# SpendGuru Repository Decision Record

## Decision

The canonical product repository is:

`profitia/spendguru`

Previous name:

`profitia/sg2.0-dashboard-preview`

## Rejected Target

`profitia/pmos-sg20-development`

The PMOS repository was incorrectly interpreted as the target product
repository. The related pull request was closed without merge.

## Repository Role

The repository contains the active SpendGuru application and its complete Git
history.

## Application Location

The application remains at repository root.

## Environment Model

- local development
- staging from `main`
- production from `production`

## Deployment Provider

Render

## Existing Service

`srv-d98a73btqb8s73fabp90`

## Deferred Decisions

- final role of the existing Render service
- creation of the `production` branch
- creation of a separate production service
- database separation