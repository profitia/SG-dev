// Diagnostics are an allowlisted projection, never a serialization of an exception,
// request, headers, credentials, response body or release payload.
import fs from "node:fs";
const text = (v, pattern) => typeof v === "string" && pattern.test(v) ? v : undefined;
const sha = (v) => text(v, /^[a-f0-9]{40}$/);
const id = (v) => text(v, /^[A-Za-z0-9:_-]{1,100}$/);
const number = (v) => Number.isSafeInteger(v) && v >= 0 ? v : undefined;
const responseMetadata = new WeakMap();
export const githubMetadata = (value) => value && typeof value === "object" ? responseMetadata.get(value) ?? {} : {};
const messages = [
  [/resource not accessible/i, "GitHub permission denied"],
  [/bad credentials/i, "GitHub credentials rejected"],
  [/rate limit/i, "GitHub rate limit reached"],
  [/expected.*(head|branch)|head.*(mismatch|changed)/i, "GitHub expected branch head rejected"],
  [/protected branch|protection rule/i, "GitHub protection rejected publication"],
  [/could not resolve|not found/i, "GitHub object unavailable"],
  [/invalid|validation/i, "GitHub payload validation rejected"],
];
const gateMessages = [
  "Lawful merge publication unavailable", "Publication branch acknowledgement unavailable",
  "Publication candidate contains unapproved changes", "Ambiguous publication PR",
  "Publication PR identity drift", "Publication PR was closed without merge",
  "Incomplete publication CI",
  "Canonical publication conflict; PR preserved", "Publication branch content drift",
  "Publication CI pending; resume the preserved PR", "Publication CI failed; PR preserved",
  "Approval expired or owner missing", "Authority refresh failed",
  "Executor source must be on authority main", "Required scoped management credential missing",
  "Merged canonical publication verification failed", "Protected publication not merged; PR preserved",
  "Independent governance preflight blocked", "Clean governed source required",
  "Promotion mechanism changed; restart from reviewed main", "Authority integration failed",
  "Approved migration source differs from mechanism", "Approved runtime contract differs from mechanism",
  "Repository authority identity mismatch", "Full approved SHA required", "Unverified release revision",
  "Release contract absent", "Release lacks staging runtime",
];
export function safeProviderMessage(value) {
  if (messages.some(([,v]) => v === value)) return value;
  return messages.find(([pattern]) => pattern.test(String(value ?? "")))?.[1]
    ?? "Provider message withheld; inspect the request ID in GitHub";
}
export function sanitizeDiagnostic(d = {}) {
  return Object.fromEntries(Object.entries({
    stage: id(d.stage), operation: id(d.operation), category: id(d.category),
    message: [...messages.map(([,v]) => v), ...gateMessages].includes(d.message) ? d.message : undefined,
    httpStatus: Number.isInteger(d.httpStatus) && d.httpStatus >= 100 && d.httpStatus <= 599 ? d.httpStatus : undefined,
    requestId: text(d.requestId, /^[a-fA-F0-9:-]{1,100}$/),
    requestReachedGitHub: ["HTTP_RESPONSE", "UNKNOWN", "NOT_SENT"].includes(d.requestReachedGitHub) ? d.requestReachedGitHub : undefined,
    effect: ["OBSERVATION_REQUIRED", "COMMIT_OBSERVED", "NO_COMMIT_OBSERVED", "BRANCH_OBSERVED", "BRANCH_NOT_OBSERVED"].includes(d.effect) ? d.effect : undefined,
    expectedSha: sha(d.expectedSha), observedSha: sha(d.observedSha),
    branch: text(d.branch, /^(main|srm-publication-[a-f0-9]{24})$/),
    generation: Number.isSafeInteger(d.generation) && d.generation >= 0 ? d.generation : undefined,
    approvalId: text(d.approvalId, /^SRM-STAGING-[A-Za-z0-9_-]{1,80}$/),
    attemptNumber: number(d.attemptNumber), attemptLimit: number(d.attemptLimit),
    retryAfterMs: number(d.retryAfterMs), pollIntervalMs: number(d.pollIntervalMs),
    rateLimitRemaining: number(d.rateLimitRemaining), rateLimitResetAt: number(d.rateLimitResetAt),
    retryGuidanceInvalid: d.retryGuidanceInvalid === true ? true : undefined,
    creationHttpStatus: number(d.creationHttpStatus), creationRequestId: text(d.creationRequestId, /^[a-fA-F0-9:-]{1,100}$/),
    providerEffectObserved: ["CREATION_ACKNOWLEDGED", "BRANCH_AT_EXPECTED_PARENT", "BRANCH_AT_OTHER_SHA", "NOT_OBSERVED"].includes(d.providerEffectObserved) ? d.providerEffectObserved : undefined,
    retryDecision: ["GET_ONLY_BACKOFF", "STOP_ATTEMPT_LIMIT", "STOP_TIME_LIMIT", "STOP_RETRY_GUIDANCE", "STOP_NOT_RETRYABLE", "STOP_AMBIGUOUS_CREATE", "STOP_IDENTITY_CONFLICT"].includes(d.retryDecision) ? d.retryDecision : undefined,
    graphqlErrors: Array.isArray(d.graphqlErrors) ? d.graphqlErrors.slice(0,10).map(e => ({
      type: ["FORBIDDEN","UNAUTHORIZED","NOT_FOUND","UNPROCESSABLE","RATE_LIMITED","BAD_USER_INPUT","INTERNAL","CONFLICT"].includes(e.type) ? e.type : "OTHER",
      path: Array.isArray(e.path) ? e.path.filter(x => Number.isSafeInteger(x) || ["createCommitOnBranch","commit","oid","input","branch","expectedHeadOid","fileChanges","additions"].includes(x)).slice(0,10) : [],
      message: safeProviderMessage(e.message),
    })) : undefined,
  }).filter(([,v]) => v !== undefined));
}
export class ReleaseDiagnosticError extends Error {
  constructor(diagnostic) {
    super("SRM release failed closed: " + (sanitizeDiagnostic(diagnostic).message ?? id(diagnostic.category) ?? "RELEASE_GATE"));
    this.diagnostic = sanitizeDiagnostic(diagnostic);
  }
}
export function diagnosticError(error, context = {}) {
  return new ReleaseDiagnosticError({
    category: "RELEASE_GATE", message: gateMessages.includes(error?.message) ? error.message : undefined, requestReachedGitHub: "UNKNOWN",
    ...context, ...(error instanceof ReleaseDiagnosticError ? error.diagnostic : {}),
  });
}
export async function diagnosticStage(context, action) {
  try { return await action(); } catch (error) {
    const diagnostic = diagnosticError(error, context).diagnostic;
    // Preserve a more precise inner publication boundary; replace only the
    // generic HTTP stage with the caller's actual publication stage.
    if (diagnostic.stage === "github-request" && context.stage) diagnostic.stage = context.stage;
    throw new ReleaseDiagnosticError(diagnostic);
  }
}
export async function githubResponse(fetcher, url, options, operation, {missingIsError = false} = {}) {
  const context = {stage:"github-request",operation,effect:"OBSERVATION_REQUIRED"};
  let response;
  try { response = await fetcher(url, options); }
  catch (error) {
    throw new ReleaseDiagnosticError({...context,category:["TimeoutError","AbortError"].includes(error?.name) ? "NETWORK_TIMEOUT" : "NETWORK_FAILURE",requestReachedGitHub:"UNKNOWN"});
  }
  const metadata = {...context,httpStatus:response.status,requestId:response.headers?.get("x-github-request-id"),requestReachedGitHub:"HTTP_RESPONSE"};
  const headerInteger = name => {
    const value = response.headers?.get(name);
    return typeof value === "string" && /^\d+$/.test(value) ? number(Number(value)) : undefined;
  };
  const retryAfter = response.headers?.get("retry-after");
  if (retryAfter !== null && retryAfter !== undefined) {
    const delay = /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(delay) && delay >= 0 && Number.isSafeInteger(Math.ceil(delay))) metadata.retryAfterMs = Math.ceil(delay);
    else metadata.retryGuidanceInvalid = true;
  }
  metadata.rateLimitRemaining = headerInteger("x-ratelimit-remaining");
  metadata.rateLimitResetAt = headerInteger("x-ratelimit-reset");
  const pollSeconds = headerInteger("x-poll-interval");
  if (pollSeconds !== undefined) metadata.pollIntervalMs = pollSeconds * 1000;
  if (response.status === 404 && options.method === "GET" && !missingIsError) return null;
  if (response.status === 204 && response.ok) return null;
  let body;
  try { body = await response.json(); }
  catch { throw new ReleaseDiagnosticError({...metadata,category:response.ok ? "INVALID_JSON" : "HTTP_REJECTION"}); }
  if (!response.ok) {
    const message = safeProviderMessage(body?.message);
    const rateLimited = response.status === 429 || (response.status === 403 && message === "GitHub rate limit reached");
    throw new ReleaseDiagnosticError({...metadata,category:rateLimited ? "RATE_LIMITED" : "HTTP_REJECTION",message});
  }
  if (operation === "createCommitOnBranch" && (body.errors?.length || !body.data?.createCommitOnBranch?.commit?.oid))
    throw new ReleaseDiagnosticError({...metadata,category:"GRAPHQL_REJECTION",graphqlErrors:body.errors ?? []});
  if (body && typeof body === "object") responseMetadata.set(body,sanitizeDiagnostic(metadata));
  return body;
}
export function childDiagnostic(stderr) {
  const lines = String(stderr ?? "").split("\n").filter(x => x.startsWith("SRM_RELEASE_DIAGNOSTIC "));
  try { return sanitizeDiagnostic(JSON.parse(lines.at(-1).slice(23))); } catch { return null; }
}
export function reportDiagnostic(error, context = {}, outputPath = null) {
  const d = diagnosticError(error, context).diagnostic;
  const complete = {...d,
    publicationStage:d.stage ?? "UNKNOWN", githubOperation:d.operation ?? "UNKNOWN",
    httpStatus:d.httpStatus ?? "UNKNOWN", githubRequestId:d.requestId ?? "UNKNOWN", failureCategory:d.category ?? "UNKNOWN",
    attemptNumber:d.attemptNumber ?? "UNKNOWN", attemptLimit:d.attemptLimit ?? "UNKNOWN",
    expectedSha:d.expectedSha ?? "UNKNOWN", observedSha:d.observedSha ?? "NOT_OBSERVED", branch:d.branch ?? "UNKNOWN",
    journalGeneration:d.generation ?? "UNKNOWN", releaseApprovalId:d.approvalId ?? "UNKNOWN",
    providerEffectObserved:d.providerEffectObserved ?? "NOT_OBSERVED", retryDecision:d.retryDecision ?? "STOP_NOT_RETRYABLE"};
  console.error("SRM_RELEASE_DIAGNOSTIC " + JSON.stringify(complete));
  if (outputPath) fs.writeFileSync(outputPath, JSON.stringify(complete,null,2)+"\n", {mode:0o600});
  return complete;
}
