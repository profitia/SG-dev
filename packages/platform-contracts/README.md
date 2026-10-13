# Development integration contracts

Owner: ARCHITECTURE. This package defines the identity of a development track. `projectKey` is a governance project; it does not replace Organisation ID or User ID and does not implement SaaS tenancy.

The source remains one implementation. SG2 and SRM adopt the contract in separate governed tasks, recording its version and source digest. A changed digest requires explicit consumer integration and CI. A monorepo folder or version string alone does not isolate an application's next build. Experiments stay on the Architecture branch until dependent checks pass; deployed products retain their accepted revisions and separate release procedures.

Run `npm test` and `npm run build` here. Product adapters and integration CI are completed in the remaining E0-A-06 tasks. See Canon/runbooks/shared-development-contract-integration-v1.md.
