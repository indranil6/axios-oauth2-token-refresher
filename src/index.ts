import { jwtDecode } from "./jwt-decode";

export enum Storages {
  localStorage = "localStorage",
  sessionStorage = "sessionStorage",
  cookie = "cookie",
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
}

export interface AxiosInstanceOptions {
  axios: any; // Add this line to accept axios instance
  axiosConfig?: any;
  baseURL: string;
  accessTokenStorage: Storages;
  refreshTokenStorage: Storages;
  accessTokenStorageKey: string;
  refreshTokenStorageKey: string;
  accessTokenRefresherEndpoint: string;
  isBearer?: boolean;
  tokenRefresherPayloadGenerator?: (token: string) => any;
  accessTokenGetterFnFromRefresherResponse?: (response: any) => string;
  refreshTokenGetterFnFromRefresherResponse?: (response: any) => string;
}

export class AxiosInstance {
  private axiosInstance: any;
  private accessToken: string | null;
  private axiosConfig: any;
  private refreshExpiredToken: () => Promise<string>;

  constructor(private options: AxiosInstanceOptions) {
    this.accessToken = this.getStorage(
      this.options.accessTokenStorage,
      this.options.accessTokenStorageKey,
      ""
    );

    this.axiosConfig = options.axiosConfig || {
      headers: {},
    };
    this.axiosInstance = this.options.axios.create({
      ...this.axiosConfig,
      baseURL: options.baseURL,
      headers: {
        ...(this.axiosConfig?.headers || {}),
        Authorization: this.options.isBearer
          ? `Bearer ${this.accessToken || ""}`
          : this.accessToken || "",
      },
    });

    this.refreshExpiredToken = this.refreshExpiredTokenClosure();
    this.setupInterceptors();
  }

  private getStorage(
    storage: Storages,
    key: string,
    defaultValue: string
  ): string {
    switch (storage) {
      case Storages.localStorage:
        return localStorage.getItem(key) || defaultValue;
      case Storages.sessionStorage:
        return sessionStorage.getItem(key) || defaultValue;
      case Storages.cookie:
        return this.getCookieValue(key) || defaultValue;
      default:
        return defaultValue;
    }
  }

  private setStorage(storage: Storages, key: string, value: string): void {
    switch (storage) {
      case Storages.localStorage:
        localStorage.setItem(key, value);
        break;
      case Storages.sessionStorage:
        sessionStorage.setItem(key, value);
        break;
      case Storages.cookie:
        document.cookie = `${key}=${value}`;
        break;
    }
  }

  private getCookieValue(name: string): string {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return cookie.substring(nameEQ.length, cookie.length);
      }
    }
    return "";
  }

  private clearStorage(): void {
    this.setStorage(
      this.options.accessTokenStorage,
      this.options.accessTokenStorageKey,
      ""
    );
    this.setStorage(
      this.options.refreshTokenStorage,
      this.options.refreshTokenStorageKey,
      ""
    );
  }

  private async obtainNewAccessToken(): Promise<TokenResponse> {
    if (!this.options.accessTokenRefresherEndpoint) {
      throw new Error("accessTokenRefresherEndpoint must be provided");
    }

    try {
      let refreshToken = this.getStorage(
        this.options.refreshTokenStorage,
        this.options.refreshTokenStorageKey,
        ""
      );
      const response = await this.options.axios.post(
        this.options.accessTokenRefresherEndpoint?.startsWith("http")
          ? this.options.accessTokenRefresherEndpoint
          : `${this.options.baseURL}${this.options.accessTokenRefresherEndpoint}`,
        this.options.tokenRefresherPayloadGenerator
          ? this.options.tokenRefresherPayloadGenerator(refreshToken || "")
          : {
              token: refreshToken,
            }
      );

      if (response.status === 200) {
        const foundAccessToken = this.options
          .accessTokenGetterFnFromRefresherResponse
          ? this.options.accessTokenGetterFnFromRefresherResponse(response)
          : response.data.accessToken;

        this.setStorage(
          this.options.accessTokenStorage,
          this.options.accessTokenStorageKey,
          foundAccessToken
        );

        const foundRefreshToken = this.options
          .refreshTokenGetterFnFromRefresherResponse
          ? this.options.refreshTokenGetterFnFromRefresherResponse(response)
          : response.data.refreshToken;

        if (foundRefreshToken) {
          this.setStorage(
            this.options.refreshTokenStorage,
            this.options.refreshTokenStorageKey,
            foundRefreshToken
          );
        }

        return {
          accessToken: foundAccessToken || "",
          refreshToken: foundRefreshToken || "",
        };
      }
    } catch (error) {
      console.error("Error obtaining new access token:", error);
      this.clearStorage();
      throw new Error("Something went wrong while refreshing access token");
    }

    throw new Error("Unable to obtain new access token");
  }

  private refreshExpiredTokenClosure() {
    let isCalled = false;
    let runningPromise: Promise<string> | undefined = undefined;

    return () => {
      if (isCalled && runningPromise) {
        return runningPromise;
      } else {
        isCalled = true;
        runningPromise = this.obtainNewAccessToken()
          .then((tokenResponse) => {
            this.setStorage(
              this.options.accessTokenStorage,
              this.options.accessTokenStorageKey,
              tokenResponse.accessToken
            );

            if (tokenResponse.refreshToken) {
              this.setStorage(
                this.options.refreshTokenStorage,
                this.options.refreshTokenStorageKey,
                tokenResponse.refreshToken
              );
            }

            return tokenResponse.accessToken;
          })
          .finally(() => {
            isCalled = false;
            runningPromise = undefined;
          });
        return runningPromise;
      }
    };
  }

  private setupInterceptors() {
    this.axiosInstance.interceptors.request.use(
      async (req: any) => {
        this.accessToken = this.getStorage(
          this.options.accessTokenStorage,
          this.options.accessTokenStorageKey,
          ""
        );
        req.headers = req.headers || {};
        req.headers.Authorization = this.options.isBearer
          ? `Bearer ${this.accessToken || ""}`
          : this.accessToken || "";

        const decodedToken: { exp: number } = jwtDecode(
          this.accessToken as string
        );
        const isExpired = new Date(decodedToken.exp * 1000) < new Date();

        if (isExpired) {
          const updatedToken = await this.refreshExpiredToken();
          req.headers.Authorization = this.options.isBearer
            ? `Bearer ${updatedToken}`
            : updatedToken;
        }

        return req;
      },
      (error: any) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response: any) => response,
      async (error: any) => {
        const originalRequest = error.config;

        if (
          error?.response?.status === 401 &&
          originalRequest.url === this.options.accessTokenRefresherEndpoint
        ) {
          this.clearStorage();
          return Promise.reject(error);
        }

        if (error?.response?.status === 401) {
          const updatedToken = await this.refreshExpiredToken();
          originalRequest.headers.Authorization = this.options.isBearer
            ? `Bearer ${updatedToken}`
            : updatedToken;
          return this.axiosInstance(originalRequest);
        }

        return Promise.reject(error);
      }
    );
  }

  public getAxiosInstance(): any {
    return this.axiosInstance;
  }
}
