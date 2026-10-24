import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
export const vocativeSchemaDigest = () => createHash('sha256').update(readFileSync(new URL('../migrations/profile/006-vocative.sql', import.meta.resolve('@profitia/platform-contracts/user-profile')))).digest('hex')
const dictionaryModule = import(new URL('./vocative-dictionary.mjs', import.meta.resolve('@profitia/platform-contracts/user-profile')).href) as Promise<{vocativeReviewDigest:()=>string}>
export type Salutation = {firstName?:string|null;vocative?:string|null}
export async function requireVocative(query:(sql:string)=>Promise<{rows:Record<string,unknown>[]}>) {
 const d=(await query('SELECT profitia_profile.vocative_descriptor() AS d')).rows[0]?.d as Record<string,unknown>|undefined
 if(!d||d.salutationEnabled!==true||d.vocativeSchemaDigest!==vocativeSchemaDigest()||d.dictionaryDigest!==(await dictionaryModule).vocativeReviewDigest())throw Error('VOCATIVE_UNAVAILABLE')
}
