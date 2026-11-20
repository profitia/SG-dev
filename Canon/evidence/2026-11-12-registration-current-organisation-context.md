# Current organisation context — Stage I implementation

Task: ARCH-REGISTRATION-CURRENT-ORGANISATION-CONTEXT-20261112. Development source only; installation, enrolment and live acceptance remain pending.

The optional shared reader uses the existing account.settings.read operation and unchanged Root candidate.16, official identity, actual driver transaction, durable INTENT and current own-account SQL scope. SQL011 is additive and disabled until a specific ordinary application role is enrolled. It returns only the current user's canonical organisation selector and a bounded expiry, following Identity's preference order. A separately configured legacy fallback requires current own membership. It creates no organisation, membership, product grant or business permission. Raw table/function access and foreign/expired scope fail closed.

Validation: genuine isolated PostgreSQL and Root suite 6/6 PASS. Includes disabled policy, unchanged Root16, own preference, POST lookup before a separately authorised module mutation, expired membership, foreign preference, legacy membership, revoked identity and ordinary raw SQL denial. Combined Identity/bootstrap/store/Package Limits/context suite 47/47 PASS, zero skipped or cancelled; Identity and Package Limits builds PASS. SDK CJS/type acceptance and full adopted-consumer checks remain required before release.

The installation plan records SQL011 digest and separate application enrolment; no live SQL, keys, grants, deployment, provider or mail operation was performed.
