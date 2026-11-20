import { createRegistrationStore, registrationSchemaDigest, type RegistrationStore } from './registration-store.js'
import { createRegistrationProvider } from './registration-provider.js'
import { createRegistrationSurface, type RegistrationSurface } from './registration.js'
import { createCommunicationLanguageSurface, type CommunicationLanguageSurface } from './communication-language.js'
import {createReportEmailRuntime} from './report-email.js'
import {createCalendarEmailRuntime} from './calendar-email.js'
import {createCalendarMailgunWebhook} from './calendar-mailgun-webhook.js'
import { createEmailRuntime, loadEmailRenderer, type EmailSurface } from './email-runtime.js'
import { createClerkEmailVerifier } from './email-webhook.js'
import { createEmailStore } from './email-store.js'
import { createEmailRecipientVerifier } from './email-correlation.js'
import { createMailgunTransactionalSender } from './mailgun-delivery.js'
import pg from 'pg'
import { createHash } from 'node:crypto'
import {createCurrentAuthority} from './current-e1-authority.js'
import type {CurrentE1Authority} from '@profitia/platform-current-e1-authority'
import { createAssistantAvatarSurface, type AssistantAvatarSurface } from './assistant-avatar.js'
import { createAccountSalutationSurface, type AccountSalutationSurface } from './account-salutation.js'
import { readConfiguration } from './config.js'
import { createOfficialClient } from './official-client.js'
import { createSessionBoundary, createDatabaseAuthority } from './session-boundary.js'
import { createHttpHandler } from './http-handler.js'
import { createNodeServer } from './node-server.js'
import { readDeploymentOrigin } from './deployment-configuration.js'
import type { SessionBoundary } from './contracts.js'
import { embeddedTargets, createEmbeddedAccountHandler, type EmbeddedAccountSurface } from './embedded-account.js'
import { createAccountSurface, accountTransactions, type AccountSurface } from './account-provisioning.js'
let email: EmailSurface | null = null
let reportEmail:ReturnType<typeof createReportEmailRuntime>|null=null
let calendarEmail:ReturnType<typeof createCalendarEmailRuntime>|null=null
let calendarWebhook:ReturnType<typeof createCalendarMailgunWebhook>|null=null
let calendarPool:pg.Pool|null=null
async function closeCalendarPool(){const p=calendarPool;calendarPool=null;await p?.end()}
let pool: pg.Pool | null = null
async function start() {
let boundary: SessionBoundary | null = null
let account: AccountSurface | null = null
let avatar: AssistantAvatarSurface | null = null
let salutation: AccountSalutationSurface | null = null
let language: CommunicationLanguageSurface | null = null
let registration: RegistrationSurface | null = null
let registrationStore: RegistrationStore | null = null
let embedded: ReturnType<typeof createEmbeddedAccountHandler> | null = null
let currentE1:CurrentE1Authority|null=null
if (process.env.IDENTITY_CURRENT_E1_ENABLED !== undefined && !['true','false'].includes(process.env.IDENTITY_CURRENT_E1_ENABLED)) throw Error('INVALID_CURRENT_E1_FLAG')
if (process.env.IDENTITY_CURRENT_E1_ENABLED==='true' && process.env.IDENTITY_RUNTIME_ENABLED!=='true') throw Error('CURRENT_E1_RUNTIME_REQUIRED')
const embeddedInput: unknown = JSON.parse(process.env.IDENTITY_EMBEDDED_TARGETS ?? '[]')
if (!Array.isArray(embeddedInput) || embeddedInput.length && process.env.IDENTITY_SELF_SERVICE_ENABLED !== 'true') throw Error('EMBEDDED_ACCOUNT_DEPENDENCIES')
if (process.env.IDENTITY_REGISTRATION_ENABLED !== undefined && !['true','false'].includes(process.env.IDENTITY_REGISTRATION_ENABLED)) throw Error('INVALID_REGISTRATION_FLAG')
if (process.env.IDENTITY_REGISTRATION_ENABLED === 'true' && (process.env.IDENTITY_EMAIL_ENABLED !== 'true' || process.env.IDENTITY_SELF_SERVICE_ENABLED !== 'true')) throw Error('REGISTRATION_DEPENDENCIES')
if (process.env.IDENTITY_EMAIL_ENABLED !== undefined && !['true','false'].includes(process.env.IDENTITY_EMAIL_ENABLED)) throw Error('INVALID_EMAIL_FLAG')
if (process.env.IDENTITY_EMAIL_ENABLED === 'true' && process.env.IDENTITY_RUNTIME_ENABLED !== 'true') throw Error('EMAIL_RUNTIME_REQUIRED')
if (process.env.IDENTITY_CALENDAR_DELIVERY_ENABLED !== undefined && !['true','false'].includes(process.env.IDENTITY_CALENDAR_DELIVERY_ENABLED)) throw Error('INVALID_CALENDAR_DELIVERY_FLAG')
if (process.env.IDENTITY_SELF_SERVICE_ENABLED !== undefined && !['true', 'false'].includes(process.env.IDENTITY_SELF_SERVICE_ENABLED)) throw Error('INVALID_SELF_SERVICE_FLAG')
if (process.env.IDENTITY_SELF_SERVICE_ENABLED === 'true' && process.env.IDENTITY_RUNTIME_ENABLED !== 'true') throw Error('RUNTIME_REQUIRED')
if (process.env.IDENTITY_BINDING_RENEWAL_ENABLED !== undefined && !['true', 'false'].includes(process.env.IDENTITY_BINDING_RENEWAL_ENABLED)) throw Error('INVALID_RENEWAL_FLAG')
if (process.env.IDENTITY_BINDING_RENEWAL_ENABLED === 'true' && process.env.IDENTITY_SELF_SERVICE_ENABLED !== 'true') throw Error('SELF_SERVICE_REQUIRED')
const port = Number(process.env.PORT ?? '3600'); if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('INVALID_PORT')
let origin = readDeploymentOrigin(process.env.IDENTITY_RUNTIME_PUBLIC_ORIGIN, `http://127.0.0.1:${port}`)
if (process.env.IDENTITY_RUNTIME_ENABLED === 'true') {
  // Only a later owner-authorized deployment may supply these private values.
  const config = readConfiguration(JSON.parse(process.env.IDENTITY_RUNTIME_CONFIGURATION ?? 'null'))
  if (process.env.IDENTITY_RUNTIME_PUBLIC_ORIGIN !== undefined && config.origin !== origin) throw Error('PUBLIC_ORIGIN_BINDING')
  if (!process.env.CLERK_SECRET_KEY || !process.env.IDENTITY_DATABASE_URL || !process.env.IDENTITY_ACCESS_BINDING) throw Error('PRIVATE_CONFIGURATION_REQUIRED')
  const binding = JSON.parse(process.env.IDENTITY_ACCESS_BINDING)
  if (binding.applicationId !== config.applicationId || binding.environment !== config.environment || binding.role !== 'identity_b1_runtime') throw Error('EXACT_RUNTIME_BINDING_REQUIRED')
  const u = new URL(process.env.IDENTITY_DATABASE_URL)
  if (u.protocol !== 'postgresql:' || decodeURIComponent(u.username) !== binding.role || decodeURIComponent(u.pathname.slice(1)) !== binding.databaseName) throw Error('DATABASE_ROLE_BINDING')
  pool = new pg.Pool({ host: u.hostname, port: Number(u.port || '5432'), user: binding.role, password: decodeURIComponent(u.password), database: binding.databaseName, ssl: { rejectUnauthorized: true }, max: 8, connectionTimeoutMillis: 5000 })
  pool.on('error', () => {})
  const authority = createDatabaseAuthority(binding, (sql, values) => pool!.query(sql, values), config.issuer)
  const client = createOfficialClient(config, process.env.CLERK_SECRET_KEY)
  if (process.env.IDENTITY_CURRENT_E1_ENABLED==='true') {
    currentE1=createCurrentAuthority((sql,values)=>pool!.query(sql,values as unknown[]),client,binding)
    if (!await currentE1.ready()) throw Error('CURRENT_E1_SCHEMA_REQUIRED')
  }
  if (process.env.IDENTITY_EMAIL_ENABLED === 'true') {
    if (config.environment !== 'development') throw Error('EMAIL_DEVELOPMENT_ONLY')
    const e = JSON.parse(process.env.IDENTITY_EMAIL_CONFIGURATION ?? 'null')
    if (!e || Object.keys(e).sort().join(',') !== ['instanceId','serviceId','schemaDigest','keyId','region','domain','from','senderName','appName','recipientPolicy','authorizedRecipients','allowedInvitationOrigins'].sort().join(',')
      || !Array.isArray(e.authorizedRecipients) || !Array.isArray(e.allowedInvitationOrigins)) throw Error('EMAIL_CONFIGURATION_REQUIRED')
    const proof = process.env.IDENTITY_EMAIL_PROOF_KEY, encryption = process.env.IDENTITY_EMAIL_ENCRYPTION_KEY
    if (!/^[a-f0-9]{64}$/.test(proof ?? '') || !/^[a-f0-9]{64}$/.test(encryption ?? '') || !process.env.MAILGUN_SENDING_KEY || !process.env.CLERK_EMAIL_SIGNING_SECRET) throw Error('EMAIL_SECRETS_REQUIRED')
    const transaction = accountTransactions(pool)
    const store = createEmailStore({binding, issuer:config.issuer, instanceId:e.instanceId, serviceId:e.serviceId, schemaDigest:e.schemaDigest,
      proofKey:Buffer.from(proof!, 'hex'), encryptionKey:Buffer.from(encryption!, 'hex'), keyId:e.keyId},
      run => transaction(tx => run({query:tx.query}), {timeoutMs:15000,maxWaitMs:3000}))
    if (process.env.IDENTITY_REGISTRATION_ENABLED === 'true') {
      if (process.env.IDENTITY_REGISTRATION_SCHEMA_DIGEST !== registrationSchemaDigest()) throw Error('REGISTRATION_SCHEMA_REQUIRED')
      registrationStore = createRegistrationStore({binding,issuer:config.issuer,instanceId:e.instanceId,serviceId:e.serviceId,schemaDigest:e.schemaDigest,
        proofKey:Buffer.from(proof!, 'hex'),encryptionKey:Buffer.from(encryption!, 'hex'),keyId:e.keyId},
        run => transaction(tx => run({query:tx.query}), {timeoutMs:15000,maxWaitMs:3000}))
      const provider = createRegistrationProvider({secret:process.env.CLERK_SECRET_KEY,issuer:config.issuer,instanceId:e.instanceId,environment:config.environment})
      await provider.guard()
      registration = createRegistrationSurface(registrationStore, provider); await registration.ready()
    }
    // Opt-in: Clerk continues delivering its native security notification until
    // a separate accepted release and provider-template cutover are verified.
    const revocationOrigins=process.env.IDENTITY_NEW_DEVICE_EMAIL_ENABLED==='true'?
      [...new Set([new URL(config.issuer).origin,new URL(config.issuer.replace(/\.clerk\.accounts\.dev$/,'.accounts.dev')).origin])]:[]
    const verify = createClerkEmailVerifier({environment:'development', instanceId:e.instanceId, signingSecret:process.env.CLERK_EMAIL_SIGNING_SECRET, allowedInvitationOrigins:e.allowedInvitationOrigins,allowedRevocationOrigins:revocationOrigins})
    const send = createMailgunTransactionalSender({environment:'development',region:e.region,domain:e.domain,apiKey:process.env.MAILGUN_SENDING_KEY,
      authorizedRecipients:e.authorizedRecipients,recipientPolicy:e.recipientPolicy,from:e.from,senderName:e.senderName})
    await store.ready()
    const render = await loadEmailRenderer(e.appName, e.allowedInvitationOrigins,fetch,revocationOrigins)
    email = createEmailRuntime({verify,store,render,send,recipient:createEmailRecipientVerifier(client),
      diagnostic:code => console.error('identity-email: '+code)})
    if(process.env.IDENTITY_REPORT_DELIVERY_ENABLED==='true'){
      if(!currentE1||!process.env.IDENTITY_REPORT_DELIVERY_SCHEMA_DIGEST)throw Error('REPORT_DELIVERY_AUTHORITY_REQUIRED')
      reportEmail=createReportEmailRuntime({query:(sql,values)=>pool!.query(sql,values),client,reportSchemaDigest:process.env.IDENTITY_REPORT_DELIVERY_SCHEMA_DIGEST,
        mailgun:{environment:'development',region:e.region,domain:e.domain,apiKey:process.env.MAILGUN_SENDING_KEY,authorizedRecipients:[],from:e.from,senderName:e.senderName},
        diagnostic:code=>console.error('identity-email: '+code)})
      await reportEmail.ready()
      const security=email,report=reportEmail
      email={...security,async ready(){await Promise.all([security.ready(),report.ready()])},async stop(){await Promise.all([security.stop(),report.stop()])}}
    }
    if(process.env.IDENTITY_CALENDAR_DELIVERY_ENABLED==='true'){
      if(!currentE1||!process.env.IDENTITY_CALENDAR_SCHEMA_DIGEST)throw Error('CALENDAR_DELIVERY_AUTHORITY_REQUIRED')
      const u=new URL(process.env.IDENTITY_CALENDAR_DATABASE_URL??'')
      if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!=='ep-silent-lake-b9o1yr6z.c-7.eu-central-1.aws.neon.tech'||u.username!=='economic_calendar_development_delivery'||u.pathname!=='/economic_calendar_development'||!['require','verify-full'].includes(u.searchParams.get('sslmode')??''))throw Error('CALENDAR_DELIVERY_DATABASE_BINDING_REQUIRED')
      u.searchParams.delete('sslmode');u.searchParams.delete('channel_binding')
      calendarPool=new pg.Pool({connectionString:u.href,ssl:{rejectUnauthorized:true},max:2,connectionTimeoutMillis:3000,query_timeout:10000,idleTimeoutMillis:10000});calendarPool.on('error',()=>{})
      const {rows:[login]}=await calendarPool.query("SELECT session_user,current_user,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,EXISTS(SELECT 1 FROM pg_roles o WHERE o.rolname LIKE '%\\_owner' ESCAPE '\\' AND pg_has_role(current_user,o.oid,'MEMBER')) AS owner_member FROM pg_roles WHERE rolname=current_user")
      if(!login||login.session_user!=='economic_calendar_development_delivery'||login.current_user!==login.session_user||login.rolsuper||login.rolbypassrls||login.rolcreaterole||login.rolcreatedb||login.rolreplication||login.owner_member)throw Error('ORDINARY_CALENDAR_DELIVERY_LOGIN_REQUIRED')
      calendarWebhook=createCalendarMailgunWebhook({query:(sql,values)=>calendarPool!.query(sql,values),signingKey:process.env.IDENTITY_CALENDAR_MAILGUN_WEBHOOK_SIGNING_KEY??'',origin:config.origin,domain:e.domain})
      calendarEmail=createCalendarEmailRuntime({query:(sql,values)=>pool!.query(sql,values),calendarQuery:(sql,values)=>calendarPool!.query(sql,values),client,calendarSchemaDigest:process.env.IDENTITY_CALENDAR_SCHEMA_DIGEST,
        mailgun:{environment:'development',region:e.region,domain:e.domain,apiKey:process.env.MAILGUN_SENDING_KEY,authorizedRecipients:[],from:e.from,senderName:e.senderName},diagnostic:code=>console.error('identity-email: '+code)})
      await calendarEmail.ready()
      const previous=email,calendar=calendarEmail
      email={...previous,async ready(){await Promise.all([previous.ready(),calendar.ready()])},async stop(){await Promise.all([previous.stop(),calendar.stop()]);await closeCalendarPool()}}
    }
  }
  if(process.env.IDENTITY_REPORT_DELIVERY_ENABLED==='true'&&!reportEmail)throw Error('EXISTING_EMAIL_TRANSPORT_REQUIRED')
  if(process.env.IDENTITY_CALENDAR_DELIVERY_ENABLED==='true'&&!calendarEmail)throw Error('EXISTING_CALENDAR_EMAIL_TRANSPORT_REQUIRED')
  boundary = createSessionBoundary({ configuration: config, client, authority }); origin = config.origin
  if (process.env.IDENTITY_SELF_SERVICE_ENABLED === 'true') {
    const key = process.env.IDENTITY_PROFILE_PROOF_KEY, digest = process.env.IDENTITY_PROFILE_SCHEMA_DIGEST
    if (!/^[a-f0-9]{64}$/.test(key ?? '') || !/^[a-f0-9]{64}$/.test(digest ?? '')) throw Error('PROFILE_CONFIGURATION_REQUIRED')
    const renewalDigest = process.env.IDENTITY_BINDING_RENEWAL_ENABLED === 'true' ? process.env.IDENTITY_RENEWAL_SCHEMA_DIGEST : undefined
    if (process.env.IDENTITY_BINDING_RENEWAL_ENABLED === 'true' && !/^[a-f0-9]{64}$/.test(renewalDigest ?? '')) throw Error('RENEWAL_CONFIGURATION_REQUIRED')
    account = createAccountSurface({ configuration: config, client, authority, binding, schemaDigest: digest!, ...(renewalDigest === undefined ? {} : { renewalSchemaDigest: renewalDigest }),
      proofKey: Buffer.from(key!, 'hex'), transact: accountTransactions(pool), ...(registrationStore ? {finalizeRegistration:registrationStore.finish} : {}) })
    avatar = createAssistantAvatarSurface({ configuration: config, client, binding, schemaDigest: digest!, proofKey: Buffer.from(key!, 'hex'),
      transact: accountTransactions(pool), independentQuery: (sql, values) => pool!.query(sql, values as unknown[]),
      deploymentId: process.env.RENDER_GIT_COMMIT ?? 'local-development', configurationVersion: createHash('sha256').update(JSON.stringify(config)).digest('hex') })
    salutation = createAccountSalutationSurface({ configuration: config, client, binding, schemaDigest: digest!, proofKey: Buffer.from(key!, 'hex'),
      transact: accountTransactions(pool), independentQuery: (sql, values) => pool!.query(sql, values as unknown[]),
      deploymentId: process.env.RENDER_GIT_COMMIT ?? 'local-development', configurationVersion: createHash('sha256').update(JSON.stringify(config)).digest('hex') })
    language = createCommunicationLanguageSurface({ configuration: config, client, binding, schemaDigest: digest!, proofKey: Buffer.from(key!, 'hex'),
      transact: accountTransactions(pool), independentQuery: (sql, values) => pool!.query(sql, values as unknown[]),
      deploymentId: process.env.RENDER_GIT_COMMIT ?? 'local-development', configurationVersion: createHash('sha256').update(JSON.stringify(config)).digest('hex') })
    await language.ready()
    const consumers = new Map<string, EmbeddedAccountSurface>()
    for (const targetId of embeddedTargets(config, embeddedInput)) {
      if (!registration || !registrationStore) throw Error('EMBEDDED_REGISTRATION_REQUIRED')
      const consumerConfig = readConfiguration({ ...config, origin: config.targets[targetId]!.origin })
      const common = { configuration: consumerConfig, client, binding, schemaDigest: digest!, proofKey: Buffer.from(key!, 'hex'),
        transact: accountTransactions(pool), independentQuery: (sql: string, values: readonly unknown[] = []) => pool!.query(sql, values as unknown[]),
        deploymentId: process.env.RENDER_GIT_COMMIT ?? 'local-development', configurationVersion: createHash('sha256').update(JSON.stringify(consumerConfig)).digest('hex') }
      consumers.set(targetId, { registration,
        account: createAccountSurface({ ...common, authority, ...(renewalDigest === undefined ? {} : { renewalSchemaDigest: renewalDigest }), finalizeRegistration: registrationStore.finish }),
        avatar: createAssistantAvatarSurface(common), language: createCommunicationLanguageSurface(common) })
    }
    embedded = createEmbeddedAccountHandler(config, consumers)
  }
}
const server = createNodeServer(origin, createHttpHandler(boundary, account, avatar, email, language, registration, embedded, salutation,currentE1,calendarWebhook), email !== null,calendarWebhook !== null); server.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log('identity-runtime started; live readiness requires verified provider and authority'))
let shuttingDown = false
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => {
  if (shuttingDown) return
  shuttingDown = true
  // Stop queue intake immediately, before waiting for existing HTTP connections.
  const emailStopped = email?.stop()
  server.close(() => { void (async () => { await emailStopped; await pool?.end(); process.exit(0) })() })
  server.closeIdleConnections()
})
}
start().catch(async () => { console.error('identity-runtime configuration unavailable'); await Promise.all([email?.stop(),reportEmail?.stop(),calendarEmail?.stop()]); await closeCalendarPool(); await pool?.end(); process.exitCode = 1 })
