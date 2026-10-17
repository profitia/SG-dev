# SRM — explicit provider closes the legacy demo boundary

Task `SRM-E1-LEGACY-PROVIDER-BOUNDARY-20261017`, SRM / Development; source authority at mutation: `c197e5d1f8ff2add3c6460b85fbfce582d68c015`.

The temporary Clerk UI preparation did not itself close the old cookie/password boundary. Every existing demo consumer now receives the explicit deployment provider discriminator: absent provider or exact `legacy_demo` retains the current signed demo; `clerk`, empty or unknown explicit values deny it. `demoAuthReady` also closes the legacy login endpoint. No caller header establishes an identity. The report handler now passes its complete deployment environment to the shared demo helper instead of discarding that discriminator.

Source callers include middleware, lookup, search, KYS/JDG/PESEL, financial Excel, supplier web identity, report data and PDF/KRS exports. This closes their old demo path when a new provider is selected. It is not their adoption of the new permission engine, and activating Clerk before that separate adoption would intentionally deny those paths.

Verification: 37 focused tests of demo, report and existing PDF/KRS behaviour; 475 full product/migration tests, zero skipped; typecheck and full Next16/React19 build PASS. The real report HTTP handler refuses a valid old cookie plus forged identity headers under Clerk/invalid providers without invoking its reader, while exact legacy mode still returns the existing business result. Default process environment propagation is tested. Existing shared-host API/SQL and remote required checks remain required before merge; final exact-source runs are recorded in the task PMOS/PHR closeout.

No runtime flag, service, secret, database, external permission or deployment changed. No real browser login, all-entry integration, completed E1, Development release or Staging acceptance is claimed.
