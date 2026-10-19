# E1 — SG2 optional Supplier delegation source compatibility

Task SG2-E1-SUPPLIER-DELEGATION-COMPATIBILITY-20261019, SG2 Development.
Producer ARCHITECTURE-E1-SUPPLIER-DELEGATION-20261019, PR512, source 978e9526c9ec79ed415a6aaf904d4dac5ea9cc02.
Separate ARCHITECTURE regression task retains the strict candidate.10 audit pin.

The current acceptance pins platform1.17.0 and 44 actual core source/schema files.
Historical fingerprints retain their original values and are explicitly historical.
The default Forecast store stays closed; Supplier requires explicit optional
configuration and a verified SQL013 installation. Importing this source does not
activate a Supplier worker, private SERVICE phases, vendor acquisition or product
deployment. Existing business logic and framework versions are unchanged.

Producer/laboratory local verification: 818 tests pass, zero failures and skips.
Own consumer native regressions and exact controlled candidate/main CI remain
required for acceptance. SG2 private packages use only the existing trusted-main
controlled CI. No live cloud data/SQL/roles/grants/configuration/secrets/resources
or release is changed. Full E0/E1 remains IN_PROGRESS.
