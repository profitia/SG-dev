# SpendGuru

Canonical repository for the SpendGuru application.

## Environments

- Development - local feature branches and isolated Neon `development` branch
- Staging - `main` deployed to Render service `spendguru-stage`
- Production - `production` deployed to a separate Render production service

The same validated commit is promoted from staging to production.

The repository was previously named:

`profitia/sg2.0-dashboard-preview`