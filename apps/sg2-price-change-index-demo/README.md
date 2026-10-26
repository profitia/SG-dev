# Price Change Index — SG2 Development demo

Stage 1 only: synthetic local datasets and in-memory simulations. No real PORR records, product API, auth, database, provider, telemetry, LLM or cross-app connection. Names and source series in fixtures are demonstrative labels. Save changes only local demo state; a reload resets it. The UI package emits local intent callbacks recorded in memory by this host.

Routes: /v1, /v2, /v3 (default), /portable (independent mounting/reset host). Use ?theme=dark for an initial dark mode, or the canonical theme switch. The host can configure a base path with PCI_BASE_PATH at build time. The module does not own a router.

Install/build: npm ci --install-links --include=dev, npm run typecheck, npm test, npm run build from this directory. Run npm start to serve only static output on 0.0.0.0 and PORT. No secret or DATABASE_URL is required. Local dev is npm run dev on 127.0.0.1:3671. The server accepts GET/HEAD only, supports direct-route reload and denies runtime network connections with CSP.

Source revisions and the full element/style matrix are in verification/. DO WDROŻENIA is discovery only, not a parity PASS. The deployed service/project/environment/SHA and post-deploy evidence are recorded after creation. No live resource exists merely because deployment/render.yaml exists.

Render target: existing PROFITIA WORKSPACE / SpendGuru 2.0 Actual / Development. Requested new Web Service: Price Change Index, one 0.5c-512mb instance, manual deploy, Frankfurt, no env group/disk/database. Compute budget $7/month; usage allowances and any additional charges must be checked before creating. Do not use or redeploy existing SG2/SRM services.

Future controlled shutdown: suspend only the recorded new service after separate owner instruction; preserve source, service/deploy IDs, provenance and verification evidence. Do not delete it automatically. First release has no previous artifact. Later rollback uses its retained proven working deployment with fresh configuration/source checks. Stage 2 host/data integration is a separate future task.
