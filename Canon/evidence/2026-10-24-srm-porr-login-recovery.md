# SRM PORR conversational password recovery

Task: SRM-PORR-LOGIN-RECOVERY-20261024. Profile SRM. Target Development only.

The generic recovery link incorrectly opened ordinary native sign-in from the method chooser. Recovery is now contextual to the password step. Users can request a password-reset email code or switch to email-code sign-in without changing a password. Existing PORR V2 chat, avatar and light/dark tokens provide the visual; no separate prototype or provider configuration change is required.

Password recovery uses the installed official Clerk SDK: reset-password email-code creation, code verification, and resetPassword only after the provider reports needs_new_password. The UI asks for matching new passwords and announces revocation of other sessions. Required challenges remain with Clerk, styled using the same visual tokens. A provider session must still pass shared ACCOUNT_SELF before application entry. No organisation or product access is granted by this flow.

Password and code values never enter the transcript, local/session storage, own application API or continuity reports. Provider validation, expiration and throttling remain authoritative; the resend UI adds a 30-second cooldown. Cancellation clears the local recovery continuation. No-mailbox help explains that this email-based process cannot change the account's address.

Scope: SRM presentation and acceptance evidence only. Shared backend, database, Clerk configuration, Mailgun configuration and unrelated runtimes are unchanged. Historical acceptance receipts are preserved append-only. Runtime deployment evidence and measured rollback proof belong to the task's final PMOS/PHR closeout; source tests alone do not prove live email delivery.
