// Diagnostics are an allowlisted projection, never a serialization of an exception,
// request, headers, credentials, response body or release payload.
import fs from "node:fs";
const text = (v, pattern) => typeof v === "string" && pattern.test(v) ? v : undefined;
const sha = (v) => text(v, /^[a-f0-9]{40}$/);
const id = (v) => text(v, /^[A-Za-z0-9:_-]{1,100}$/);
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
    effect: ["OBSERVATION_REQUIRED", "COMMIT_OBSERVED", "NO_COMMIT_OBSERVED"].includes(d.effect) ? d.effect : undefined,
    expectedSha: sha(d.expectedSha), observedSha: sha(d.observedSha),
    branch: text(d.branch, /^(main|srm-publication-[a-f0-9]{24})$/),
    generation: Number.isSafeInteger(d.generation) && d.generation >= 0 ? d.generation : undefined,
    approvalId: text(d.approvalId, /^SRM-STAGING-[A-Za-z0-9_-]{1,80}$/),
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
  try { return await action(); } catch (error) { throw diagnosticError(error, context); }
}
export async function githubResponse(fetcher, url, options, operation) {
  const context = {stage:"github-request",operation,effect:"OBSERVATION_REQUIRED"};
  let response;
  try { response = await fetcher(url, options); }
  catch (error) {
    throw new ReleaseDiagnosticError({...context,category:["TimeoutError","AbortError"].includes(error?.name) ? "NETWORK_TIMEOUT" : "NETWORK_FAILURE",requestReachedGitHub:"UNKNOWN"});
  }
  const metadata = {...context,httpStatus:response.status,requestId:response.headers?.get("x-github-request-id"),requestReachedGitHub:"HTTP_RESPONSE"};
  if (response.status === 404 && options.method === "GET") return null;
  if (response.status === 204 && response.ok) return null;
  let body;
  try { body = await response.json(); }
  catch { throw new ReleaseDiagnosticError({...metadata,category:response.ok ? "INVALID_JSON" : "HTTP_REJECTION"}); }
  if (!response.ok) throw new ReleaseDiagnosticError({...metadata,category:"HTTP_REJECTION",message:safeProviderMessage(body?.message)});
  if (operation === "createCommitOnBranch" && (body.errors?.length || !body.data?.createCommitOnBranch?.commit?.oid))
    throw new ReleaseDiagnosticError({...metadata,category:"GRAPHQL_REJECTION",graphqlErrors:body.errors ?? []});
  return body;
}
export function childDiagnostic(stderr) {
  const lines = String(stderr ?? "").split("\n").filter(x => x.startsWith("SRM_RELEASE_DIAGNOSTIC "));
  try { return sanitizeDiagnostic(JSON.parse(lines.at(-1).slice(23))); } catch { return null; }
}
export function reportDiagnostic(error, context = {}, outputPath = null) {
  const d = diagnosticError(error, context).diagnostic;
  console.error("SRM_RELEASE_DIAGNOSTIC " + JSON.stringify(d));
  if (outputPath) fs.writeFileSync(outputPath, JSON.stringify(d,null,2)+"\n", {mode:0o600});
  return d;
}
