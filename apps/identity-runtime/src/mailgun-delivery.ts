/** Development transports. Sandbox and transactional modes retain separate guards. */
export interface SandboxMailgunConfig {
  environment: 'development';
  region: 'us' | 'eu';
  domain: string;
  apiKey: string;
  authorizedRecipients: readonly string[];
  timeoutMs?: number;
}
export interface InlineImage { filename: string; bytes: Uint8Array }
export interface StoredEmailTemplate {name:string; version:string; variables:Record<string,string>}
export interface EmailContent { template?:StoredEmailTemplate; subject: string; html: string; text: string; inline?: readonly InlineImage[] }
export interface SandboxMessage extends EmailContent { recipient: string }
export type Submission =
  | { status: 'accepted'; providerId: string }
  | { status: 'rejected'; code: 'provider_rejected' }
  | { status: 'unknown'; code: 'submission_unconfirmed' };

// One bare ASCII mailbox, never a display name, list, header, or URL.
export function mailbox(value: unknown): string {
  if (typeof value !== 'string' || value.length > 254 ||
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value)) {
    throw new Error('Invalid sandbox recipient');
  }
  const at = value.lastIndexOf('@');
  // Preserve the local part; do not merge potentially distinct accounts.
  return value.slice(0, at) + '@' + value.slice(at + 1).toLowerCase();
}

export interface TransactionalMailgunConfig extends SandboxMailgunConfig {
  from: string; senderName: string
  /** Only the signed Clerk outbox may enable instance-wide transactional delivery. */
  recipientPolicy?: 'allowlist' | 'signed-clerk'
}
export function createMailgunSandboxSender(config: SandboxMailgunConfig, fetcher: typeof fetch = fetch) {
  return createSender(config, fetcher, null)
}
export function createMailgunTransactionalSender(config: TransactionalMailgunConfig, fetcher: typeof fetch = fetch) {
  return createSender(config, fetcher, config)
}
function createSender(config: SandboxMailgunConfig, fetcher: typeof fetch, transactional: TransactionalMailgunConfig | null) {
  if (config.environment !== 'development' || !['us', 'eu'].includes(config.region) ||
    !(transactional ? /^(?!sandbox)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(config.domain) : /^sandbox[a-f0-9]{32}\.mailgun\.org$/.test(config.domain)) ||
    typeof config.apiKey !== 'string' || !/^[A-Za-z0-9_-]{20,256}$/.test(config.apiKey)) {
    throw new Error('Invalid sandbox configuration');
  }
  const recipients = new Set(config.authorizedRecipients.map(mailbox));
  const policy = transactional?.recipientPolicy ?? 'allowlist';
  if (!['allowlist','signed-clerk'].includes(policy)
    || policy === 'allowlist' && (recipients.size < 1 || recipients.size > 5)
    || policy === 'signed-clerk' && recipients.size !== 0) throw new Error('Invalid recipient policy');
  const timeout = config.timeoutMs ?? 15000;
  if (!Number.isInteger(timeout) || timeout < 10 || timeout > 30000) throw new Error('Invalid send timeout');
  const endpoint = `https://${config.region === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net'}/v3/${config.domain}/messages`;
  const authorization = 'Basic ' + Buffer.from('api:' + config.apiKey).toString('base64');
  if (transactional && (mailbox(transactional.from).split('@')[1] !== config.domain || !transactional.senderName
    || transactional.senderName.length > 80 || /[<>\r\n\x00-\x1f\x7f]/.test(transactional.senderName))) throw Error('Invalid transactional sender');
  const from = transactional ? `${transactional.senderName} <${transactional.from}>` : `SpendGuru PORR — test <notifications@${config.domain}>`;

  return async (message: SandboxMessage): Promise<Submission> => {
    const recipient = mailbox(message.recipient);
    if (policy === 'allowlist' && !recipients.has(recipient)) throw new Error('Recipient not enabled for sandbox');
    if (typeof message.subject !== 'string' || (!transactional && !message.subject.startsWith('[TEST SANDBOX] ')) ||
      message.subject.length > 200 || /[\r\n\x00-\x1f\x7f]/.test(message.subject) ||
      typeof message.html !== 'string' || typeof message.text !== 'string' ||
      (!transactional && (!message.html.includes('WIADOMOŚĆ TESTOWA') || !message.text.includes('WIADOMOŚĆ TESTOWA'))) ||
      message.html.length > 100000 || message.text.length > 20000) {
      throw new Error('Only labelled sandbox samples may be sent');
    }
    const form = new FormData();
    const images = message.inline ?? [];
    if (images.length > 3) throw new Error('Too many inline images');
    const names = new Set<string>();
    let total = 0;
    for (const image of images) {
      if (!/^(spendguru-logo|porr-logo|assistant-male|assistant-female)\.png$/.test(image.filename) ||
        names.has(image.filename) || !(image.bytes instanceof Uint8Array) || image.bytes.length > 2000000 ||
        !Buffer.from(image.bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
        throw new Error('Invalid inline image');
      }
      names.add(image.filename); total += image.bytes.length;
      form.append('inline', new Blob([new Uint8Array(image.bytes)], {type:'image/png'}), image.filename);
    }
    if (total > 4000000) throw new Error('Inline image budget exceeded');
    const referenced = new Set<string>();
    for (const match of message.html.matchAll(/<img\b[^>]*>/gi)) {
      const src = match[0].match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!src?.startsWith('cid:') || !names.has(src.slice(4))) throw new Error('Every email image must have an inline attachment');
      referenced.add(src.slice(4));
    }
    if ([...names].some(name => !referenced.has(name))) throw new Error('Unreferenced inline image');
    for (const [key, value] of Object.entries({
      from, to: recipient, subject: message.subject, html: message.html, text: message.text,
      'o:tracking': 'no', 'o:tracking-clicks': 'no', 'o:tracking-opens': 'no',
      'o:require-tls': 'yes', 'o:skip-verification': 'no', 'o:tag': transactional ? 'identity-transactional-development' : 'avatar-sandbox',
    })) form.set(key, value);
    if (message.template) {
      const t=message.template, keys=Object.keys(t.variables).sort().join(',');
      if (!transactional || !/^identity-(verification-code|invitation)-(pl|en)-(male|female|neutral)$/.test(t.name)
        || !/^v-[a-f0-9]{24}$/.test(t.version)
        || !['app_name,current_year,otp_code,requested_at,requested_from','action_url,app_name,current_year,expires_in_days'].includes(keys)
        || Object.values(t.variables).some(v=>typeof v!=='string'||v.length>2000||/[\x00-\x1f\x7f]|\{\{|\}\}/.test(v))) throw Error('Invalid stored template');
      form.delete('html'); form.set('template',t.name); form.set('t:version',t.version);
      // Template values must never be placed in provider event/user variables.
      form.set('t:variables',JSON.stringify(t.variables));
    }
    try {
      const response = await fetcher(endpoint, {
        method: 'POST', headers: { Authorization: authorization }, body: form,
        redirect: 'error', signal: AbortSignal.timeout(timeout),
      });
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        await response.body?.cancel();
        return { status: 'rejected', code: 'provider_rejected' };
      }
      if (response.status !== 200 && response.status !== 202) {
        await response.body?.cancel();
        return { status: 'unknown', code: 'submission_unconfirmed' };
      }
      const payload: unknown = await response.json();
      const id = payload && typeof payload === 'object' && 'id' in payload ? payload.id : undefined;
      if (typeof id !== 'string' || id.length > 255 || !/^<[A-Za-z0-9_.@+-]+>$/.test(id)) {
        return { status: 'unknown', code: 'submission_unconfirmed' };
      }
      return { status: 'accepted', providerId: id };
    } catch {
      // A timeout may follow acceptance. Never auto-resend, expose body/key, or
      // include raw provider/HTTP error details in logs or receipts.
      return { status: 'unknown', code: 'submission_unconfirmed' };
    }
  };
}
