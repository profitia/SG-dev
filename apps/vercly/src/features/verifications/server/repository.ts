import {
  CompanyVerificationStatus,
  Prisma,
} from "@prisma/client";

import { db } from "@/lib/db/prisma";

import {
  DEFAULT_COMPANY_VERIFICATION_PROVIDER,
  type CompanyVerificationAggregate,
  type CreateCompanyVerificationInput,
  type CreateCompanyVerificationPayloadInput,
} from "../model/types";
import { isTerminalCompanyVerificationStatus } from "../model/status";

function toPersistenceStatus(status?: CreateCompanyVerificationInput["status"]) {
  if (!status) {
    return CompanyVerificationStatus.PENDING;
  }

  return CompanyVerificationStatus[status];
}

export async function createCompanyVerification(
  input: CreateCompanyVerificationInput,
) {
  const status = toPersistenceStatus(input.status);

  return db.companyVerification.create({
    data: {
      orgId: input.orgId,
      requestedByUserId: input.requestedByUserId,
      inputId: input.inputId,
      inputName: input.inputName,
      country: input.country,
      selectedSectionsJson: input.selectedSectionsJson,
      provider: input.provider ?? DEFAULT_COMPANY_VERIFICATION_PROVIDER,
      providerCorrelationId: input.providerCorrelationId ?? null,
      status,
      isComplete: input.isComplete ?? isTerminalCompanyVerificationStatus(status),
      stateAsOfDate: input.stateAsOfDate ?? null,
      queriedRegistersJson: input.queriedRegistersJson ?? Prisma.JsonNull,
      errorCount: input.errorCount ?? 0,
      fatalErrorCount: input.fatalErrorCount ?? 0,
      riskLevel: input.riskLevel ?? null,
      completedAt:
        input.completedAt ??
        (isTerminalCompanyVerificationStatus(status) ? new Date() : null),
    },
  });
}

export async function appendCompanyVerificationPayload(
  input: CreateCompanyVerificationPayloadInput,
) {
  return db.companyVerificationPayload.create({
    data: {
      verificationId: input.verificationId,
      payloadJson: input.payloadJson,
      isFinal: input.isFinal ?? false,
      receivedAt: input.receivedAt ?? new Date(),
    },
  });
}

export async function markCompanyVerificationStatus(
  verificationId: string,
  status: CompanyVerificationStatus,
) {
  const terminal = isTerminalCompanyVerificationStatus(status);

  return db.companyVerification.update({
    where: { id: verificationId },
    data: {
      status,
      isComplete: terminal,
      completedAt: terminal ? new Date() : null,
    },
  });
}

export async function getCompanyVerificationById(
  verificationId: string,
): Promise<CompanyVerificationAggregate | null> {
  return db.companyVerification.findUnique({
    where: { id: verificationId },
    include: {
      payloads: {
        orderBy: {
          receivedAt: "asc",
        },
      },
    },
  });
}

export async function updateCompanyVerification(
  verificationId: string,
  data: Prisma.CompanyVerificationUpdateInput,
) {
  return db.companyVerification.update({
    where: { id: verificationId },
    data,
  });
}