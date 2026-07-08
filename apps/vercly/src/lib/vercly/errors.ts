export type VerclyProviderErrorCode =
  | "VERCLY_CONFIG_ERROR"
  | "VERCLY_AUTH_ERROR"
  | "VERCLY_REFRESH_ERROR"
  | "VERCLY_HTTP_ERROR"
  | "VERCLY_INVALID_RESPONSE";

export class VerclyProviderError extends Error {
  code: VerclyProviderErrorCode;
  endpoint: string;
  httpStatus: number | null;
  correlationId: string | null;
  retryable: boolean;

  constructor(options: {
    message: string;
    code: VerclyProviderErrorCode;
    endpoint: string;
    httpStatus?: number | null;
    correlationId?: string | null;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "VerclyProviderError";
    this.code = options.code;
    this.endpoint = options.endpoint;
    this.httpStatus = options.httpStatus ?? null;
    this.correlationId = options.correlationId ?? null;
    this.retryable = options.retryable ?? false;
  }
}

export function toVerclyProviderError(
  error: unknown,
  fallback: Omit<ConstructorParameters<typeof VerclyProviderError>[0], "message"> & {
    message?: string;
  },
) {
  if (error instanceof VerclyProviderError) {
    return error;
  }

  return new VerclyProviderError({
    ...fallback,
    message: fallback.message ?? "Unexpected Vercly provider error.",
    cause: error,
  });
}