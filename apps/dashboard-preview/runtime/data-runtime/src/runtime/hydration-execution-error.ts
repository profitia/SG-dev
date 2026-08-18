import type { PipelineStageName } from "./execution-context.ts";

const MAX_PERSISTED_ERROR_LENGTH = 320;
const PRIVATE_KEY_BLOCK_PATTERN = /-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/gi;
const AUTHORIZATION_HEADER_PATTERN = /(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+/gi;
const BEARER_TOKEN_PATTERN = /\bbearer\s+[a-z0-9._~+/=-]+/gi;
const URL_WITH_CREDENTIALS_PATTERN = /\b([a-z][a-z0-9+.-]*:\/\/)(?:[^\s/@:]+)(?::[^\s/@]*)?@[^\s/]+[^\s]*/gi;
const GENERIC_URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s]+/gi;
const PASSWORD_FRAGMENT_PATTERN = /((?:[a-z0-9_\-]*_)?(?:password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|username|user|host|account)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const HOST_PATTERN = /\b(?:[a-z0-9-]+\.)+(?:[a-z]{2,}|invalid|local)\b/gi;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]+/g;
const MULTI_WHITESPACE_PATTERN = /\s+/g;

export interface NormalizedHydrationExecutionError {
  code: "HYDRATION_STAGE_FAILED";
  errorClass: string;
  failedStage: PipelineStageName | "unknown";
  sanitizedMessage: string;
  recoverability: "retryable" | "manual";
}

export class HydrationFailureFinalizationError extends Error {
  readonly code = "FAILURE_FINALIZATION_FAILED";

  constructor(
    readonly originalError: unknown,
    readonly finalizationError: unknown,
    failedStage: PipelineStageName | null,
  ) {
    super(`FAILURE_FINALIZATION_FAILED: unable to durably finalize hydration failure for stage "${failedStage ?? "unknown"}".`);
    this.name = "HydrationFailureFinalizationError";
  }
}

export function createFailureFinalizationError(
  originalError: unknown,
  finalizationError: unknown,
  failedStage: PipelineStageName | null,
): HydrationFailureFinalizationError {
  return new HydrationFailureFinalizationError(originalError, finalizationError, failedStage);
}

export function normalizeHydrationExecutionError(
  error: unknown,
  failedStage: PipelineStageName | null,
): NormalizedHydrationExecutionError {
  const rawMessage = extractErrorMessage(error);
  const sanitizedMessage = sanitizeHydrationError(rawMessage);

  return {
    code: "HYDRATION_STAGE_FAILED",
    errorClass: extractErrorClass(error),
    failedStage: failedStage ?? "unknown",
    sanitizedMessage,
    recoverability: isRetryableHydrationError(rawMessage) ? "retryable" : "manual",
  };
}

export function sanitizeHydrationError(value: string): string {
  const normalized = value
    .replace(PRIVATE_KEY_BLOCK_PATTERN, "[REDACTED_PRIVATE_KEY]")
    .replace(AUTHORIZATION_HEADER_PATTERN, "$1[REDACTED_AUTHORIZATION]")
    .replace(BEARER_TOKEN_PATTERN, "Bearer [REDACTED_TOKEN]")
    .replace(URL_WITH_CREDENTIALS_PATTERN, "$1[REDACTED_CREDENTIALS]@[REDACTED_HOST]")
    .replace(GENERIC_URL_PATTERN, "[REDACTED_URL]")
    .replace(PASSWORD_FRAGMENT_PATTERN, "$1[REDACTED]")
    .replace(HOST_PATTERN, "[REDACTED_HOST]")
    .replace(CONTROL_CHARACTER_PATTERN, " ")
    .replace(MULTI_WHITESPACE_PATTERN, " ")
    .trim();

  if (normalized.length <= MAX_PERSISTED_ERROR_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_PERSISTED_ERROR_LENGTH - 3)}...`;
}

export function formatPersistedHydrationFailureMessage(error: NormalizedHydrationExecutionError): string {
  return `[${error.code}] stage=${error.failedStage} class=${error.errorClass} recoverability=${error.recoverability} message=${error.sanitizedMessage}`;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Hydration execution failed.";
}

function extractErrorClass(error: unknown): string {
  if (error instanceof Error && error.name.trim().length > 0) {
    return error.name;
  }

  if (typeof error === "object" && error !== null) {
    return "Object";
  }

  return typeof error;
}

function isRetryableHydrationError(message: string): boolean {
  return /timeout|timed out|temporary|temporarily|network|econn|connection reset|fetch failed|unavailable/i.test(message);
}