import { CompanyVerificationStatus, Prisma } from "@prisma/client";

import { getVerclyAdapterConfig } from "@/lib/vercly/config";
import { VerclyProviderError } from "@/lib/vercly/errors";
import {
  getVerificationReport,
  startVerification,
} from "@/lib/vercly/client";

import { isTerminalCompanyVerificationStatus } from "../model/status";
import type {
  CompanyVerificationAggregate,
  LocalVerificationOperationError,
  LocalVerificationPollResult,
  LocalVerificationStartResult,
  StartLocalVerificationInput,
} from "../model/types";
import {
  appendCompanyVerificationPayload,
  createCompanyVerification,
  getCompanyVerificationById,
  updateCompanyVerification,
} from "./repository";

function logVerificationOrchestration(event: string, data: Record<string, unknown>) {
  console.info("[vercly-orchestration]", {
    event,
    ...data,
  });
}

function mapProviderError(error: unknown): LocalVerificationOperationError {
  if (error instanceof VerclyProviderError) {
    return {
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
    };
  }

  return {
    code: "VERIFICATION_ORCHESTRATION_ERROR",
    message: error instanceof Error ? error.message : "Unknown verification orchestration error.",
    httpStatus: null,
  };
}

function toStartRouteRequest(input: StartLocalVerificationInput) {
  const config = getVerclyAdapterConfig();
  const country = input.country?.trim() || config.defaultCountry;

  return {
    Id: input.inputId,
    Country: country,
    Name: input.inputName,
  };
}

function buildPollResult(
  aggregate: CompanyVerificationAggregate,
  error: LocalVerificationOperationError | null,
): LocalVerificationPollResult {
  return {
    verificationId: aggregate.id,
    providerCorrelationId: aggregate.providerCorrelationId,
    status: aggregate.status,
    isComplete: aggregate.isComplete,
    errorCount: aggregate.errorCount,
    fatalErrorCount: aggregate.fatalErrorCount,
    error,
  };
}

export async function startLocalVerification(
  input: StartLocalVerificationInput,
): Promise<LocalVerificationStartResult> {
  const verification = await createCompanyVerification({
    orgId: input.orgId,
    requestedByUserId: input.requestedByUserId,
    inputId: input.inputId,
    inputName: input.inputName,
    country: input.country?.trim() || getVerclyAdapterConfig().defaultCountry,
    selectedSectionsJson: input.selectedSectionsJson,
    status: "PENDING",
    isComplete: false,
  });

  try {
    const startResult = await startVerification(toStartRouteRequest(input));

    await updateCompanyVerification(verification.id, {
      providerCorrelationId: startResult.correlationId,
      status: CompanyVerificationStatus.PROCESSING,
      isComplete: false,
      completedAt: null,
    });

    logVerificationOrchestration("start_success", {
      verificationId: verification.id,
      providerCorrelationId: startResult.correlationId,
      status: "PROCESSING",
    });

    return {
      verificationId: verification.id,
      providerCorrelationId: startResult.correlationId,
      status: "PROCESSING",
      error: null,
    };
  } catch (error) {
    const mappedError = mapProviderError(error);

    await updateCompanyVerification(verification.id, {
      status: CompanyVerificationStatus.FAILED,
      isComplete: true,
      completedAt: new Date(),
      errorCount: 1,
      fatalErrorCount: 1,
    });

    logVerificationOrchestration("start_failed", {
      verificationId: verification.id,
      providerCorrelationId: null,
      status: "FAILED",
      errorCode: mappedError.code,
      httpStatus: mappedError.httpStatus,
    });

    return {
      verificationId: verification.id,
      providerCorrelationId: null,
      status: "FAILED",
      error: mappedError,
    };
  }
}

export async function getLocalVerificationState(verificationId: string) {
  return getCompanyVerificationById(verificationId);
}

export async function pollVerificationOnce(
  verificationId: string,
): Promise<LocalVerificationPollResult | null> {
  const verification = await getCompanyVerificationById(verificationId);

  if (!verification) {
    return null;
  }

  if (isTerminalCompanyVerificationStatus(verification.status)) {
    return buildPollResult(verification, null);
  }

  if (!verification.providerCorrelationId) {
    const updated = await updateCompanyVerification(verificationId, {
      status: CompanyVerificationStatus.FAILED,
      isComplete: true,
      completedAt: new Date(),
      errorCount: verification.errorCount + 1,
      fatalErrorCount: verification.fatalErrorCount + 1,
    });

    const aggregate = await getCompanyVerificationById(updated.id);

    if (!aggregate) {
      return null;
    }

    return buildPollResult(aggregate, {
      code: "VERIFICATION_MISSING_CORRELATION_ID",
      message: "Verification has no providerCorrelationId.",
      httpStatus: null,
    });
  }

  try {
    const reportResult = await getVerificationReport(verification.providerCorrelationId);
    const errorCount = reportResult.summary.warningCount + reportResult.summary.fatalErrorCount;
    const isComplete = reportResult.summary.isComplete;
    const nextStatus = isComplete
      ? CompanyVerificationStatus.COMPLETED
      : CompanyVerificationStatus.PROCESSING;

    await appendCompanyVerificationPayload({
      verificationId,
      isFinal: isComplete,
      payloadJson: JSON.parse(
        JSON.stringify({
          provider: verification.provider,
          correlationId: verification.providerCorrelationId,
          summary: reportResult.summary,
          reports: reportResult.reports,
        }),
      ) as Prisma.InputJsonValue,
    });

    await updateCompanyVerification(verificationId, {
      status: nextStatus,
      isComplete,
      completedAt: isComplete ? new Date() : null,
      stateAsOfDate:
        reportResult.summary.stateAsOfDate !== null
          ? new Date(reportResult.summary.stateAsOfDate)
          : null,
      queriedRegistersJson: reportResult.summary.queriedRegisters,
      errorCount,
      fatalErrorCount: reportResult.summary.fatalErrorCount,
    });

    const aggregate = await getCompanyVerificationById(verificationId);

    if (!aggregate) {
      return null;
    }

    logVerificationOrchestration("poll_step", {
      verificationId,
      providerCorrelationId: verification.providerCorrelationId,
      status: aggregate.status,
      isComplete: aggregate.isComplete,
      errorCount: aggregate.errorCount,
      fatalErrorCount: aggregate.fatalErrorCount,
    });

    return buildPollResult(aggregate, null);
  } catch (error) {
    const mappedError = mapProviderError(error);

    await updateCompanyVerification(verificationId, {
      status: CompanyVerificationStatus.FAILED,
      isComplete: true,
      completedAt: new Date(),
      errorCount: verification.errorCount + 1,
      fatalErrorCount: verification.fatalErrorCount + 1,
    });

    const aggregate = await getCompanyVerificationById(verificationId);

    if (!aggregate) {
      return null;
    }

    logVerificationOrchestration("poll_failed", {
      verificationId,
      providerCorrelationId: verification.providerCorrelationId,
      status: aggregate.status,
      errorCode: mappedError.code,
      httpStatus: mappedError.httpStatus,
      errorCount: aggregate.errorCount,
      fatalErrorCount: aggregate.fatalErrorCount,
    });

    return buildPollResult(aggregate, mappedError);
  }
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function pollUntilComplete(
  verificationId: string,
): Promise<LocalVerificationPollResult | null> {
  const config = getVerclyAdapterConfig();
  const startedAt = Date.now();

  while (Date.now() - startedAt < config.pollTimeoutMs) {
    const result = await pollVerificationOnce(verificationId);

    if (!result) {
      return null;
    }

    if (isTerminalCompanyVerificationStatus(result.status)) {
      return result;
    }

    await wait(config.pollIntervalMs);
  }

  await updateCompanyVerification(verificationId, {
    status: CompanyVerificationStatus.TIMEOUT,
    isComplete: true,
    completedAt: new Date(),
  });

  const aggregate = await getCompanyVerificationById(verificationId);

  if (!aggregate) {
    return null;
  }

  logVerificationOrchestration("poll_timeout", {
    verificationId,
    providerCorrelationId: aggregate.providerCorrelationId,
    status: aggregate.status,
    errorCount: aggregate.errorCount,
    fatalErrorCount: aggregate.fatalErrorCount,
  });

  return buildPollResult(aggregate, {
    code: "VERIFICATION_POLL_TIMEOUT",
    message: "Polling timed out before the verification completed.",
    httpStatus: null,
  });
}