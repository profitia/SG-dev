import type {
  VerclyVerificationReport,
  VerclyVerificationReportResult,
  VerclyVerificationStartResult,
} from "./types";
import { VerclyProviderError } from "./errors";

export function mapStartVerificationResult(
  payload: unknown,
): VerclyVerificationStartResult {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new VerclyProviderError({
      code: "VERCLY_INVALID_RESPONSE",
      endpoint: "/api/verifications",
      message: "Vercly start verification response did not return a CorrelationId array.",
    });
  }

  const rawCorrelationIds = payload.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  if (rawCorrelationIds.length === 0) {
    throw new VerclyProviderError({
      code: "VERCLY_INVALID_RESPONSE",
      endpoint: "/api/verifications",
      message: "Vercly start verification response did not include a usable CorrelationId.",
    });
  }

  return {
    correlationId: rawCorrelationIds[0],
    rawCorrelationIds,
  };
}

export function mapVerificationReportResult(
  payload: unknown,
  correlationId: string,
): VerclyVerificationReportResult {
  if (!Array.isArray(payload)) {
    throw new VerclyProviderError({
      code: "VERCLY_INVALID_RESPONSE",
      endpoint: `/api/verifications/${correlationId}`,
      message: "Vercly verification report response was not an array.",
      correlationId,
    });
  }

  const reports = payload as VerclyVerificationReport[];
  const firstReport = reports[0];
  const errors = firstReport?.Body?.Errors ?? [];

  return {
    reports,
    summary: {
      correlationId: firstReport?.Header?.CorrelationId ?? correlationId,
      reportId: firstReport?.Header?.Id ?? null,
      isComplete: Boolean(firstReport?.Body?.IsComplete),
      queriedRegisters: firstReport?.Body?.QueriedRegisters ?? [],
      warningCount: errors.filter((error) => error?.Severity === 1).length,
      fatalErrorCount: errors.filter((error) => error?.Severity === 2).length,
      stateAsOfDate: firstReport?.Body?.StateAsOfDate ?? null,
    },
  };
}