import {
  assertVerclyCredentials,
  getVerclyAdapterConfig,
} from "./config";
import { VerclyProviderError, toVerclyProviderError } from "./errors";
import { logVerclyTechnicalEvent } from "./logging";
import type {
  VerclyAuthTokens,
  VerclyLoginResponse,
  VerclyRefreshResponse,
} from "./types";

const ACCESS_TOKEN_TTL_MS = 55 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

let cachedTokens: VerclyAuthTokens | null = null;

function encodeBasicAuth(username: string, password: string) {
  return Buffer.from(`${username}:${password}`).toString("base64");
}

function isAccessTokenValid(tokens: VerclyAuthTokens | null) {
  return Boolean(tokens && Date.now() < tokens.accessTokenExpiresAt);
}

function isRefreshTokenValid(tokens: VerclyAuthTokens | null) {
  return Boolean(tokens && Date.now() < tokens.refreshTokenExpiresAt);
}

export function clearVerclyTokenCache() {
  cachedTokens = null;
}

export async function loginToVercly() {
  const config = assertVerclyCredentials();
  const username = config.username!;
  const password = config.password!;
  const endpoint = `${config.apiBaseUrl}/api/login`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodeBasicAuth(username, password)}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new VerclyProviderError({
        code: "VERCLY_AUTH_ERROR",
        endpoint: "/api/login",
        httpStatus: response.status,
        retryable: response.status >= 500,
        message: `Vercly login failed with status ${response.status}.`,
      });
    }

    const payload = (await response.json()) as VerclyLoginResponse;

    if (!payload.AccessToken || !payload.RefreshToken) {
      throw new VerclyProviderError({
        code: "VERCLY_INVALID_RESPONSE",
        endpoint: "/api/login",
        httpStatus: response.status,
        message: "Vercly login response did not include both access and refresh tokens.",
      });
    }

    cachedTokens = {
      accessToken: payload.AccessToken,
      refreshToken: payload.RefreshToken,
      accessTokenExpiresAt: Date.now() + ACCESS_TOKEN_TTL_MS,
      refreshTokenExpiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
    };

    logVerclyTechnicalEvent({
      event: "login_success",
      endpoint: "/api/login",
      httpStatus: response.status,
    });

    return cachedTokens;
  } catch (error) {
    throw toVerclyProviderError(error, {
      code: "VERCLY_AUTH_ERROR",
      endpoint: "/api/login",
      message: "Vercly login failed.",
    });
  }
}

export async function refreshVerclyAccessToken(refreshToken: string) {
  const config = assertVerclyCredentials();
  const endpoint = `${config.apiBaseUrl}/api/tokens`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new VerclyProviderError({
        code: "VERCLY_REFRESH_ERROR",
        endpoint: "/api/tokens",
        httpStatus: response.status,
        retryable: response.status >= 500,
        message: `Vercly token refresh failed with status ${response.status}.`,
      });
    }

    const payload = (await response.json()) as VerclyRefreshResponse;

    if (!payload.AccessToken) {
      throw new VerclyProviderError({
        code: "VERCLY_INVALID_RESPONSE",
        endpoint: "/api/tokens",
        httpStatus: response.status,
        message: "Vercly refresh response did not include a new access token.",
      });
    }

    cachedTokens = {
      accessToken: payload.AccessToken,
      refreshToken,
      accessTokenExpiresAt: Date.now() + ACCESS_TOKEN_TTL_MS,
      refreshTokenExpiresAt:
        cachedTokens?.refreshToken === refreshToken
          ? cachedTokens.refreshTokenExpiresAt
          : Date.now() + REFRESH_TOKEN_TTL_MS,
    };

    logVerclyTechnicalEvent({
      event: "refresh_success",
      endpoint: "/api/tokens",
      httpStatus: response.status,
    });

    return cachedTokens;
  } catch (error) {
    throw toVerclyProviderError(error, {
      code: "VERCLY_REFRESH_ERROR",
      endpoint: "/api/tokens",
      message: "Vercly token refresh failed.",
    });
  }
}

export async function getVerclyAccessToken(forceRefresh = false) {
  getVerclyAdapterConfig();

  if (!forceRefresh && isAccessTokenValid(cachedTokens)) {
    return cachedTokens!.accessToken;
  }

  if (isRefreshTokenValid(cachedTokens)) {
    const refreshed = await refreshVerclyAccessToken(cachedTokens!.refreshToken);
    return refreshed.accessToken;
  }

  const session = await loginToVercly();
  return session.accessToken;
}