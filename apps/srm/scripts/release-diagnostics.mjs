// Diagnostics are an allowlisted projection, never a serialization of an exception,
// request, headers, credentials, response body or release payload.
import fs from "node:fs";
const text = (v, pattern) => typeof v === "string" && pattern.test(v) ? v : undefined;
const sha = (v) => text(v, /^[a-f0-9]{40}$/);
const id = (v) => text(v, /^[A-Za-z0-9:_-]{1,100}$/);
const number = (v) => Number.isSafeInteger(v) && v >= 0 ? v : undefined;
const responseMetadata = new WeakMap();
const endpointPatterns = [
  [/^$/, "repository"], [/^\/branches\/main$/, "authority-branch"],
  [/^\/git\/trees\/[a-f0-9]{40}$/, "git-tree"], [/^\/git\/blobs\/[a-f0-9]{40}$/, "git-blob"],
  [/^\/git\/ref\/heads\/srm-publication-[a-f0-9]{24}$/, "publication-ref"],
  [/^\/git\/matching-refs\/heads\/srm-publication-[a-f0-9]{24}$/, "publication-ref-inventory"],
  [/^\/git\/ref\/heads\/srm-release-[a-f0-9]{40}$/, "release-ref"],
  [/^\/git\/refs$/, "create-ref"], [/^\/contents\/Canon\/registries\/srm-(staging-release-state|environment-topology)-v1\.json$/, "canonical-content"],
  [/^\/compare\/[a-f0-9]{40}\.\.\.[a-f0-9]{40}$/, "publication-compare"],
  [/^\/pulls$/, "publication-prs"], [/^\/pulls\/\d+\/merge$/, "publication-merge"],
  [/^\/commits\/[a-f0-9]{40}\/check-runs$/, "commit-checks"],
  [/^\/environments\/srm-staging$/, "staging-environment"],
  [/^\/environments\/srm-staging\/secrets$/, "staging-secret-metadata"],
  [/^\/environments\/srm-staging\/variables(?:\/[A-Z][A-Z0-9_]{0,80})?$/, "staging-variable"],
  [/^\/environments\/srm-staging\/deployment-branch-policies$/, "staging-branch-policies"],
  [/^\/branches\/srm-release-[a-f0-9]{40}\/protection$/, "release-protection"],
  [/^\/actions\/runs\/\d+$/, "executor-run"],
];
const endpointIds = [...endpointPatterns.map(([,name]) => name), "codespace", "commit-mutation", "unrecognized"];
export function githubRequestIdentity(url, method = "GET") {
  let endpoint = "unrecognized";
  try {
    const u = new URL(url), prefix = "/repos/profitia/SG-dev";
    if (u.origin === "https://api.github.com" && !u.username && !u.password) {
      if (u.pathname.startsWith(prefix + "/") || u.pathname === prefix)
        endpoint = endpointPatterns.find(([pattern]) => pattern.test(u.pathname.slice(prefix.length)))?.[1] ?? endpoint;
      else if (u.pathname === "/graphql") endpoint = "commit-mutation";
      else if (/^\/user\/codespaces\/[A-Za-z0-9_-]{1,100}$/.test(u.pathname)) endpoint = "codespace";
    }
  } catch { /* Unrecognized routing can never authorize recovery. */ }
  const readOnly = method === "GET" && !["unrecognized", "commit-mutation", "create-ref", "publication-merge"].includes(endpoint);
  return {httpMethod:method, endpoint, requestType:readOnly ? "READ_ONLY" : method !== "GET" ? "MUTATION" : "UNKNOWN",
    retryEligibility:readOnly ? "READ_ONLY" : "INELIGIBLE", providerEffectCertainty:readOnly ? "NO_MUTATION" : "UNKNOWN"};
}
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
    httpMethod: ["GET","POST","PUT","PATCH","DELETE","HEAD"].includes(d.httpMethod) ? d.httpMethod : undefined,
    endpoint: endpointIds.includes(d.endpoint) ? d.endpoint : undefined,
    requestType: ["READ_ONLY","MUTATION","UNKNOWN"].includes(d.requestType) ? d.requestType : undefined,
    retryEligibility: ["READ_ONLY","INELIGIBLE","ACKNOWLEDGEMENT_MANAGED","UNKNOWN"].includes(d.retryEligibility) ? d.retryEligibility : undefined,
    providerEffectCertainty: ["NO_MUTATION","AMBIGUOUS","ACKNOWLEDGED","UNKNOWN"].includes(d.providerEffectCertainty) ? d.providerEffectCertainty : undefined,
    networkRetrySafe: typeof d.networkRetrySafe === "boolean" ? d.networkRetrySafe : undefined,
    retryDeadlineAt: number(d.retryDeadlineAt), retryBudgetRemaining: number(d.retryBudgetRemaining),
    durationMs: number(d.durationMs),
    failureDomain: ["RELEASE_BOOKKEEPING", "PROVIDER_OPERATION"].includes(d.failureDomain) ? d.failureDomain : undefined,
    applicationStatus: ["LIVE_SOURCE_OBSERVED", "NOT_CONFIRMED"].includes(d.applicationStatus) ? d.applicationStatus : undefined,
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
    acknowledgementDeadlineAt: number(d.acknowledgementDeadlineAt), retryNotBeforeAt: number(d.retryNotBeforeAt),
    rateLimitRemaining: number(d.rateLimitRemaining), rateLimitResetAt: number(d.rateLimitResetAt),
    retryGuidanceInvalid: d.retryGuidanceInvalid === true ? true : undefined,
    creationHttpStatus: number(d.creationHttpStatus), creationRequestId: text(d.creationRequestId, /^[a-fA-F0-9:-]{1,100}$/),
    providerEffectObserved: ["CREATION_ACKNOWLEDGED", "BRANCH_AT_EXPECTED_PARENT", "BRANCH_AT_OTHER_SHA", "NOT_OBSERVED", "UNKNOWN"].includes(d.providerEffectObserved) ? d.providerEffectObserved : undefined,
    retryDecision: ["GET_ONLY_BACKOFF", "RECOVERED", "DEFER_TO_ACKNOWLEDGEMENT", "NOT_EVALUATED", "STOP_RETRY_BUDGET", "STOP_AMBIGUOUS_WRITE", "STOP_ATTEMPT_LIMIT", "STOP_TIME_LIMIT", "STOP_RETRY_GUIDANCE", "STOP_NOT_RETRYABLE", "STOP_AMBIGUOUS_CREATE", "STOP_IDENTITY_CONFLICT", "STOP_AUTHORIZATION_EXPIRED", "STOP_AUTHORIZATION_WINDOW"].includes(d.retryDecision) ? d.retryDecision : undefined,
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
export async function githubResponse(fetcher, url, options, operation, {missingIsError = false, now = Date.now, observeMetadata = () => {}} = {}) {
  const identity = githubRequestIdentity(url,options.method);
  const context = {stage:"github-request",operation,effect:"OBSERVATION_REQUIRED",...identity};
  let response;
  try { response = await fetcher(url, options); }
  catch (error) {
    if (error instanceof ReleaseDiagnosticError) throw diagnosticError(error,context);
    const timeout = ["TimeoutError","AbortError"].includes(error?.name);
    const connection = ["ECONNRESET","ECONNREFUSED","EPIPE","ENOTFOUND","EAI_AGAIN","ETIMEDOUT","UND_ERR_CONNECT_TIMEOUT","UND_ERR_SOCKET"].includes(error?.cause?.code ?? error?.code);
    throw new ReleaseDiagnosticError({...context,category:timeout ? "NETWORK_TIMEOUT" : "NETWORK_FAILURE",networkRetrySafe:timeout || connection,
      providerEffectCertainty:identity.requestType === "MUTATION" ? "AMBIGUOUS" : identity.providerEffectCertainty,requestReachedGitHub:"UNKNOWN"});
  }
  const metadata = {...context,httpStatus:response.status,requestId:response.headers?.get("x-github-request-id"),requestReachedGitHub:"HTTP_RESPONSE",
    providerEffectCertainty:identity.requestType === "MUTATION" ? response.ok ? "ACKNOWLEDGED" : "AMBIGUOUS" : identity.providerEffectCertainty};
  const headerInteger = name => {
    const value = response.headers?.get(name);
    return typeof value === "string" && /^\d+$/.test(value) ? number(Number(value)) : undefined;
  };
  const retryAfter = response.headers?.get("retry-after");
  if (retryAfter !== null && retryAfter !== undefined) {
    const delay = /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - now();
    if (Number.isFinite(delay) && delay >= 0 && Number.isSafeInteger(Math.ceil(delay))) metadata.retryAfterMs = Math.ceil(delay);
    else metadata.retryGuidanceInvalid = true;
  }
  metadata.rateLimitRemaining = headerInteger("x-ratelimit-remaining");
  metadata.rateLimitResetAt = headerInteger("x-ratelimit-reset");
  const pollSeconds = headerInteger("x-poll-interval");
  if (pollSeconds !== undefined && number(pollSeconds * 1000) !== undefined) metadata.pollIntervalMs = pollSeconds * 1000;
  else if (response.headers?.get("x-poll-interval") != null) metadata.retryGuidanceInvalid = true;
  observeMetadata(sanitizeDiagnostic(metadata));
  if (response.status === 404 && options.method === "GET" && !missingIsError) return null;
  if (response.status === 204 && response.ok) return null;
  let body;
  try { body = await response.json(); }
  catch { throw new ReleaseDiagnosticError({...metadata,category:response.ok ? "INVALID_JSON" : response.status === 429 || response.status === 403 && metadata.rateLimitRemaining === 0 ? "RATE_LIMITED" : "HTTP_REJECTION"}); }
  if (!response.ok) {
    const message = safeProviderMessage(body?.message);
    const rateLimited = response.status === 429 || (response.status === 403 && (message === "GitHub rate limit reached" || metadata.rateLimitRemaining === 0));
    throw new ReleaseDiagnosticError({...metadata,category:rateLimited ? "RATE_LIMITED" : "HTTP_REJECTION",message,
      providerEffectCertainty:identity.requestType === "MUTATION" ? "AMBIGUOUS" : identity.providerEffectCertainty});
  }
  if (operation === "createCommitOnBranch" && (body.errors?.length || !body.data?.createCommitOnBranch?.commit?.oid))
    throw new ReleaseDiagnosticError({...metadata,category:"GRAPHQL_REJECTION",graphqlErrors:body.errors ?? []});
  if (body && typeof body === "object") responseMetadata.set(body,sanitizeDiagnostic(metadata));
  return body;
}

// This adapter owns retry of known REST reads only. The separate validated
// 201 acknowledgement loop remains the sole owner of publication-ref polling.
export function createGithubRequester(fetcher, {
  authorizationExpiresAt, now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve,ms)), random = Math.random,
  attemptLimit = 3, readDeadlineMs = 660000, executionDeadlineMs = 3600000, retryBudget = 20,
  diagnosticContext = () => ({}),
  onRequest = () => {},
  emit = d => console.error("SRM_GITHUB_RECOVERY " + JSON.stringify({...d,journalGeneration:d.generation ?? "UNKNOWN"})),
} = {}) {
  if (!Number.isSafeInteger(attemptLimit) || attemptLimit < 1 || attemptLimit > 5 ||
    !Number.isSafeInteger(readDeadlineMs) || readDeadlineMs < 1 || readDeadlineMs > 1800000 ||
    !Number.isSafeInteger(executionDeadlineMs) || executionDeadlineMs < 1 || executionDeadlineMs > 3600000 ||
    !Number.isSafeInteger(retryBudget) || retryBudget < 0 || retryBudget > 20)
    throw new ReleaseDiagnosticError({category:"INVALID_RETRY_BOUNDS",requestReachedGitHub:"NOT_SENT"});
  const authorizationDeadline = Date.parse(authorizationExpiresAt), executionDeadline = now()+executionDeadlineMs;
  if (!Number.isFinite(authorizationDeadline)) throw new ReleaseDiagnosticError({category:"INVALID_AUTHORIZATION_EXPIRY",requestReachedGitHub:"NOT_SENT"});
  let remaining = retryBudget, rateNotBefore = 0;
  const pollNotBefore = new Map();
  return async (url, options, operation, readOptions = {}) => {
    const identity = githubRequestIdentity(url,options.method), managed = readOptions.acknowledgementManaged === true;
    const eligible = identity.requestType === "READ_ONLY" && !managed;
    const limit = eligible ? attemptLimit : 1;
    const deadline = Math.min(now()+readDeadlineMs,executionDeadline,authorizationDeadline,readOptions.deadlineAt ?? Infinity);
    const {generation,approvalId} = sanitizeDiagnostic(diagnosticContext());
    const context = {...identity,generation,approvalId,operation,stage:"github-request",attemptLimit:limit,retryDeadlineAt:deadline,
      retryEligibility:managed ? "ACKNOWLEDGEMENT_MANAGED" : identity.retryEligibility};
    const gate = (attemptNumber, notBefore = now()) => {
      const decision = now() >= authorizationDeadline ? "STOP_AUTHORIZATION_EXPIRED" :
        notBefore >= deadline || now() >= deadline ? deadline === authorizationDeadline ? "STOP_AUTHORIZATION_WINDOW" : "STOP_TIME_LIMIT" : null;
      if (decision) throw new ReleaseDiagnosticError({...context,category:"RETRY_WINDOW_CLOSED",attemptNumber,retryDecision:decision,
        retryNotBeforeAt:notBefore,retryBudgetRemaining:remaining,requestReachedGitHub:"NOT_SENT"});
    };
    for (let attemptNumber = 1; attemptNumber <= limit; attemptNumber++) {
      gate(attemptNumber);
      const notBefore = Math.max(rateNotBefore,pollNotBefore.get(url) ?? 0);
      if (notBefore > now()) { gate(attemptNumber,notBefore); await pause(notBefore-now()); gate(attemptNumber); }
      const startedAt = now();
      let responseObserved = false;
      try {
        const result = await githubResponse(fetcher,url,{...options,signal:AbortSignal.timeout(Math.max(1,Math.min(readOptions.timeoutMs ?? 30000,deadline-now())))},operation,{...readOptions,now,observeMetadata:metadata=>{
          responseObserved = true;
          onRequest(sanitizeDiagnostic({...context,...metadata,attemptNumber,durationMs:Math.max(0,now()-startedAt)}));
          // Include null/204/missing responses, whose payload has no WeakMap key.
          if (metadata.pollIntervalMs !== undefined) pollNotBefore.set(url,now()+metadata.pollIntervalMs);
          if (metadata.rateLimitRemaining === 0) rateNotBefore = metadata.rateLimitResetAt === undefined ? Infinity : metadata.rateLimitResetAt*1000+1000;
        }});
        const metadata = githubMetadata(result);
        if (metadata.pollIntervalMs !== undefined) pollNotBefore.set(url,now()+metadata.pollIntervalMs);
        if (metadata.rateLimitRemaining === 0) rateNotBefore = metadata.rateLimitResetAt === undefined ? Infinity : metadata.rateLimitResetAt*1000+1000;
        if (attemptNumber > 1) emit(sanitizeDiagnostic({...context,...metadata,attemptNumber,retryBudgetRemaining:remaining,retryDecision:"RECOVERED"}));
        return result;
      } catch (error) {
        const d = diagnosticError(error).diagnostic;
        if (!responseObserved) onRequest(sanitizeDiagnostic({...context,...d,attemptNumber,durationMs:Math.max(0,now()-startedAt)}));
        const transient = [500,502,503,504].includes(d.httpStatus) || d.category === "RATE_LIMITED" || d.networkRetrySafe === true;
        let decision = d.requestReachedGitHub === "NOT_SENT" ? "STOP_NOT_RETRYABLE" : managed ? "DEFER_TO_ACKNOWLEDGEMENT" : !eligible && identity.requestType === "MUTATION" ? "STOP_AMBIGUOUS_WRITE" :
          !eligible || !transient ? "STOP_NOT_RETRYABLE" : attemptNumber === limit ? "STOP_ATTEMPT_LIMIT" : remaining === 0 ? "STOP_RETRY_BUDGET" : "GET_ONLY_BACKOFF";
        const base = 250*2**(attemptNumber-1), sample = random();
        let waitMs = base + Math.floor(base*(Number.isFinite(sample) ? Math.min(1,Math.max(0,sample)) : 1));
        if (d.retryGuidanceInvalid && decision === "GET_ONLY_BACKOFF") decision = "STOP_RETRY_GUIDANCE";
        if (d.retryAfterMs !== undefined) {waitMs = Math.max(waitMs,d.retryAfterMs);rateNotBefore = Math.max(rateNotBefore,now()+d.retryAfterMs);}
        if (d.pollIntervalMs !== undefined) {waitMs = Math.max(waitMs,d.pollIntervalMs);pollNotBefore.set(url,now()+d.pollIntervalMs);}
        if (d.rateLimitRemaining === 0) {
          rateNotBefore = d.rateLimitResetAt === undefined ? Infinity : d.rateLimitResetAt*1000+1000;
          if (d.rateLimitResetAt === undefined && decision === "GET_ONLY_BACKOFF") decision = "STOP_RETRY_GUIDANCE";
          else waitMs = Math.max(waitMs,rateNotBefore-now());
        } else if (d.category === "RATE_LIMITED" && d.retryAfterMs === undefined) {
          waitMs = Math.max(waitMs,60000*2**(attemptNumber-1));rateNotBefore = Math.max(rateNotBefore,now()+waitMs);
        }
        if (decision === "GET_ONLY_BACKOFF" && now()+waitMs >= deadline)
          decision = deadline === authorizationDeadline ? "STOP_AUTHORIZATION_WINDOW" : "STOP_TIME_LIMIT";
        const diagnostic = sanitizeDiagnostic({...context,...d,attemptLimit:limit,retryEligibility:context.retryEligibility,
          attemptNumber,retryDecision:decision,retryBudgetRemaining:remaining,retryNotBeforeAt:now()+waitMs});
        if (decision !== "GET_ONLY_BACKOFF") throw new ReleaseDiagnosticError(diagnostic);
        remaining--; emit(diagnostic); await pause(waitMs);
      }
    }
  };
}
export function createGithubRequestMetrics() {
  const rows = new Map();
  return {
    record(input) {
      const d = sanitizeDiagnostic(input);
      if (!d.httpMethod || !d.endpoint || !d.requestType) return;
      const key = d.httpMethod + " " + d.endpoint;
      const row = rows.get(key) ?? {
        httpMethod: d.httpMethod, endpoint: d.endpoint, requestType: d.requestType,
        attempts: 0, httpResponses: 0, networkFailures: 0, retriedAttempts: 0,
        durationMs: 0, statuses: {},
      };
      row.attempts++;
      if (d.httpStatus !== undefined) row.httpResponses++;
      else row.networkFailures++;
      if (d.attemptNumber > 1) row.retriedAttempts++;
      row.durationMs += d.durationMs ?? 0;
      const status = d.httpStatus ?? "NO_HTTP_RESPONSE";
      row.statuses[status] = (row.statuses[status] ?? 0) + 1;
      rows.set(key, row);
    },
    read() {
      const endpoints = structuredClone([...rows.values()]);
      return {scope: "SHARED_GITHUB_ADAPTER", attempts: endpoints.reduce((n, r) => n + r.attempts, 0), endpoints};
    },
  };
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
    providerEffectObserved:d.providerEffectObserved ?? "UNKNOWN", retryDecision:d.retryDecision ?? "NOT_EVALUATED",
    httpMethod:d.httpMethod ?? "UNKNOWN",endpoint:d.endpoint ?? "unrecognized",requestType:d.requestType ?? "UNKNOWN",
    retryEligibility:d.retryEligibility ?? "UNKNOWN",providerEffectCertainty:d.providerEffectCertainty ?? "UNKNOWN"};
  console.error("SRM_RELEASE_DIAGNOSTIC " + JSON.stringify(complete));
  if (outputPath) fs.writeFileSync(outputPath, JSON.stringify(complete,null,2)+"\n", {mode:0o600});
  return complete;
}
