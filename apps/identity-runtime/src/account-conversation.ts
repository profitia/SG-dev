/** Scripted presentation over the official Clerk resource; no local authentication authority. */
export function createClerkConversation(sdk: any, registration: boolean) {
  const state = { step: 'avatar', avatarSex: null as 'male' | 'female' | null, firstName: '', lastName: '', email: '', method: 'email_code', complete: false, busy: false }
  let completedUserId: string | null = null
  async function finish(result: any) {
    if (result.status !== 'complete' || !result.createdSessionId) { state.step = 'challenge'; return }
    if (registration && typeof result.createdUserId === 'string') completedUserId = result.createdUserId
    await sdk.setActive({ session: result.createdSessionId })
    state.complete = true; state.step = 'done'
  }
  async function sendCode() {
    if (registration) await sdk.client.signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
    else {
      const factor = sdk.client.signIn.supportedFirstFactors?.find((f: any) => f.strategy === 'email_code')
      if (!factor?.emailAddressId) { state.step = 'challenge'; return }
      await sdk.client.signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId })
    }
    state.step = 'code'
  }
  return { state,
    registrationAvatar(userId: string) {
      const signUp = sdk.client.signUp
      const subject = completedUserId ?? (signUp?.status === 'complete' ? signUp.createdUserId : null)
      return registration && subject === userId && ['male', 'female'].includes(state.avatarSex ?? '') ? state.avatarSex : null
    },
    async resend() { if (state.busy || state.step !== 'code') return; state.busy = true; try { await sendCode() } finally { state.busy = false } },
    async submit(value: string) {
      if (state.busy || state.complete) return
      const step = state.step, input = step === 'password' ? value : value.trim()
      if (!input || input.length > (step === 'password' ? 1024 : 320)) throw Error('INVALID_INPUT')
      if (step === 'code' && !/^\d{6}$/.test(input)) throw Error('INVALID_CODE')
      state.busy = true
      try {
        if (step === 'avatar') { if (!['male', 'female'].includes(input)) throw Error('INVALID_INPUT'); state.avatarSex = input as 'male' | 'female'; state.step = registration ? 'name' : 'method' }
        else if (step === 'name') { state.firstName = input; state.step = 'surname' }
        else if (step === 'surname') { state.lastName = input; state.step = 'email' }
        else if (step === 'method') { if (!['email_code', 'password'].includes(input)) throw Error('INVALID_INPUT'); state.method = input; state.step = 'email' }
        else if (step === 'email') {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) throw Error('INVALID_EMAIL')
          state.email = input
          if (registration) {
            // Presentation preference only. Clerk signup metadata is a temporary
            // carrier until the verified account writes its own private profile.
            const result = await sdk.client.signUp.create({ firstName: state.firstName, lastName: state.lastName, emailAddress: input, unsafeMetadata: { assistantAvatar: state.avatarSex } })
            // Required provider fields, legal acceptance and challenges are never skipped.
            if (result.status === 'complete') await finish(result)
            else if (result.missingFields?.length) state.step = 'challenge'
            else await sendCode()
          } else {
            const result = await sdk.client.signIn.create({ identifier: input })
            if (result.status === 'complete') await finish(result)
            else if (result.status !== 'needs_first_factor') state.step = 'challenge'
            else if (state.method === 'password') {
              state.step = result.supportedFirstFactors?.some((f: any) => f.strategy === 'password') ? 'password' : 'challenge'
            } else await sendCode()
          }
        } else if (step === 'code') {
          const result = registration ? await sdk.client.signUp.attemptEmailAddressVerification({ code: input }) : await sdk.client.signIn.attemptFirstFactor({ strategy: 'email_code', code: input })
          await finish(result)
        } else if (step === 'password') await finish(await sdk.client.signIn.attemptFirstFactor({ strategy: 'password', password: input }))
      } finally { state.busy = false }
    }
  }
}

/** All dynamic chat content uses textContent. Passwords and codes never become transcript data. */
export const conversationClientScript = String.raw`
window.startSpendGuruConversation = function(cfg, nativeChallenge) {
  const root = document.getElementById('chat-interface');
  if (!root) { nativeChallenge(); return; }
  const model = createClerkConversation(window.Clerk, cfg.flow === 'registration');
  const reg = cfg.flow === 'registration', en = cfg.en;
  const history = document.getElementById('history'), choices = document.getElementById('choices');
  const form = document.getElementById('composer-form'), input = document.getElementById('answer');
  const otp = document.getElementById('otp'), digits = [...otp.querySelectorAll('input')];
  const error = document.getElementById('chat-error'), send = document.getElementById('send');
  const dots = document.getElementById('typing'), status = document.getElementById('chat-status');
  const resend = document.getElementById('resend'), switchMethod = document.getElementById('switch-method');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let avatar = 'female', writing = false, epoch = 0, resendAt = 0;
  const tr = (pl, english) => en ? english : pl;
  const scroll = () => { history.scrollTo({ top: history.scrollHeight, behavior: reduced ? 'instant' : 'smooth' }); };
  const avatarNode = (size, dynamic = true) => { const wrap = document.createElement('span'); wrap.className = 'sg-v2-avatar'; wrap.style.width = wrap.style.height = size + 'px'; const image = document.createElement('img'); image.src = cfg.avatars[avatar]; image.alt = ''; if (dynamic) image.setAttribute('data-avatar', ''); image.referrerPolicy = 'no-referrer'; wrap.append(image); return wrap; };
  const setAvatar = value => { if (!['male','female'].includes(value)) return; avatar = value; model.state.avatarSex = value; document.querySelectorAll('[data-avatar]').forEach(image => { image.src = cfg.avatars[avatar]; }); };
  window.spendGuruRestoreAvatar = value => { setAvatar(value); };
  window.spendGuruRegistrationAvatar = userId => model.registrationAvatar(userId);
  function bubble(text, user) {
    const row = document.createElement('div'); row.className = 'sg-v2-message ' + (user ? 'is-user' : 'is-bot');
    if (!user) row.append(avatarNode(34)); const box = document.createElement('div'); box.className = 'sg-v2-bubble ' + (user ? 'is-user' : 'is-bot'); box.textContent = text; row.append(box); history.insertBefore(row, dots);
    if (!reduced) row.animate(user ? [{ opacity: 0, transform: 'translateY(32px) scale(.96)', filter: 'blur(2px)' }, { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' }] : [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: user ? 430 : 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    scroll(); return box;
  }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function lock(yes) { send.disabled = yes; input.disabled = yes; digits.forEach(d => d.disabled = yes); choices.querySelectorAll('button').forEach(b => b.disabled = yes); }
  async function say(text) {
    const current = ++epoch; writing = true; lock(true); choices.replaceChildren(); dots.hidden = false; status.textContent = tr('SpendGuru pisze…', 'SpendGuru is typing…'); scroll();
    await pause(reduced ? 0 : 420); if (current !== epoch) return;
    dots.hidden = true; const box = bubble('', false); const letters = Array.from(text);
    for (let i = 0; i < letters.length; i += reduced ? letters.length : 2) { if (current !== epoch) return; box.textContent = letters.slice(0, Math.min(i + (reduced ? letters.length : 2), letters.length)).join(''); if (!reduced) await pause(24); scroll(); }
    writing = false; status.textContent = tr('Twój rozmówca · online', 'Your guide · online'); lock(false);
  }
  function choice(label, value, image) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'sg-v2-choice';
    if (image) { const old = avatar; avatar = image; button.append(avatarNode(80, false)); avatar = old; }
    const labelNode = document.createElement('span'); labelNode.textContent = label; button.append(labelNode); button.onclick = () => submit(value, label); choices.append(button);
  }
  async function ask() {
    form.hidden = true; otp.hidden = true; input.hidden = false; resend.hidden = true; switchMethod.hidden = true; input.value = ''; digits.forEach(d => d.value = ''); error.textContent = '';
    const step = model.state.step;
    document.querySelectorAll('[data-step]').forEach((el, index) => { const phase = step === 'avatar' ? 0 : ['name','surname','email','method','password'].includes(step) ? 1 : 2; el.classList.toggle('is-current', index === phase); el.classList.toggle('is-muted', index !== phase); el.querySelector('span').classList.toggle('is-reached', index <= phase); });
    const questions = {
      avatar: tr('Cześć, jestem SpendGuru. Najpierw wybierz, z kim wolisz rozmawiać. Pamiętaj, zawsze możesz zmienić decyzję w dowolnym momencie.', 'Hi, I’m SpendGuru. First, choose who you’d like to talk to. You can change your choice at any time.'),
      name: tr('Cześć, miło Cię poznać. Zacznijmy od tego, jak masz na imię?', 'Hi, nice to meet you. Let’s start with your first name.'),
      surname: tr('Miło Cię poznać! A jak masz na nazwisko?', 'Nice to meet you! And your last name?'),
      email: reg ? tr('Na jaki adres e-mail założymy Twoje konto?', 'Which email address shall we use for your account?') : tr('Podaj adres e-mail swojego konta.', 'What is your account email address?'),
      method: tr('Dobrze Cię znów widzieć. Jak chcesz się zalogować?', 'Good to see you again. How would you like to sign in?'),
      password: tr('Teraz wpisz swoje hasło. Zostanie między Tobą a Clerkiem.', 'Now enter your password. It stays between you and Clerk.'),
      code: tr('Została nam jeszcze jedna rzecz. Sprawdź pocztę i wpisz sześciocyfrowy kod, który otrzymasz w wiadomości.', 'One more thing. Check your inbox and enter the six-digit code from your email.'),
      challenge: tr('Potrzebne jest dodatkowe potwierdzenie. Dokończ je w bezpiecznym oknie poniżej.', 'An extra verification is needed. Complete it in the secure panel below.')
    };
    await say(questions[step] || tr('Przygotowujemy Twoje konto…', 'Preparing your account…'));
    if (step === 'avatar') { choices.className = 'sg-v2-choices is-avatars'; choice(tr('Awatar żeński', 'Female avatar'), 'female', 'female'); choice(tr('Awatar męski', 'Male avatar'), 'male', 'male'); }
    else if (step === 'method') { choices.className = 'sg-v2-choices'; choice(tr('Kodem e-mail', 'Email code'), 'email_code'); choice(tr('Hasłem', 'Password'), 'password'); }
    else if (step === 'challenge') nativeChallenge();
    else if (!model.state.complete) {
      form.hidden = false; const code = step === 'code'; otp.hidden = !code; input.hidden = code;
      input.type = step === 'email' ? 'email' : step === 'password' ? 'password' : 'text'; input.maxLength = step === 'password' ? 1024 : 320;
      input.autocomplete = ({name:'given-name',surname:'family-name',email:'email',password:'current-password'})[step] || 'off';
      input.setAttribute('aria-label', ({name:tr('Imię','First name'),surname:tr('Nazwisko','Last name'),email:'E-mail',password:tr('Hasło','Password')})[step] || tr('Odpowiedź','Your answer'));
      input.placeholder = step === 'email' ? 'twoj@email.pl' : step === 'password' ? tr('Wpisz hasło…','Your password…') : tr('Napisz wiadomość…','Write a message…');
      resend.hidden = !code; switchMethod.hidden = reg || !['code','password'].includes(step); (code ? digits[0] : input).focus({preventScroll:true});
    }
    scroll();
  }
  async function submit(value, label) {
    if (writing || model.state.busy) return;
    const step = model.state.step;
    if (!value.trim()) { error.textContent = tr('Wpisz odpowiedź.', 'Please enter your answer.'); return; }
    if (step === 'code' && !/^\d{6}$/.test(value)) { error.textContent = tr('Wpisz wszystkie sześć cyfr.', 'Please enter all six digits.'); return; }
    if (step === 'avatar') setAvatar(value);
    bubble(['password','code'].includes(step) ? (step === 'code' ? '••••••' : '••••••••') : label || value, true);
    input.value = ''; digits.forEach(d => d.value = ''); error.textContent = ''; lock(true); dots.hidden = false; status.textContent = tr('Sprawdzamy…','Checking…');
    try { await model.submit(value); dots.hidden = true; if (!model.state.complete) await ask(); }
    catch (e) { dots.hidden = true; lock(false); status.textContent = tr('Twój rozmówca · online','Your guide · online'); error.textContent = tr('Nie udało się potwierdzić odpowiedzi. Sprawdź wpisane dane lub kod i spróbuj ponownie.', 'We could not verify that answer. Check your details or code and try again.'); if (step === 'code') digits[0].focus(); else input.focus(); }
  }
  form.onsubmit = event => { event.preventDefault(); void submit(model.state.step === 'code' ? digits.map(d => d.value).join('') : input.value); };
  digits.forEach((digit,index) => {
    digit.oninput = () => { const values = digit.value.replace(/\D/g,'').slice(0,6-index); digit.value = values[0] || ''; [...values].slice(1).forEach((v,j) => digits[index+j+1].value = v); if (values) digits[Math.min(5,index+values.length)].focus(); };
    digit.onpaste = event => { event.preventDefault(); const value = event.clipboardData.getData('text').replace(/\D/g,'').slice(0,6); [...value].forEach((v,i) => digits[i].value = v); digits[Math.min(5,value.length)].focus(); };
    digit.onkeydown = event => { if (event.key === 'Backspace' && !digit.value && index > 0) { digits[index-1].value = ''; digits[index-1].focus(); } };
  });
  resend.onclick = async () => { if (writing || model.state.busy || Date.now() < resendAt) return; resendAt = Date.now()+30000; resend.disabled = true; try { await model.resend(); error.textContent = tr('Nowy kod został wysłany. Sprawdź pocztę.', 'A new code has been sent. Check your inbox.'); } catch { error.textContent = tr('Nie udało się wysłać nowego kodu. Spróbuj za chwilę.', 'We could not send a new code. Try again shortly.'); } setTimeout(() => resend.disabled = false, 30000); };
  switchMethod.onclick = () => { if (!writing && !model.state.busy) { model.state.step = 'method'; void ask(); } };
  document.getElementById('avatar-switch').onclick = () => setAvatar(avatar === 'female' ? 'male' : 'female');
  window.spendGuruAccountReady = async () => { form.hidden = true; choices.replaceChildren(); await say(tr('Konto gotowe. Za chwilę przeniesiemy Cię do aplikacji.', 'Your account is ready. Taking you to the app.')); await pause(reduced ? 0 : 600); };
  document.getElementById('restart').onclick = () => window.location.reload();
  root.hidden = false;
  if (cfg.flow === 'recovery') { model.state.step = 'challenge'; }
  void ask();
};`
