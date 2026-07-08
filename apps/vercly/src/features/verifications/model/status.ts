export const COMPANY_VERIFICATION_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "TIMEOUT",
  "CANCELLED",
] as const;

export type CompanyVerificationStatusName =
  (typeof COMPANY_VERIFICATION_STATUSES)[number];

const TERMINAL_STATUSES = new Set<CompanyVerificationStatusName>([
  "COMPLETED",
  "FAILED",
  "TIMEOUT",
  "CANCELLED",
]);

export function isTerminalCompanyVerificationStatus(
  status: CompanyVerificationStatusName,
) {
  return TERMINAL_STATUSES.has(status);
}