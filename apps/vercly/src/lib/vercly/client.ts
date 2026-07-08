import { clearVerclyTokenCache, getVerclyAccessToken } from "./auth";
import { assertVerclyBaseConfig } from "./config";
import { VerclyProviderError, toVerclyProviderError } from "./errors";
import { logVerclyTechnicalEvent } from "./logging";
import {
  mapStartVerificationResult,
  mapVerificationReportResult,
} from "./mapping";
import type {
  VerclyVerificationReportResult,
  VerclyVerificationRequest,
  VerclyVerificationStartResult,
} from "./types";

type RequestOptions = {
  endpoint: string;
  method: "GET" | "POST";
  correlationId?: string;
  body?: unknown;
};

async function requestVercly<T>(options: RequestOptions): Promise<T> {
  const config = assertVerclyBaseConfig();

  const execute = async (forceRefresh: boolean) => {
    const accessToken = await getVerclyAccessToken(forceRefresh);
    const response = await fetch(`${config.apiBaseUrl}${options.endpoint}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });

    if (response.status === 401 && !forceRefresh) {
      clearVerclyTokenCache();
      return execute(true);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new VerclyProviderError({
        code: "VERCLY_HTTP_ERROR",
        endpoint: options.endpoint,
        httpStatus: response.status,
        correlationId: options.correlationId ?? null,
        retryable: response.status >= 500 || response.status === 401,
        message: `Vercly request failed with status ${response.status}. ${errorText}`,
      });
    }

    logVerclyTechnicalEvent({
      event: "request_success",
      endpoint: options.endpoint,
      httpStatus: response.status,
      correlationId: options.correlationId ?? null,
    });

    return (await response.json()) as T;
  };

  try {
    return await execute(false);
  } catch (error) {
    const providerError = toVerclyProviderError(error, {
      code: "VERCLY_HTTP_ERROR",
      endpoint: options.endpoint,
      correlationId: options.correlationId ?? null,
      message: "Vercly request failed.",
    });

    logVerclyTechnicalEvent({
      event: "request_error",
      endpoint: providerError.endpoint,
      httpStatus: providerError.httpStatus,
      correlationId: providerError.correlationId,
      message: providerError.message,
    });

    throw providerError;
  }
}

export async function startVerification(
  request: VerclyVerificationRequest,
): Promise<VerclyVerificationStartResult> {
  const payload = await requestVercly<unknown>({
    endpoint: "/api/verifications",
    method: "POST",
    body: [request],
  });

  return mapStartVerificationResult(payload);
}

export async function getVerificationReport(
  correlationId: string,
): Promise<VerclyVerificationReportResult> {
  const payload = await requestVercly<unknown>({
    endpoint: `/api/verifications/${correlationId}`,
    method: "GET",
    correlationId,
  });

  return mapVerificationReportResult(payload, correlationId);
}

export function createVerclyClient() {
  return {
    startVerification,
    getVerificationReport,
  };
}