-- Destructive rollback for disposable tests / explicitly authorised empty pre-activation storage only.
DROP SCHEMA krs_registry CASCADE;
-- Keep pg_trgm: an existing extension may serve other schemas.
