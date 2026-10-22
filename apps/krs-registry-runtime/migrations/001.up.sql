-- Apply only through an explicitly authorised migrator. No role creation or cloud installation.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE SCHEMA krs_registry;
REVOKE ALL ON SCHEMA krs_registry FROM PUBLIC;
CREATE TABLE krs_registry.metadata (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), generation bigint NOT NULL DEFAULT 0,
 scope text NOT NULL DEFAULT 'PROGRESSIVE' CHECK(scope='PROGRESSIVE'), bootstrap_reference text
);
INSERT INTO krs_registry.metadata(singleton) VALUES(true);
CREATE TABLE krs_registry.companies (
 krs text PRIMARY KEY CHECK(krs ~ '^[0-9]{10}$' AND krs <> '0000000000'),
 entity_key text NOT NULL UNIQUE CHECK(entity_key='PL:KRS:'||krs), official_name text,
 nip text, regon text, locality text, state text NOT NULL CHECK(state IN ('ACTIVE','REMOVED','UNKNOWN')),
 latest_ref text
);
CREATE TABLE krs_registry.snapshots (
 evidence_ref text PRIMARY KEY CHECK(length(evidence_ref)<=256), krs text NOT NULL REFERENCES krs_registry.companies,
 register text NOT NULL CHECK(register IN ('P','S')), extract text NOT NULL CHECK(extract IN ('CURRENT','FULL')),
 source_version text NOT NULL, raw_digest text NOT NULL CHECK(raw_digest ~ '^[a-f0-9]{64}$'),
 content_digest text NOT NULL CHECK(content_digest ~ '^[a-f0-9]{64}$'), retrieved_at timestamptz NOT NULL,
 effect_ref text NOT NULL UNIQUE, payload jsonb NOT NULL CHECK(octet_length(payload::text)<=1048576)
);
ALTER TABLE krs_registry.companies ADD CONSTRAINT latest_snapshot FOREIGN KEY(latest_ref) REFERENCES krs_registry.snapshots DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX snapshot_versions ON krs_registry.snapshots(krs,register,extract,source_version);
CREATE TABLE krs_registry.company_sources (
 krs text NOT NULL REFERENCES krs_registry.companies, register text NOT NULL CHECK(register IN ('P','S')),
 extract text NOT NULL CHECK(extract IN ('CURRENT','FULL')), evidence_ref text NOT NULL REFERENCES krs_registry.snapshots,
 PRIMARY KEY(krs,register,extract)
);
CREATE TABLE krs_registry.identifiers (
 krs text NOT NULL REFERENCES krs_registry.companies, kind text NOT NULL CHECK(kind IN ('NIP','REGON')),
 value text NOT NULL CHECK(length(value)<=14), valid boolean NOT NULL,
 evidence_ref text NOT NULL REFERENCES krs_registry.snapshots, introduced_entry bigint, removed_entry bigint,
 PRIMARY KEY(krs,kind,value,evidence_ref)
);
CREATE INDEX identifier_discovery ON krs_registry.identifiers(kind,value,krs) WHERE valid;
CREATE TABLE krs_registry.names (
 krs text NOT NULL REFERENCES krs_registry.companies, name text NOT NULL CHECK(length(name)<=1000),
 normalized text COLLATE "C" NOT NULL CHECK(length(normalized)<=2000), historical boolean NOT NULL,
 evidence_ref text NOT NULL REFERENCES krs_registry.snapshots,
 PRIMARY KEY(krs,normalized,name)
);
CREATE INDEX names_prefix ON krs_registry.names(normalized text_pattern_ops,krs);
CREATE INDEX names_fragment ON krs_registry.names USING gin(normalized gin_trgm_ops);
CREATE TABLE krs_registry.checkpoints (
 day date PRIMARY KEY CHECK(day>'2021-12-08'), revision text NOT NULL, source_digest text NOT NULL,
 state text NOT NULL CHECK(state IN ('PENDING','COMPLETE')), acquired_at timestamptz NOT NULL,
 UNIQUE(day,revision)
);
CREATE TABLE krs_registry.items (
 day date NOT NULL REFERENCES krs_registry.checkpoints, revision text NOT NULL, krs text NOT NULL REFERENCES krs_registry.companies,
 state text NOT NULL CHECK(state IN ('PENDING','RUNNING','FAILED','UNCERTAIN','DONE')) DEFAULT 'PENDING',
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), lease_token uuid, lease_until timestamptz,
 diagnostic text, evidence_ref text REFERENCES krs_registry.snapshots,
 PRIMARY KEY(day,revision,krs)
);
CREATE INDEX queue_pending ON krs_registry.items(day,krs) WHERE state IN ('PENDING','RUNNING');
GRANT USAGE ON SCHEMA krs_registry TO krs_reader,krs_ingest;
GRANT SELECT ON krs_registry.metadata,krs_registry.companies,krs_registry.snapshots,krs_registry.company_sources,krs_registry.identifiers,krs_registry.names TO krs_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA krs_registry TO krs_ingest;
GRANT INSERT ON krs_registry.snapshots,krs_registry.identifiers TO krs_ingest;
GRANT INSERT,UPDATE ON krs_registry.companies,krs_registry.company_sources,krs_registry.names,krs_registry.checkpoints,krs_registry.items TO krs_ingest;
GRANT UPDATE ON krs_registry.metadata TO krs_ingest;
ALTER DEFAULT PRIVILEGES IN SCHEMA krs_registry REVOKE ALL ON TABLES FROM PUBLIC;
