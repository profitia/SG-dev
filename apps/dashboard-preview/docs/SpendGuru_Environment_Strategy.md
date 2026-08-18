# SpendGuru Environment Strategy

## Development

- local only
- feature branches
- isolated Neon `development` branch under the staging Neon project
- no automatic external deployment

## Staging

- `main`
- Render staging service `spendguru-stage`
- Neon project `sg2-data-runtime-staging`
- staging branch `production`
- auto-deploy after approved merge

## Production

- `production`
- separate Render production service
- separate Neon project `sg2-data-runtime-production`
- production branch `production`
- promotion from validated `main`

## Promotion Rules

- No direct push to production.
- No force push.
- No database sharing between staging and production.
- No promotion by manually copying code.
- The same commit is promoted from staging to production.

## Current Foundation State

- Staging validation passed on the renamed Render service and existing public URL.
- Development database isolation exists via Neon child branch `development`.
- Production service creation remains a separate gated step because it introduces an additional hosted environment.