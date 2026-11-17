import {createOrganisationInvitationLinkBuilder,ORGANISATION_INVITATION_LIFETIME_MS} from '@profitia/platform-contracts/organisation-invitations'
import type {AssistantAvatar} from './email-avatar.js'
import type {CommunicationLanguage} from './communication-language.js'
import type {EmailContent,InlineImage} from './mailgun-delivery.js'
import {mailbox} from './mailgun-delivery.js'
import {verifyEmailAsset} from './email-runtime.js'

export interface OrganisationInvitationEmail {
  token:string;createdAt:string;expiresAt:string
  inviterName:string|null;inviterEmail:string;organisationName:string
  avatar:AssistantAvatar;language:CommunicationLanguage
  /** Read from the recipient's persisted profile. Never guessed from an email address. */
  recipientProfile:Readonly<{firstName:string|null;vocative:string|null;dictionaryVersion:string|null}>|null
}
type Asset=Readonly<{filename:string;url:string;sha256:string}>
type Renderer={
  inlineAssetsForAvatar(avatar:AssistantAvatar,kind:'organisation-invitation'):Asset[]
  renderMailgunResolved(options:{kind:'organisation-invitation';avatar:AssistantAvatar;language:CommunicationLanguage;allowedActionOrigins:readonly string[];data:Record<string,unknown>}):EmailContent
}
const renderer=async()=>await import(new URL('../../email-templates/render.mjs',import.meta.url).href) as Renderer
/** Presentation only. This is not invitation authorization, enqueueing or delivery. */
export async function prepareOrganisationInvitationEmail(input:OrganisationInvitationEmail,options:{
  identityOrigin:string;allowedIdentityOrigins:readonly string[];now?:()=>number
}):Promise<Readonly<{content:EmailContent;assets:readonly Asset[]}>>{
  const now=(options.now??Date.now)(),created=Date.parse(input.createdAt),expires=Date.parse(input.expiresAt)
  if(!Number.isFinite(now)||!Number.isFinite(created)||!Number.isFinite(expires)||created>now||expires<=now
    ||expires-created!==ORGANISATION_INVITATION_LIFETIME_MS
    ||!['male','female','neutral'].includes(input.avatar)||!['pl','en'].includes(input.language))throw Error('ORGANISATION_INVITATION_EMAIL_REJECTED')
  const actionUrl=createOrganisationInvitationLinkBuilder({identityOrigin:options.identityOrigin,allowedIdentityOrigins:options.allowedIdentityOrigins}).build(input.token)
  const profile=input.recipientProfile
  let firstName:string|null=null,vocative:string|null=null
  if(profile!==null){
    const name=(v:unknown)=>v===null||typeof v==='string'&&v===v.trim()&&v.length>0&&[...v].length<=160&&!/[\p{Cc}\p{Cf}]|\{\{|\}\}/u.test(v)
    if(!name(profile.firstName)||!name(profile.vocative)
      ||!(profile.dictionaryVersion===null||typeof profile.dictionaryVersion==='string'&&/^[A-Za-z0-9._:-]{1,160}$/.test(profile.dictionaryVersion))
      ||profile.vocative!==null&&(profile.firstName===null||profile.dictionaryVersion===null))throw Error('ORGANISATION_INVITATION_SALUTATION_REJECTED')
    // Missing dictionary match uses a neutral Polish greeting, not an invented declension.
    if(input.language==='en'||profile.vocative!==null){firstName=profile.firstName;vocative=profile.vocative}
  }
  const module=await renderer()
  const content=module.renderMailgunResolved({kind:'organisation-invitation',avatar:input.avatar,language:input.language,
    allowedActionOrigins:options.allowedIdentityOrigins,data:{appName:'SpendGuru',currentYear:new Date(created).getUTCFullYear(),
      actionUrl,expiresInDays:7,inviterName:input.inviterName,inviterEmail:mailbox(input.inviterEmail),organisationName:input.organisationName,firstName,vocative}})
  return Object.freeze({content,assets:Object.freeze(module.inlineAssetsForAvatar(input.avatar,'organisation-invitation').map(asset=>Object.freeze({...asset})))})
}
/** Attach only canonical, digest-pinned PNGs; no provider or recipient access. */
export async function attachOrganisationInvitationAssets(plan:Awaited<ReturnType<typeof prepareOrganisationInvitationEmail>>,fetcher:typeof fetch=fetch):Promise<EmailContent>{
  const inline:InlineImage[]=[]
  for(const asset of plan.assets){
    const url=new URL(asset.url)
    if(url.origin!=='https://storage.googleapis.com'||!url.pathname.startsWith('/storage.magicpath.ai/component-assets/')
      ||!/^[-A-Za-z0-9_.]+\.png$/.test(asset.filename)||!/^[a-f0-9]{64}$/.test(asset.sha256))throw Error('EMAIL_ASSET_ORIGIN')
    const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(10000)})
    if(!response.ok||!response.body){await response.body?.cancel();throw Error('EMAIL_ASSET_UNAVAILABLE')}
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
    try{for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength
      if(size>2000000){await reader.cancel();throw Error('EMAIL_ASSET_LIMIT')}chunks.push(chunk.value)}}
    finally{reader.releaseLock()}
    inline.push(verifyEmailAsset(Buffer.concat(chunks),asset))
  }
  return {...plan.content,inline}
}
