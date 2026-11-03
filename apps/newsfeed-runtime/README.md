# Newsfeed NewsAPI Development connector

Architecture Platform owns this first News Discovery provider and the independent
`packages/newsfeed-contracts` contract. It is a library and operator CLI, not a
hosted service, scheduler, user subscription store or consumer integration.

See the [Polish capability catalogue and proposed business filters](docs/newsapi-capabilities.pl.md)
and [actual live-test status](docs/newsapi-live-evidence.json). Contract version 0.1.0
has not been adopted or deployed by SG2/SRM. No main merge is implied by this source proposal.

## Local verification

From this directory, with Node 22 or newer:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build
node src/cli.mjs capabilities
node src/cli.mjs plan examples/company.json
node src/cli.mjs plan examples/industry.json
```

The last example intentionally reports unsupported Polish headline edition.
`plan` performs no request and requires no credential. The build validates native
ES modules and the public TypeScript consumer contract; no generated runtime
bundle or registry publication is required.

## Real queries

Load `NEWSAPI_API_KEY` through the existing secure Development secret workflow,
outside the command line and source. Do not paste a key into shell history, input
JSON, URLs, test fixtures, PRs or continuity records. There is no automatic env-file
loader or credential lookup in another project's resource.

```sh
TARGET_ENVIRONMENT=development node src/cli.mjs search examples/company.json
TARGET_ENVIRONMENT=development node src/cli.mjs publishers publisher-criteria.json
TARGET_ENVIRONMENT=development npm run probe:live
```

`publisher-criteria.json` is a local JSON object, for example
`{"publisherCountry":"pl","category":"business"}`. For a time window add
`publishedAfter` and `publishedBefore` to a search JSON, using date or UTC `Z`.
No default week is silently inserted. The live probe uses a seven-day window
ending 24 hours before execution to accommodate a delayed Development plan; it
does not establish the actual account plan. It saves only counts, field names and
sanitized status, never article bodies, raw errors or a credential. Up to 24
sequential requests; no retries or automatic pagination. Expected negative raw
probes investigate undocumented acceptance and never widen connector capabilities.

## Boundary and errors

`createNewsApiProvider({apiKey, targetEnvironment:'development'})` implements
`NewsDiscoveryProvider.search()`, `listPublishers()` and `getCapabilities()`.
Supported values and combinations are validated before transport. Unknown or
unsupported criteria are rejected, not dropped. One call makes at most one fixed
HTTPS provider request. Redirects are refused; request timeout is bounded; response
body size is limited to 2 MiB. Errors use stable safe codes; provider messages,
queries and credentials are absent from telemetry. No automatic retry or scraping.

`status:'empty'` is a successful empty page, not a filter failure or a statement
about provider coverage. Article language/category/event location remain null;
publisher country is catalogue metadata, not an event location. `content` is a
preview, not licensed full text. Source selection is not entity disambiguation.

No private product records, grants, sessions or identities are read or stored.
Queries/results exist in the operator process only. Test examples are public
synthetic search criteria, not customer data. The operator's supplied provider
credential authorizes this bounded Development discovery exercise. This is not a
customer-facing E1 operation. Any later HTTP endpoint or SG2/SRM adoption must
first bind the exact operation to verified host identity, applicable organisation
and user scope, product access and current E1 authorization. No bypass, fixed user
ID or parallel identity implementation is supplied here.

## Observability and CI

`onEvent` optionally receives provider, operation, outcome, duration, HTTP status
and count only. Tests prove absence of search text, key and upstream exception
details; monitoring failure does not fail the search. Status: **EXTENDED**, local
safe transport instrumentation. No Sentry project, PostHog configuration or hosted
collector is created or claimed as live-accepted.

`newsfeed-ci.yml` runs public dependency installation with lifecycle scripts
disabled, controlled transport tests, typecheck/build, existing governance/owner
regressions and exact changed-path Architecture preflight. It has read-only GitHub
permissions, no provider credentials, no paid/live calls and no deployment step.
The existing SG2/SRM runtime, private packages and CI policies are unchanged.
