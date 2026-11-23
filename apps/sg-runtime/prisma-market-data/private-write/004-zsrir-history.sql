-- Additive ZSRIR contract for the existing controlled Market Data Store.
-- Install transactionally after the period model and the accepted history
-- boundary. The table owner must grant the Source owner the necessary table
-- privileges. This file creates no runtime credentials, Source grants or activation.
SET LOCAL search_path = pg_catalog, pg_temp;
DO $$
BEGIN
  IF current_user <> 'profitia_ingestion_owner'
    OR NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = current_user
      AND NOT (r.rolcanlogin OR r.rolinherit OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)
      AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid))
    OR to_regprocedure('profitia_market_history.immutable_record()') IS NULL THEN
    RAISE EXCEPTION 'Controlled Market History owner and existing boundary required' USING ERRCODE = '42501';
  END IF;
END
$$;

CREATE TABLE profitia_market_history.zsrir_staging (
  snapshot_sha text NOT NULL,
  series_id text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  revision integer NOT NULL,
  row_sha text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (snapshot_sha, series_id, period_start, period_end, revision)
);
REVOKE ALL ON profitia_market_history.zsrir_staging FROM PUBLIC;
ALTER TABLE profitia_market_history.zsrir_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_market_history.zsrir_staging FORCE ROW LEVEL SECURITY;
CREATE POLICY zsrir_staging_owner ON profitia_market_history.zsrir_staging
  TO profitia_ingestion_owner USING (true) WITH CHECK (true);
CREATE TRIGGER zsrir_staging_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON profitia_market_history.zsrir_staging FOR EACH STATEMENT
  EXECUTE FUNCTION profitia_market_history.immutable_record();

CREATE FUNCTION profitia_market_history.validate_zsrir_row(p jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  ref jsonb;
  pub jsonb;
  loc jsonb;
  tuple_text text;
BEGIN
  IF (jsonb_typeof(p) = 'object'
    AND p->>'provider_code' = 'ZSRIR'
    AND p->>'provider_series_id' ~ '^zsrir:v1:[a-f0-9]{64}$'
    AND p->>'category_code' IN ('FOOD','COMMODITIES')
    AND length(btrim(p->>'display_name')) BETWEEN 1 AND 4096
    AND p->>'market_code' ~ '^[A-Za-z0-9_.:-]{1,128}$'
    AND p->>'product_code' ~ '^[A-Za-z0-9_.:-]{1,128}$'
    AND p->>'metric_code' ~ '^[A-Za-z0-9_.:-]{1,128}$'
    AND p->>'geography_code' ~ '^[A-Za-z0-9_.:-]{1,128}$'
    AND p->>'aggregation_code' ~ '^[A-Za-z0-9_.:-]{1,128}$'
    AND p->>'frequency' ~ '^[A-Z_]{1,32}$'
    AND p->>'currency' ~ '^[A-Z]{3}$'
    AND left(p->>'unit',4) = (p->>'currency') || '/'
    AND length(p->>'unit') BETWEEN 5 AND 80
    AND p->>'period_start' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND p->>'period_end' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND pg_input_is_valid(p->>'period_start','date') AND pg_input_is_valid(p->>'period_end','date')
    AND p->>'observed_at' = p->>'period_end'
    AND p->>'value' ~ '^-?(0|[1-9][0-9]{0,15})(\.[0-9]{0,7}[1-9])?$'
    AND p->>'value' <> '-0'
    AND p->>'normalization_version' ~ '^[A-Za-z0-9_.:-]{1,128}$'
    AND p->>'revision' ~ '^[1-9][0-9]{0,8}$'
    AND p->>'revision_ref' ~ '^sha256:[a-f0-9]{64}$'
    AND jsonb_typeof(p->'provenance') = 'array') IS NOT TRUE THEN
    RAISE EXCEPTION 'Invalid qualified ZSRIR observation' USING ERRCODE = '22023';
  END IF;
  SELECT '[' || string_agg(to_json(v)::text, ',' ORDER BY n) || ']' INTO tuple_text
  FROM unnest(ARRAY[p->>'market_code',p->>'product_code',p->>'metric_code',p->>'geography_code',
    p->>'frequency',p->>'unit',p->>'currency',p->>'aggregation_code']) WITH ORDINALITY a(v,n);
  IF p->>'provider_series_id' <> 'zsrir:v1:' || encode(sha256(convert_to(tuple_text,'UTF8')),'hex')
    OR (p->>'period_start')::date > (p->>'period_end')::date THEN
    RAISE EXCEPTION 'ZSRIR series identity or period mismatch' USING ERRCODE = '22023';
  END IF;

  FOR ref IN SELECT value FROM jsonb_array_elements(p->'provenance') LOOP
    pub := ref->'publication_time';
    loc := ref->'locator';
    IF (jsonb_typeof(ref) = 'object' AND ref->>'provider_code' = 'ZSRIR' AND ref->>'publisher_code' = 'MRIRW'
      AND ref->>'channel_code' IN ('GOV_PL','ZSRIR_PORTAL')
      AND ref->>'report_type' ~ '^[A-Z0-9_]{1,48}$'
      AND length(btrim(ref->>'publication_ref')) BETWEEN 1 AND 2048
      AND length(btrim(ref->>'artifact_ref')) BETWEEN 1 AND 2048
      AND length(btrim(ref->>'revision_ref')) BETWEEN 1 AND 2048
      AND (ref->>'sha256' ~ '^[a-f0-9]{64}$'
        OR (ref->>'sha256' IS NULL AND length(btrim(ref->>'version_ref')) BETWEEN 1 AND 2048))
      AND (ref->>'archive_member_sha256' IS NULL OR ref->>'archive_member_sha256' ~ '^[a-f0-9]{64}$')
      AND jsonb_typeof(loc) = 'object' AND (
        (length(btrim(loc->>'sheet')) BETWEEN 1 AND 256 AND loc->>'table' ~ '^([1-9][0-9]*|[A-Z]{1,3}[1-9][0-9]{0,6})$'
          AND loc->>'cell' ~ '^[A-Z]{1,3}[1-9][0-9]{0,6}$')
        OR (jsonb_typeof(loc->'parameters') = 'object' AND length(btrim(loc->>'point_id')) BETWEEN 1 AND 512))
      AND length(btrim(ref->>'source_unit')) BETWEEN 1 AND 256
      AND ref->>'source_value' IS NOT NULL AND jsonb_typeof(ref->'conversion') IN ('string','object')
      AND jsonb_typeof(pub) = 'object' AND pub ? 'source_text' AND pub ? 'timezone' AND pub ? 'evidence'
      AND (pub->>'timezone' IS NULL OR EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = pub->>'timezone'))
      AND pub->>'classification' IN ('BEFORE_OR_AT_CUTOFF','AFTER_CUTOFF','NEEDS_DATE_REVIEW')
      AND (pub->>'classification' = 'NEEDS_DATE_REVIEW' OR
        (length(btrim(pub->>'source_text')) BETWEEN 1 AND 512
          AND pub->>'precision' IN ('DATE','DATETIME','TIMESTAMP','SECOND','OFFSET','MINUTE','MILLISECOND','TIMESTAMP_OFFSET_UNSPECIFIED')
          AND pub->>'source_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          AND pg_input_is_valid(pub->>'source_date','date')
          AND left(pub->>'source_text',10) = pub->>'source_date'
          AND jsonb_typeof(pub->'evidence') = 'object'
          AND length(btrim(pub#>>'{evidence,field}')) BETWEEN 1 AND 512
          AND length(btrim(pub#>>'{evidence,edition_ref}')) BETWEEN 1 AND 2048))
      AND (ref->>'source_url' IS NULL OR ref->>'source_url' ~ '^https://(www\.gov\.pl|zsrir\.minrol\.gov\.pl)/')
      AND ref::text !~* '(password|authorization|access_token)"\s*:') IS NOT TRUE THEN
      RAISE EXCEPTION 'Invalid ZSRIR provenance reference' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF (p->>'revision')::integer = 1 THEN
    IF p->>'supersedes_revision' IS NOT NULL OR p->>'correction' IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p->'provenance') r
      WHERE r#>>'{publication_time,classification}' = 'BEFORE_OR_AT_CUTOFF'
    ) THEN RAISE EXCEPTION 'Qualified baseline requires eligible publication evidence' USING ERRCODE = '22023';
    END IF;
  ELSIF (p->>'supersedes_revision' = ((p->>'revision')::integer - 1)::text
      AND p#>>'{correction,previous_revision_ref}' ~ '^sha256:[a-f0-9]{64}$'
      AND p#>>'{correction,kind}' = 'VALUE_CORRECTION'
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(p->'provenance') r
        WHERE r->>'revision_ref' = p#>>'{correction,source_revision_ref}'
          AND r#>>'{publication_time,classification}' IN ('BEFORE_OR_AT_CUTOFF','AFTER_CUTOFF'))) IS NOT TRUE
  THEN RAISE EXCEPTION 'A value correction needs its predecessor and dated source evidence' USING ERRCODE = '22023';
  END IF;
END
$$;

CREATE FUNCTION profitia_market_history.stage_zsrir_history(p_snapshot text, p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  p jsonb;
  row_hash text;
  inserted integer := 0;
BEGIN
  IF (p_snapshot ~ '^[a-f0-9]{64}$' AND jsonb_typeof(p_rows) = 'array') IS NOT TRUE THEN
    RAISE EXCEPTION 'Exact qualified snapshot and rows required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 512 OR pg_column_size(p_rows) > 8388608 THEN
    RAISE EXCEPTION 'Bounded staging chunk required' USING ERRCODE = '22023';
  END IF;
  FOR p IN SELECT value FROM jsonb_array_elements(p_rows)
    ORDER BY value->>'provider_series_id', value->>'period_start', value->>'period_end', value->>'revision'
  LOOP
    PERFORM profitia_market_history.validate_zsrir_row(p);
    PERFORM pg_advisory_xact_lock(hashtextextended('sg2-zsrir:' || (p->>'provider_series_id'),0));
    row_hash := encode(sha256(convert_to(p::text,'UTF8')),'hex');
    INSERT INTO profitia_market_history.zsrir_staging
    VALUES (p_snapshot,p->>'provider_series_id',(p->>'period_start')::date,(p->>'period_end')::date,
      (p->>'revision')::integer,row_hash,p)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN
      inserted := inserted + 1;
    ELSIF NOT EXISTS (
      SELECT 1 FROM profitia_market_history.zsrir_staging s
      WHERE (s.snapshot_sha,s.series_id,s.period_start,s.period_end,s.revision) =
        (p_snapshot,p->>'provider_series_id',(p->>'period_start')::date,(p->>'period_end')::date,(p->>'revision')::integer)
        AND s.row_sha = row_hash AND s.payload = p
    ) THEN RAISE EXCEPTION 'Conflicting staged ZSRIR observation' USING ERRCODE = '23505';
    END IF;
  END LOOP;
  RETURN inserted;
END
$$;

CREATE FUNCTION profitia_market_history.apply_zsrir_history(p_effect uuid, p_decision uuid, p_canonical text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  e profitia_ingestion.effects%ROWTYPE;
  envelope jsonb;
  request jsonb;
  p jsonb;
  dimensions jsonb;
  old public.market_period_observation_revisions%ROWTYPE;
  observed_count integer;
  observed_hash text;
  written integer := 0;
  completed jsonb;
BEGIN
  IF p_canonical IS NULL OR octet_length(p_canonical) > 4096 THEN
    RAISE EXCEPTION 'Bounded ZSRIR Source envelope required' USING ERRCODE = '22023';
  END IF;
  envelope := p_canonical::jsonb;
  request := envelope->'content';
  SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id = p_effect AND decision_id = p_decision
    AND status = 'RESERVED' AND payload_digest = encode(sha256(convert_to(p_canonical,'UTF8')),'hex');
  IF NOT FOUND OR (e.application_id = 'spendguru-market-history' AND e.source_id = 'sg2.market.zsrir.history.persist'
    AND e.source_id = envelope->>'sourceId'
    AND e.resource_id = request->>'series_id'
    AND (profitia_ingestion.runtime_descriptor()->>'serviceId') = e.service_id::text
    AND profitia_ingestion.scope_allows(e.source_id,e.resource_id)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Current provider-specific Source reservation required' USING ERRCODE = '42501';
  END IF;
  IF (request->>'schema_version' = '1.0.0' AND request->>'snapshot_sha256' ~ '^[a-f0-9]{64}$'
    AND request->>'series_id' ~ '^zsrir:v1:[a-f0-9]{64}$'
    AND request->>'row_count' ~ '^[1-9][0-9]{0,5}$'
    AND request->>'rows_sha256' ~ '^[a-f0-9]{64}$') IS NOT TRUE THEN
    RAISE EXCEPTION 'Exact series, staged snapshot and row digest required' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('sg2-zsrir:' || (request->>'series_id'),0));
  SELECT count(*), encode(sha256(convert_to(string_agg(row_sha,E'\n' ORDER BY period_start,period_end,revision),'UTF8')),'hex')
    INTO observed_count,observed_hash
    FROM profitia_market_history.zsrir_staging
    WHERE snapshot_sha = request->>'snapshot_sha256' AND series_id = request->>'series_id';
  IF observed_count <> (request->>'row_count')::integer OR observed_hash IS DISTINCT FROM request->>'rows_sha256' THEN
    RAISE EXCEPTION 'Staged ZSRIR series digest mismatch' USING ERRCODE = '22023';
  END IF;
  FOR p IN SELECT payload FROM profitia_market_history.zsrir_staging
    WHERE snapshot_sha = request->>'snapshot_sha256' AND series_id = request->>'series_id'
    ORDER BY period_start,period_end,revision
  LOOP
    dimensions := jsonb_build_object('category_code',p->'category_code','market_code',p->'market_code',
      'product_code',p->'product_code','metric_code',p->'metric_code','geography_code',p->'geography_code',
      'aggregation_code',p->'aggregation_code');
    INSERT INTO public.market_series
      ("id","providerCode","providerSeriesId","displayName","frequency","currency","unit","sourceLabel","createdAt","updatedAt","zsrirDimensions")
    VALUES (gen_random_uuid()::text,'ZSRIR',p->>'provider_series_id',p->>'display_name',p->>'frequency',
      p->>'currency',p->>'unit','MRiRW',now(),now(),dimensions)
    ON CONFLICT ("providerCode","providerSeriesId") DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.market_series s
      WHERE s."providerCode" = 'ZSRIR' AND s."providerSeriesId" = p->>'provider_series_id'
        AND (s.frequency,s.currency,s.unit,s."zsrirDimensions") =
          (p->>'frequency',p->>'currency',p->>'unit',dimensions)) THEN
      RAISE EXCEPTION 'Conflicting ZSRIR series descriptor' USING ERRCODE = '23505';
    END IF;

    SELECT * INTO old FROM public.market_period_observation_revisions
    WHERE "providerCode" = 'ZSRIR' AND "providerSeriesId" = p->>'provider_series_id'
      AND "periodStart" = (p->>'period_start')::date AND "periodEnd" = (p->>'period_end')::date
      AND revision = (p->>'revision')::integer;
    IF FOUND THEN
      IF (old."revisionRef",old."supersedesRevision",old.value,old.provenance,old."normalizationVersion")
        IS DISTINCT FROM (p->>'revision_ref',(p->>'supersedes_revision')::integer,
          (p->>'value')::numeric,p->'provenance',p->>'normalization_version') THEN
        RAISE EXCEPTION 'Conflicting published ZSRIR observation' USING ERRCODE = '23505';
      END IF;
      CONTINUE;
    END IF;

    IF (p->>'revision')::integer > 1 AND NOT EXISTS (
      SELECT 1 FROM public.market_period_observation_revisions prior
      WHERE prior."providerCode" = 'ZSRIR' AND prior."providerSeriesId" = p->>'provider_series_id'
        AND prior."periodStart" = (p->>'period_start')::date AND prior."periodEnd" = (p->>'period_end')::date
        AND prior.revision = (p->>'supersedes_revision')::integer
        AND prior."revisionRef" = p#>>'{correction,previous_revision_ref}'
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(prior.provenance) r
          WHERE r->>'revision_ref' = p#>>'{correction,source_revision_ref}')
    ) THEN RAISE EXCEPTION 'ZSRIR correction predecessor or evidence mismatch' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.market_period_observation_revisions
      ("providerSeriesId","periodStart","periodEnd",revision,"supersedesRevision","revisionRef",value,provenance,"normalizationVersion")
    VALUES (p->>'provider_series_id',(p->>'period_start')::date,(p->>'period_end')::date,(p->>'revision')::integer,
      (p->>'supersedes_revision')::integer,p->>'revision_ref',(p->>'value')::numeric,p->'provenance',p->>'normalization_version');
    written := written + 1;
  END LOOP;
  completed := profitia_ingestion.complete(p_effect,p_decision);
  IF completed->>'status' IS DISTINCT FROM 'COMMITTED' THEN
    RAISE EXCEPTION 'ZSRIR Source completion rejected' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('effectId',p_effect,'seriesId',e.resource_id,'snapshotSha256',request->>'snapshot_sha256',
    'rowCount',observed_count,'rowsSha256',observed_hash,'writtenCount',written);
END
$$;

REVOKE ALL ON FUNCTION profitia_market_history.validate_zsrir_row(jsonb),
  profitia_market_history.stage_zsrir_history(text,jsonb),
  profitia_market_history.apply_zsrir_history(uuid,uuid,text) FROM PUBLIC;
