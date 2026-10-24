import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {prepareRegistryPackages} from './pilot2-registry-package.mjs'

const hash=value=>createHash('sha256').update(value).digest('hex')
export function replaceRegistrySeam(source,from,to){
 if(source.split(from).length!==2)throw Error('Accepted Staging registry seam changed: '+from.slice(0,80))
 return source.replace(from,to)
}
/** This overlay preserves the Staging financial mapper, document acquisition,
 * calculations, seven-day freshness and UI. General acquisition and the
 * already accepted company reconciliation are the explicit changed seams. */
export function registryPilot2(repo,output,proof){
 if(proof.overlay?.stage!=='TELEMETRY')throw Error('Registry stage requires the separately measured telemetry baseline')
 const changed=new Map(proof.overlay.changedFiles.map(f=>[f.path,f.sha256]))
 const patch=(name,action)=>{
  const file=path.join(output,name),source=fs.readFileSync(file,'utf8')
  if(hash(source)!==(changed.get(name)??proof.originalFiles[name]))throw Error('Unreviewed registry overlay input: '+name)
  fs.writeFileSync(file,action(source));if(!proof.changedFiles.includes(name))proof.changedFiles.push(name)
 }
 const replace=replaceRegistrySeam
 patch('apps/srm/src/server/msr-repository.ts',source=>replace(
  'import {requirePilot2FinancialAcquisition} from "./pilot2-registry";\n'+source,
  'claim:(c,id) => withOrganization(organizationId,client => claimMsrSource(client,organizationId,c,id,requestId)),',
  'claim:(c,id) => {requirePilot2FinancialAcquisition();return withOrganization(organizationId,client => claimMsrSource(client,organizationId,c,id,requestId));},'))
 patch('apps/srm/src/server/lookup-diagnostics.ts',source=>replace(source,
  'type Provider = "MGBI" | "CEIDG" | "VERCLY";',
  'type Provider = "MGBI" | "CEIDG" | "VERCLY" | "KRS";'))
 patch('apps/srm/app/api/xray/search/route.ts',source=>replace(replace(source,
  'import { searchRegistryByNip } from "../../../../src/server/registry-search";',
  'import { searchPilot2RegistryByNip } from "../../../../src/server/pilot2-registry";'),
  'await searchRegistryByNip(organizationId, input)','await searchPilot2RegistryByNip(organizationId, input, request.signal)'))
 patch('apps/srm/src/server/xray-repository.ts',source=>replace(source,
  'retrievalMethod: "PROVIDER" | "CACHE" = "PROVIDER"): Promise<string> {\n  const provider = section === "kys"',
  'retrievalMethod: "PROVIDER" | "CACHE" = "PROVIDER", generalProvider?: "KRS" | "MGBI"): Promise<string> {\n  if(generalProvider && section!=="general")throw Error("Only General may select a registry provider");\n  const provider = section === "general" && generalProvider ? generalProvider : section === "kys"'))
 patch('apps/srm/src/server/mgbi-financial.ts',source=>{
  source=replace(source,'history?:RegistryHistory):Promise<MgbiFinancialResult|null> {','history?:RegistryHistory,includeOriginalResponse=false):Promise<MgbiFinancialResult|null> {')
  return replace(source,
   'return mapMgbiFinancialRecords(financialRecordsFromPages(JSON.parse(row.payload_text).pages),{type:"NIP",value:nip},new Date(row.retrieved_at).toISOString(),row.record_count,history);',
   'const pages=JSON.parse(row.payload_text).pages;\n    const result=mapMgbiFinancialRecords(financialRecordsFromPages(pages),{type:"NIP",value:nip},new Date(row.retrieved_at).toISOString(),row.record_count,history);\n    return includeOriginalResponse?{...result,rawResponse:{pages,recordCount:row.record_count}}:result;')
 })
 patch('apps/srm/src/server/xray-lookup.ts',source=>{
  source='import {currentPilot2RegistrySelection,reconcilePilot2Financial,pilot2SkipCompanyCache,requirePilot2FinancialAcquisition} from "./pilot2-registry";\n'+source
  source=replace(source,'startAttempt(organizationId, lookup.requestId, sectionName, 1, retrievalMethod)',
   'startAttempt(organizationId, lookup.requestId, sectionName, 1, retrievalMethod, sectionName==="general" && section.source.provider==="KRS"?"KRS":undefined)')
  source=replace(source,'  const cached = await atLookupStage("cache_read", () => readFreshCompany(organizationId, request.identifier.value));',
   '  const registry=currentPilot2RegistrySelection();\n  const cached = pilot2SkipCompanyCache()?null:await atLookupStage("cache_read", () => readFreshCompany(organizationId, request.identifier.value));\n  if(cached && registry){cached.general=registry.general;cached.generalReprojected=true;}')
  source=replace(source,'const companyData = await enrichCompanyPkd(organizationId, request.identifier.value, cached.general);',
   'const companyData = cached.general.source.provider==="KRS"?cached.general.data:await enrichCompanyPkd(organizationId, request.identifier.value, cached.general);')
  source=replace(source,'    if (cached.generalReprojected) {','    let registrySnapshotId:string|null=null;\n    if (cached.generalReprojected) {')
  source=replace(source,'      await saveSharedCompany(organizationId,request.identifier.value,{general,financial:cached.financial,generalSnapshotId:snapshotId,financialSnapshotId:null,facts:[]});',
   '      registrySnapshotId=snapshotId;\n      if(!registry)await saveSharedCompany(organizationId,request.identifier.value,{general,financial:cached.financial,generalSnapshotId:snapshotId,financialSnapshotId:null,facts:[]});')
  source=replace(source,'logProviderOutcome("MGBI", "general", cached.general.status, null, "CACHE");',
   'logProviderOutcome(general.source.provider==="KRS"?"KRS":"MGBI", "general", general.status, null, registry?"PROVIDER":"CACHE");')
  source=replace(source,
   'const reconstructed = needsRevisionProjection || needsRegistryProjection || needsQualityProjection ? await reprojectFinancialArchive(organizationId,request.identifier.value,history) : null;',
   'let reconstructed = registry || needsRevisionProjection || needsRegistryProjection || needsQualityProjection ? await reprojectFinancialArchive(organizationId,request.identifier.value,history,!!registry) : null;\n    if(registry)reconstructed=await reconcilePilot2Financial(registry,reconstructed??await fetchCompanyFinancial(general.data,request.identifier));')
  source=replace(source,'const msr = await atLookupStage("financial_persistence", () => enrichMsrFinancial(',
   'let msr = await atLookupStage("financial_persistence", () => enrichMsrFinancial(')
  source=replace(source,'const latest=await fetchMgbiFinancial(request.identifier,{companyHistory:history});',
   'requirePilot2FinancialAcquisition();\n        let latest=await fetchMgbiFinancial(request.identifier,{companyHistory:history});\n        if(registry)latest=await reconcilePilot2Financial(registry,latest);')
  source=replace(source,'      }}),"financial");\n    const documents=',
   '      }}),"financial");\n    if(registry)msr={...await reconcilePilot2Financial(registry,msr),msrChanged:msr.msrChanged};\n    const documents=')
  source=replace(source,'if (msr.msrChanged || reconstructed || JSON.stringify(savedFinancial)!==JSON.stringify(cached.financial)) {',
   'if (registry || msr.msrChanged || reconstructed || JSON.stringify(savedFinancial)!==JSON.stringify(cached.financial)) {')
  source=replace(source,'generalSnapshotId:null,financialSnapshotId:snapshotId,facts:msr.facts,preserveGeneral:true',
   'generalSnapshotId:registrySnapshotId,financialSnapshotId:snapshotId,facts:msr.facts,preserveGeneral:!registry')
  source=replace(source,'krs: cached.general.data?.krs ?? null,\n        nip: cached.general.data?.nip ?? request.identifier.value,\n        name: cached.general.data?.legalName ?? null,',
   'krs: general.data?.krs ?? null,\n        nip: general.data?.nip ?? request.identifier.value,\n        name: general.data?.legalName ?? null,')
  source=replace(source,'const general = await fetchMgbiGeneral(request.identifier).catch',
   'const general = registry?{section:registry.general,rawRecord:null,rawResponse:undefined,errorCode:null}:await fetchMgbiGeneral(request.identifier).catch')
  source=replace(source,'  logProviderOutcome("MGBI", "general", general.section.status, general.errorCode);',
   '  if(registry)financial=await reconcilePilot2Financial(registry,financial);\n  logProviderOutcome(registry?"KRS":"MGBI", "general", general.section.status, general.errorCode);')
  source=replace(source,'  if (!isCompanyReportRestricted(general.section.data) && financial.section.data) {',
   '  if(registry && !isCompanyReportRestricted(general.section.data))financial=await reconcilePilot2Financial(registry,financial);\n  if (!isCompanyReportRestricted(general.section.data) && financial.section.data) {')
  return source
 })
 patch('apps/srm/next.config.ts',source=>replace(replace(source,
  'serverExternalPackages: ["pdfkit"]','serverExternalPackages: ["pdfkit","@profitia/platform-contracts","@profitia/krs-registry-contracts","@profitia/krs-registry-runtime"]'),
  'outputFileTracingIncludes: {','outputFileTracingIncludes: { "/*": ["./node_modules/@profitia/platform-contracts/src/**/*","./node_modules/@profitia/krs-registry-contracts/dist/**/*","./node_modules/@profitia/krs-registry-runtime/dist/**/*"],'))
 const copy=(name,destination=name)=>{
  const to=path.join(output,destination)
  if(fs.existsSync(to))throw Error('Registry helper would overwrite baseline source: '+destination)
  fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(repo,name),to);proof.addedFiles.push(destination)
 }
 for(const name of ['pilot2-registry.ts','krs-general.ts','krs-continuity.ts','krs-financial.ts','native-pg-driver.ts'])copy('apps/srm/src/server/'+name)
 for(const name of ['pilot2-registry-targets.json','krs-name-pilot-targets.json'])copy('apps/srm/deployment/'+name)
 copy('apps/srm/scripts/build-krs-contract.mjs')
 // KRS adds typed provenance only; all runtime financial functions remain the
 // archived Staging implementation.
 patch('packages/srm-xray/src/contracts.ts',()=>fs.readFileSync(path.join(repo,'packages/srm-xray/src/contracts.ts'),'utf8'))
 prepareRegistryPackages(repo,output,proof)
 proof.exactBusinessSource=false
 proof.overlay={...proof.overlay,stage:'REGISTRY',previousStage:'TELEMETRY',
  adapterSha256:hash(fs.readFileSync(new URL('./pilot2-registry-overlay.mjs',import.meta.url))),
  companyIdentityAuthority:'EXISTING_KRS_SOURCE_AND_CANONICAL_RECONCILIATION',humanAuthorizationStage:'NOT_YET_ADOPTED',
  financialEngine:'STAGING_6eede5cd_WITH_EXPLICIT_COMPANY_RECONCILIATION',
  changedFiles:proof.changedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))})),
  addedFiles:proof.addedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))}))}
 return proof
}
