-- Revised, still uninstalled SOURCE CANDIDATE v3: approved prepared Current,
-- Verification and preparation states. This file is not an initialization or deployment.
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
CREATE TYPE profitia_forecast_read."RollingDailyVerificationMaturityStatus" AS ENUM ('MATURED','NOT_YET_MATURED');
REVOKE ALL ON TYPE profitia_forecast_read."RollingDailyVerificationMaturityStatus" FROM PUBLIC;

CREATE TABLE profitia_forecast_read.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='3.0.1'),
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
        'smoothing_seasonal','damping_trend','seasonal_periods','sigma2','const','intercept','drift','lamda','lambda','candidateCount','x1'])
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

-- Existing generic Current metadata is open JSON. Only reviewed scientific
-- fields cross this source boundary. Raw error text and caller fields do not.
-- An uncertainty-band identity must already equal its actual run/point
-- identity before a closed copy is published; no stale band is relabelled.
CREATE FUNCTION profitia_forecast_read.project_period_metadata(value jsonb, model text, expected_identity jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $period_metadata$
  SELECT CASE WHEN jsonb_typeof(value)='object' AND octet_length(value::text)<=65536
    AND value->>'modelFamily'=model AND value->>'fitStatus' IN('SUCCEEDED','FAILED')
    AND (CASE model WHEN 'naive' THEN value->>'selectedVariant'='NAIVE_LAST_VALUE'
      WHEN 'damped_holt' THEN value->>'selectedVariant'='DAMPED_HOLT_ADDITIVE'
      WHEN 'ets' THEN value->>'selectedVariant' ~ '^ETS[(]A,(N|A|Ad),(N|A)[)]$'
      WHEN 'arima' THEN value->>'selectedVariant' ~ '^ARIMA[(][0-9],[0-9],[0-9][)]$' ELSE false END)
    AND jsonb_typeof(value->'selectedParameters')='object'
    AND profitia_forecast_read.public_model_parameters(value->'selectedParameters')
    AND jsonb_typeof(value->'selectionScore') IN('null','number')
    AND (value->'selectionMetric'='null'::jsonb OR value->>'selectionMetric'='AICc')
    AND (NOT(value ? 'uncertaintyBand') OR value->'uncertaintyBand'='null'::jsonb OR (
      jsonb_typeof(value->'uncertaintyBand')='object'
      AND value #>> '{uncertaintyBand,status}' IN('AVAILABLE','NOT_AVAILABLE')
      AND value #>> '{uncertaintyBand,policyVersion}'='ADAPTIVE_UNCERTAINTY_BANDS_V1'
      AND value #> '{uncertaintyBand,coverage}'='0.8'::jsonb
      AND (value #> '{uncertaintyBand,source}'='null'::jsonb
        OR value #>> '{uncertaintyBand,source}' IN('EMPIRICAL_EXACT_RESIDUALS','MODEL_NATIVE_SHORT_HISTORY'))
      AND jsonb_typeof(value #> '{uncertaintyBand,lower}') IN('null','number')
      AND jsonb_typeof(value #> '{uncertaintyBand,upper}') IN('null','number')
      AND jsonb_typeof(value #> '{uncertaintyBand,sampleCount}')='number'
      AND value #>> '{uncertaintyBand,calibrationStatus}' IN('CALIBRATED','INSUFFICIENT_SAMPLE','NOT_AVAILABLE')
      AND value #>> '{uncertaintyBand,calibrationMethod}' IN('EMPIRICAL_RESIDUAL_QUANTILES_HF7','NAIVE_RANDOM_WALK_INNOVATION_RMS_NORMAL',
        'STATSMODELS_ETS_SIMULATION','STATSMODELS_DAMPED_HOLT_SIMULATION')
      AND value #>> '{uncertaintyBand,calibrationVersion}' IN('empirical-exact-residual-quantiles-v1','naive-random-walk-innovation-rms-normal-v1',
        'statsmodels-ets-simulation-seed-1729-r1000-v1','statsmodels-damped-holt-simulation-seed-1729-r1000-v1')
      AND (value #> '{uncertaintyBand,reasonCode}'='null'::jsonb
        OR value #>> '{uncertaintyBand,reasonCode}' IN('INSUFFICIENT_EXACT_RESIDUALS','INSUFFICIENT_BAND_HISTORY','NON_FINITE_MODEL_NATIVE_SCALE')
        OR value #>> '{uncertaintyBand,reasonCode}' LIKE 'MODEL_NATIVE_INTERVAL_FAILED:%')
      AND (profitia_forecast_read.pick_fields(value #> '{uncertaintyBand,identity}',ARRAY['inputSource','sourceFrequency','targetCadence',
        'horizonLabel','horizonSteps','targetDate','sourceHistoryFingerprint','trainingWindowPolicyId','effectiveTrainingPolicyId',
        'bandPolicyVersion','bandSource','calibrationMethod','calibrationVersion','calibrationCutoff'])
        || jsonb_build_object('forecastIdentity',profitia_forecast_read.pick_fields(value #> '{uncertaintyBand,identity,forecastIdentity}',
          ARRAY['seriesId','modelId','targetSemantics','methodId','methodVersion'])))=expected_identity
    )) THEN profitia_forecast_read.pick_fields(value,ARRAY['modelFamily','selectedVariant','selectedParameters','selectionScore','selectionMetric','fitStatus'])
      || jsonb_build_object('failureReason',NULL)
      || CASE WHEN NOT(value ? 'uncertaintyBand') THEN '{}'::jsonb WHEN value->'uncertaintyBand'='null'::jsonb THEN jsonb_build_object('uncertaintyBand',NULL)
        ELSE jsonb_build_object('uncertaintyBand',profitia_forecast_read.pick_fields(value->'uncertaintyBand',ARRAY['status','source','policyVersion',
          'coverage','lower','upper','sampleCount','calibrationStatus','calibrationMethod','calibrationVersion'])
          || jsonb_build_object('identity',expected_identity,'reasonCode',CASE WHEN value #>> '{uncertaintyBand,reasonCode}' LIKE 'MODEL_NATIVE_INTERVAL_FAILED:%'
            THEN 'MODEL_NATIVE_INTERVAL_FAILED' ELSE value #>> '{uncertaintyBand,reasonCode}' END)) END
    ELSE NULL END
$period_metadata$;

CREATE VIEW profitia_forecast_read.forecast_current_points WITH(security_barrier=true) AS
SELECT p."id",p."runId",p."horizonLabel",p."horizonSteps",p."forecastDate",p."forecastValue",
  projected.metadata->>'fitStatus' AS "fitStatus",NULL::text AS "failureReason",
  projected.metadata->>'selectedVariant' AS "selectedVariant",projected.metadata->>'selectionMetric' AS "selectionMetric",
  (projected.metadata->>'selectionScore')::double precision AS "selectionScore",projected.metadata AS "metadataJson",p."createdAt",p."updatedAt"
FROM public.forecast_current_points p JOIN public.forecast_current_runs r ON r."id"=p."runId"
JOIN profitia_market_read.series s ON s."providerSeriesId"=r."seriesId"
CROSS JOIN LATERAL (SELECT profitia_forecast_read.project_period_metadata(p."metadataJson",r."modelId",jsonb_build_object(
  'forecastIdentity',jsonb_build_object('seriesId',r."seriesId",'modelId',r."modelId",'targetSemantics',r."targetBasis"::text,
    'methodId',r."methodId",'methodVersion',r."methodVersion"),
  'inputSource',r."inputSource",'sourceFrequency',split_part(split_part(r.frequency,'|',2),'=',2),
  'targetCadence',split_part(split_part(r.frequency,'|',3),'=',2),'horizonLabel',p."horizonLabel",'horizonSteps',p."horizonSteps",
  'targetDate',to_char(p."forecastDate",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'sourceHistoryFingerprint',r."historyFingerprint",
  'trainingWindowPolicyId',r."trainingWindowPolicyId",'effectiveTrainingPolicyId',r."effectiveTrainingPolicyId",
  'bandPolicyVersion','ADAPTIVE_UNCERTAINTY_BANDS_V1','bandSource',p."metadataJson" #>> '{uncertaintyBand,source}',
  'calibrationMethod',p."metadataJson" #>> '{uncertaintyBand,calibrationMethod}',
  'calibrationVersion',p."metadataJson" #>> '{uncertaintyBand,calibrationVersion}',
  'calibrationCutoff',to_char(r."forecastOriginAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) AS metadata) projected
WHERE r."inputSource"='DYNAMIC_MARKET_DATA_STORE' AND r.status='AVAILABLE' AND r."targetBasis"::text IN('MONTHLY_AVERAGE','END_OF_PERIOD')
  AND r."methodId"=r."targetBasis"::text AND r."methodVersion"='benchmark-forecasting-mvp-phase2-v1'
  AND r."modelId" IN('naive','damped_holt','ets','arima') AND r."historyFingerprint" ~ '^[a-f0-9]{64}$'
  AND r.frequency ~ '^FORECAST_CADENCE_V1[|]source=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)[|]target=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)$'
  AND p."horizonLabel" ~ '^[1-9][0-9]{0,2}[MDQWY]$' AND p."horizonSteps" BETWEEN 1 AND 10000
  AND p."forecastDate" IS NOT NULL AND (p."metadataJson" IS NULL OR p."metadataJson"='null'::jsonb OR projected.metadata IS NOT NULL);

CREATE VIEW profitia_forecast_read.forecast_current_runs WITH(security_barrier=true) AS
SELECT r."id",r."seriesId",s."displayName",s."displayName" AS description,r.frequency,s.currency,s.unit,s."sourceLabel",
  r."inputSource",NULL::text AS "inputRunId",r."historyFingerprint",r."targetBasis"::text::profitia_forecast_read."ForecastTargetBasis" AS "targetBasis",
  r."methodId",r."historyStartAt",r."historyEndAt",r."observationCount",r."forecastOriginAt",r."modelId",r."methodVersion",
  r."trainingWindowPolicyId",r."effectiveTrainingPolicyId",r.status,NULL::text AS "failureReason",r."runtimeSeconds",r."createdAt",r."updatedAt"
FROM public.forecast_current_runs r JOIN profitia_market_read.series s ON s."providerSeriesId"=r."seriesId"
WHERE r."inputSource"='DYNAMIC_MARKET_DATA_STORE' AND r.status='AVAILABLE' AND r."targetBasis"::text IN('MONTHLY_AVERAGE','END_OF_PERIOD')
  AND r."methodId"=r."targetBasis"::text AND r."methodVersion"='benchmark-forecasting-mvp-phase2-v1'
  AND r."modelId" IN('naive','damped_holt','ets','arima') AND r."historyFingerprint" ~ '^[a-f0-9]{64}$'
  AND r."forecastOriginAt" IS NOT NULL AND r."observationCount">0
  AND (SELECT count(*) BETWEEN 1 AND 366 FROM public.forecast_current_points p WHERE p."runId"=r.id)
  AND NOT EXISTS(SELECT 1 FROM public.forecast_current_points p WHERE p."runId"=r.id
    AND NOT EXISTS(SELECT 1 FROM profitia_forecast_read.forecast_current_points approved WHERE approved.id=p.id AND approved."runId"=r.id));


-- Verification keeps original scientific fields; absent band identity remains
-- absent. A supplied identity must equal its actual row/point context. Prefix
-- proof is retained for the existing Rolling source-revision compatibility rule.
CREATE FUNCTION profitia_forecast_read.project_verification_metadata(value jsonb, model text, expected_identity jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $verification_metadata$
  WITH core AS (
    SELECT CASE WHEN jsonb_typeof(value)='object' AND octet_length(value::text)<=65536
      THEN profitia_forecast_read.project_period_metadata(value-'uncertaintyBand',model,'{}'::jsonb) END AS metadata
  ), compatibility AS (
    SELECT CASE WHEN value->>'verificationIdentityVersion'='ROLLING_DAILY_VERIFICATION_IDENTITY_V2'
      AND value->>'trainingHistoryFingerprint' ~ '^[a-f0-9]{64}$'
      THEN profitia_forecast_read.pick_fields(value,ARRAY['verificationIdentityVersion','trainingHistoryFingerprint']) ELSE '{}'::jsonb END AS metadata
  ), band AS (
    SELECT CASE WHEN NOT(value ? 'uncertaintyBand') THEN '{}'::jsonb
      WHEN value->'uncertaintyBand'='null'::jsonb THEN jsonb_build_object('uncertaintyBand',NULL)
      WHEN jsonb_typeof(value->'uncertaintyBand')='object'
        AND value #>> '{uncertaintyBand,status}' IN('AVAILABLE','NOT_AVAILABLE')
        AND value #>> '{uncertaintyBand,policyVersion}'='ADAPTIVE_UNCERTAINTY_BANDS_V1'
        AND value #> '{uncertaintyBand,coverage}'='0.8'::jsonb
        AND (value #> '{uncertaintyBand,source}'='null'::jsonb OR value #>> '{uncertaintyBand,source}' IN('EMPIRICAL_EXACT_RESIDUALS','MODEL_NATIVE_SHORT_HISTORY'))
        AND jsonb_typeof(value #> '{uncertaintyBand,lower}') IN('null','number')
        AND jsonb_typeof(value #> '{uncertaintyBand,upper}') IN('null','number')
        AND jsonb_typeof(value #> '{uncertaintyBand,sampleCount}')='number'
        AND value #>> '{uncertaintyBand,calibrationStatus}' IN('CALIBRATED','INSUFFICIENT_SAMPLE','NOT_AVAILABLE')
        AND value #>> '{uncertaintyBand,calibrationMethod}' IN('EMPIRICAL_RESIDUAL_QUANTILES_HF7','NAIVE_RANDOM_WALK_INNOVATION_RMS_NORMAL',
          'STATSMODELS_ETS_SIMULATION','STATSMODELS_DAMPED_HOLT_SIMULATION')
        AND value #>> '{uncertaintyBand,calibrationVersion}' IN('empirical-exact-residual-quantiles-v1','naive-random-walk-innovation-rms-normal-v1',
          'statsmodels-ets-simulation-seed-1729-r1000-v1','statsmodels-damped-holt-simulation-seed-1729-r1000-v1')
        AND (value #> '{uncertaintyBand,reasonCode}'='null'::jsonb
          OR value #>> '{uncertaintyBand,reasonCode}' IN('INSUFFICIENT_EXACT_RESIDUALS','INSUFFICIENT_BAND_HISTORY','NON_FINITE_MODEL_NATIVE_SCALE')
          OR value #>> '{uncertaintyBand,reasonCode}' LIKE 'MODEL_NATIVE_INTERVAL_FAILED:%')
        AND (NOT((value->'uncertaintyBand') ? 'identity') OR value #> '{uncertaintyBand,identity}'='null'::jsonb OR
          (profitia_forecast_read.pick_fields(value #> '{uncertaintyBand,identity}',ARRAY['inputSource','sourceFrequency','targetCadence','horizonLabel',
            'horizonSteps','targetDate','sourceHistoryFingerprint','trainingWindowPolicyId','effectiveTrainingPolicyId','bandPolicyVersion',
            'bandSource','calibrationMethod','calibrationVersion','calibrationCutoff'])
            || jsonb_build_object('forecastIdentity',profitia_forecast_read.pick_fields(value #> '{uncertaintyBand,identity,forecastIdentity}',
              ARRAY['seriesId','modelId','targetSemantics','methodId','methodVersion'])))=expected_identity)
      THEN jsonb_build_object('uncertaintyBand',profitia_forecast_read.pick_fields(value->'uncertaintyBand',ARRAY['status','source','policyVersion','coverage',
        'lower','upper','sampleCount','calibrationStatus','calibrationMethod','calibrationVersion'])
        || jsonb_build_object('reasonCode',CASE WHEN value #>> '{uncertaintyBand,reasonCode}' LIKE 'MODEL_NATIVE_INTERVAL_FAILED:%'
          THEN 'MODEL_NATIVE_INTERVAL_FAILED' ELSE value #>> '{uncertaintyBand,reasonCode}' END)
        || CASE WHEN jsonb_typeof(value #> '{uncertaintyBand,identity}')='object' THEN jsonb_build_object('identity',expected_identity) ELSE '{}'::jsonb END)
      ELSE NULL END AS metadata
  )
  SELECT CASE WHEN value IS NULL OR value='null'::jsonb THEN NULL
    WHEN core.metadata IS NULL OR band.metadata IS NULL THEN jsonb_build_object('projectionRefused',true)||compatibility.metadata
    ELSE core.metadata||band.metadata||compatibility.metadata END FROM core,compatibility,band
$verification_metadata$;

CREATE FUNCTION profitia_forecast_read.project_verification_failures(value jsonb, series text, model text) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $verification_failures$
  WITH entries AS (
    SELECT e,n FROM jsonb_array_elements(CASE WHEN jsonb_typeof(value)='array' THEN value ELSE '[]'::jsonb END) WITH ORDINALITY AS item(e,n)
  ), projected AS (
    SELECT n,CASE WHEN jsonb_typeof(e)='object'
      AND (NOT(e ? 'benchmarkId') OR (jsonb_typeof(e->'benchmarkId')='string' AND e->>'benchmarkId'=series))
      AND (NOT(e ? 'modelId') OR (jsonb_typeof(e->'modelId')='string' AND e->>'modelId'=model))
      AND e->>'horizon' ~ '^[1-9][0-9]{0,2}[MDQWY]$'
      AND e->>'horizonSteps' ~ '^([1-9][0-9]{0,3}|10000)$'
      AND e->>'forecastOrigin' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2}))?$'
      AND e->>'forecastDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2}))?$'
      THEN jsonb_build_object('benchmarkId',series,'modelId',model,'horizon',e->>'horizon','horizonSteps',(e->>'horizonSteps')::integer,
        'forecastOrigin',e->>'forecastOrigin','forecastDate',e->>'forecastDate','failureReason','FORECAST_FIT_FAILED') END AS item FROM entries
  )
  SELECT CASE WHEN value IS NULL OR value='null'::jsonb THEN '[]'::jsonb
    WHEN jsonb_typeof(value)<>'array' OR octet_length(value::text)>16777216
      OR (SELECT count(*) FROM entries)>20000 OR EXISTS(SELECT 1 FROM projected WHERE item IS NULL)
      THEN jsonb_build_array(jsonb_build_object('projectionRefused',true))
    ELSE COALESCE((SELECT jsonb_agg(item ORDER BY n) FROM projected),'[]'::jsonb) END
$verification_failures$;


CREATE VIEW profitia_forecast_read.forecast_verification_points WITH(security_barrier=true) AS
SELECT p.id,p."runId",CASE WHEN p."horizonLabel" ~ '^[1-9][0-9]{0,2}[MDQWY]$' THEN p."horizonLabel" ELSE 'INVALID' END AS "horizonLabel",
  p."horizonSteps",p."forecastOriginAt",p."targetDate",p."actualObservedAt",p."originValue",p."forecastValue",p."actualValue",
  p."errorValue",p."absoluteErrorValue",p."deltaValue",p."deltaPct",p."maseScale",
  projected.metadata->>'selectedVariant' AS "selectedVariant",projected.metadata->>'selectionMetric' AS "selectionMetric",
  (projected.metadata->>'selectionScore')::double precision AS "selectionScore",projected.metadata AS "metadataJson",p."createdAt",p."updatedAt"
FROM public.forecast_verification_points p JOIN public.forecast_verification_runs r ON r.id=p."runId"
JOIN profitia_market_read.series s ON s."providerSeriesId"=r."seriesId"
CROSS JOIN LATERAL (SELECT profitia_forecast_read.project_verification_metadata(p."metadataJson",r."modelId",jsonb_build_object(
  'forecastIdentity',jsonb_build_object('seriesId',r."seriesId",'modelId',r."modelId",'targetSemantics',r."targetBasis"::text,
    'methodId',r."methodId",'methodVersion',r."methodVersion"),
  'inputSource',r."inputSource",'sourceFrequency',split_part(split_part(r.frequency,'|',2),'=',2),
  'targetCadence',split_part(split_part(r.frequency,'|',3),'=',2),'horizonLabel',p."horizonLabel",'horizonSteps',p."horizonSteps",
  'targetDate',to_char(p."targetDate",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'sourceHistoryFingerprint',r."historyFingerprint",
  'trainingWindowPolicyId',r."trainingWindowPolicyId",'effectiveTrainingPolicyId',r."effectiveTrainingPolicyId",
  'bandPolicyVersion','ADAPTIVE_UNCERTAINTY_BANDS_V1','bandSource',p."metadataJson" #>> '{uncertaintyBand,source}',
  'calibrationMethod',p."metadataJson" #>> '{uncertaintyBand,calibrationMethod}',
  'calibrationVersion',p."metadataJson" #>> '{uncertaintyBand,calibrationVersion}',
  'calibrationCutoff',to_char(p."forecastOriginAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) AS metadata) projected
WHERE r.status='AVAILABLE' AND r."inputSource"='DYNAMIC_MARKET_DATA_STORE' AND r."targetBasis"::text IN('MONTHLY_AVERAGE','END_OF_PERIOD')
  AND r."methodId"=r."targetBasis"::text AND r."methodVersion"='benchmark-forecasting-mvp-phase2-v1'
  AND r."modelId" IN('naive','damped_holt','ets','arima')
  AND r.frequency ~ '^FORECAST_CADENCE_V1[|]source=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)[|]target=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)$' ;

CREATE VIEW profitia_forecast_read.forecast_verification_metrics WITH(security_barrier=true) AS
SELECT p.id,p."runId",CASE WHEN p."horizonLabel" ~ '^[1-9][0-9]{0,2}[MDQWY]$' THEN p."horizonLabel" ELSE 'INVALID' END AS "horizonLabel",
  p."horizonSteps",p.origins,p."expectedOrigins",p."failedOrigins",p.coverage,p.mae,p.rmse,p.mase,p.smape,p."directionalAccuracy",p.bias,
  profitia_forecast_read.project_verification_failures(p."failureSummaryJson",r."seriesId",r."modelId") AS "failureSummaryJson",p."createdAt",p."updatedAt"
FROM public.forecast_verification_metrics p JOIN public.forecast_verification_runs r ON r.id=p."runId"
JOIN profitia_market_read.series s ON s."providerSeriesId"=r."seriesId"
WHERE r.status='AVAILABLE' AND r."inputSource"='DYNAMIC_MARKET_DATA_STORE' AND r."targetBasis"::text IN('MONTHLY_AVERAGE','END_OF_PERIOD')
  AND r."methodId"=r."targetBasis"::text AND r."methodVersion"='benchmark-forecasting-mvp-phase2-v1'
  AND r."modelId" IN('naive','damped_holt','ets','arima')
  AND r.frequency ~ '^FORECAST_CADENCE_V1[|]source=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)[|]target=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)$' ;

-- Schema 3.0.1: materialize only this run before checking projected payloads.
-- The security-barrier child views and refusal predicates remain unchanged.
-- Without this boundary, an anti-join may project unrelated runs first.
CREATE VIEW profitia_forecast_read.forecast_verification_runs WITH(security_barrier=true) AS
SELECT r.id,r."seriesId",s."displayName",s."displayName" AS description,r.frequency,s.currency,s.unit,s."sourceLabel",
  r."inputSource",NULL::text AS "inputRunId",r."historyFingerprint",r."targetBasis"::text::profitia_forecast_read."ForecastTargetBasis" AS "targetBasis",
  r."methodId",r."historyStartAt",r."historyEndAt",r."observationCount",r."forecastOriginAt",r."modelId",r."methodVersion",
  r."trainingWindowPolicyId",r."effectiveTrainingPolicyId",r.status,NULL::text AS "failureReason",r."runtimeSeconds",r."createdAt",r."updatedAt"
FROM public.forecast_verification_runs r JOIN profitia_market_read.series s ON s."providerSeriesId"=r."seriesId"
WHERE r.status='AVAILABLE' AND r."historyFingerprint" ~ '^[a-f0-9]{64}$' AND r."inputSource"='DYNAMIC_MARKET_DATA_STORE' AND r."targetBasis"::text IN('MONTHLY_AVERAGE','END_OF_PERIOD')
  AND r."methodId"=r."targetBasis"::text AND r."methodVersion"='benchmark-forecasting-mvp-phase2-v1'
  AND r."modelId" IN('naive','damped_holt','ets','arima')
  AND r.frequency ~ '^FORECAST_CADENCE_V1[|]source=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)[|]target=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)$'
  AND NOT EXISTS(
    WITH selected_points AS MATERIALIZED (
      SELECT q."horizonLabel",q."horizonSteps",q."forecastOriginAt",q."targetDate",q."originValue",q."forecastValue",q."actualValue",q."errorValue",q."absoluteErrorValue",q."deltaValue",q."maseScale",q."metadataJson"
      FROM profitia_forecast_read.forecast_verification_points q WHERE q."runId"=r.id
    )
    SELECT 1 FROM selected_points q WHERE (q."horizonLabel"='INVALID' OR q."horizonSteps" IS NULL OR q."horizonSteps" NOT BETWEEN 1 AND 10000
      OR q."forecastOriginAt" IS NULL OR q."targetDate" IS NULL OR q."originValue" IS NULL OR q."forecastValue" IS NULL
      OR q."actualValue" IS NULL OR q."errorValue" IS NULL OR q."absoluteErrorValue" IS NULL OR q."deltaValue" IS NULL OR q."maseScale" IS NULL
      OR q."metadataJson" ? 'projectionRefused'))
  AND NOT EXISTS(
    WITH selected_metrics AS MATERIALIZED (
      SELECT q."horizonLabel",q."horizonSteps",q."failureSummaryJson"
      FROM profitia_forecast_read.forecast_verification_metrics q WHERE q."runId"=r.id
    )
    SELECT 1 FROM selected_metrics q WHERE (q."horizonLabel"='INVALID' OR q."horizonSteps" IS NULL OR q."horizonSteps" NOT BETWEEN 1 AND 10000
      OR q."failureSummaryJson" @> '[{"projectionRefused":true}]'::jsonb));

-- A refusal marker retains only already validated prefix proof. The original
-- reader can first discard incompatible historical rows; an applicable marker
-- is then refused by the closed publication contract, never counted as a
-- silently omitted observation. No raw diagnostics or caller IDs cross.
CREATE VIEW profitia_forecast_read.rolling_daily_verification_records WITH(security_barrier=true) AS
SELECT p.id,p."seriesId",p."inputSource",NULL::text AS "inputRunId",p."targetBasis"::text::profitia_forecast_read."ForecastTargetBasis" AS "targetBasis",
  p."methodId",p."methodVersion",p."modelId",p."forecastOriginAt",
  CASE WHEN p."horizonLabel" ~ '^[1-9][0-9]{0,2}[MDQWY]$' THEN p."horizonLabel" ELSE 'INVALID' END AS "horizonLabel",
  p."horizonMonths",p."horizonSteps",p."targetCalendarDate",p."verificationObservedAt",
  p."maturityStatus"::text::profitia_forecast_read."RollingDailyVerificationMaturityStatus" AS "maturityStatus",
  p."originValue",p."forecastValue",p."actualValue",p."errorValue",p."absoluteErrorValue",p."deltaValue",p."deltaPct",p."residualValue",p."maseScale",
  p."trainingHistoryStartAt",p."trainingHistoryEndAt",p."trainingObservationCount",
  CASE WHEN p."sourceHistoryFingerprint" ~ '^[a-f0-9]{64}$' THEN p."sourceHistoryFingerprint" ELSE 'UNAVAILABLE' END AS "sourceHistoryFingerprint",
  projected.metadata->>'selectedVariant' AS "selectedVariant",projected.metadata->>'selectionMetric' AS "selectionMetric",
  (projected.metadata->>'selectionScore')::double precision AS "selectionScore",
  projected.metadata || CASE WHEN jsonb_typeof(p."metadataJson"->'uncertaintyBand')='object'
    THEN jsonb_build_object('projectionRefused',true) ELSE '{}'::jsonb END AS "metadataJson",p."createdAt",p."updatedAt"
FROM public.rolling_daily_verification_records p JOIN profitia_market_read.series s ON s."providerSeriesId"=p."seriesId"
CROSS JOIN LATERAL (SELECT profitia_forecast_read.project_verification_metadata(p."metadataJson",p."modelId",'{}'::jsonb) AS metadata) projected
WHERE p."inputSource"='DYNAMIC_MARKET_DATA_STORE' AND p."targetBasis"::text='POINT_IN_TIME'
  AND p."methodId"='ROLLING_DAILY_POINT_IN_TIME' AND p."methodVersion"='rolling-daily-point-in-time-v1'
  AND p."modelId" IN('naive','damped_holt','ets','arima');
-- Rolling records have no persisted band-policy columns, and actual source has
-- zero non-null bands. A future band producer needs its own proof contract;
-- this reader must not manufacture one from current aggregate history.

CREATE VIEW profitia_forecast_read.rolling_daily_maintenance_state WITH(security_barrier=true) AS
SELECT p.id,p."seriesId",p."inputSource",p."targetBasis"::text::profitia_forecast_read."ForecastTargetBasis" AS "targetBasis",p."methodId",p."methodVersion",p."modelId",
  p."latestSourceObservationAt",CASE WHEN p."latestSourceHistoryFingerprint" ~ '^[a-f0-9]{64}$' THEN p."latestSourceHistoryFingerprint" ELSE NULL END AS "latestSourceHistoryFingerprint",
  p."lastProcessedOriginAt",CASE WHEN p."lastMaintenanceStatus" IN('SUCCEEDED','NO_OP','FAILED') THEN p."lastMaintenanceStatus" ELSE NULL END AS "lastMaintenanceStatus"
FROM public.rolling_daily_maintenance_state p JOIN profitia_market_read.series s ON s."providerSeriesId"=p."seriesId"
WHERE p."inputSource"='DYNAMIC_MARKET_DATA_STORE' AND p."targetBasis"::text='POINT_IN_TIME'
  AND p."methodId"='ROLLING_DAILY_POINT_IN_TIME' AND p."methodVersion"='rolling-daily-point-in-time-v1'
  AND p."modelId" IN('naive','damped_holt','ets','arima');

-- State projections describe the newest attempt, including a failure. Artifact
-- projections above retain their original approved-AVAILABLE-only semantics.
-- No synthetic fingerprint or forecast value is used as a readiness stand-in.
CREATE VIEW profitia_forecast_read.forecast_current_states WITH(security_barrier=true) AS
SELECT r."seriesId",r.frequency,r."targetBasis"::text::profitia_forecast_read."ForecastTargetBasis" AS "targetBasis",r."methodId",r."modelId",r."methodVersion",
  r."trainingWindowPolicyId",r."effectiveTrainingPolicyId",
  CASE WHEN r."historyFingerprint" ~ '^[a-f0-9]{64}$' THEN r."historyFingerprint" ELSE 'UNAVAILABLE' END AS "historyFingerprint",
  CASE WHEN r.status='AVAILABLE' AND EXISTS(SELECT 1 FROM profitia_forecast_read.forecast_current_runs a WHERE a.id=r.id) THEN 'AVAILABLE'
    WHEN r.status='FAILED' THEN 'FAILED' ELSE 'NOT_AVAILABLE' END AS status,r."updatedAt",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('forecastValue',p."forecastValue")) FROM profitia_forecast_read.forecast_current_points p
    WHERE p."runId"=r.id),'[]'::jsonb) AS "pointsJson"
FROM public.forecast_current_runs r JOIN profitia_market_read.series s ON s."providerSeriesId"=r."seriesId"
WHERE r."inputSource"='DYNAMIC_MARKET_DATA_STORE' AND r."targetBasis"::text IN('MONTHLY_AVERAGE','END_OF_PERIOD')
  AND r."methodId"=r."targetBasis"::text AND r."methodVersion"='benchmark-forecasting-mvp-phase2-v1'
  AND r."modelId" IN('naive','damped_holt','ets','arima')
  AND r.frequency ~ '^FORECAST_CADENCE_V1[|]source=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)[|]target=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)$' ;

CREATE VIEW profitia_forecast_read.forecast_verification_states WITH(security_barrier=true) AS
SELECT r."seriesId",r.frequency,r."targetBasis"::text::profitia_forecast_read."ForecastTargetBasis" AS "targetBasis",r."methodId",r."modelId",r."methodVersion",
  r."trainingWindowPolicyId",r."effectiveTrainingPolicyId",
  CASE WHEN r."historyFingerprint" ~ '^[a-f0-9]{64}$' THEN r."historyFingerprint" ELSE 'UNAVAILABLE' END AS "historyFingerprint",
  CASE WHEN r.status='AVAILABLE' AND EXISTS(SELECT 1 FROM profitia_forecast_read.forecast_verification_runs a WHERE a.id=r.id) THEN 'AVAILABLE'
    WHEN r.status='FAILED' THEN 'FAILED' ELSE 'NOT_AVAILABLE' END AS status,r."updatedAt",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('origins',p.origins,'expectedOrigins',p."expectedOrigins",'failedOrigins',p."failedOrigins"))
    FROM public.forecast_verification_metrics p WHERE p."runId"=r.id),'[]'::jsonb) AS "metricsJson"
FROM public.forecast_verification_runs r JOIN profitia_market_read.series s ON s."providerSeriesId"=r."seriesId"
WHERE r."inputSource"='DYNAMIC_MARKET_DATA_STORE' AND r."targetBasis"::text IN('MONTHLY_AVERAGE','END_OF_PERIOD')
  AND r."methodId"=r."targetBasis"::text AND r."methodVersion"='benchmark-forecasting-mvp-phase2-v1'
  AND r."modelId" IN('naive','damped_holt','ets','arima')
  AND r.frequency ~ '^FORECAST_CADENCE_V1[|]source=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)[|]target=(DAILY|WEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|QUADMONTHLY|SEMIANNUAL|ANNUAL)$' ;

REVOKE ALL ON ALL TABLES IN SCHEMA profitia_forecast_read FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_forecast_read FROM PUBLIC;
