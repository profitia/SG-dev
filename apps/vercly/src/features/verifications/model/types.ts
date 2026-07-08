import type {
  CompanyVerification,
  CompanyVerificationPayload,
  Prisma,
} from "@prisma/client";

import type { CompanyVerificationStatusName } from "./status";

export const DEFAULT_COMPANY_VERIFICATION_PROVIDER = "VERCLY";

export type CreateCompanyVerificationInput = {
  orgId: string;
  requestedByUserId: string;
  inputId: string;
  inputName: string;
  country: string;
  selectedSectionsJson: Prisma.InputJsonValue;
  provider?: string;
  providerCorrelationId?: string | null;
  status?: CompanyVerificationStatusName;
  isComplete?: boolean;
  stateAsOfDate?: Date | null;
  queriedRegistersJson?: Prisma.InputJsonValue | null;
  errorCount?: number;
  fatalErrorCount?: number;
  riskLevel?: string | null;
  completedAt?: Date | null;
};

export type CreateCompanyVerificationPayloadInput = {
  verificationId: string;
  payloadJson: Prisma.InputJsonValue;
  isFinal?: boolean;
  receivedAt?: Date;
};

export type CompanyVerificationAggregate = CompanyVerification & {
  payloads: CompanyVerificationPayload[];
};

export type StartLocalVerificationInput = {
  orgId: string;
  requestedByUserId: string;
  inputId: string;
  inputName: string;
  country?: string;
  selectedSectionsJson: Prisma.InputJsonValue;
};

export type LocalVerificationOperationError = {
  code: string;
  message: string;
  httpStatus: number | null;
};

export type LocalVerificationStartResult = {
  verificationId: string;
  providerCorrelationId: string | null;
  status: CompanyVerificationStatusName;
  error: LocalVerificationOperationError | null;
};

export type LocalVerificationPollResult = {
  verificationId: string;
  providerCorrelationId: string | null;
  status: CompanyVerificationStatusName;
  isComplete: boolean;
  errorCount: number;
  fatalErrorCount: number;
  error: LocalVerificationOperationError | null;
};