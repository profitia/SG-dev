// Synthetic loopback fixture only. No deployed entry point imports this module.
const databases = new Set(['sg2_forecast_read_test','sg2_private_host_test','sg2_verification_source_test'])
async function assertOwner(owner) {
  if (!['127.0.0.1','localhost','::1'].includes(owner.connectionParameters?.host)
    || owner.connectionParameters?.user !== 'architecture_test_owner'
    || !databases.has(owner.connectionParameters?.database)) throw Error('Explicit disposable loopback source fixture required')
  const {rows:[actual]} = await owner.query('SELECT current_database() AS database_name,current_user AS role')
  if (!databases.has(actual?.database_name) || actual.role !== 'architecture_test_owner') throw Error('Actual source fixture owner mismatch')
}

/** The two older Current fixtures construct minimal source tables. New source
 * tests use the real Prisma schema instead and call only the grants below. */
export async function createEmptyVerificationSourceFixture(owner) {
  await assertOwner(owner)
  await owner.query(`
    DROP TABLE IF EXISTS public.forecast_verification_points,public.forecast_verification_metrics,public.forecast_verification_runs,
      public.rolling_daily_verification_records,public.rolling_daily_maintenance_state CASCADE;
    DO $$ BEGIN IF to_regtype('public."RollingDailyVerificationMaturityStatus"') IS NULL THEN
      CREATE TYPE public."RollingDailyVerificationMaturityStatus" AS ENUM('MATURED','NOT_YET_MATURED'); END IF; END $$;
    CREATE TABLE public.forecast_verification_runs (
      id text PRIMARY KEY,"seriesId" text,"displayName" text,description text,frequency text,currency text,unit text,"sourceLabel" text,
      "inputSource" text,"inputRunId" text,"historyFingerprint" text,"targetBasis" public."ForecastTargetBasis","methodId" text,
      "historyStartAt" timestamp,"historyEndAt" timestamp,"observationCount" integer,"forecastOriginAt" timestamp,
      "modelId" text,"methodVersion" text,"trainingWindowPolicyId" text,"effectiveTrainingPolicyId" text,
      status text,"failureReason" text,"runtimeSeconds" double precision,"createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
    CREATE TABLE public.forecast_verification_metrics (
      id text PRIMARY KEY,"runId" text REFERENCES public.forecast_verification_runs(id),"horizonLabel" text,"horizonSteps" integer,
      origins integer,"expectedOrigins" integer,"failedOrigins" integer,coverage double precision,mae double precision,rmse double precision,
      mase double precision,smape double precision,"directionalAccuracy" double precision,bias double precision,"failureSummaryJson" jsonb,
      "createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
    CREATE TABLE public.forecast_verification_points (
      id text PRIMARY KEY,"runId" text REFERENCES public.forecast_verification_runs(id),"horizonLabel" text,"horizonSteps" integer,
      "forecastOriginAt" timestamp,"targetDate" timestamp,"actualObservedAt" timestamp,"originValue" numeric(24,8),"forecastValue" numeric(24,8),
      "actualValue" numeric(24,8),"errorValue" numeric(24,8),"absoluteErrorValue" numeric(24,8),"deltaValue" numeric(24,8),"deltaPct" double precision,
      "maseScale" double precision,"selectedVariant" text,"selectionMetric" text,"selectionScore" double precision,"metadataJson" jsonb,
      "createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
    CREATE TABLE public.rolling_daily_verification_records (
      id text PRIMARY KEY,"seriesId" text,"inputSource" text,"inputRunId" text,"targetBasis" public."ForecastTargetBasis","methodId" text,
      "methodVersion" text,"modelId" text,"forecastOriginAt" timestamp,"horizonLabel" text,"horizonMonths" integer,"horizonSteps" integer,
      "targetCalendarDate" timestamp,"verificationObservedAt" timestamp,"maturityStatus" public."RollingDailyVerificationMaturityStatus",
      "originValue" numeric(24,8),"forecastValue" numeric(24,8),"actualValue" numeric(24,8),"errorValue" numeric(24,8),"absoluteErrorValue" numeric(24,8),
      "deltaValue" numeric(24,8),"deltaPct" double precision,"residualValue" numeric(24,8),"maseScale" double precision,
      "trainingHistoryStartAt" timestamp,"trainingHistoryEndAt" timestamp,"trainingObservationCount" integer,"sourceHistoryFingerprint" text,
      "selectedVariant" text,"selectionMetric" text,"selectionScore" double precision,"metadataJson" jsonb,
      "createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
    CREATE TABLE public.rolling_daily_maintenance_state (
      id text PRIMARY KEY,"seriesId" text,"inputSource" text,"inputRunId" text,"targetBasis" public."ForecastTargetBasis","methodId" text,
      "methodVersion" text,"modelId" text,"historicalOriginStartAt" timestamp,"minimumTrainingObservations" integer,"minimumCalibrationSamples" integer,
      "latestSourceObservationAt" timestamp,"latestSourceHistoryStartAt" timestamp,"latestSourceObservationCount" integer,"latestSourceHistoryFingerprint" text,
      "lastProcessedOriginAt" timestamp,"lastMaturedObservedAt" timestamp,"lastMaintenanceAt" timestamp,"lastMaintenanceStatus" text,"lastFailureReason" text,
      "createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now(),
      UNIQUE("seriesId","inputSource","targetBasis","methodId","methodVersion","modelId"));
  `)
}

export async function grantVerificationProjectionSourceColumns(owner, role) {
  await assertOwner(owner)
  if (role !== 'profitia_forecast_read_owner') throw Error('Exact controlled source owner required')
  await owner.query(`
    GRANT USAGE ON TYPE public."RollingDailyVerificationMaturityStatus" TO ${role};
    GRANT SELECT(id,"seriesId",frequency,"inputSource","historyFingerprint","targetBasis","methodId","historyStartAt","historyEndAt",
      "observationCount","forecastOriginAt","modelId","methodVersion","trainingWindowPolicyId","effectiveTrainingPolicyId",status,"runtimeSeconds","createdAt","updatedAt")
      ON public.forecast_verification_runs TO ${role};
    GRANT SELECT(id,"runId","horizonLabel","horizonSteps",origins,"expectedOrigins","failedOrigins",coverage,mae,rmse,mase,smape,
      "directionalAccuracy",bias,"failureSummaryJson","createdAt","updatedAt") ON public.forecast_verification_metrics TO ${role};
    GRANT SELECT(id,"runId","horizonLabel","horizonSteps","forecastOriginAt","targetDate","actualObservedAt","originValue","forecastValue","actualValue",
      "errorValue","absoluteErrorValue","deltaValue","deltaPct","maseScale","metadataJson","createdAt","updatedAt") ON public.forecast_verification_points TO ${role};
    GRANT SELECT(id,"seriesId","inputSource","targetBasis","methodId","methodVersion","modelId","forecastOriginAt","horizonLabel","horizonMonths","horizonSteps",
      "targetCalendarDate","verificationObservedAt","maturityStatus","originValue","forecastValue","actualValue","errorValue","absoluteErrorValue","deltaValue","deltaPct",
      "residualValue","maseScale","trainingHistoryStartAt","trainingHistoryEndAt","trainingObservationCount","sourceHistoryFingerprint","metadataJson","createdAt","updatedAt")
      ON public.rolling_daily_verification_records TO ${role};
    GRANT SELECT(id,"seriesId","inputSource","targetBasis","methodId","methodVersion","modelId","latestSourceObservationAt","latestSourceHistoryFingerprint",
      "lastProcessedOriginAt","lastMaintenanceStatus") ON public.rolling_daily_maintenance_state TO ${role};
  `)
}
