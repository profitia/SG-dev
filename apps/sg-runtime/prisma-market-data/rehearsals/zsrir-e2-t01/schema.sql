-- Candidate for E2-T01. This file is outside the deployable Prisma migrations.
-- Run in a transaction on an isolated schema-only test target as the table owner.
SET LOCAL search_path = pg_catalog, pg_temp;

ALTER TABLE public.market_series
  ADD COLUMN IF NOT EXISTS "zsrirDimensions" jsonb;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.market_series'::regclass AND conname = 'market_series_zsrir_dimensions_check'
  ) THEN
    ALTER TABLE public.market_series
      ADD CONSTRAINT market_series_zsrir_dimensions_check CHECK (
        CASE WHEN "providerCode" = 'ZSRIR' THEN
          "zsrirDimensions" IS NOT NULL
          AND jsonb_typeof("zsrirDimensions") = 'object'
          AND jsonb_typeof("zsrirDimensions"->'category_code') = 'string'
          AND "zsrirDimensions"->>'category_code' IN ('FOOD', 'COMMODITIES')
          AND jsonb_typeof("zsrirDimensions"->'market_code') = 'string'
          AND jsonb_typeof("zsrirDimensions"->'product_code') = 'string'
          AND jsonb_typeof("zsrirDimensions"->'metric_code') = 'string'
          AND jsonb_typeof("zsrirDimensions"->'geography_code') = 'string'
          AND jsonb_typeof("zsrirDimensions"->'aggregation_code') = 'string'
          AND nullif(frequency, '') IS NOT NULL
          AND nullif(unit, '') IS NOT NULL
          AND nullif(currency, '') IS NOT NULL
        ELSE "zsrirDimensions" IS NULL END
        IS TRUE
      );
  END IF;
END
$migration$;

CREATE TABLE IF NOT EXISTS public.market_period_observation_revisions (
  "providerCode" text NOT NULL DEFAULT 'ZSRIR' CHECK ("providerCode" = 'ZSRIR'),
  "providerSeriesId" text NOT NULL,
  "periodStart" date NOT NULL,
  "periodEnd" date NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  "supersedesRevision" integer,
  "revisionRef" text NOT NULL CHECK (length(btrim("revisionRef")) > 0),
  value numeric(24,8) NOT NULL,
  provenance jsonb NOT NULL CHECK (
    CASE WHEN jsonb_typeof(provenance) = 'array' THEN
      jsonb_array_length(provenance) > 0
      AND NOT jsonb_path_exists(provenance, '$[*] ? (@.type() != "object")')
    ELSE false END
  ),
  "normalizationVersion" text NOT NULL CHECK (length(btrim("normalizationVersion")) > 0),
  CONSTRAINT market_period_observations_revision_pk
    PRIMARY KEY ("providerCode", "providerSeriesId", "periodStart", "periodEnd", revision),
  CONSTRAINT market_period_observations_revision_ref_key
    UNIQUE ("providerCode", "providerSeriesId", "periodStart", "periodEnd", "revisionRef"),
  CONSTRAINT market_period_observations_series_fk
    FOREIGN KEY ("providerCode", "providerSeriesId")
    REFERENCES public.market_series ("providerCode", "providerSeriesId"),
  CONSTRAINT market_period_observations_previous_fk
    FOREIGN KEY ("providerCode", "providerSeriesId", "periodStart", "periodEnd", "supersedesRevision")
    REFERENCES public.market_period_observation_revisions
      ("providerCode", "providerSeriesId", "periodStart", "periodEnd", revision),
  CONSTRAINT market_period_observations_ordered_dates CHECK ("periodStart" <= "periodEnd"),
  CONSTRAINT market_period_observations_revision_chain CHECK (
    CASE WHEN revision = 1 THEN "supersedesRevision" IS NULL
         ELSE "supersedesRevision" IS NOT DISTINCT FROM revision - 1 END
  )
);

CREATE OR REPLACE VIEW public.market_period_observations
WITH (security_invoker = true, security_barrier = true) AS
SELECT DISTINCT ON ("providerCode", "providerSeriesId", "periodStart", "periodEnd")
  "providerCode", "providerSeriesId", "periodStart", "periodEnd",
  "periodEnd"::timestamp(3) AS "observedAt",
  revision, "supersedesRevision", "revisionRef", value, provenance, "normalizationVersion"
FROM public.market_period_observation_revisions
ORDER BY "providerCode", "providerSeriesId", "periodStart", "periodEnd", revision DESC;

-- Activation of a provider-scoped Source/Identity operation is a later task.
REVOKE ALL ON public.market_period_observation_revisions, public.market_period_observations FROM PUBLIC;
