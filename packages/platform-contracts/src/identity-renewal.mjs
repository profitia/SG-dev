import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createProfileSql,closedObject,deny} from './identity-profile-sql.mjs'

export const IDENTITY_RENEWAL_CONTRACT=Object.freeze({id:'profitia.identity-binding-renewal',version:'1.0.0'})
export const renewalSchemaUrl=new URL('../migrations/profile/002-binding-renewal.sql',import.meta.url).href
export const renewalSchemaDigest=()=>createHash('sha256').update(readFileSync(new URL(renewalSchemaUrl))).digest('hex')
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

/** Internal verified-identity callback only. HTTP/provider verification and the
 * owning transaction remain with the existing provisioner. Never creates data. */
export function createIdentityRenewalSql(options) {
  const {renewalSchemaDigest:expected,issuer,now=Date.now}=options
  if(!/^[a-f0-9]{64}$/.test(expected??''))throw new TypeError('Explicit renewal installation digest required')
  const sql=createProfileSql(options)
  return Object.freeze({contract:IDENTITY_RENEWAL_CONTRACT,
    async revalidate(query,identity,identityUntil) {
      if(identity?.issuer!==issuer||typeof identity.subject!=='string'||!Number.isSafeInteger(identityUntil)||identityUntil<=now())deny()
      await sql.descriptor(query)
      const {descriptor}=await sql.queryOne(query,'SELECT profitia_profile.binding_renewal_descriptor() AS descriptor')
      if(descriptor?.renewalSchemaDigest!==expected)deny()
      const readProof=await sql.attest(query,{operation:'identity.binding.inspect',principal:identity.subject,issuer,identityUntil,expiresAt:identityUntil})
      const {metadata:m}=await sql.queryOne(query,'SELECT profitia_profile.binding_renewal_metadata($1,$2,$3::bigint,$4::bigint,$5) AS metadata',
        [issuer,identity.subject,identityUntil,readProof.until,readProof.signature])
      if(m===null)return false
      if(!closedObject(m)||Object.keys(m).sort().join(',')!=='allowExpiredRecovery,allowRenewal,expiresAt,maxRecoveryAgeMs,revision,userId,version'
        ||!uuid.test(m.userId??'')||typeof m.version!=='string'||!new RegExp('^'+uuid.source.slice(1,-1)+':[1-9][0-9]*:[1-9][0-9]*$','i').test(m.version)
        ||typeof m.expiresAt!=='string'||!Number.isFinite(Date.parse(m.expiresAt))||!Number.isSafeInteger(m.revision)||m.revision<1
        ||typeof m.allowRenewal!=='boolean'||typeof m.allowExpiredRecovery!=='boolean'||!Number.isInteger(m.maxRecoveryAgeMs)
        ||m.maxRecoveryAgeMs<0||m.maxRecoveryAgeMs>604800000||m.allowExpiredRecovery&&(!m.allowRenewal||m.maxRecoveryAgeMs===0))deny()
      const remaining=Date.parse(m.expiresAt)-now()
      if(remaining>30000)return true
      if(!m.allowRenewal||remaining<=0&&(!m.allowExpiredRecovery||-remaining>m.maxRecoveryAgeMs))deny()
      const mode=remaining>0?'RENEW':'RECOVER_EXPIRED'
      const principal=createHash('sha256').update(['binding-renewal-v1',identity.subject,m.version,mode,String(m.revision)].join('\u001f')).digest('hex')
      const proof=await sql.attest(query,{operation:'identity.binding.renew',principal,issuer,identityUntil,expiresAt:identityUntil})
      await sql.queryOne(query,'SELECT profitia_profile.renew_binding($1,$2,$3,$4,$5::bigint,$6::bigint,$7::bigint,$8) AS binding',
        [issuer,identity.subject,m.version,mode,m.revision,identityUntil,proof.until,proof.signature])
      return true
    },
  })
}
