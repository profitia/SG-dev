import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

// Security notification only. No session operation is performed by this renderer.
const copy = {
  pl: {title:'Nowe logowanie do Twojego konta',message:'Na Twoje konto SpendGuru zalogowano się z nowego urządzenia. Poniżej znajdziesz szczegóły tego logowania.',method:'Sposób logowania',device:'Urządzenie',location:'Lokalizacja',ip:'Adres IP',time:'Data i czas',known:'To Ty?',knownBody:'Wszystko w porządku — nie musisz nic robić.',unknown:'Nie rozpoznajesz tego logowania?',unknownBody:'Wyloguj to urządzenie i sprawdź bezpieczeństwo swojego konta oraz skrzynki e-mail.',action:'Wyloguj to urządzenie',fallback:'Przycisk nie działa?',link:'Użyj tego linku do wylogowania.',noAction:'Skontaktuj się z administratorem aplikacji i sprawdź bezpieczeństwo swojego konta oraz skrzynki e-mail.',locationNote:'Lokalizacja jest przybliżona i może zależeć od używanej sieci lub VPN.',services:'Inteligencja negocjacyjna · Zakupy oparte na danych · Certyfikowany Partner CIPS w Polsce · Doradztwo · Szkolenia · Analityka zakupowa',address:'02-715 Warszawa, Villa Metro<br />ul. Puławska 145, V p.',security:'BEZPIECZEŃSTWO KONTA'},
  en: {title:'New sign-in to your account',message:'Your SpendGuru account was signed in to from a new device. Here are the details of this sign-in.',method:'Sign-in method',device:'Device',location:'Location',ip:'IP address',time:'Date and time',known:'Was this you?',knownBody:'You’re all set — no action is needed.',unknown:'Don’t recognize this sign-in?',unknownBody:'Sign out of this device and check the security of your account and email inbox.',action:'Sign out of this device',fallback:'Button not working?',link:'Use this sign-out link.',noAction:'Contact your app administrator and check the security of your account and email inbox.',locationNote:'Location is approximate and may depend on your network or VPN.',services:'Negotiation intelligence · Data-driven procurement · Certified CIPS Partner in Poland · Consulting · Training · Procurement analytics',address:'Villa Metro, 02-715 Warsaw, Poland<br />145 Puławska Street, 5th floor',security:'ACCOUNT SECURITY'},
};
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const font='font-family:Arial,Helvetica,sans-serif;';
const scalar=(v,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f\x7f]|\{\{|\}\}/.test(v))throw Error('Invalid new-device email data');return v;};
const subject='New device signed in to your {{app_name}} account';

export function newDeviceTemplate(avatar,language,catalog) {
  if(!Object.hasOwn(copy,language)||!['male','female','neutral'].includes(avatar))throw Error('Invalid new-device presentation');
  const c=copy[language], t=catalog.tokens;
  const p=(value,extra='')=>`<p style="${font}font-size:14px;line-height:1.65;color:${t.text};margin:0 0 12px;${extra}">${value}</p>`;
  const rows=[[c.method,'sign_in_method'],[c.device,'device'],[c.location,'location'],[c.ip,'ip_address'],[c.time,'session_created_at']];
  const details=rows.map(([label,key])=>`<tr><th align="left" style="${font}font-size:12px;line-height:1.7;font-weight:normal;vertical-align:top;padding:6px 12px;color:${t.muted};width:36%;">${label}</th><td style="${font}font-size:12px;line-height:1.7;font-weight:bold;padding:6px 12px;color:${t.ink};word-break:break-word;">{{${key}}}</td></tr>`).join('');
  const assistant=avatar==='neutral'?`<span style="${font}display:block;width:54px;height:54px;line-height:54px;text-align:center;border:1px solid ${t.border};border-radius:50%;color:${t.brand};">SG</span>`:`<img src="${catalog.assets[avatar]}" width="54" height="54" alt="SpendGuru" style="display:block;border:1px solid ${t.sand};border-radius:50%;padding:2px;" />`;
  const action=`{{#if revoke_session_url}}${p(c.unknownBody)}<p style="margin:18px 0;"><a href="{{revoke_session_url}}" style="${font}display:inline-block;background:${t.brand};color:#fff;text-decoration:none;padding:13px 18px;border-radius:7px;font-size:13px;font-weight:bold;">${c.action}</a></p>${p(c.fallback+' <a href="{{revoke_session_url}}" style="color:'+t.brand+';text-decoration:underline;">'+c.link+'</a>','font-size:12px;')}{{else}}${p(c.noAction)}{{/if}}`;
  const html=`<!doctype html><html lang="${language}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${c.title}</title><style>@media(max-width:520px){.outer{padding:12px 6px!important}.inside{padding:24px 16px!important}.avatar-column{width:48px!important;padding-right:10px!important}.avatar-column img,.avatar-column span{width:36px!important;height:36px!important;line-height:36px!important}.bubble{padding:18px 16px!important}h1{font-size:24px!important}}</style></head><body style="margin:0;background:${t.background};${font}"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${c.title}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="outer" align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid ${t.border};border-radius:18px;"><tr><td class="inside" style="padding:32px 36px;">
  <table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding-right:24px;"><img src="${catalog.assets.logo}" width="145" alt="SpendGuru" style="display:block;height:auto;"/></td><td style="border-left:1px solid ${t.border};padding-left:24px;"><img src="${catalog.assets.partner}" width="52" alt="PORR" style="display:block;height:auto;"/></td></tr></table>
  ${p(c.security,'font-size:10px;letter-spacing:1.3px;margin-top:28px;')}<h1 style="${font}font-size:28px;line-height:1.25;color:${t.ink};margin:0 0 30px;">${c.title}</h1>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="avatar-column" width="76" valign="top" style="width:76px;padding:24px 18px 0 0;">${assistant}</td><td valign="top">${p('SpendGuru','font-size:12px;font-weight:bold;')}<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="bubble" style="padding:22px 24px;background:${t.bubble};border:1px solid ${t.border};border-radius:5px 19px 19px 19px;">${p('{{greeting}}')}${p(c.message,'margin-bottom:0;')}</td></tr></table></td></tr></table>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;padding:12px;background:${t.background};border:1px solid ${t.border};border-radius:12px;">${details}</table>
  ${p(c.locationNote,'font-size:10px;margin-top:10px;')}<h2 style="${font}font-size:13px;color:${t.ink};margin:22px 0 6px;">${c.known}</h2>${p(c.knownBody,'font-size:12px;')}
  <h2 style="${font}font-size:13px;color:${t.ink};margin:22px 0 6px;border-top:1px solid ${t.border};padding-top:22px;">${c.unknown}</h2>${action}
  <p style="${font}font-size:11px;line-height:1.7;color:${t.muted};border-top:1px solid ${t.border};padding-top:20px;margin-top:24px;">© {{current_year}} {{app_name}}<br/><br/><b>${catalog.footer.company.map(escape).join('<br/>')}</b><br/><br/>${c.services}<br/><br/>${c.address}</p>
  </td></tr></table></td></tr></table></body></html>`;
  const text=[c.title,'{{greeting}}',c.message,...rows.map(([label,key])=>label+': {{'+key+'}}'),c.locationNote,c.known,c.knownBody,c.unknown,
    '{{#if revoke_session_url}}'+c.unknownBody+'\n'+c.action+': {{revoke_session_url}}{{else}}'+c.noAction+'{{/if}}',catalog.footer.company.join('\n'),c.services,c.address.replace(/<br\s*\/?\s*>/g,'\n'),'© {{current_year}} {{app_name}}'].join('\n\n')+'\n';
  return {subject,html,text};
}

export function resolveNewDevice(options,catalog,greeting) {
  const {data,avatar='neutral',language='pl',allowedRevocationOrigins=[]}=options;
  const c=copy[language];if(!c)throw Error('Unknown communication language');
  const values={app_name:scalar(data?.appName,80),greeting:scalar(greeting,200),current_year:String(data?.currentYear),
    sign_in_method:data?.signInMethod==null?(language==='pl'?'Nie podano':'Not provided'):scalar(data.signInMethod,100),
    device:scalar(data?.browserName,100)+' · '+scalar(data?.operatingSystem,100),location:scalar(data?.location,200),
    ip_address:scalar(data?.ipAddress,45),session_created_at:scalar(data?.sessionCreatedAt,200),revoke_session_url:''};
  if(!/^20\d{2}$/.test(values.current_year)||!isIP(values.ip_address))throw Error('Invalid new-device metadata');
  if(data?.revokeSessionUrl!=null){const raw=scalar(data.revokeSessionUrl,4096),u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||u.hash||/[\x00-\x20\x7f\\]/.test(raw)||!allowedRevocationOrigins.includes(u.origin))throw Error('Untrusted session revocation URL');
    values.revoke_session_url=raw; // Preserve the provider's opaque URL exactly.
  }
  const substitute=(source,html)=>source.replace(/\{\{#if revoke_session_url\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,(_,yes,no)=>values.revoke_session_url?yes:no)
    .replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>{if(!Object.hasOwn(values,key))throw Error('Unresolved security-email variable');return html?escape(values[key]):values[key];});
  const source=newDeviceTemplate(avatar,language,catalog);
  return {...Object.fromEntries(Object.entries(source).map(([k,v])=>[k,substitute(v,k==='html')])),variables:values};
}

export function newDeviceMailgunTemplate(avatar,language,catalog,inlineAssets){
  let html=newDeviceTemplate(avatar,language,catalog).html;
  for(const asset of inlineAssets)html=html.replaceAll(asset.url,'cid:'+asset.filename);
  return {name:`identity-new-device-sign-in-${language}-${avatar}`,version:'v-'+createHash('sha256').update(html).digest('hex').slice(0,24),html};
}
