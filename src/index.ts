import axios, {
  AxiosInstance as AxiosInstanceType,
  InternalAxiosRequestConfig,
} from "axios";
import { jwtDecode } from "./jwt-decode";

enum Storages {
  localStorage = "localStorage",
  sessionStorage = "sessionStorage",
  cookie = "cookie",
}
interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
}

interface AxiosInstanceOptions {
  baseURL: string;
  accessTokenStorage: Storages;
  refreshTokenStorage: Storages;
  accessTokenStorageKey: string;
  refreshTokenStorageKey: string;
  accessTokenRefresherEndpoint: string;
  accessTokenGetterFnFromRefresherResponse?: (
    response: TokenResponse
  ) => string;
  refreshTokenGetterFnFromRefresherResponse?: (
    response: TokenResponse
  ) => string;
}

export class AxiosInstance {
  private axiosInstance: AxiosInstanceType;
  private accessToken: string | null;
  private refreshExpiredToken: () => Promise<string>;

  constructor(private options: AxiosInstanceOptions) {
    this.accessToken = this.getStorage(
      this.options.accessTokenStorage,
      this.options.accessTokenStorageKey,
      ""
    );
    this.axiosInstance = axios.create({
      baseURL: options.baseURL,
      headers: {
        Authorization: this.accessToken || "",
      },
    });

    this.refreshExpiredToken = this.refreshExpiredTokenClosure();
    this.setupInterceptors();
  }

  private getStorage(
    storage: string,
    key: string,
    defaultValue: string
  ): string {
    if (storage === Storages.localStorage) {
      return localStorage.getItem(key) || defaultValue;
    } else if (storage === Storages.sessionStorage) {
      return sessionStorage.getItem(key) || defaultValue;
    } else if (storage === Storages.cookie) {
      return this.getCookieValue(key) || defaultValue;
    } else {
      return "";
    }
  }

  private setStorage(storage: string, key: string, value: string): void {
    if (storage === Storages.localStorage) {
      localStorage.setItem(key, value);
    } else if (storage === Storages.sessionStorage) {
      sessionStorage.setItem(key, value);
    } else if (storage === Storages.cookie) {
      document.cookie = `${key}=${value}`;
    }
  }

  private getCookieValue(name: string): string {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(";");

    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i].trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return cookie.substring(nameEQ.length, cookie.length);
      }
    }

    return "";
  }

  clearStorage() {
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
      const response = await axios.post(
        this.options.accessTokenRefresherEndpoint,
        {
          token: this.getStorage(
            this.options.refreshTokenStorage,
            this.options.refreshTokenStorageKey,
            ""
          ),
        }
      );

      if (response.status === 200) {
        let foundAccessToken = this.options
          .accessTokenGetterFnFromRefresherResponse
          ? this.options.accessTokenGetterFnFromRefresherResponse(response.data)
          : response.data.accessToken;
        this.setStorage(
          this.options.accessTokenStorage,
          this.options.accessTokenStorageKey,
          foundAccessToken
        );

        let foundRefreshToken = this.options
          .refreshTokenGetterFnFromRefresherResponse
          ? this.options.refreshTokenGetterFnFromRefresherResponse(
              response.data
            )
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
      this.clearStorage();
      throw new Error("Something went wrong while refreshing access token");
    }

    throw new Error("Unable to obtain new access token");
  }

  private refreshExpiredTokenClosure() {
    let isCalled = false;
    let runningPromise: Promise<string> | undefined = undefined;

    return () => {
      if (isCalled) {
        return runningPromise!;
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
      async (req: InternalAxiosRequestConfig) => {
        this.accessToken = this.getStorage(
          this.options.accessTokenStorage,
          this.options.accessTokenStorageKey,
          ""
        );
        req.headers = req.headers || {};
        req.headers.Authorization = this.accessToken || "";

        const decodedToken: { exp: number } = jwtDecode(
          this.accessToken as string
        );
        const isExpired = new Date(decodedToken.exp * 1000) < new Date();

        if (isExpired) {
          const updatedToken = await this.refreshExpiredToken();
          req.headers.Authorization = updatedToken;
          return req;
        }

        return req;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
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
          originalRequest.headers.Authorization = updatedToken;
          return this.axiosInstance(originalRequest);
        }

        return Promise.reject(error);
      }
    );
  }

  public getAxiosInstance(): AxiosInstanceType {
    return this.axiosInstance;
  }
}
