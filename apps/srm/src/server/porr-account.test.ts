import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {readPorrAccountOrigin} from './identity-runtime';
const issuer='https://fixture.clerk.accounts.dev';
const valid={TARGET_ENVIRONMENT:'development',PROFITIA_AUTH_PROVIDER:'clerk',SRM_PORR_ACCOUNT_ENABLED:'true',SRM_IDENTITY_ACCOUNT_ORIGIN:'https://identity-runtime-development.onrender.com',PROFITIA_CLERK_ISSUER:issuer,PROFITIA_CLERK_PUBLISHABLE_KEY:'pk_test_'+Buffer.from('fixture.clerk.accounts.dev$').toString('base64url'),PROFITIA_CLERK_SECRET_KEY:'sk_test_fixture',PROFITIA_CLERK_AUTHORIZED_PARTIES:JSON.stringify(['https://srm-development-runtime.onrender.com'])};
test('PORR live account is opt-in and exact Development only',()=>{
 assert.equal(readPorrAccountOrigin({}),null);assert.equal(readPorrAccountOrigin(valid),valid.SRM_IDENTITY_ACCOUNT_ORIGIN);
 for(const patch of [{TARGET_ENVIRONMENT:'staging'},{TARGET_ENVIRONMENT:'production'},{SRM_PORR_ACCOUNT_ENABLED:'yes'},{PROFITIA_AUTH_PROVIDER:'legacy_demo'},{SRM_IDENTITY_ACCOUNT_ORIGIN:'https://evil.test'},{PROFITIA_CLERK_AUTHORIZED_PARTIES:'["https://other.test"]'}])assert.throws(()=>readPorrAccountOrigin({...valid,...patch}));
});
test('public adoption receipt pins reviewed design and closed origins',()=>{
 const x=JSON.parse(fs.readFileSync('deployment/identity-account-v1.json','utf8'));
 assert.equal(x.magicPath.revisionId,'464297738012618752');assert.equal(x.identityOrigin,readPorrAccountOrigin(valid));assert.equal(x.targetEnvironment,'development');
});
