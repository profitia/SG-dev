# SRM — optional native SQL work source acceptance, 2026-10-19

Own task `SRM-E1-NATIVE-WORK-SOURCE-COMPATIBILITY-20261019`, SRM/Development/local, own canonical PMOS/PHR. Producer ARCHITECTURE-E1-DELEGATED-NATIVE-WORK-20261019, PR534, source025146034b42381c6e1eb812ed1c159c69d05bb1.

Accept exact platform1.20/rootcandidate.13/host1.11/work1.0 implementation/declarations and51 source digests. Previous source receipts keep their values and are explicitly historical. Local file dependencies use exact1.20 package locks; no private dependency or CI policy/access change. Original app business sources and private migrations remain unchanged, including the actual SRM16-source private-read adoption.

The optional factory is imported and its schema/source/host fingerprints are checked by the actual existing native integration suite. Default HUMAN, Forecast, phase and inspection behavior must remain valid. This is source compatibility only: nativeSqlWorkAdopted=false, sql016Installed=false, no provider execution or product activation. Consumer composition needs a separate domain acceptance task.

Validation: 173 native tests;551 existing product tests;311 promotion tests, all passed with zero failures/skips. Typecheck/build results are separately retained in task evidence.

Initial producer-only PR534 CI correctly refused stale consumer hashes/locks and Maps exact peer1.19. Those failures remain historical; only a separately validated complete candidate may integrate. No weakening of fingerprint or access controls.

No cloud schema/role/grant/data/identity/configuration/credential/resource/provider/deployment change. Prepared Profitia stays empty and old demo retains its owner. Full E1 remains IN_PROGRESS; tested source is not owner session, live isolation, business UAT or release/LKG. Staging has its own protected review; no Production/E2–E4.
