export const OFFICIAL_NEON_API_BASE_URL = "https://console.neon.tech/api/v2";

export const NEON_PROVIDER_REQUEST_STAGES = [
  "PROJECT_LOOKUP",
  "ENDPOINT_LOOKUP",
  "BRANCH_LOOKUP",
  "DATABASE_LOOKUP",
] as const;

export type NeonProviderRequestStage = (typeof NEON_PROVIDER_REQUEST_STAGES)[number];

export interface NeonProviderFailureDetails {
  requestStage: NeonProviderRequestStage;
  resourceKind: "project" | "endpoint" | "branch" | "database";
  httpStatus: number | null;
  providerErrorCode: string;
  retryable: boolean;
}

export class NeonProviderConfigurationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown>,
  ) {
    super(message);
    this.name = "NeonProviderConfigurationError";
  }
}

const REQUEST_STAGE_RESOURCE_KIND: Record<NeonProviderRequestStage, NeonProviderFailureDetails["resourceKind"]> = {
  PROJECT_LOOKUP: "project",
  ENDPOINT_LOOKUP: "endpoint",
  BRANCH_LOOKUP: "branch",
  DATABASE_LOOKUP: "database",
};

function normalizeApiBaseUrlPath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

export function normalizeNeonApiBaseUrl(baseUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new NeonProviderConfigurationError(
      "PROVIDER_TARGET_IDENTITY_BASE_URL_INVALID",
      "Production registry bootstrap requires the official Neon API root.",
      {
        providerErrorCode: "PROVIDER_BASE_URL_INVALID",
        retryable: false,
      },
    );
  }

  const official = new URL(OFFICIAL_NEON_API_BASE_URL);

  if (parsed.protocol !== "https:") {
    throw new NeonProviderConfigurationError(
      "PROVIDER_TARGET_IDENTITY_BASE_URL_INVALID",
      "Production registry bootstrap requires the official Neon API root over HTTPS.",
      {
        providerErrorCode: "PROVIDER_BASE_URL_INVALID",
        retryable: false,
      },
    );
  }

  if (parsed.origin !== official.origin) {
    throw new NeonProviderConfigurationError(
      "PROVIDER_TARGET_IDENTITY_BASE_URL_INVALID",
      "Production registry bootstrap cannot send Neon API credentials to a non-official origin.",
      {
        providerErrorCode: "PROVIDER_BASE_URL_INVALID",
        retryable: false,
      },
    );
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new NeonProviderConfigurationError(
      "PROVIDER_TARGET_IDENTITY_BASE_URL_INVALID",
      "Production registry bootstrap requires a clean official Neon API root without credentials, query, or fragment.",
      {
        providerErrorCode: "PROVIDER_BASE_URL_INVALID",
        retryable: false,
      },
    );
  }

  if (normalizeApiBaseUrlPath(parsed.pathname) !== official.pathname) {
    throw new NeonProviderConfigurationError(
      "PROVIDER_TARGET_IDENTITY_BASE_URL_INVALID",
      "Production registry bootstrap requires the canonical Neon API path /api/v2.",
      {
        providerErrorCode: "PROVIDER_BASE_URL_INVALID",
        retryable: false,
      },
    );
  }

  return OFFICIAL_NEON_API_BASE_URL;
}

export function buildNeonApiUrl(baseUrl: string, path: string): URL {
  const canonicalBaseUrl = normalizeNeonApiBaseUrl(baseUrl);
  const normalizedPath = path.replace(/^\/+/, "");

  return new URL(normalizedPath, `${canonicalBaseUrl}/`);
}

export function describeNeonProviderHttpFailure(
  requestStage: NeonProviderRequestStage,
  httpStatus: number,
): NeonProviderFailureDetails & { code: string } {
  const resourceKind = REQUEST_STAGE_RESOURCE_KIND[requestStage];

  if (httpStatus === 401) {
    return {
      code: "PROVIDER_TARGET_IDENTITY_CREDENTIAL_INVALID",
      requestStage,
      resourceKind,
      httpStatus,
      providerErrorCode: "PROVIDER_CREDENTIAL_INVALID",
      retryable: false,
    };
  }

  if (httpStatus === 403) {
    return {
      code: "PROVIDER_TARGET_IDENTITY_ACCESS_DENIED",
      requestStage,
      resourceKind,
      httpStatus,
      providerErrorCode: "PROVIDER_ACCESS_DENIED",
      retryable: false,
    };
  }

  if (httpStatus === 404) {
    return {
      code: requestStage === "PROJECT_LOOKUP"
        ? "PROVIDER_TARGET_IDENTITY_PROJECT_NOT_FOUND"
        : requestStage === "ENDPOINT_LOOKUP"
        ? "PROVIDER_TARGET_IDENTITY_ENDPOINT_NOT_FOUND"
        : requestStage === "BRANCH_LOOKUP"
        ? "PROVIDER_TARGET_IDENTITY_BRANCH_NOT_FOUND"
        : "PROVIDER_TARGET_IDENTITY_DATABASE_NOT_FOUND",
      requestStage,
      resourceKind,
      httpStatus,
      providerErrorCode: requestStage === "PROJECT_LOOKUP"
        ? "PROVIDER_PROJECT_NOT_FOUND"
        : requestStage === "ENDPOINT_LOOKUP"
        ? "PROVIDER_ENDPOINT_NOT_FOUND"
        : requestStage === "BRANCH_LOOKUP"
        ? "PROVIDER_BRANCH_NOT_FOUND"
        : "PROVIDER_DATABASE_NOT_FOUND",
      retryable: false,
    };
  }

  if (httpStatus === 429) {
    return {
      code: "PROVIDER_TARGET_IDENTITY_RATE_LIMITED",
      requestStage,
      resourceKind,
      httpStatus,
      providerErrorCode: "PROVIDER_RATE_LIMITED",
      retryable: true,
    };
  }

  return {
    code: "PROVIDER_TARGET_IDENTITY_VERIFICATION_FAILED",
    requestStage,
    resourceKind,
    httpStatus,
    providerErrorCode: "PROVIDER_REQUEST_FAILED",
    retryable: httpStatus >= 500,
  };
}

export function describeNeonProviderNetworkFailure(
  requestStage: NeonProviderRequestStage,
): NeonProviderFailureDetails & { code: string } {
  return {
    code: "PROVIDER_TARGET_IDENTITY_NETWORK_ERROR",
    requestStage,
    resourceKind: REQUEST_STAGE_RESOURCE_KIND[requestStage],
    httpStatus: null,
    providerErrorCode: "PROVIDER_NETWORK_ERROR",
    retryable: true,
  };
}

export function describeNeonProviderMalformedResponse(
  requestStage: NeonProviderRequestStage,
): NeonProviderFailureDetails & { code: string } {
  return {
    code: "PROVIDER_TARGET_IDENTITY_MALFORMED_RESPONSE",
    requestStage,
    resourceKind: REQUEST_STAGE_RESOURCE_KIND[requestStage],
    httpStatus: 200,
    providerErrorCode: "PROVIDER_RESPONSE_INVALID",
    retryable: false,
  };
}