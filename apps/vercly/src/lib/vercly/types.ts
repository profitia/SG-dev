export type VerclyVerificationType =
  | "FULL"
  | "G2"
  | "WithAuthologic"
  | "ADVERSE_MEDIA";

export type VerclyVerificationRequest = {
  Id?: string;
  Country?: string;
  Name?: string;
  PersonalId?: string;
  RegisterCity?: string;
  Jurisdiction?: string;
  VerificationType?: VerclyVerificationType;
  WWW?: string;
  PhoneNo?: string;
  MCC?: string;
  SicCodes?: string[];
  CorrelationID?: string;
};

export type VerclyLoginResponse = {
  AccessToken: string;
  RefreshToken: string;
};

export type VerclyRefreshResponse = {
  AccessToken: string;
};

export type VerclyVerificationStartResult = {
  correlationId: string;
  rawCorrelationIds: string[];
};

export type VerclyReportHeader = {
  Type?: string;
  CorrelationId?: string;
  Id?: string;
  CausationId?: string;
  Origin?: string;
};

export type VerclyReportError = {
  Severity?: number;
  Code?: string;
  Message?: string;
  Source?: string;
};

export type VerclyReportBody = {
  StateAsOfDate?: number;
  IsComplete?: boolean;
  QueriedRegisters?: string[];
  Errors?: VerclyReportError[];
  Entity?: unknown;
  DepEntities?: unknown[];
};

export type VerclyVerificationReport = {
  Header?: VerclyReportHeader;
  Body?: VerclyReportBody;
  Auditlog?: unknown[];
  Analysis?: string;
};

export type VerclyVerificationReportSummary = {
  correlationId: string | null;
  reportId: string | null;
  isComplete: boolean;
  queriedRegisters: string[];
  warningCount: number;
  fatalErrorCount: number;
  stateAsOfDate: number | null;
};

export type VerclyVerificationReportResult = {
  reports: VerclyVerificationReport[];
  summary: VerclyVerificationReportSummary;
};

export type VerclyAuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};

export type VerclyAdapterConfig = {
  apiBaseUrl: string;
  username: string | null;
  password: string | null;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  defaultCountry: string;
};