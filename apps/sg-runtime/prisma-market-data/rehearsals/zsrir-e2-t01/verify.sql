\set ON_ERROR_STOP on
-- Only run in an isolated PostgreSQL cluster with the SG2 core schema and
-- synthetic roles. The three baseline tables must be empty.
SELECT current_database() = 'sg2_zsrir_model_test' AND current_user = 'architecture_test_owner' AS isolated_target \gset
\if :isolated_target
\else
  \echo 'Incorrect rehearsal database or role'
  \quit 4
\endif
DO $fixture$
BEGIN
  IF EXISTS (SELECT 1 FROM public.market_series)
     OR EXISTS (SELECT 1 FROM public.market_observations)
     OR EXISTS (SELECT 1 FROM public.market_hydration_state)
     OR to_regclass('public.market_period_observation_revisions') IS NOT NULL THEN
    RAISE EXCEPTION 'Rehearsal requires an empty baseline';
  END IF;
END
$fixture$;

-- First apply and roll back. The baseline and sample authorizations are pre-existing.
BEGIN;
\ir schema.sql
SELECT to_regclass('public.market_period_observation_revisions') IS NOT NULL AS installed \gset
\if :installed
\else
  \quit 4
\endif
ROLLBACK;
DO $rollback$
BEGIN
  IF to_regclass('public.market_period_observation_revisions') IS NOT NULL
     OR to_regclass('public.market_period_observations') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_attribute
        WHERE attrelid = 'public.market_series'::regclass AND attname = 'zsrirDimensions' AND NOT attisdropped)
     OR EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.market_series'::regclass AND conname = 'market_series_zsrir_dimensions_check') THEN
    RAISE EXCEPTION 'Rollback failed';
  END IF;
END
$rollback$;
SELECT 'PASS migration rollback restoration' AS outcome;

BEGIN;
\ir schema.sql
CREATE TEMP TABLE rehearsal_schema_signature AS
SELECT md5(pg_get_viewdef('public.market_period_observations'::regclass)
  || string_agg(pg_get_constraintdef(oid), E'\n' ORDER BY conname)) AS digest
FROM pg_constraint WHERE conrelid = 'public.market_period_observation_revisions'::regclass;
\ir schema.sql
DO $repeat$
BEGIN
  IF (SELECT digest FROM rehearsal_schema_signature) IS DISTINCT FROM (
    SELECT md5(pg_get_viewdef('public.market_period_observations'::regclass)
      || string_agg(pg_get_constraintdef(oid), E'\n' ORDER BY conname))
    FROM pg_constraint WHERE conrelid = 'public.market_period_observation_revisions'::regclass
  ) THEN RAISE EXCEPTION 'Repeated migration drift'; END IF;
END
$repeat$;
SELECT 'PASS repeated migration' AS outcome;

SET LOCAL ROLE profitia_ingestion_owner;
INSERT INTO public.market_series ("id","providerCode","providerSeriesId","displayName","updatedAt")
VALUES ('mc-fixture','MACROBOND','synthetic_overlap','Synthetic Macrobond',now())
ON CONFLICT ("providerCode","providerSeriesId") DO UPDATE SET "displayName"=excluded."displayName";
INSERT INTO public.market_observations ("id","seriesId","observedAt",value,"updatedAt")
VALUES ('mc-1','mc-fixture','2026-10-25',123.25,now()),('mc-2','mc-fixture','2026-10-26',NULL,now())
ON CONFLICT ("seriesId","observedAt") DO UPDATE SET value=excluded.value;
INSERT INTO public.market_observations ("id","seriesId","observedAt",value,"updatedAt")
VALUES ('mc-replay','mc-fixture','2026-10-25',124.25,now())
ON CONFLICT ("seriesId","observedAt") DO UPDATE SET value=excluded.value;
RESET ROLE;

INSERT INTO public.market_series
  ("id","providerCode","providerSeriesId","displayName","frequency","currency","unit","updatedAt","zsrirDimensions")
VALUES
  ('zs-fixture','ZSRIR','synthetic_overlap','Synthetic ZSRIR','WEEKLY','PLN','PLN/t',now(),
   '{"category_code":"FOOD","market_code":"SYNTH","product_code":"SYNTHETIC_VARIANT_A","metric_code":"NET_PURCHASE","geography_code":"PL","aggregation_code":"AS_PUBLISHED"}'),
  ('mc-only','MACROBOND','macrobond_only','Other synthetic Macrobond',NULL,NULL,NULL,now(),NULL);

CREATE TEMP TABLE rehearsal_source (initial jsonb, revised jsonb);
INSERT INTO rehearsal_source VALUES (
  jsonb_build_array(
    jsonb_build_object('publisher_code','MRIRW','provider_code','ZSRIR','channel_code','GOV_PL','artifact_ref','synthetic-a','publication_ref','edition-a','report_type','BULLETIN','locator',jsonb_build_object('sheet','TEST','cell','D7'),'sha256',repeat('a',64),'publication_time',jsonb_build_object('source_text','2026-10-26','precision','DATE'),'revision_ref','synthetic-v1'),
    jsonb_build_object('publisher_code','MRIRW','provider_code','ZSRIR','channel_code','ZSRIR_PORTAL','artifact_ref','synthetic-b','publication_ref','edition-b','report_type','BULLETIN','locator',jsonb_build_object('sheet','TEST','cell','C5'),'sha256',repeat('b',64),'publication_time',jsonb_build_object('source_text','2026-10-26','precision','DATE'),'revision_ref','synthetic-v1')
  ), jsonb_build_array(
    jsonb_build_object('publisher_code','MRIRW','provider_code','ZSRIR','channel_code','ZSRIR_PORTAL','artifact_ref','synthetic-c','publication_ref','edition-c','report_type','BULLETIN','locator',jsonb_build_object('sheet','TEST','cell','C5'),'sha256',repeat('c',64),'publication_time',jsonb_build_object('source_text','2026-10-27','precision','DATE'),'revision_ref','synthetic-v2')
  )
);

-- Transaction shape for a future admitted writer. A retry is accepted only when
-- the existing immutable record matches exactly. This function is fixture-only.
CREATE FUNCTION pg_temp.replay_check(p_start date,p_end date,p_seq integer,p_prev integer,
 p_ref text,p_value numeric,p_provenance jsonb) RETURNS boolean LANGUAGE plpgsql AS $fixture$
DECLARE inserted boolean;
BEGIN
  INSERT INTO public.market_period_observation_revisions
    ("providerSeriesId","periodStart","periodEnd",revision,"supersedesRevision","revisionRef",value,provenance,"normalizationVersion")
  VALUES ('synthetic_overlap',p_start,p_end,p_seq,p_prev,p_ref,p_value,p_provenance,'synthetic-v1')
  ON CONFLICT ON CONSTRAINT market_period_observations_revision_ref_key DO NOTHING;
  inserted := FOUND;
  IF NOT inserted AND NOT EXISTS (
    SELECT 1 FROM public.market_period_observation_revisions
    WHERE "providerCode"='ZSRIR' AND "providerSeriesId"='synthetic_overlap'
      AND "periodStart"=p_start AND "periodEnd"=p_end AND "revisionRef"=p_ref
      AND revision=p_seq AND "supersedesRevision" IS NOT DISTINCT FROM p_prev
      AND value=p_value AND provenance=p_provenance AND "normalizationVersion"='synthetic-v1'
  ) THEN
    RAISE EXCEPTION 'Conflicting replay' USING ERRCODE='23505';
  END IF;
  RETURN inserted;
END
$fixture$;

DO $tests$
DECLARE source record;
BEGIN
  SELECT * INTO STRICT source FROM pg_temp.rehearsal_source;
  IF pg_temp.replay_check('2026-10-19','2026-10-25',1,NULL,'v1',0.00000001,source.initial) IS NOT TRUE
     OR pg_temp.replay_check('2026-10-20','2026-10-25',1,NULL,'v1',4.125,source.initial) IS NOT TRUE THEN
    RAISE EXCEPTION 'Two periods with one end failed';
  END IF;
  IF (SELECT count(*) FROM public.market_period_observations WHERE "observedAt"='2026-10-25')<>2 THEN
    RAISE EXCEPTION 'Logical period collision';
  END IF;
  RAISE NOTICE 'PASS periods with same end; exact observedAt projection';
  IF pg_temp.replay_check('2026-10-19','2026-10-25',1,NULL,'v1',0.00000001,source.initial) IS NOT FALSE THEN
    RAISE EXCEPTION 'Duplicate replay created a row';
  END IF;
  BEGIN
    PERFORM pg_temp.replay_check('2026-10-19','2026-10-25',1,NULL,'v1',999,source.initial);
    RAISE EXCEPTION 'Conflicting replay accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM pg_temp.replay_check('2026-10-19','2026-10-25',1,NULL,'another-v1',999,source.initial);
    RAISE EXCEPTION 'Conflicting revision number accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS idempotent retries; conflicting values and duplicate revisions refused';
  IF pg_temp.replay_check('2026-10-19','2026-10-25',2,1,'v2',12.34567891,source.revised) IS NOT TRUE THEN
    RAISE EXCEPTION 'First submission of correction was not inserted';
  END IF;
  IF (SELECT value FROM public.market_period_observations WHERE "periodStart"='2026-10-19') IS DISTINCT FROM 12.34567891
     OR (SELECT provenance FROM public.market_period_observation_revisions WHERE "periodStart"='2026-10-19' AND revision=1) IS DISTINCT FROM source.initial
     OR (SELECT provenance FROM public.market_period_observations WHERE "periodStart"='2026-10-19') IS DISTINCT FROM source.revised
     OR (SELECT value FROM public.market_period_observation_revisions WHERE "periodStart"='2026-10-19' AND revision=1) IS DISTINCT FROM 0.00000001 THEN
    RAISE EXCEPTION 'Revision or provenance readback mismatch';
  END IF;
  BEGIN
    PERFORM pg_temp.replay_check('2026-10-19','2026-10-25',4,3,'v4',1,source.revised);
    RAISE EXCEPTION 'Revision without predecessor accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS correction chain, previous value, exact multichannel provenance, missing predecessor denied';
  BEGIN
    PERFORM pg_temp.replay_check('2026-10-28','2026-10-25',1,NULL,'bad-order',1,source.initial);
    RAISE EXCEPTION 'Reversed period accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM pg_temp.replay_check('2026-10-27','2026-10-28',1,NULL,'bad-provenance',1,'[]');
    RAISE EXCEPTION 'Empty provenance accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.market_period_observation_revisions
      ("providerCode","providerSeriesId","periodStart","periodEnd",revision,"revisionRef",value,provenance,"normalizationVersion")
    VALUES ('MACROBOND','macrobond_only','2026-10-19','2026-10-25',1,'x',1,source.initial,'v1');
    RAISE EXCEPTION 'Macrobond accepted in ZSRIR model';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.market_period_observation_revisions
      ("providerSeriesId","periodStart","periodEnd",revision,"revisionRef",value,provenance,"normalizationVersion")
    VALUES ('macrobond_only','2026-10-19','2026-10-25',1,'x',1,source.initial,'v1');
    RAISE EXCEPTION 'Foreign provider link accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.market_series ("id","providerCode","providerSeriesId","displayName","updatedAt")
    VALUES ('zs-invalid','ZSRIR','invalid_dimensions','Synthetic invalid',now());
    RAISE EXCEPTION 'Missing series dimensions accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM public.market_series WHERE "providerSeriesId"='synthetic_overlap')<>2 THEN
    RAISE EXCEPTION 'Provider scope was lost';
  END IF;
  RAISE NOTICE 'PASS invalid periods, missing provenance, dimensions and cross-provider rows denied';
END
$tests$;

SET LOCAL ROLE sg2_market_read_development_runtime;
DO $acl$
BEGIN
  IF (SELECT array_agg(value ORDER BY "observedAt") FROM profitia_market_read.observations WHERE "providerSeriesId"='synthetic_overlap')
     IS DISTINCT FROM ARRAY[124.25,NULL]::numeric[] OR
     (SELECT array_agg("providerCode") FROM profitia_market_read.series WHERE "providerSeriesId"='synthetic_overlap')
     IS DISTINCT FROM ARRAY['MACROBOND'] THEN
    RAISE EXCEPTION 'Macrobond reader regression';
  END IF;
  BEGIN
    PERFORM 1 FROM public.market_period_observations;
    RAISE EXCEPTION 'Unentitled reader reached ZSRIR';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.market_observations SET value=999;
    RAISE EXCEPTION 'Read role wrote Macrobond';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.market_series;
    RAISE EXCEPTION 'Read role read base tables';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS Macrobond write/upsert and result projection with restricted reader';
END
$acl$;
RESET ROLE;

SET LOCAL ROLE sg2_market_history_development_runtime;
DO $acl$
BEGIN
  BEGIN
    INSERT INTO public.market_period_observation_revisions ("providerSeriesId") VALUES ('synthetic_overlap');
    RAISE EXCEPTION 'Existing history runtime wrote ZSRIR';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.market_period_observation_revisions;
    RAISE EXCEPTION 'Existing history runtime read ZSRIR';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.market_observations SET value=0;
    RAISE EXCEPTION 'Existing history runtime gained a direct Macrobond write path';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS runtime access separation and denied direct writes';
END
$acl$;
RESET ROLE;
ROLLBACK;

DO $finish$
BEGIN
  IF to_regclass('public.market_period_observation_revisions') IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.market_series)
     OR EXISTS (SELECT 1 FROM public.market_observations)
     OR EXISTS (SELECT 1 FROM public.market_hydration_state) THEN
    RAISE EXCEPTION 'Fixture was not restored';
  END IF;
END
$finish$;
SELECT 'PASS restore complete empty baseline' AS outcome;
