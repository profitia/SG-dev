-- PILOT2 only. Forward-compatible provenance extension of the cloned Staging
-- schema. No data, account grants, RLS or provider counters are changed.
-- The applying operator must independently verify the TLS endpoint/branch.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $target$
BEGIN
 IF current_database()<>'srm_app' OR current_user<>'neondb_owner'
  OR current_setting('profitia.install.pilot2_target',true) IS DISTINCT FROM
   'srv-dbeh6srrjlhs73fmikrg:br-summer-rain-b1nwbcbr:development'
  OR (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='srm.provider_attempts'::regclass
    AND conname='provider_attempts_provider_check') IS DISTINCT FROM
   'CHECK ((provider = ANY (ARRAY[''MGBI''::text, ''VERCLY''::text, ''CEIDG''::text])))'
  OR (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='srm.provider_attempts'::regclass
    AND conname='provider_attempts_check') IS DISTINCT FROM
   'CHECK ((((section = ''kys''::text) AND (provider = ''VERCLY''::text)) OR ((section = ANY (ARRAY[''general''::text, ''financial''::text])) AND (provider = ''MGBI''::text)) OR ((section = ''jdg''::text) AND (provider = ''CEIDG''::text))))'
 THEN RAISE EXCEPTION 'Exact approved PILOT2 endpoint and unchanged Staging provenance constraints required';END IF;
END $target$;
ALTER TABLE srm.provider_attempts
 DROP CONSTRAINT provider_attempts_provider_check,
 DROP CONSTRAINT provider_attempts_check,
 ADD CONSTRAINT provider_attempts_provider_check CHECK (provider IN ('MGBI','VERCLY','CEIDG','KRS')),
 ADD CONSTRAINT provider_attempts_check CHECK (
  (section='kys' AND provider='VERCLY') OR
  (section IN ('general','financial') AND provider='MGBI') OR
  (section='jdg' AND provider='CEIDG') OR
  (section='general' AND provider='KRS'));
COMMENT ON CONSTRAINT provider_attempts_check ON srm.provider_attempts IS
 'SRM-PILOT2-STAGING-BASELINE-20261024: General-only KRS provenance; retained Staging rollback artifact remains schema compatible';
