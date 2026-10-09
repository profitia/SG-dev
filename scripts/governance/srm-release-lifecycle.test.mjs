import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertProductSecretIsolation,
  assertStagingGitHubProtection,
  assertLifecycleAuthorization,
  assertSnapshot,
  assertStagingDomainBinding,
  claimRelease,
  authorizationFromRelease,
  digest,
  operations,
  casPublish,
} from "./srm-release-lifecycle.mjs";
const c = JSON.parse(
  fs.readFileSync("apps/srm/deployment/staging-contract.json", "utf8"),
);
const ownerEnvironment = (preventSelfReview = false) => ({
  id:23853126630,name:"srm-staging",
  protection_rules:[{type:"required_reviewers",prevent_self_review:preventSelfReview,
    reviewers:[{type:"User",reviewer:{id:275643368,login:"profitia"}}]}],
  deployment_branch_policy:{custom_branch_policies:true,protected_branches:false},
});
test("existing SRM Staging accepts solo owner review without removing the reviewer",()=>{
  const result=assertStagingGitHubProtection(ownerEnvironment(),c);
  assert.equal(result.mode,"SOLO_OPERATOR_OWNER_REVIEW");
  assert.deepEqual(result.reviewerIds,[275643368]);
  assert.equal(result.preventSelfReview,false);
});
test("pre-corrective independent review remains valid until separately approved policy application",()=>{
  assert.equal(assertStagingGitHubProtection(ownerEnvironment(true),c).mode,"INDEPENDENT_REVIEW");
});
for(const [label,mutate] of [
  ["another environment ID",g=>g.id=1],
  ["Development",g=>g.name="SRM-development"],
  ["Production",g=>g.name="srm-production"],
  ["SG2",g=>g.name="sg2-staging"],
  ["CIC",g=>g.name="cic-staging"],
  ["no reviewer rule",g=>g.protection_rules=[]],
  ["empty reviewers",g=>g.protection_rules[0].reviewers=[]],
  ["another reviewer",g=>g.protection_rules[0].reviewers[0].reviewer.id=1],
  ["wrong login",g=>g.protection_rules[0].reviewers[0].reviewer.login="other"],
  ["team reviewer",g=>g.protection_rules[0].reviewers[0].type="Team"],
  ["additional reviewer",g=>g.protection_rules[0].reviewers.push({type:"User",reviewer:{id:1,login:"other"}})],
  ["duplicate reviewer rule",g=>g.protection_rules.push(structuredClone(g.protection_rules[0]))],
  ["unknown self-review state",g=>delete g.protection_rules[0].prevent_self_review],
  ["unrestricted deployment branches",g=>g.deployment_branch_policy.custom_branch_policies=false],
])test("solo approval fails closed: "+label,()=>{
  const ge=ownerEnvironment();mutate(ge);assert.throws(()=>assertStagingGitHubProtection(ge,c));
});
test("self-review cannot be enabled by missing policy or environment override",()=>{
  const copy=structuredClone(c);delete copy.github.soloOperatorApproval;
  assert.throws(()=>assertStagingGitHubProtection(ownerEnvironment(),copy));
  assert.throws(()=>assertStagingGitHubProtection(ownerEnvironment(),{...copy,SRM_ALLOW_SELF_REVIEW:true}));
  assert.doesNotThrow(()=>assertStagingGitHubProtection(ownerEnvironment(true),copy));
});
for(const [field,value] of Object.entries({id:"other",projectKey:"SG2",targetEnvironment:"production",repository:"profitia/other",repositoryId:1,environmentName:"sg2-staging",environmentId:1,preventSelfReview:true,applicationGate:"AUTOMATIC"}))
test("canonical solo approval scope cannot change: "+field,()=>{
  const copy=structuredClone(c);copy.github.soloOperatorApproval[field]=value;
  assert.throws(()=>assertStagingGitHubProtection(ownerEnvironment(),copy));
});
test("the SRM validator never grants a solo exception to another project contract",()=>{
  for(const projectKey of ["SG2","CIC"])assert.throws(()=>assertStagingGitHubProtection(ownerEnvironment(),{...c,projectKey}));
});
const m = {
  projectKey: "SRM",
  targetEnvironment: "staging",
  repository: c.repository,
  sha: "a".repeat(40),
  source: {
    repositoryId: c.repositoryId,
    approvedMainAncestor: true,
    ciPassed: true,
    developmentLiveSha: "a".repeat(40),
  },
  migrations: [{ version: "0001", checksum: "b".repeat(64) }],
};
const approval = () => ({
  schemaVersion: "2.0",
  projectKey: "SRM",
  targetEnvironment: "staging",
  stagingDeploymentAuthorized: true,
  stagingMutationsAllowed: true,
  productionMutationsAllowed: false,
  releaseSha: m.sha,
  manifestDigest: digest(m),
  repository: c.repository,
  repositoryId: c.repositoryId,
  renderWorkspaceId: c.render.workspaceId,
  renderProjectId: c.render.projectId,
  renderEnvironmentId: c.render.environmentId,
  neonProjectId: c.neon.projectId,
  neonBranchId: c.neon.branchId,
  neonEndpointId: c.neon.endpointId,
  databaseName: "srm_app",
  approvalId: "future-approved-test",
  approvedBy: "synthetic-test",
  costOwner: "synthetic-test",
  costEvidence: {
    source: "PRIMARY_PROVIDER_QUOTE",
    url: "https://render.com/pricing",
    verifiedAt: new Date().toISOString(),
    monthlyComputeUsd: 7,
  },
  operations,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  mode: "onboard",
  firstOnboardingAuthorized: true,
  githubReviewerIds: [123],
  budget: {
    renderPlan: c.render.plan,
    renderInstances: 1,
    renderMonthlyComputeUsd: 7,
    neonMaxCu: 8,
    neonExistingEndpointOnly: true,
    providerEntitlementsAccepted: true,
    storageEgressBuildCostsAccepted: true,
    maxDeploymentAttempts: 3,
  },
});
test("narrow future first-onboarding authorization passes", () =>
  assert.equal(assertLifecycleAuthorization(approval(), m, c), true));
for (const [key, value] of Object.entries({
  projectKey: "SG2",
  targetEnvironment: "production",
  stagingDeploymentAuthorized: false,
  stagingMutationsAllowed: false,
  productionMutationsAllowed: true,
  releaseSha: "c".repeat(40),
  manifestDigest: "manual-sha",
  repositoryId: 1,
  renderWorkspaceId: "other",
  renderProjectId: "other",
  renderEnvironmentId: "production",
  neonProjectId: "bold-breeze-68888550",
  neonBranchId: "br-nameless-bar-b1wlhjhx",
  neonEndpointId: "other",
  databaseName: "srm_pmos",
  approvedBy: null,
  costOwner: null,
  operations: ["reset"],
  expiresAt: "2000-01-01",
  mode: "production",
  firstOnboardingAuthorized: false,
  githubReviewerIds: [],
  budget: {},
}))
  test("fail closed " + key, () =>
    assert.throws(() =>
      assertLifecycleAuthorization({ ...approval(), [key]: value }, m, c),
    ),
  );
test("concurrent promotion and expired executor cannot take lease", () => {
  const s = {
    schemaVersion: "1.0",
    projectKey: "SRM",
    targetEnvironment: "staging",
    generation: 0,
    release: null,
  };
  const a = approval(),
    j = claimRelease(s, a, m, "github-run:1");
  assert.throws(() => claimRelease(j, a, m, "github-run:2"));
  assert.throws(() =>
    claimRelease(j, { ...a, approvalId: "different" }, m, "github-run:1"),
  );
  assert.equal(
    claimRelease(j, a, m, "github-run:2", true).release.owner,
    "github-run:2",
  );
});
test("same-scope renewal is retained in the original journal without resetting steps",()=>{
  const a=approval(),s={schemaVersion:'1.0',projectKey:'SRM',targetEnvironment:'staging',generation:0,release:null};
  const j=claimRelease(s,a,m,'github-run:1');j.release.steps['github-environment']={status:'DONE'};
  const renewed={...a,expiresAt:new Date(Date.parse(a.expiresAt)+60000).toISOString()};
  const next=claimRelease(j,renewed,m,'github-run:2',true);
  assert.equal(next.release.approvalId,a.approvalId);assert.equal(next.release.authorizationDigest,j.release.authorizationDigest);
  assert.equal(next.release.authorization.expiresAt,renewed.expiresAt);assert.equal(next.release.authorizationRenewals.length,1);
  assert.deepEqual(next.release.steps,j.release.steps);assert.equal(j.release.authorization.expiresAt,a.expiresAt);
  assert.throws(()=>claimRelease(j,{...renewed,budget:{...renewed.budget,maxDeploymentAttempts:99}},m,'github-run:2',true));
});
test("persisted authorization reconstructs exact property order without changing its digest",()=>{
  const original=approval();
  const {manifestDigest: ignored,...rest}=original;
  const a={...rest,manifest:m,manifestDigest:digest(m)};
  const state={schemaVersion:'1.0',projectKey:'SRM',targetEnvironment:'staging',generation:0,release:null};
  const j=JSON.parse(JSON.stringify(claimRelease(state,a,m,'github-run:1')));
  assert.deepEqual(authorizationFromRelease(j.release),a);
  const resumed=claimRelease(j,authorizationFromRelease(j.release),m,'github-run:2',true);
  assert.equal(resumed.release.authorizationDigest,j.release.authorizationDigest);
  const legacy=JSON.parse(JSON.stringify(j));delete legacy.release.authorizationKeyOrder;
  assert.equal(digest({...authorizationFromRelease(legacy.release),expiresAt:undefined,costEvidence:{...a.costEvidence,verifiedAt:undefined}}),legacy.release.authorizationDigest);
  legacy.release.authorization.budget.maxDeploymentAttempts=99;
  assert.throws(()=>authorizationFromRelease(legacy.release),/scope mismatch/);
});
test("CAS never publishes stale or concurrent baseline", async () => {
  let head = "a".repeat(40);
  const store = {
    read: async () => ({ head }),
    commit: async (x) => {
      assert.equal(x.expectedHead, head);
      head = "b".repeat(40);
      return head;
    },
  };
  await casPublish(store, head, {}, "test");
  await assert.rejects(casPublish(store, "a".repeat(40), {}, "stale"));
});
test("ordinary ACTIVE gate retains explicit RESERVED fixture rejection", async (t) => {
  const { resolveEnvironmentProfile } = await import("./environment-profile.mjs");
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "srm-reserved-lifecycle-test-"));
  t.after(() => fs.rmSync(temporaryRoot, {recursive:true,force:true}));
  const topology = JSON.parse(fs.readFileSync("Canon/registries/srm-environment-topology-v1.json","utf8"));
  topology.environments.staging.status = "RESERVED";
  const relative = "Canon/registries/srm-environment-topology-v1.json";
  const target = path.join(temporaryRoot,relative);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify(topology));
  assert.throws(() => resolveEnvironmentProfile({
    profile:{projectKey:"SRM",repository:{environmentTopologyRegistry:relative}},
    targetEnvironment:"staging",governanceRoot:temporaryRoot,
  }), /not ACTIVE/);
});

test("negative generation and unknown lifecycle phase fail closed", () => {
  const s = {
    schemaVersion: "1.0",
    projectKey: "SRM",
    targetEnvironment: "staging",
    generation: -1,
    release: null,
    baseline: null,
  };
  assert.throws(() => claimRelease(s, approval(), m, "test"));
  assert.throws(() =>
    claimRelease(
      { ...s, generation: 0, release: { phase: "UNREVIEWED" } },
      approval(),
      m,
      "test",
    ),
  );
});

const supplierNow = Date.parse('2026-10-10T00:00:00Z');
function supplierBindings() {
  const development = Object.fromEntries(c.requiredSecrets.map(k => [k, 'synthetic-development-' + k]));
  const values = Object.fromEntries(c.requiredSecrets.map(k => [k, 'synthetic-staging-' + k]));
  values.TARGET_ENVIRONMENT = 'staging';
  for (const k of ['MGBI_API_KEY', 'VERCLY_API_KEY', 'CEIDG_API_KEY']) values[k] = development[k];
  return { development, values };
}
test('owner-approved three supplier keys may be shared in exact SRM Staging only', () => {
  const {values, development} = supplierBindings();
  assert.equal(assertProductSecretIsolation(c, values, development, supplierNow), true);
});
test('fully isolated product secrets work without an exception or after its expiry', () => {
  const {values, development} = supplierBindings();
  for (const k of c.requiredSecrets) values[k] = 'isolated-stage-' + k;
  assert.equal(assertProductSecretIsolation({...c, vendorCredentialReuse:null}, values, development, supplierNow), true);
  assert.equal(assertProductSecretIsolation(c, values, development, Date.parse('2027-01-01')), true);
});
for (const key of ['SRM_APP_DATABASE_PASSWORD', 'SRM_DEMO_PASSWORD', 'SRM_DEMO_SESSION_SECRET']) {
  test('supplier approval never permits sharing ' + key, () => {
    const {values, development} = supplierBindings(); values[key] = development[key];
    assert.throws(() => assertProductSecretIsolation({...c,demoPasswordReuse:null}, values, development, supplierNow));
  });
}
for (const [field, value] of Object.entries({id:'other',projectKey:'SG2',targetEnvironment:'production',sourceEnvironment:'staging',owner:'other',approvedBy:null,approvalSource:'ENV_OVERRIDE',repository:'profitia/other',repositoryId:1,developmentServiceId:'other',renderEnvironmentId:'production',neonProjectId:'bold-breeze-68888550',neonBranchId:'br-nameless-bar-b1wlhjhx',approvedAt:'2026-10-11',expiresAt:'2026-11-10',sharedSecretNames:['MGBI_API_KEY','VERCLY_API_KEY','CEIDG_API_KEY','SRM_APP_DATABASE_PASSWORD'],rollback:'',monitoring:'',expiryAction:''})) {
  test('invalid supplier exception fails closed: ' + field, () => {
    const {values, development} = supplierBindings();
    assert.throws(() => assertProductSecretIsolation({...c,vendorCredentialReuse:{...c.vendorCredentialReuse,[field]:value}},values,development,supplierNow));
  });
}
test('missing canonical exception cannot be replaced by operator environment variables', () => {
  const {values,development} = supplierBindings(); values.SRM_ALLOW_SHARED_SECRETS='true';
  assert.throws(() => assertProductSecretIsolation({...c,vendorCredentialReuse:null},values,development,supplierNow));
});
test('shared supplier approval expires exactly at its recorded deadline', () => {
  const {values,development} = supplierBindings();
  assert.throws(() => assertProductSecretIsolation(c,values,development,Date.parse(c.vendorCredentialReuse.expiresAt)));
});
test('missing Development comparison and empty Stage credentials fail closed', () => {
  const {values,development} = supplierBindings();
  assert.throws(() => assertProductSecretIsolation(c,values,{...development,MGBI_API_KEY:undefined},supplierNow));
  assert.throws(() => assertProductSecretIsolation(c,{...values,MGBI_API_KEY:''},development,supplierNow));
});
for (const environment of ['development','production']) test('supplier exception cannot target ' + environment, () => {
  const {values,development}=supplierBindings();
  assert.throws(() => assertProductSecretIsolation(c,{...values,TARGET_ENVIRONMENT:environment},development,supplierNow));
});
for (const [field,value] of Object.entries({projectKey:'CIC',repository:'profitia/other',repositoryId:1})) test('foreign product identity rejects supplier sharing: ' + field, () => {
  const {values,development}=supplierBindings();
  assert.throws(() => assertProductSecretIsolation({...c,[field]:value},values,development,supplierNow));
});

function demoBindings() {
  const pair = supplierBindings();
  pair.values.SRM_DEMO_PASSWORD = pair.development.SRM_DEMO_PASSWORD;
  return pair;
}
test('separately owner-approved demo password and supplier exceptions can coexist', () => {
  const {values,development}=demoBindings();
  assert.equal(assertProductSecretIsolation(c,values,development,supplierNow),true);
});
test('demo password exception does not require sharing supplier credentials', () => {
  const {values,development}=demoBindings();
  for(const key of ['MGBI_API_KEY','VERCLY_API_KEY','CEIDG_API_KEY'])values[key]='isolated-'+key;
  assert.equal(assertProductSecretIsolation({...c,vendorCredentialReuse:null},values,development,supplierNow),true);
});
for(const key of ['SRM_APP_DATABASE_PASSWORD','SRM_DEMO_SESSION_SECRET'])test('both approved exceptions still reject '+key,()=>{
  const {values,development}=demoBindings();values[key]=development[key];
  assert.throws(()=>assertProductSecretIsolation(c,values,development,supplierNow));
});
test('missing demo approval cannot be enabled through environment override',()=>{
  const {values,development}=demoBindings();values.SRM_ALLOW_SHARED_DEMO_PASSWORD='true';
  assert.throws(()=>assertProductSecretIsolation({...c,demoPasswordReuse:null},values,development,supplierNow));
});
for(const [field,value] of Object.entries({
  id:'other',projectKey:'SG2',targetEnvironment:'production',sourceEnvironment:'staging',
  owner:'other',approvedBy:null,approvalSource:'ENV_OVERRIDE',repository:'profitia/other',
  repositoryId:1,developmentServiceId:'other',stagingServiceId:'srv-other',githubEnvironmentId:1,
  renderEnvironmentId:'production',neonProjectId:'bold-breeze-68888550',neonBranchId:'br-nameless-bar-b1wlhjhx',
  approvedAt:'2026-10-11',expiresAt:'2026-11-10',sharedSecretNames:['SRM_DEMO_PASSWORD','SRM_DEMO_SESSION_SECRET'],
  rollback:'',monitoring:'',expiryAction:'',sessionSecretMustRemainSeparate:false,databaseCredentialsMustRemainSeparate:false,
}))test('demo approval fails closed on '+field,()=>{
  const {values,development}=demoBindings();
  assert.throws(()=>assertProductSecretIsolation({...c,demoPasswordReuse:{...c.demoPasswordReuse,[field]:value}},values,development,supplierNow));
});
test('demo password approval expires exactly at its deadline',()=>{
  const {values,development}=demoBindings();
  // Isolate this exception so the supplier exception cannot mask its expiry.
  for(const key of ['MGBI_API_KEY','VERCLY_API_KEY','CEIDG_API_KEY'])values[key]='isolated-'+key;
  assert.throws(()=>assertProductSecretIsolation(c,values,development,Date.parse(c.demoPasswordReuse.expiresAt)));
});
for(const environment of ['development','production'])test('demo approval cannot target '+environment,()=>{
  const {values,development}=demoBindings();
  assert.throws(()=>assertProductSecretIsolation(c,{...values,TARGET_ENVIRONMENT:environment},development,supplierNow));
});

// Exact existing-domain correction: all values below are synthetic provider observations.
const domainSnapshot = () => ({
  services: [{ id: c.existingDomainBinding.serviceId, environmentId: c.render.environmentId }],
  domains: [{ customDomain: { ...c.existingDomainBinding.domains[0], redirectForName: "" }, cursor: "synthetic" }],
});
test("existing verified custom domain is observed with immutable service binding", () => {
  const s = domainSnapshot();
  assert.deepEqual(assertStagingDomainBinding(s, c), [{ ...c.existingDomainBinding.domains[0], serviceId:c.existingDomainBinding.serviceId }]);
  assert.equal(s.domains[0].cursor, "synthetic");
});
for (const [label, mutate] of [
  ["missing inventory",s=>delete s.domains],
  ["missing domain",s=>s.domains=[]],
  ["additional domain",s=>s.domains.push(structuredClone(s.domains[0]))],
  ["changed domain ID",s=>s.domains[0].customDomain.id="cdm-other"],
  ["changed domain name",s=>s.domains[0].customDomain.name="other.example.com"],
  ["unverified domain",s=>s.domains[0].customDomain.verificationStatus="pending"],
  ["missing verification",s=>delete s.domains[0].customDomain.verificationStatus],
  ["redirect",s=>s.domains[0].customDomain.redirectForName="other.example.com"],
  ["missing redirect evidence",s=>delete s.domains[0].customDomain.redirectForName],
  ["foreign explicit service",s=>s.domains[0].customDomain.serviceId="srv-other"],
  ["wrong service",s=>s.services[0].id="srv-other"],
  ["multiple services",s=>s.services.push(structuredClone(s.services[0]))],
  ["wrong environment",s=>s.services[0].environmentId="production"],
]) test("domain observation rejects "+label, () => {
  const s=domainSnapshot();mutate(s);assert.throws(()=>assertStagingDomainBinding(s,c));
});
for(const [field,value] of Object.entries({id:"other",projectKey:"SG2",targetEnvironment:"development",repository:"profitia/other",repositoryId:1,renderWorkspaceId:"other",renderProjectId:"other",renderEnvironmentId:"other",serviceId:"srv-other",mode:"CREATE"})) test("domain policy rejects scope change: "+field,()=>{
  const copy=structuredClone(c);copy.existingDomainBinding[field]=value;
  assert.throws(()=>assertStagingDomainBinding(domainSnapshot(),copy));
});
test("Production, Development, SG2, CIC and environment overrides cannot grant domain adoption",()=>{
  for(const projectKey of ["SG2","CIC"])assert.throws(()=>assertStagingDomainBinding(domainSnapshot(),{...c,projectKey}));
  const noPolicy={...c,existingDomainBinding:undefined,SRM_ALLOW_DOMAINS:true};
  assert.throws(()=>assertStagingDomainBinding(domainSnapshot(),noPolicy));
  assert.deepEqual(assertStagingDomainBinding({services:[],domains:[]},noPolicy),[]);
  assert.deepEqual(assertStagingDomainBinding({services:[{id:"srv-first-onboarding"}],domains:[]},c),[]);
});
test("canonical domain identity cannot be replaced by an arbitrary allowlist",()=>{
  for(const mutate of [p=>p.domains[0].id="cdm-other",p=>p.domains[0].name="other.example.com",p=>p.domains[0].verificationStatus="pending",p=>p.domains.push(structuredClone(p.domains[0]))]){
    const copy=structuredClone(c);mutate(copy.existingDomainBinding);assert.throws(()=>assertStagingDomainBinding(domainSnapshot(),copy));
  }
});
