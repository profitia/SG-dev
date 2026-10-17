-- Additive SOURCE CANDIDATE, not an initialization or deployment.
-- Execute atomically as the controlled NOLOGIN owner after granting only the
-- public snapshot columns used below and SELECT on the approved market view.
-- No existing table/type/data/role, runtime grant or receipt is changed here.
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN
  IF current_user <> 'profitia_forecast_read_owner' OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND
      (rolreplication OR rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)
  ) THEN RAISE EXCEPTION 'Controlled forecast projection owner required'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='profitia_market_read' AND c.relname IN('series','observations') AND c.relkind='v'
      AND c.relowner::pg_catalog.regrole::text='profitia_market_read_owner'
      AND 'security_barrier=true'=ANY(c.reloptions)) <> 2
  THEN RAISE EXCEPTION 'Approved stored market projection required'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='rolling_daily_current_forecast_snapshots' AND a.attnum>0 AND NOT a.attisdropped
      AND a.attname=ANY(ARRAY['id','seriesId','inputSource','targetBasis','methodId','methodVersion','modelId',
        'trainingWindowPolicyId','effectiveTrainingPolicyId','sourceHistoryFingerprint','contractVersion','status',
        'forecastOriginAt','sourceLatestObservationAt','payloadJson','createdAt','updatedAt'])) <> 17
  THEN RAISE EXCEPTION 'Exact prepared snapshot columns required'; END IF;
END $$;

CREATE SCHEMA profitia_forecast_read AUTHORIZATION profitia_forecast_read_owner;
REVOKE ALL ON SCHEMA profitia_forecast_read FROM PUBLIC;
-- The generated ORM qualifies enum casts with its configured schema. This
-- independent read type preserves the source values without altering its type.
CREATE TYPE profitia_forecast_read."ForecastTargetBasis" AS ENUM ('MONTHLY_AVERAGE','END_OF_PERIOD','POINT_IN_TIME');
REVOKE ALL ON TYPE profitia_forecast_read."ForecastTargetBasis" FROM PUBLIC;

CREATE TABLE profitia_forecast_read.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
  market_schema_digest text NOT NULL CHECK(market_schema_digest ~ '^[a-f0-9]{64}$'),
  project_id text NOT NULL CHECK(length(project_id) BETWEEN 1 AND 128),
  branch_id text NOT NULL CHECK(length(branch_id) BETWEEN 1 AND 128),
  database_name text NOT NULL CHECK(length(database_name) BETWEEN 1 AND 128),
  runtime_role name NOT NULL,
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
  expires_at timestamptz NOT NULL
);
ALTER TABLE profitia_forecast_read.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_forecast_read.installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_forecast_read.installation
  TO profitia_forecast_read_owner USING(true) WITH CHECK(true);
CREATE POLICY own_runtime_receipt ON profitia_forecast_read.installation FOR SELECT
  USING(runtime_role::text=session_user AND database_name=current_database());

-- Pure, immutable JSON projection only. These helpers perform no queries,
-- writes or external effects and execute with the caller's privileges.
CREATE FUNCTION profitia_forecast_read.pick_fields(value jsonb, allowed text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $pick$
  SELECT CASE WHEN jsonb_typeof(value)='object' THEN
    (SELECT COALESCE(jsonb_object_agg(e.key,e.value),'{}'::jsonb) FROM jsonb_each(value) e WHERE e.key=ANY(allowed))
    ELSE NULL END
$pick$;

-- Reviewed model metadata, matching the bounded public application boundary.
-- Unknown keys/values reject the whole parameter record; no partial parameters.
CREATE FUNCTION profitia_forecast_read.public_model_parameters(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $parameters$
  SELECT CASE WHEN jsonb_typeof(value)='null' THEN true WHEN jsonb_typeof(value)<>'object' THEN false ELSE
    (SELECT count(*)<=512 AND COALESCE(bool_and(CASE
      WHEN e.key=ANY(ARRAY['alpha','beta','phi','initial_level','initial_trend','smoothing_level','smoothing_trend',
        'smoothing_seasonal','damping_trend','seasonal_periods','sigma2','const','intercept','drift','lamda','lambda','candidateCount'])
        OR e.key ~ '^(?:(?:ar|ma)(?:\.S)?\.L[1-9][0-9]{0,2}|initial_seasonal\.[0-9]{1,3}|param_[0-9]{1,3})$'
        THEN jsonb_typeof(e.value)='number'
      WHEN e.key='trend' THEN jsonb_typeof(e.value)='null' OR e.value #>> '{}' IN('n','c','t','ct')
      WHEN e.key IN('order','seasonal_order') THEN CASE WHEN jsonb_typeof(e.value)='array' THEN
        jsonb_array_length(e.value)=CASE WHEN e.key='order' THEN 3 ELSE 4 END
        AND (SELECT COALESCE(bool_and(CASE WHEN jsonb_typeof(a.value)='number'
          THEN (a.value::text)::numeric BETWEEN 0 AND 366 AND trunc((a.value::text)::numeric)=(a.value::text)::numeric
          ELSE false END),false) FROM jsonb_array_elements(e.value) a)
        ELSE false END
      WHEN e.key='policyIdentity' THEN e.value #>> '{}'='ARIMA_NON_SEASONAL_BOUNDED_AICC_V1'
      WHEN e.key='tieBreakPolicy' THEN e.value #>> '{}'='LOWER_D_THEN_LOWER_P_PLUS_Q_THEN_P_THEN_Q'
      WHEN e.key='estimationPolicyIdentity' THEN e.value #>> '{}'='ARIMA_SAMPLE_SIZE_ADAPTIVE_EXACT_MLE_V1'
      WHEN e.key='fitImplementation' THEN e.value #>> '{}' IN('STATSMODELS_ARIMA_INNOVATIONS_MLE','STATSMODELS_ARIMA_STATESPACE','STATSMODELS_ARIMA_STATESPACE_FALLBACK')
      ELSE false END),true) FROM jsonb_each(value) e) END
$parameters$;

CREATE FUNCTION profitia_forecast_read.project_payload(value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $payload$
  SELECT CASE WHEN jsonb_typeof(value)='object' AND octet_length(value::text)<=4194304
    AND CASE WHEN value->>'status'='AVAILABLE' THEN
      CASE WHEN jsonb_typeof(value->'path')='array' AND jsonb_typeof(value->'anchors')='array'
        THEN jsonb_array_length(value->'path')<=366 AND jsonb_array_length(value->'anchors')=4 ELSE false END
      ELSE true END
    AND profitia_forecast_read.public_model_parameters(value #> '{model,selectedParameters}')
    AND value->>'status' IN('AVAILABLE','NOT_AVAILABLE','FAILED') THEN
    profitia_forecast_read.pick_fields(value,ARRAY['contractVersion','status'])
    || jsonb_build_object(
      'benchmark',profitia_forecast_read.pick_fields(value->'benchmark',ARRAY['benchmarkId','displayName','frequency','unit','currency','provider','providerSeriesId']),
      'forecastMethod',profitia_forecast_read.pick_fields(value->'forecastMethod',ARRAY['id','version']),
      'model',profitia_forecast_read.pick_fields(value->'model',ARRAY['id','selectedCandidate','selectionMetric','selectionScore','selectedParameters']),
      'audit',profitia_forecast_read.pick_fields(value->'audit',ARRAY['generatedAt','sourceLatestObservationDate','calendarProjectionMode',
        'projectionCalendarStrategy','technicalMinimumTrainingObservations','methodologicalTrainingEligibilityStatus',
        'calibrationUpdatedAt','calibrationLastResidualAvailabilityDate','inputSource','sourceHistoryFingerprint']),
      'warnings',CASE WHEN jsonb_typeof(value->'warnings')='array' THEN
        (SELECT COALESCE(jsonb_agg(CASE item->>'code'
          WHEN 'CALIBRATION_STALE' THEN jsonb_build_object('code','CALIBRATION_STALE','message','Calibration is stale.')
          WHEN 'PARTIAL_BAND_AVAILABILITY' THEN jsonb_build_object('code','PARTIAL_BAND_AVAILABILITY','message','Prediction band is partially available.')
          ELSE NULL END ORDER BY position),'[]'::jsonb)
        FROM jsonb_array_elements(value->'warnings') WITH ORDINALITY AS warning(item,position)) ELSE NULL END)
    || CASE WHEN value->>'status'='AVAILABLE' THEN
      profitia_forecast_read.pick_fields(value,ARRAY['origin','maxHorizonMonths'])
      || jsonb_build_object(
        'origin',profitia_forecast_read.pick_fields(value->'origin',ARRAY['date','value']),
        'calibration',profitia_forecast_read.pick_fields(value->'calibration',ARRAY['availabilityStatus','freshnessStatus','quantileConvention',
          'coverageLabel','methodologicalMinimumStatus','updatedAt','processedThrough','lastResidualAvailabilityDate']),
        'anchors',CASE WHEN jsonb_typeof(value->'anchors')='array' THEN
          (SELECT COALESCE(jsonb_agg(profitia_forecast_read.pick_fields(item,ARRAY['horizon','horizonMonths','targetCalendarDate','pointForecast'])
            || jsonb_build_object('band',profitia_forecast_read.pick_fields(item->'band',ARRAY['status','reasonCode','source','lower','upper',
              'policyVersion','coverage','sampleCount','calibrationStatus','calibrationMethod','calibrationVersion','rollingDailySource','p10ResidualOffset','p90ResidualOffset']))
            ORDER BY position),'[]'::jsonb)
          FROM jsonb_array_elements(value->'anchors') WITH ORDINALITY AS anchor(item,position)) ELSE NULL END,
        'path',CASE WHEN jsonb_typeof(value->'path')='array' THEN
          (SELECT COALESCE(jsonb_agg(profitia_forecast_read.pick_fields(item,ARRAY['date','pointForecast'])
            || jsonb_build_object('band',profitia_forecast_read.pick_fields(item->'band',ARRAY['status','reasonCode','source','lower','upper',
              'policyVersion','coverage','sampleCount','calibrationStatus','calibrationMethod','calibrationVersion','rollingDailySource']))
            ORDER BY position),'[]'::jsonb)
          FROM jsonb_array_elements(value->'path') WITH ORDINALITY AS path(item,position)) ELSE NULL END)
      ELSE profitia_forecast_read.pick_fields(value,ARRAY['reasonCode']) || jsonb_build_object('message',NULL) END
    ELSE NULL END
$payload$;

-- Genuine generated Prisma reads this view using its existing model/delegate.
-- Raw request/ownership identifiers, raw errors and unrestricted payload JSON
-- are never selected by the runtime role. Shared MACROBOND lineage only.
CREATE VIEW profitia_forecast_read.rolling_daily_current_forecast_snapshots WITH(security_barrier=true) AS
SELECT p."id",p."seriesId",p."inputSource",NULL::text AS "inputRunId",
  p."targetBasis"::text::profitia_forecast_read."ForecastTargetBasis" AS "targetBasis",
  p."methodId",p."methodVersion",p."modelId",p."trainingWindowPolicyId",p."effectiveTrainingPolicyId",p."sourceHistoryFingerprint",
  p."contractVersion",p."status",NULL::text AS "reasonCode",NULL::text AS "message",
  p."forecastOriginAt",p."sourceLatestObservationAt",
  profitia_forecast_read.project_payload(p."payloadJson") AS "payloadJson",p."createdAt",p."updatedAt"
FROM public.rolling_daily_current_forecast_snapshots p
JOIN profitia_market_read.series s ON s."providerSeriesId"=p."seriesId"
WHERE p."inputSource"='DYNAMIC_MARKET_DATA_STORE' AND p."targetBasis"::text='POINT_IN_TIME'
  AND p."methodId"='ROLLING_DAILY_POINT_IN_TIME' AND p."methodVersion"='rolling-daily-point-in-time-v1'
  AND p."modelId" IN('naive','damped_holt','ets','arima') AND p."contractVersion"='1'
  AND p."status"=p."payloadJson"->>'status'
  AND p."modelId"=p."payloadJson" #>> '{model,id}'
  AND p."seriesId"=p."payloadJson" #>> '{benchmark,benchmarkId}'
  AND p."seriesId"=p."payloadJson" #>> '{benchmark,providerSeriesId}'
  AND profitia_forecast_read.project_payload(p."payloadJson") IS NOT NULL;

REVOKE ALL ON ALL TABLES IN SCHEMA profitia_forecast_read FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_forecast_read FROM PUBLIC;
