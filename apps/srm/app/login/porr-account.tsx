'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { SignIn, useAuth, useClerk } from '@clerk/react';
import { createClerkConversation } from '@profitia/identity-runtime/conversation';
import { createPasswordRecovery } from './porr-password-recovery';
import './porr-account.css';

type Mode = 'registration' | 'login';
type Message = { text: string; user?: boolean };
type Receipt = { attemptId: string; token: string };
const avatarUrl = (sex: string) => `/spendguru/assistant-${sex}.png`;
const prompts: Record<string, string> = {
  avatar: 'Cześć! Wybierz, z kim chcesz porozmawiać. Razem przejdziemy przez kilka krótkich kroków.',
  name: 'Miło Cię poznać! Jak masz na imię?', surname: 'Dziękuję. Podaj teraz swoje nazwisko.',
  method: 'Jak chcesz się zalogować — jednorazowym kodem e-mail czy hasłem?',
  email: 'Podaj swój adres e-mail.', code: 'Sprawdź swoją skrzynkę. Wpisz sześciocyfrowy kod z wiadomości.',
  password: 'Wpisz hasło do swojego konta.', existing: 'Ten adres ma już ukończone konto. Przejdź do logowania.',
  password_unavailable: 'To konto nie ma ustawionego hasła. Możesz zalogować się jednorazowym kodem wysłanym na Twój adres e-mail.',
  reset_code: 'Wysłaliśmy kod do zmiany hasła na Twój adres e-mail. Wpisz sześciocyfrowy kod z wiadomości.',
  new_password: 'Adres e-mail potwierdzony. Ustaw nowe, unikalne hasło. Po zmianie wylogujemy pozostałe sesje Twojego konta.',
  challenge: 'Potrzebne jest dodatkowe potwierdzenie. Dokończ je w bezpiecznym formularzu logowania.',
};
function Avatar({ sex = 'female', size = 34 }: { sex?: string; size?: number }) {
  return <span className="porr-avatar" style={{ width: size, height: size }}><img src={avatarUrl(sex)} alt="" width={size} height={size} /></span>;
}
function Icon({ name }: { name: 'sun' | 'moon' | 'restart' | 'send' }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'sun' ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></> : name === 'moon' ? <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/> : name === 'restart' ? <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></> : <><path d="m5 12 7-7 7 7M12 5v15"/></>}</svg>;
}
function friendlyError(error: unknown): string {
  const e = error as { message?: string; errors?: { code?: string }[] };
  const code = e?.errors?.[0]?.code ?? e?.message ?? '';
  if (/rate|too_many|cooldown/i.test(code)) return 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.';
  if (/password_pwned|password_not_strong|password_length|password_size|password_validation/i.test(code)) return 'To hasło nie spełnia wymagań bezpieczeństwa. Wybierz dłuższe, unikalne hasło, którego nie używasz w innych serwisach.';
  if (/code|verification|otp/i.test(code)) return 'Kod jest nieprawidłowy lub wygasł. Sprawdź go albo wyślij nowy kod.';
  if (/email|identifier/i.test(code)) return 'Sprawdź adres e-mail i spróbuj ponownie.';
  if (/password/i.test(code)) return 'Sprawdź hasło. Możesz też zalogować się kodem e-mail lub ustawić nowe hasło.';
  return 'Nie udało się dokończyć tej czynności. Spróbuj ponownie.';
}

function AccountConversation({ identityOrigin, mode, onLogin, onBusy }: { identityOrigin: string; mode: Mode; onLogin(): void; onBusy(value: boolean): void }) {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const receipt = useRef<Receipt | null>(null), history = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true), operation = useRef(false);
  const [messages, setMessages] = useState<Message[]>([{ text: prompts.avatar }]);
  const [answer, setAnswer] = useState(''), [error, setError] = useState(''), [submitting, setBusy] = useState(false), [finalizing, setFinalizing] = useState(false);
  const busy = submitting || finalizing;
  const [step, setStep] = useState('avatar'), [avatar, setAvatar] = useState<'male'|'female'>('female');
  const [native, setNative] = useState(false), [ready, setReady] = useState(false), [retry, setRetry] = useState(0), [resendLocked, setResendLocked] = useState(false);
  const [recovery] = useState(() => createPasswordRecovery(clerk));
  const [confirmation, setConfirmation] = useState(''), [passwordChanged, setPasswordChanged] = useState(false);
  const request = useCallback(async (path: string, body: unknown, headers: Record<string,string> = {}, signal?: AbortSignal) => {
    const result = await fetch(`${identityOrigin}/v1/embedded/srm/${path}`, { method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000), headers: { 'Content-Type':'application/json', ...headers }, body: JSON.stringify(body) });
    const value = await result.json(); if (!result.ok) throw Error(value.error || 'ACCOUNT_UNAVAILABLE'); return value;
  }, [identityOrigin]);
  const [model] = useState(() => createClerkConversation(clerk, mode === 'registration', null, {
    start: async draft => { const result = await request('registration/start', { ...draft, browserLanguage: navigator.languages?.[0] || navigator.language || '' });
      receipt.current = result.status === 'code' ? { attemptId: result.attemptId, token: result.token } : null; return result; },
    verify: code => { if (!receipt.current) throw Error('REGISTRATION_REQUIRED'); return request('registration/verify', { ...receipt.current, code }); }
  }));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; receipt.current = null; recovery.clear(); }; }, [recovery]);
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);
  useEffect(() => { if (!resendLocked) return; const timer = setTimeout(() => setResendLocked(false), 30000); return () => clearTimeout(timer); }, [resendLocked]);
  useEffect(() => { history.current?.scrollTo({ top: history.current.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); if (!busy) input.current?.focus(); }, [messages, busy, step]);

  // A provider session is not an internal account or membership. Confirm it with
  // the shared ACCOUNT_SELF authority before offering entry to the application.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId) { setReady(false); setFinalizing(false); return; }
    const controller = new AbortController(), expectedSession = sessionId;
    setFinalizing(true); setReady(false); setError('');
    (async () => {
      const token = await clerk.session?.getToken({ skipCache: true });
      if (!token || controller.signal.aborted || clerk.session?.id !== expectedSession) throw Error('SESSION_CHANGED');
      const result = await request('account', {}, { Authorization: `Bearer ${token}`, ...(receipt.current ? { 'X-Registration-Receipt': receipt.current.token } : {}) }, controller.signal);
      if (controller.signal.aborted || clerk.session?.id !== expectedSession) return;
      if (result.authenticated !== true || typeof result.userId !== 'string' || !Number.isFinite(Date.parse(result.expiresAt)) || Date.parse(result.expiresAt) <= Date.now()) throw Error('ACCOUNT_UNAVAILABLE');
      if (result.assistantAvatar === 'male' || result.assistantAvatar === 'female') setAvatar(result.assistantAvatar);
      receipt.current = null; setReady(true); setStep('done'); setNative(false);
    })().catch(e => { if (!controller.signal.aborted) setError(friendlyError(e)); }).finally(() => { if (!controller.signal.aborted) setFinalizing(false); });
    return () => controller.abort();
  }, [isLoaded, isSignedIn, sessionId, clerk, request, retry]);

  async function submit(value: string) {
    if (operation.current || busy || !isLoaded || isSignedIn) return;
    operation.current = true; setBusy(true); setError('');
    const previous = step;
    try {
      let next: string;
      if (previous === 'reset_code') next = await recovery.verify(value);
      else if (previous === 'new_password') {
        if (value !== confirmation) { setError('Hasła muszą być identyczne. Wpisz je ponownie.'); return; }
        next = await recovery.finish(value);
        setPasswordChanged(true); setConfirmation('');
      } else { await model.submit(value); next = model.state.step; }
      // An account without a password is not a security challenge. Preserve every
      // other provider status (MFA, device trust, Protect) for the official UI.
      if (previous === 'email' && mode === 'login' && model.state.method === 'password' && next === 'challenge'
        && clerk.client.signIn.status === 'needs_first_factor'
        && !clerk.client.signIn.supportedFirstFactors?.some(f => f.strategy === 'password')
        && clerk.client.signIn.supportedFirstFactors?.some(f => f.strategy === 'email_code')) next = 'password_unavailable';
      if (!mounted.current) return;
      if (previous === 'avatar') setAvatar(value as 'male'|'female');
      const shown = ['code','reset_code'].includes(previous) ? '••••••' : ['password','new_password'].includes(previous) ? '••••••••' : previous === 'avatar' ? (value === 'male' ? 'Awatar męski' : 'Awatar żeński') : previous === 'method' ? (value === 'password' ? 'Hasło' : 'Kod e-mail') : value;
      setMessages(current => [...current, { text: shown, user: true }, ...(prompts[next] ? [{ text: prompts[next] }] : [])]);
      setAnswer(''); setStep(next); if (next === 'code') setResendLocked(true);
    } catch (e) { if (mounted.current) setError(friendlyError(e)); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  }
  async function resend() {
    if (operation.current || busy || resendLocked) return;
    operation.current = true; setBusy(true); setError('');
    try { await model.resend(); setStep(model.state.step); setResendLocked(true); setMessages(current => [...current,{text: prompts[model.state.step] ?? 'Nowy kod został wysłany.'}]); }
    catch(e) { setError(friendlyError(e)); } finally { operation.current = false; setBusy(false); }
  }
  async function startRecovery() {
    if (operation.current || busy || !isLoaded || isSignedIn || !['password','reset_code'].includes(step) || (step === 'reset_code' && resendLocked)) return;
    operation.current = true; setBusy(true); setError(''); setAnswer(''); setConfirmation('');
    try {
      const next = await recovery.start(model.state.email);
      if (!mounted.current) return;
      setStep(next); setResendLocked(true); setMessages(current => [...current,{text:prompts[next]}]);
    } catch(e) { if (mounted.current) setError(friendlyError(e)); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  }
  async function switchMethod(code = false) {
    if (operation.current || busy || !isLoaded || isSignedIn) return;
    operation.current = true; setBusy(true); setError(''); setAnswer(''); setConfirmation(''); recovery.clear();
    model.state.step = 'method'; setStep('method');
    try {
      if (code) { await model.submit('email_code'); await model.submit(model.state.email); }
      if (!mounted.current) return;
      setStep(model.state.step); if (model.state.step === 'code') setResendLocked(true);
      setMessages(current => [...current,{text:prompts[model.state.step]}]);
    } catch(e) { if (mounted.current) { setStep(model.state.step); setError(friendlyError(e)); } }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  }
  const isCode = ['code','reset_code'].includes(step), isPassword = ['password','new_password'].includes(step);
  const formStep = ['name','surname','email','code','password','reset_code','new_password'].includes(step) && !isSignedIn;
  const progress = step === 'avatar' ? 0 : ['code','challenge','done','reset_code','new_password'].includes(step) ? 2 : 1;
  return <div className="porr-auth-slot">
    <ol className="porr-progress" aria-label="Etapy">{['Twój rozmówca', mode === 'registration' ? 'Podstawowe dane' : 'Dane logowania', 'Potwierdzenie e-maila'].map((label,i)=><li key={label} aria-current={i === progress ? 'step' : undefined} className={i <= progress ? 'reached' : ''}><span>{i+1}</span><b>{label}</b></li>)}</ol>
    <section className="porr-chat" aria-label={mode === 'registration' ? 'Rejestracja konta' : 'Logowanie'}>
      <header className="porr-chat-header"><Avatar sex={avatar}/><div><strong>SpendGuru</strong><p>{busy ? 'Chwila, sprawdzam…' : 'Twój rozmówca · online'}</p></div>
        {!isSignedIn && <button className="porr-icon" title="Zacznij od nowa" aria-label="Zacznij od nowa" disabled={busy} onClick={()=>window.location.reload()}><Icon name="restart"/></button>}
      </header>
      <div className="porr-chat-history" ref={history}>
        {ready ? <div className="porr-success"><Avatar sex={avatar} size={60}/><h2>{passwordChanged ? 'Hasło zmienione. Zalogowano' : mode === 'registration' ? 'Konto jest gotowe' : 'Zalogowano'}</h2><p>Dostęp do danych dostawców zależy od przypisania konta do organizacji i nadanych uprawnień.</p><a className="porr-primary" href="/">Przejdź do aplikacji</a></div>
          : native ? <><button className="porr-text-button" onClick={()=>setNative(false)}>Wróć do rozmowy</button><SignIn routing="hash" forceRedirectUrl="/login" signUpUrl="/login" withSignUp={false} appearance={{variables:{colorPrimary:'var(--brand)',colorBackground:'var(--surface)',colorForeground:'var(--text)',fontFamily:'Inter, Arial, sans-serif',fontSize:'14px',borderRadius:'12px'},elements:{rootBox:'porr-provider-root',cardBox:'porr-provider-card',card:'porr-provider-card',headerTitle:'porr-provider-title',formButtonPrimary:'porr-provider-button'}}}/></>
          : <><div role="log" aria-live="polite" aria-relevant="additions">{messages.map((message,i)=><div key={i} className={`porr-message ${message.user?'is-user':''}`}>{!message.user && <Avatar sex={avatar} size={28}/>}<div className="porr-bubble">{message.text}</div></div>)}</div>
            {step === 'avatar' && !isSignedIn && <div className="porr-choices avatars">{(['female','male'] as const).map(sex=><button disabled={busy || !isLoaded} key={sex} onClick={()=>void submit(sex)}><Avatar sex={sex} size={60}/><span>Awatar {sex === 'male' ? 'męski' : 'żeński'}</span></button>)}</div>}
            {step === 'method' && <div className="porr-choices"><button disabled={busy} onClick={()=>void submit('email_code')}>Kod e-mail</button><button disabled={busy} onClick={()=>void submit('password')}>Hasło</button></div>}
            {step === 'password_unavailable' && <button className="porr-primary" disabled={busy} onClick={()=>void switchMethod(true)}>Zaloguj się kodem e-mail</button>}
            {step === 'existing' && <button className="porr-primary" disabled={busy} onClick={onLogin}>Przejdź do logowania</button>}
            {step === 'challenge' && <button className="porr-primary" disabled={busy} onClick={()=>setNative(true)}>Dokończ potwierdzenie</button>}
          </>}
        {busy && <div className="porr-typing" role="status" aria-label="Przetwarzanie"><span/><span/><span/></div>}
        {error && <p className="porr-error" role="alert">{error}{isSignedIn && <button onClick={()=>setRetry(x=>x+1)} disabled={busy}>Spróbuj ponownie</button>}</p>}
      </div>
      {!ready && !native && <footer className="porr-composer">
        {formStep ? <form onSubmit={(e: FormEvent)=>{e.preventDefault();void submit(answer);}}>
          <label className="porr-sr-only" htmlFor="porr-answer">{isCode ? 'Kod weryfikacyjny' : step==='new_password' ? 'Nowe hasło' : step === 'password' ? 'Hasło' : step === 'email' ? 'Adres e-mail' : step === 'name' ? 'Imię' : 'Nazwisko'}</label>
          <div className="porr-inputs"><input ref={input} id="porr-answer" name={step} type={isPassword?'password':step==='email'?'email':'text'} inputMode={isCode?'numeric':undefined} autoComplete={isCode?'one-time-code':step==='name'?'given-name':step==='surname'?'family-name':step==='new_password'?'new-password':step==='password'?'current-password':'email'} className={isCode?'porr-otp':''} maxLength={isCode?6:isPassword?1024:320} pattern={isCode?'[0-9]{6}':undefined} placeholder={isCode?'0 0 0 0 0 0':isPassword?'Wpisz hasło…':'Wpisz odpowiedź…'} value={answer} onChange={e=>setAnswer(isCode?e.target.value.replace(/\D/g,''):e.target.value)} disabled={busy} required/>
          {step==='new_password' && <><label className="porr-sr-only" htmlFor="porr-confirm">Powtórz nowe hasło</label><input id="porr-confirm" type="password" autoComplete="new-password" maxLength={1024} placeholder="Powtórz nowe hasło…" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} required/></>}</div>
          <button className="porr-send" disabled={busy || !answer.trim()} aria-label={isCode?'Potwierdź kod':step==='new_password'?'Zmień hasło':'Wyślij odpowiedź'}><Icon name="send"/></button>
        </form> : <p className="porr-idle">{!isLoaded?'Ładowanie bezpiecznego formularza…':isSignedIn?'Potwierdzanie konta…':'Wybierz odpowiedź powyżej.'}</p>}
        {step==='code' && !isSignedIn && <button className="porr-text-button" disabled={busy || resendLocked} onClick={()=>void resend()}>{resendLocked?'Ponowna wysyłka za chwilę':'Wyślij kod ponownie'}</button>}
        {mode==='login' && !isSignedIn && <>
          {step==='password' && <div className="porr-recovery-actions"><button className="porr-text-button" disabled={busy} onClick={()=>void startRecovery()}>Nie pamiętam hasła</button><button className="porr-text-button" disabled={busy} onClick={()=>void switchMethod(true)}>Zaloguj się kodem e-mail</button></div>}
          {step==='reset_code' && <button className="porr-text-button" disabled={busy || resendLocked} onClick={()=>void startRecovery()}>{resendLocked?'Ponowna wysyłka za chwilę':'Wyślij kod ponownie'}</button>}
          {['reset_code','new_password'].includes(step) && <button className="porr-text-button" disabled={busy} onClick={()=>void switchMethod()}>Wróć do wyboru metody</button>}
          {['password','reset_code','new_password'].includes(step) && <details className="porr-mailbox-help"><summary>Nie masz dostępu do skrzynki?</summary><p>Zmiana hasła wymaga kodu z Twojego e-maila. Jeśli nie masz dostępu do skrzynki, skontaktuj się z administratorem aplikacji — ten formularz nie zmienia adresu e-mail konta.</p></details>}
        </>}
      </footer>}
    </section>
  </div>;
}

export function PorrAccount({ identityOrigin, features }: { identityOrigin: string; features: {name:string;description:string}[] }) {
  const [mode,setMode]=useState<Mode>('registration'),[busy,setBusy]=useState(false),[theme,setTheme]=useState<'light'|'dark'>('light');
  useEffect(()=>{try {setTheme(localStorage.getItem('srm-theme')==='dark'?'dark':'light')}catch{}},[]);
  const changeTheme=(value:'light'|'dark')=>{setTheme(value);try {localStorage.setItem('srm-theme',value)}catch{}};
  return <main className="porr-account" data-theme={theme} data-canon-library="SRM" data-magicpath-revision="464297738012618752">
    <div className="porr-layout">
      <section aria-label="Rejestracja i logowanie PORR">
        <div className="porr-brands"><img src="/spendguru/logo.svg" alt="SpendGuru" width="140" height="46"/><img src="/porr-demo/porr-logo.svg" alt="PORR SA" width="52" height="42"/><div className="porr-theme" role="group" aria-label="Wygląd">{(['light','dark'] as const).map(value=><button key={value} onClick={()=>changeTheme(value)} aria-label={value==='light'?'Tryb jasny':'Tryb ciemny'} aria-pressed={theme===value}><Icon name={value==='light'?'sun':'moon'}/></button>)}</div></div>
        <h1>Supplier Relationship Management</h1><p className="porr-subtitle">Wersja testowa dla PORR S.A.</p><p className="porr-description">Celem aplikacji są testy wewnętrzne udostępnianych funkcjonalności.</p>
        <div className="porr-modes" role="group" aria-label="Dostęp do konta">{(['registration','login'] as const).map(value=><button key={value} disabled={busy} aria-pressed={mode===value} onClick={()=>setMode(value)}>{value==='registration'?'Rejestracja':'Logowanie'}</button>)}</div>
        <AccountConversation key={mode} identityOrigin={identityOrigin} mode={mode} onLogin={()=>setMode('login')} onBusy={setBusy}/>
        <p className="porr-disclaimer">Wersja testowa jest przeznaczona tylko dla pracowników PORR SA i nie powinna być udostępniana osobom nieuprawnionym.</p>
      </section>
      <div className="porr-divider" aria-hidden="true"/>
      <section className="porr-release" aria-label="Informacje o wersji"><p className="porr-version">Wersja: 1.0 Development</p><h2>Zakres obecnej wersji</h2><ul>{features.map(x=><li key={x.name}><strong>{x.name}</strong> — {x.description}</li>)}</ul><h2>Change Log względem wersji poprzedniej</h2><h2>Tematy oczekujące / planowane do kolejnej wersji</h2><details><summary>Historia wersji</summary><p>Brak wcześniejszych wersji.</p></details><p className="porr-contact">Zgłaszanie poprawek, uwag, pomysłów:<br/><a href="mailto:tomasz.uscinski@profitia.pl">tomasz.uscinski@profitia.pl</a></p></section>
    </div>
  </main>;
}
