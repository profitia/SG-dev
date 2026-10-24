# Communication language — source and acceptance evidence

Task ARCHITECTURE-COMMUNICATION-LANGUAGE-20261024. Development only.

Producer source introduces additive SQL004, closed paired pl/en + source profile
patches and bounded IE-03 email language projection. Existing-account PL migration,
first browser initialization, explicit future override, concurrency, isolation,
revocation, queue snapshot and rollback compatibility tested using ephemeral local
PostgreSQL. No live installation is claimed by this source record.

Runtime, Mailgun template publication, exact-SHA deployment, live migration and
acceptance evidence will be added after their independent validation. No Staging,
Production or SG2/SRM service deployment is included.

Known limitation: an unbound first signup OTP or pre-account invitation uses the
neutral EN fallback; the current signed Clerk event cannot safely identify that
browser's pending preference. No email-based identity lookup is permitted.
