import { createHash } from 'node:crypto';
// Pure authoring/rendering. No network, credentials, profile writes or mail delivery.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const catalog = JSON.parse(fs.readFileSync(new URL('./templates.json', import.meta.url), 'utf8'));
const locales = JSON.parse(fs.readFileSync(new URL('./locales.json', import.meta.url), 'utf8'));
const colors = catalog.tokens;
const languageCheck = language => { if (!['pl','en'].includes(language)) throw new Error('Unknown communication language'); return language; };
const labelsFor = language => languageCheck(language) === 'en' ? locales.en.labels : null;
const variants = ['male', 'female', 'neutral'];
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const font = 'font-family:Arial,Helvetica,sans-serif;';

/** This is a presentation enum, never user sex or an authorization decision. */
export function normalizeAvatar(value) {
  return value === 'male' || value === 'female' ? value : 'neutral';
}

function messageFor(kind, avatar, language = 'pl') {
  languageCheck(language);
  if (!Object.hasOwn(catalog.messages, kind)) throw new Error('Unknown message kind');
  if (!variants.includes(avatar)) throw new Error('Unknown avatar variant');
  const message = language === 'pl' ? catalog.messages[kind] : {...catalog.messages[kind], ...locales.en.messages[kind]};
  return {...message, message: typeof message.message === 'string' ? message.message : message.message[avatar]};
}

function avatarHtml(avatar, language = 'pl') {
  if (avatar === 'neutral') return `<span style="${font}display:block;width:54px;height:54px;line-height:54px;text-align:center;border:1px solid ${colors.border};border-radius:50%;color:${colors.brand};font-size:16px;">SG</span>`;
  return `<img src="${catalog.assets[avatar]}" width="54" height="54" alt="${language === 'en' ? `SpendGuru ${avatar} assistant avatar` : `Awatar ${avatar === 'male' ? 'męski' : 'żeński'} SpendGuru`}" style="display:block;width:54px;height:54px;border:1px solid ${colors.sand};border-radius:50%;padding:2px;" />`;
}

function contentParts(kind, avatar, language = 'pl') {
  const labels=labelsFor(language);
  const m = messageFor(kind, avatar, language), invite = kind === 'invitation';
  const p = (text, extra = '') => `<p style="margin:0 0 12px;${font}font-size:14px;line-height:1.6;color:${colors.text};${extra}">${escapeHtml(text)}</p>`;
  const action = invite
    ? `${p(m.instruction)}<p style="margin:22px 0;"><a href="{{action_url}}" style="${font}display:inline-block;background:${colors.brand};color:#FFFFFF;text-decoration:none;padding:13px 20px;border-radius:7px;font-size:14px;font-weight:bold;">${labels?.accept ?? 'Przyjmij zaproszenie'}</a></p><p style="${font}font-size:12px;line-height:1.6;color:${colors.muted};margin:0;">${labels?.fallback ?? 'Jeśli przycisk nie działa,'} <a href="{{action_url}}" style="color:${colors.brand};">${labels?.openLink ?? 'otwórz link zaproszenia'}</a>.</p>`
    : `<p class="otp" style="${font}font-size:38px;line-height:1.3;font-weight:bold;letter-spacing:7px;color:${colors.ink};margin:24px 0;">{{otp_code}}</p>${p(m.instruction, 'font-size:13px;margin-bottom:0;')}`;
  const note = invite ? '' : labels?.note ?? 'Ten kod jest tylko dla Ciebie.<br />Nie udostępniaj go innym osobom.';
  const request = invite
    ? labels?.unexpectedInvitation ?? '<b>Nie oczekiwano tego zaproszenia?</b><br />Jeśli ta wiadomość trafiła do Ciebie omyłkowo, możesz ją zignorować.'
    : labels?.unexpectedCode ?? '<b>Nie proszono o ten kod?</b><br />Jeśli to nie Ty, możesz zignorować tę wiadomość.<br /><br />Prośba z: {{requested_from}}<br />Data prośby: {{requested_at}}';
  const footer = `<b>${catalog.footer.company.map(escapeHtml).join('<br />')}</b><br /><br />${escapeHtml(labels?.services ?? catalog.footer.services)}<br /><br />${(labels?.address ?? catalog.footer.address).map(escapeHtml).join('<br />')}<br /><br />© {{current_year}} {{app.name}}`;
  return {m, bubble: p(m.greeting) + p(m.message) + action, note, request, footer};
}

/** Portable table-based HTML, still containing Clerk's dynamic placeholders. */
export function renderHtml(kind, avatar = 'neutral', language = 'pl') {
  const {m, bubble, note, request, footer} = contentParts(kind, avatar, language);
  return `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(m.subject)}</title>
<style>@media(max-width:520px){.outer{padding:12px 6px!important}.inside{padding:24px 16px!important}.avatar-column{width:48px!important;padding-right:10px!important}.avatar-column img,.avatar-column span{width:36px!important;height:36px!important;line-height:36px!important}.bubble{padding:18px 16px!important}.otp{font-size:28px!important;letter-spacing:3px!important}h1{font-size:24px!important}}</style></head>
<body style="margin:0;padding:0;background:${colors.background};${font}"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(m.subject)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="outer" align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid ${colors.border};border-radius:18px;"><tr><td class="inside" style="padding:32px 36px;">
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding-right:24px;"><img src="${catalog.assets.logo}" width="145" alt="SpendGuru" style="display:block;width:145px;max-width:100%;height:auto;" /></td><td style="border-left:1px solid ${colors.border};padding-left:24px;"><img src="${catalog.assets.partner}" width="52" alt="PORR" style="display:block;width:52px;height:auto;" /></td></tr></table>
<h1 style="${font}font-size:28px;line-height:1.25;color:${colors.ink};margin:28px 0 30px;">${escapeHtml(m.title)}</h1>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="avatar-column" width="76" valign="top" style="width:76px;padding:24px 18px 0 0;box-sizing:border-box;">${avatarHtml(avatar, language)}</td><td valign="top"><p style="${font}font-size:12px;font-weight:bold;color:${colors.ink};margin:0 0 10px;">SpendGuru</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="bubble" style="padding:22px 24px;background:${colors.bubble};border:1px solid ${colors.border};border-radius:5px 19px 19px 19px;">${bubble}</td></tr></table><p style="${font}font-size:12px;line-height:1.6;color:${colors.muted};margin:16px 0 0;">${note}</p></td></tr></table>
<p style="${font}font-size:13px;line-height:1.6;color:${colors.muted};border-top:1px solid ${colors.border};margin:28px 0 0;padding:24px 0;">${request}</p>
<p style="${font}font-size:11px;line-height:1.65;color:${colors.muted};border-top:1px solid ${colors.border};padding-top:20px;margin:0;">${footer}</p>
</td></tr></table></td></tr></table></body></html>\n`;
}

/** Native Clerk editor source. Its editor performs the final HTML transpilation. */
export function renderRevolvapp(kind, avatar = 'neutral', language = 'pl') {
  const labels=labelsFor(language);
  const {m, note, request, footer} = contentParts(kind, avatar, language);
  const text = (value, margin = '0 0 12px') => `<re-text margin="${margin}" font-size="14px" line-height="22px" color="${colors.text}">${escapeHtml(value)}</re-text>`;
  // Separate native elements prevent the editor from applying a CTA's white
  // link color to the fallback link in the same rich-text block.
  const bubble = text(m.greeting) + text(m.message) + (kind === 'invitation'
    ? text(m.instruction) + `<re-button href="{{action_url}}" margin="10px 0 20px" background-color="${colors.brand}" color="#FFFFFF" border-radius="7px" font-size="14px" font-weight="bold">${labels?.accept ?? 'Przyjmij zaproszenie'}</re-button><re-text margin="0" font-size="12px" line-height="19px" color="${colors.muted}">${labels?.fallback ?? 'Jeśli przycisk nie działa:'}</re-text><re-link href="{{action_url}}" margin="0" font-size="12px" line-height="19px" color="${colors.brand}" text-decoration="underline">${labels?.openLink ?? 'Otwórz link zaproszenia'}</re-link>`
    : `<re-text class="otp" margin="24px 0" font-size="38px" line-height="49px" font-weight="bold" color="${colors.ink}">{{otp_code}}</re-text>` + text(m.instruction, '0'));
  return `<re-html><re-head><re-title>${escapeHtml(m.subject)}</re-title><re-style>p,a,span {font-family:Arial,Helvetica,sans-serif;} @media(max-width:520px){.mail-content{padding:24px 16px!important}.otp{font-size:28px!important;letter-spacing:3px!important}}</re-style></re-head>
<re-body background-color="${colors.background}" padding="32px 12px"><re-preheader>${escapeHtml(m.subject)}</re-preheader>
<re-main width="600px" background-color="#FFFFFF" border="1px solid ${colors.border}" border-radius="18px"><re-block padding="32px 36px" class="mail-content">
<re-text margin="0"><img src="${catalog.assets.logo}" width="145" alt="SpendGuru" style="vertical-align:middle;height:auto;" /> <span style="display:inline-block;margin:0 20px;height:28px;vertical-align:middle;border-left:1px solid ${colors.border};"></span> <img src="${catalog.assets.partner}" width="52" alt="PORR" style="vertical-align:middle;height:auto;" /></re-text>
<re-heading level="h1" margin="28px 0 30px" font-size="28px" line-height="35px" color="${colors.ink}">${escapeHtml(m.title)}</re-heading>
<re-grid><re-column width="58px" valign="top" padding="24px 0 0"><re-text margin="0">${avatarHtml(avatar, language)}</re-text></re-column><re-column-spacer width="18px"></re-column-spacer><re-column width="452px" valign="top">
<re-text margin="0 0 10px" font-size="12px" font-weight="bold" color="${colors.ink}">SpendGuru</re-text><re-block background-color="${colors.bubble}" border="1px solid ${colors.border}" border-radius="19px" padding="22px 24px">${bubble}</re-block>
<re-text margin="16px 0 0" font-size="12px" line-height="19px" color="${colors.muted}">${note}</re-text></re-column></re-grid>
<re-spacer height="28px"></re-spacer><re-divider background-color="${colors.border}" height="1px"></re-divider><re-text margin="24px 0" font-size="13px" line-height="21px" color="${colors.muted}">${request}</re-text><re-divider background-color="${colors.border}" height="1px"></re-divider><re-text margin="20px 0 0" font-size="11px" line-height="18px" color="${colors.muted}">${footer}</re-text>
</re-block></re-main></re-body></re-html>\n`;
}

export function renderPlain(kind, avatar = 'neutral', language = 'pl') {
  const {m,note,request}=contentParts(kind,avatar,language), labels=labelsFor(language),invite=kind==='invitation';
  const plain = html => html.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'');
  return [m.title,m.greeting,m.message,invite?m.instruction:'{{otp_code}}',
    invite?(labels?.accept ?? 'Przyjmij zaproszenie')+': {{action_url}}':m.instruction,plain(note),plain(request),
    catalog.footer.company.join('\n'),labels?.services ?? catalog.footer.services,(labels?.address ?? catalog.footer.address).join('\n'),
    '© {{current_year}} {{app.name}}'].filter(Boolean).join('\n\n')+'\n';
}

/** Resolve trusted message data once; never evaluate user-provided template syntax. */
export function renderResolved({kind, avatar = 'neutral', language = 'pl', data, allowedActionOrigins = []}) {
  const m = messageFor(kind, avatar, language);
  const scalar = (value, max = 160) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]|\{\{|\}\}/.test(value)) throw new Error('Invalid email template data');
    return value;
  };
  const values = {
    'app.name': scalar(data?.appName, 80),
    current_year: scalar(String(data?.currentYear), 4),
  };
  if (!/^20\d{2}$/.test(values.current_year)) throw new Error('Invalid email year');
  if (kind === 'invitation') {
    const url = new URL(scalar(data?.actionUrl, 2000));
    if (url.protocol !== 'https:' || url.username || url.password || !allowedActionOrigins.includes(url.origin)) throw new Error('Untrusted invitation URL');
    if (!Number.isInteger(data?.expiresInDays) || data.expiresInDays < 1 || data.expiresInDays > 365) throw new Error('Invalid invitation expiry');
    values.action_url = url.href;
    values['invitation.expires_in_days'] = String(data.expiresInDays);
  } else {
    if (typeof data?.otpCode !== 'string' || !/^\d{6}$/.test(data.otpCode)) throw new Error('Invalid verification code');
    values.otp_code = data.otpCode;
    values.requested_from = scalar(data.requestedFrom);
    values.requested_at = scalar(data.requestedAt);
  }
  const substitute = (source, html) => source.replace(/\{\{([a-z_.]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error('Unresolved email variable');
    return html ? escapeHtml(values[key]) : values[key];
  });
  return {subject: substitute(m.subject, false), html: substitute(renderHtml(kind, avatar, language), true), text: substitute(renderPlain(kind, avatar, language), false)};
}

/** Deliberately non-functional sample; never connected to Clerk code issuance. */
export function inlineAssetsForAvatar(avatar) {
  if (!variants.includes(avatar)) throw new Error('Unknown avatar variant');
  const keys = ['logo', 'partner', ...(avatar === 'neutral' ? [] : [avatar])];
  const filenames = {logo:'spendguru-logo.png',partner:'porr-logo.png',male:'assistant-male.png',female:'assistant-female.png'};
  return keys.map(key=>({filename:filenames[key],url:catalog.assets[key],sha256:new URL(catalog.assets[key]).pathname.split('/').at(-1).replace('.png','')}));
}

export function renderSandboxSample(avatar, requestedAt, {inlineImages = false} = {}) {
  const content = renderResolved({kind:'verification-code', avatar, data:{
    appName:'SpendGuru PORR', currentYear: new Date(requestedAt).getUTCFullYear(),
    otpCode:'000000', requestedFrom:'Test wyglądu wiadomości w sandboxie Mailgun', requestedAt,
  }});
  const notice = 'WIADOMOŚĆ TESTOWA — kod 000000 jest przykładem i nie służy do logowania.';
  let html = content.html.replace('</h1>', `</h1><p style="${font}font-size:12px;line-height:1.6;color:${colors.muted};">${notice}</p>`);
  if (inlineImages) for (const asset of inlineAssetsForAvatar(avatar)) html = html.replaceAll(asset.url, 'cid:' + asset.filename);
  return {
    subject: `[TEST SANDBOX] SpendGuru PORR — awatar ${avatar}`,
    html,
    text: notice + '\n\n' + content.text,
  };
}

// A proposed projection, not a runtime sync. Both flags set -> neutral.
// The producer must validate booleans and derive them from the persisted enum.
export function renderConditionalRevolvapp(kind) {
  if (!['verification-code', 'invitation'].includes(kind)) throw new Error('Only native shared templates have conditional candidates');
  const root = kind === 'invitation' ? 'invitation.public_metadata' : 'user.public_metadata';
  const m = `${root}.assistantAvatar.isMale`, f = `${root}.assistantAvatar.isFemale`;
  const neutral = avatarHtml('neutral');
  const conditional = `{{#if ${m}}}{{#if ${f}}}${neutral}{{else}}${avatarHtml('male')}{{/if}}{{else}}{{#if ${f}}}${avatarHtml('female')}{{else}}${neutral}{{/if}}{{/if}}`;
  return renderRevolvapp(kind, 'neutral').replace(neutral, conditional);
}

export function exportBundle(directory) {
  // Creating a new directory prevents silently replacing a reviewed package.
  fs.mkdirSync(directory, {recursive: false});
  const manifest = [];
  for (const kind of Object.keys(catalog.messages)) for (const avatar of variants) {
    const base = `${kind}-${avatar}`;
    const m = messageFor(kind, avatar);
    for (const [ext, text] of [['html', renderHtml(kind, avatar)], ['re.html', renderRevolvapp(kind, avatar)], ['txt', renderPlain(kind, avatar)], ['subject.txt', m.subject + '\n']]) fs.writeFileSync(path.join(directory, `${base}.${ext}`), text);
    manifest.push({name:base, clerkSlug:m.clerkSlug, activation:m.activation, status:'PREPARED_NOT_ACTIVATED'});
  }
  for (const kind of ['verification-code','invitation']) fs.writeFileSync(path.join(directory, `${kind}-conditional-candidate.re.html`), renderConditionalRevolvapp(kind));
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({version:catalog.version, messages:manifest, conditionalStatus:'LOCAL_CANDIDATE_REQUIRES_CLERK_CONTEXT_ACCEPTANCE'}, null, 2) + '\n');
  fs.copyFileSync(new URL('./README.md', import.meta.url), path.join(directory, 'README.md'));
  return manifest;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3) throw new Error('Usage: node email-templates/render.mjs NEW_OUTPUT_DIRECTORY');
  const out = path.resolve(process.argv[2]);
  exportBundle(out);
  console.log(`Prepared mail templates in ${out}; nothing sent or activated.`);
}

/** Domain-scoped Mailgun versions are pinned to canonical HTML content. */
export function mailgunTemplate(kind, avatar, language) {
  if (!['verification-code','invitation'].includes(kind)) throw new Error('Unsupported transport template');
  let html=renderHtml(kind,avatar,language).replaceAll('{{app.name}}','{{app_name}}').replaceAll('{{invitation.expires_in_days}}','{{expires_in_days}}');
  for(const asset of inlineAssetsForAvatar(avatar)) html=html.replaceAll(asset.url,'cid:'+asset.filename);
  return {name:`identity-${kind}-${language}-${avatar}`,version:'v-'+createHash('sha256').update(html).digest('hex').slice(0,24),html};
}
export function renderMailgunResolved(options) {
  const content=renderResolved(options), spec=mailgunTemplate(options.kind,options.avatar,options.language);
  for(const asset of inlineAssetsForAvatar(options.avatar)) content.html=content.html.replaceAll(asset.url,'cid:'+asset.filename);
  const d=options.data;
  const variables={app_name:d.appName,current_year:String(d.currentYear),...(options.kind==='invitation'
    ?{action_url:d.actionUrl,expires_in_days:String(d.expiresInDays)}
    :{otp_code:d.otpCode,requested_from:d.requestedFrom,requested_at:d.requestedAt})};
  return {...content,template:{name:spec.name,version:spec.version,variables}};
}
