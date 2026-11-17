import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {organisationInstallationPlan,organisationInstallationSources,organisationRuntimeFunctionGrants} from '../scripts/install-organisation-lifecycle.mjs'
import {organisationSelectionSchemaUrl,organisationSelectionSchemaDigest} from '../../../packages/platform-contracts/src/organisation-context.mjs'

test('Development installation plan supplies the exact schema consumed by optional organisation selection without enabling or widening grants',async()=>{
 const plan=organisationInstallationPlan(),selection=plan.organisationContext.selection
 const migration=plan.migrations.find(entry=>entry.path===selection.sql)
 assert(migration,'the deployed selection API must have its schema in the installation plan')
 assert.equal(migration.sha256,await organisationSelectionSchemaDigest())
 assert.equal(organisationInstallationSources[selection.sql].sql,fs.readFileSync(new URL(organisationSelectionSchemaUrl),'utf8'))
 assert.equal(plan.sqlExecuted,false);assert.equal(plan.sourceOnly,true)
 assert.equal(selection.defaultEnabled,false);assert.equal(selection.enrolmentSeparate,true)
 assert.equal(selection.noBusinessGrant,true);assert.equal(selection.ownActiveMembershipsOnly,true)
 for(const purpose of ['IDENTITY','REGISTRY'])assert.doesNotMatch(organisationRuntimeFunctionGrants('isolated_runtime',purpose),/organisation_selection|read_organisation_choices|read_selected_organisation_context|select_own_organisation/)
})
