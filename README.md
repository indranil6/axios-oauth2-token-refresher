# axios-oauth-token-refresher

`axios-oauth2-token-refresher` is a utility library for managing OAuth2 tokens with automatic refreshing capabilities in Axios-based applications. It provides an easy way to handle access token expiration and refreshing seamlessly.

## Introduction

### How OAuth Token Refreshing Works

OAuth2 token refreshing is a crucial mechanism in modern web applications that use OAuth2 for authentication. Access tokens, which grant access to protected resources, have a limited lifespan to enhance security. When an access token expires, the application can use a refresh token to obtain a new access token from the authorization server without requiring the user to re-enter their credentials.

### What is an Access Token and a Refresh Token?

- `Access Token`: A credential that grants access to specific resources. It typically has a short lifespan (e.g., minutes to hours) for security reasons.
- `Refresh Token`: A credential used to obtain a new access token when the current access token expires. Refresh tokens have a longer lifespan (e.g., days to weeks) and are securely stored by the client application.

### Challenges with Manual Token Management

Manually managing token expiration and refreshing in web applications can be complex and error-prone. Developers often implement Axios interceptors to automatically refresh tokens when they expire. However, this approach can lead to issues such as:

- <b>Token Synchronization</b>: Multiple simultaneous API requests triggering multiple refresh token calls.
- <b>Performance Overhead</b>: Redundant token refresh calls impacting application performance.
- <b>Maintenance Complexity</b>: Increased code complexity and potential for bugs.

### Axios OAuth2 Token Refresher: Simplifying Token Management

Axios OAuth2 Token Refresher addresses these challenges by providing a robust solution for automating OAuth2 token refreshing with Axios. It optimizes token refresh operations by:

- <b>Single Token Refresh Call</b>: Ensures that only one token refresh request is made at a time, preventing multiple simultaneous refresh operations.
- <b>Efficient Token Handling</b>: Minimizes performance overhead associated with token expiration and refreshing.
- <b>Simplified Integration</b>: Offers a straightforward API for integrating token management with Axios, reducing development complexity and maintenance efforts.

### Why Use Axios OAuth2 Token Refresher?

- <b>Enhanced Security</b>: Ensures continuous access to protected resources without compromising security through streamlined token management.
- <b>Improved User Experience</b>: Maintains seamless user sessions by automatically refreshing tokens in the background, minimizing interruptions.
- <b>Developer Efficiency</b>: Reduces development time and effort by providing a reliable solution for OAuth2 token management in Axios-based applications.

## Installation

Install the package using npm:

```bash
npm install axios-oauth2-token-refresher
```

Since axios is a peer dependency, you need to install it separately if you haven't already:

```bash
npm install axios
```

or using yarn

```bash
yarn add axios-oauth2-token-refresher
yarn add axios
```

## Usage

To use `axios-oauth2-token-refresher`, you need to create an instance of the AxiosInstance class with the appropriate configuration options.

```jsx
import axios, { AxiosResponse } from "axios";
import {
  AxiosInstance,
  AxiosInstanceOptions,
  Storages,
} from "axios-oauth2-token-refresher";

const config: AxiosInstanceOptions = {
  axios, // Pass the axios instance
  baseURL: "http://localhost:5000",
  accessTokenStorage: Storages.localStorage,
  refreshTokenStorage: Storages.localStorage,
  accessTokenStorageKey: "accessToken",
  refreshTokenStorageKey: "refreshToken",
  accessTokenRefresherEndpoint: "/token",
  tokenRefresherPayloadGenerator: (token: string) => ({ refresh_token: token }),
  accessTokenGetterFnFromRefresherResponse: (response: AxiosResponse) =>
    response.data.access_token,
  refreshTokenGetterFnFromRefresherResponse: (response: AxiosResponse) =>
    response.data.refresh_token,
};

const axiosInstance = new AxiosInstance(config).getAxiosInstance();

// Use the axiosInstance for making API requests
axiosInstance
  .get("/protected-resource")
  .then((response: AxiosResponse) => console.log(response.data))
  .catch((error: any) =>
    console.error("Error fetching protected resource:", error)
  );
```

## Configuration Options

### AxiosInstanceOptions

- `axios`: The Axios instance to be used. This is required.

- `baseURL`: The base URL for your API requests. This is required.

- `accessTokenStorage`: The storage type for the access token. It can be `Storages.localStorage`, `Storages.sessionStorage`, or `Storages.cookie`. This is required.

- `refreshTokenStorage`: The storage type for the refresh token. It can be `Storages.localStorage`, `Storages.sessionStorage`, or `Storages.cookie`. This is required.

- `accessTokenStorageKey`: The key used to store the access token. This is required.

- `refreshTokenStorageKey`: The key used to store the refresh token. This is required.

- `accessTokenRefresherEndpoint`: The endpoint to refresh the access token. This is required.

- `tokenRefresherPayloadGenerator`: A function that generates the payload for the token refresher endpoint. This is optional. If not provided, the default payload will be `{ token: refreshToken }`.

- `accessTokenGetterFnFromRefresherResponse`: A function that extracts the access token from the token refresher response. This is optional. If not provided, the default getter will assume the response contains `response.data.accessToken`.

- `refreshTokenGetterFnFromRefresherResponse`: A function that extracts the refresh token from the token refresher response. This is optional. If not provided, the default getter will assume the response contains `response.data.refreshToken`.

## Methods

### `getAxiosInstance()`

Returns the configured Axios instance with interceptors for handling token refresh.

## Storages Enum

- `localStorage`: Use the browser's localStorage to store tokens.
- `sessionStorage`: Use the browser's sessionStorage to store tokens.
- `cookie`: Use browser cookies to store tokens.

## Detailed Explanation of Each Property

### `axios`

The Axios instance that will be used for making HTTP requests. This instance will have interceptors attached to handle token refresh.

### `baseURL`

The base URL for the API requests. All requests made using the Axios instance will be relative to this URL.

### `accessTokenStorage`

The storage type for the access token. This can be one of the following values from the Storages enum:

- `localStorage`: Stores the access token in the browser's localStorage.
- `sessionStorage`: Stores the access token in the browser's sessionStorage.
- `cookie`: Stores the access token in a browser cookie.

### `refreshTokenStorage`

The storage type for the refresh token. This can be one of the following values from the Storages enum:

- `localStorage`: Stores the access token in the browser's localStorage.
- `sessionStorage`: Stores the access token in the browser's sessionStorage.
- `cookie`: Stores the access token in a browser cookie.
  accessTokenStorageKey
  The key used to store the access token in the chosen storage.

### `refreshTokenStorageKey`

The key used to store the refresh token in the chosen storage.

### `accessTokenRefresherEndpoint`

The endpoint to call to refresh the access token. This should be a relative path from the baseURL or an absolute URL.

### `tokenRefresherPayloadGenerator`

A function that generates the payload for the token refresher endpoint. This function takes the current refresh token as an argument and returns the payload to be sent in the refresh request.

### `accessTokenGetterFnFromRefresherResponse`

A function that extracts the access token from the token refresher response. This function takes the response data as an argument and returns the access token.

### `refreshTokenGetterFnFromRefresherResponse`

A function that extracts the refresh token from the token refresher response. This function takes the response data as an argument and returns the refresh token.

## License

This project is licensed under the MIT License.
