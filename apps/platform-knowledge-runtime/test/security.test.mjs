import test from 'node:test';import assert from 'node:assert/strict';
import {usableMemory} from '../src/memory.mjs';
const principal={environment:'development',internalUserId:'user-a',organisationIds:[],usePurpose:'CUSTOMER_SERVICE'};
const now=Date.parse('2026-11-11T12:00:00Z'),rights={classification:'UNKNOWN',purpose:'PRIVATE',organisationConstraintId:null,quotingAllowed:true,apiExcerptAllowed:true};
const source={id:'source',scope:'ACCOUNT_PRIVATE',ownerUserId:'user-a',ownerOrganisationId:null,environment:'development',status:'CURRENT',activeGenerationId:'g1',sourceVersion:1,rights};
const memory={scope:'ACCOUNT_PRIVATE',ownerUserId:'user-a',ownerOrganisationId:null,text:'A short supported preference',origin:'DOCUMENT',sourceRefs:[{sourceId:'source',generationId:'g1',sourceVersion:'1'}],expiresAt:new Date(now+10000).toISOString()};
const options={principal,accountState:{user_id:'user-a',memory_enabled:true,consent_version:'pk-memory-opt-in-v1',consent_at:new Date(now).toISOString()},sources:[source],now};
test('prepared memory eligibility needs opt-in, current owner and every source restriction',()=>{
 assert.equal(usableMemory(memory,options),true);
 for(const changes of [{accountState:{...options.accountState,memory_enabled:false}},{accountState:{...options.accountState,deleted_at:'now'}},{principal:{...principal,internalUserId:'user-b'}},{sources:[]},{sources:[{...source,activeGenerationId:'g2'}]},{sources:[{...source,revokedAt:'now'}]},{sources:[{...source,rights:{...rights,organisationConstraintId:'former-org'}}]}])assert.equal(usableMemory(memory,{...options,...changes}),false);
 assert.equal(usableMemory({...memory,sourceRefs:[],origin:'DOCUMENT'},options),false);assert.equal(usableMemory({...memory,sourceRefs:[],origin:'USER_EXPLICIT'},options),true);
});
