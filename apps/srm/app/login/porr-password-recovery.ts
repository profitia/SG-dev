import type { useClerk } from '@clerk/react';

type Clerk = ReturnType<typeof useClerk>;
type SignIn = Clerk['client']['signIn'];

/** Presentation adapter only: Clerk verifies codes, enforces policy and changes passwords. */
export function createPasswordRecovery(clerk: Clerk) {
  let attempt: SignIn | null = null;
  return {
    clear() { attempt = null; },
    async start(email: string) {
      attempt = null;
      attempt = await clerk.client.signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      return attempt.status === 'needs_first_factor' ? 'reset_code' : 'challenge';
    },
    async verify(code: string) {
      if (!attempt || attempt.status !== 'needs_first_factor' || !/^\d{6}$/.test(code)) throw Error('INVALID_CODE');
      attempt = await attempt.attemptFirstFactor({ strategy: 'reset_password_email_code', code });
      return attempt.status === 'needs_new_password' ? 'new_password' : 'challenge';
    },
    async finish(password: string) {
      if (!attempt || attempt.status !== 'needs_new_password') throw Error('RESET_REQUIRED');
      // Explicitly announced in the UI. Never store the password in our backend or transcript.
      attempt = await attempt.resetPassword({ password, signOutOfOtherSessions: true });
      if (attempt.status !== 'complete' || !attempt.createdSessionId) return 'challenge';
      await clerk.setActive({ session: attempt.createdSessionId });
      attempt = null;
      return 'done';
    },
  };
}
