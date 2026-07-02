// Org context for PCOS Cognition Explorer
// The explorer is scoped to a single org in a single environment.

export const EXPLORER_ORG_ID =
  process.env.PCOS_EXPLORER_ORG_ID ?? "pcos-default";

export const EXPLORER_ENV =
  (process.env.PCOS_EXPLORER_ENV as "LAB" | "PROD" | "SANDBOX") ?? "LAB";

export const EXPLORER_PREVIEW_MODE =
  (process.env.PCOS_EXPLORER_PREVIEW_MODE as "live" | "mock" | undefined) ??
  "live";

export const EXPLORER_IS_MOCK_PREVIEW = EXPLORER_PREVIEW_MODE === "mock";
