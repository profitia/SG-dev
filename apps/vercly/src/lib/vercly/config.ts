import type { VerclyAdapterConfig } from "./types";
import { VerclyProviderError } from "./errors";

function parsePositiveNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getVerclyAdapterConfig(): VerclyAdapterConfig {
  return {
    apiBaseUrl: process.env.VERCLY_API_BASE_URL?.trim().replace(/\/$/, "") || "",
    username: process.env.VERCLY_API_USERNAME?.trim() || null,
    password: process.env.VERCLY_API_PASSWORD?.trim() || null,
    pollIntervalMs: parsePositiveNumber(process.env.VERCLY_POLL_INTERVAL_MS, 3000),
    pollTimeoutMs: parsePositiveNumber(process.env.VERCLY_POLL_TIMEOUT_MS, 60000),
    defaultCountry: process.env.VERCLY_DEFAULT_COUNTRY?.trim() || "PL",
  };
}

export function assertVerclyBaseConfig() {
  const config = getVerclyAdapterConfig();

  if (!config.apiBaseUrl) {
    throw new VerclyProviderError({
      code: "VERCLY_CONFIG_ERROR",
      endpoint: "config",
      message: "VERCLY_API_BASE_URL is required.",
    });
  }

  return config;
}

export function assertVerclyCredentials() {
  const config = assertVerclyBaseConfig();

  if (!config.username || !config.password) {
    throw new VerclyProviderError({
      code: "VERCLY_CONFIG_ERROR",
      endpoint: "/api/login",
      message: "VERCLY_API_USERNAME and VERCLY_API_PASSWORD are required.",
    });
  }

  return config;
}

export function getVerclyReadiness() {
  const config = getVerclyAdapterConfig();
  const missing = [
    !config.apiBaseUrl ? "VERCLY_API_BASE_URL" : null,
    !config.username ? "VERCLY_API_USERNAME" : null,
    !config.password ? "VERCLY_API_PASSWORD" : null,
  ].filter((value): value is string => value !== null);

  return {
    configured: missing.length === 0,
    missing,
    pollIntervalMs: config.pollIntervalMs,
    pollTimeoutMs: config.pollTimeoutMs,
    defaultCountry: config.defaultCountry,
    apiBaseUrl: config.apiBaseUrl || null,
  };
}