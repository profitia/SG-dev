import {contract} from "./staging-migrate.mjs";
import {assertLifecycleAuthorization,authorizationFromRelease,digest} from "../../../scripts/governance/srm-release-lifecycle.mjs";
const fail = (ok, message) => { if (!ok) throw Error(message); };
// Pure preparation only. No approval, journal, provider write or takeover occurs here.
export function prepareResume(state, input, previousRun, now = Date.now()) {
  const r = state?.release;
  fail(state?.schemaVersion === "1.0" && state.projectKey === "SRM" && state.targetEnvironment === "staging" && Number.isSafeInteger(state.generation), "Exact SRM Staging journal required");
  fail(r && ["ONBOARDING_AUTHORIZED","PROVISIONING","VERIFYING"].includes(r.phase) && r.mode === "promote", "An unfinished existing promotion is required");
  fail(input.approvalId === r.approvalId && input.manifestDigest === r.manifestDigest && input.sha === r.manifest?.sha && digest(r.manifest) === r.manifestDigest, "Resume identity or manifest mismatch");
  fail(r.manifest.contractDigest === digest(contract), "Resume contract changed; obtain a separate governed decision");
  const runId = /^github-run:(\d+)$/.exec(r.owner)?.[1];
  fail(runId && String(previousRun?.id) === runId && previousRun.status === "completed" && previousRun.repository?.id === contract.repositoryId && previousRun.repository.full_name === contract.repository, "Previous executor must be proved completed by GitHub");
  fail(input.actor === r.authorization?.approvedBy && input.costOwner === r.authorization.costOwner, "Resume owner or cost scope changed");
  const a = authorizationFromRelease(r);
  const stable = v => digest({...v,expiresAt:undefined,costEvidence:v.costEvidence ? {...v.costEvidence,verifiedAt:undefined} : undefined});
  fail(stable(a) === r.authorizationDigest, "Stored authorization scope mismatch");
  const expired = Date.parse(a.expiresAt) <= now;
  fail(!expired || input.renewal === "YES", "Authorization expired; explicit bounded renewal required");
  if (input.renewal === "YES") a.expiresAt = new Date(now + 3600000).toISOString();
  assertLifecycleAuthorization(a,r.manifest,contract,now);
  fail(stable(a) === r.authorizationDigest, "Renewal cannot change release scope");
  return {authorization:a, fence:{generation:state.generation,journalDigest:digest(state),approvalId:r.approvalId,manifestDigest:r.manifestDigest,authorizationDigest:r.authorizationDigest,previousOwner:r.owner},renewal:{requested:input.renewal === "YES",previousExpiresAt:r.authorization.expiresAt,expiresAt:a.expiresAt}};
}
export function assertResumeFence(state, prepared) {
  const f = prepared?.fence, r = state?.release;
  fail(f && digest(state) === f.journalDigest && state.generation === f.generation && r?.approvalId === f.approvalId && r.manifestDigest === f.manifestDigest && r.authorizationDigest === f.authorizationDigest && r.owner === f.previousOwner && r.phase !== "VERIFIED", "Resume journal changed while awaiting protected approval");
  return true;
}
