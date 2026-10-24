-- Additive Development language extension. Apply once as constrained owner in
-- a transaction; installer records this file's digest. No runtime grants/enablement.
DO $guard$ BEGIN
  IF current_user<>'profitia_access_owner' OR EXISTS(SELECT FROM pg_roles WHERE rolname=current_user
    AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit))
    OR NOT EXISTS(SELECT FROM profitia_profile.installation WHERE singleton AND schema_digest='a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3')
    OR NOT EXISTS(SELECT FROM profitia_profile.email_installation WHERE singleton AND schema_digest='f8e8ca3ecebaa9bc73f87310e43a93765d516a454e05270606261ded78f95e45')
    OR NOT EXISTS(SELECT FROM profitia_access.installation WHERE singleton AND environment='development')
  THEN RAISE EXCEPTION 'LANGUAGE_INSTALLATION_REJECTED'; END IF;
END $guard$;
CREATE TABLE profitia_profile.language_installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$')
);
ALTER TABLE profitia_profile.language_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_profile.language_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_profile.language_installation TO profitia_access_owner USING(true) WITH CHECK(true);
REVOKE ALL ON profitia_profile.language_installation FROM PUBLIC;
ALTER TABLE profitia_profile.user_profiles ADD COLUMN communication_language text NOT NULL DEFAULT 'en' CHECK(communication_language IN ('pl','en')),
  ADD COLUMN language_source text NOT NULL DEFAULT 'default' CHECK(language_source IN ('migration','browser','user','default'));
-- Serialize with provisioning: the cutover boundary includes every existing
-- account, including legacy accounts without a profile. No account is reassigned.
SELECT revision FROM profitia_access.installation WHERE singleton FOR UPDATE;
INSERT INTO profitia_profile.user_profiles(user_id) SELECT user_id FROM profitia_access.accounts ON CONFLICT DO NOTHING;
UPDATE profitia_profile.user_profiles SET communication_language='pl',language_source='migration';
ALTER TABLE profitia_profile.email_policies ADD COLUMN allow_language_projection boolean NOT NULL DEFAULT false;
ALTER TABLE profitia_profile.email_outbox ADD COLUMN communication_language text NOT NULL DEFAULT 'pl' CHECK(communication_language IN ('pl','en'));
ALTER TABLE profitia_profile.email_outbox ALTER COLUMN communication_language SET DEFAULT 'en';
CREATE FUNCTION profitia_profile.language_descriptor() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
  SELECT profitia_profile.runtime_descriptor() || jsonb_build_object('languageSchemaDigest',schema_digest)
  FROM profitia_profile.language_installation WHERE singleton;
$fn$;
REVOKE ALL ON FUNCTION profitia_profile.language_descriptor() FROM PUBLIC;

CREATE OR REPLACE FUNCTION profitia_profile.update_current(p_expected_version bigint,p_patch jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid; n integer;
BEGIN
  uid:=profitia_profile.current_user_id(true);
  IF p_expected_version IS NULL OR p_expected_version<=0 OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
    OR p_patch='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_each(p_patch) e WHERE e.key NOT IN ('avatar_sex','job','phone','communication_language','language_source')
      OR jsonb_typeof(e.value) NOT IN ('string','null'))
  THEN RAISE EXCEPTION 'Invalid profile patch' USING ERRCODE='PT403'; END IF;
  IF (p_patch ? 'communication_language') <> (p_patch ? 'language_source') OR p_patch ? 'communication_language' AND (
    coalesce(p_patch->>'communication_language','') NOT IN ('pl','en') OR coalesce(p_patch->>'language_source','') NOT IN ('browser','user') OR p_patch->>'language_source'='browser' AND (SELECT count(*) FROM jsonb_object_keys(p_patch))<>2)
  THEN RAISE EXCEPTION 'Invalid language preference' USING ERRCODE='PT403'; END IF;
  -- An automatic browser initialization cannot overwrite migration, browser or
  -- explicit user preference. Version check and first initialization are atomic.
  IF p_patch->>'language_source'='browser' AND EXISTS(SELECT FROM profitia_profile.user_profiles
    WHERE user_id=uid AND language_source<>'default') THEN RETURN profitia_profile.read_current(); END IF;
  UPDATE profitia_profile.user_profiles SET
    communication_language=CASE WHEN p_patch ? 'communication_language' THEN p_patch->>'communication_language' ELSE communication_language END,
    language_source=CASE WHEN p_patch ? 'language_source' THEN p_patch->>'language_source' ELSE language_source END,
    avatar_sex=CASE WHEN p_patch ? 'avatar_sex' THEN p_patch->>'avatar_sex' ELSE avatar_sex END,
    job=CASE WHEN p_patch ? 'job' THEN nullif(normalize(btrim(p_patch->>'job'),NFC),'') ELSE job END,
    phone=CASE WHEN p_patch ? 'phone' THEN nullif(p_patch->>'phone','') ELSE phone END
    WHERE user_id=uid AND version=p_expected_version;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Profile version conflict' USING ERRCODE='PT409'; END IF;
  RETURN profitia_profile.read_current();
END $fn$;


CREATE OR REPLACE FUNCTION profitia_profile.email_command(p_command text,p_until bigint,p_signature text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE p profitia_profile.email_policies; d jsonb; c jsonb; op text; expected text;
  r profitia_profile.email_outbox; result jsonb; v_avatar text:='neutral'; v_language text:='en'; allowed text[];
  v_now timestamptz:=clock_timestamp(); v_expires timestamptz;
BEGIN
  SELECT * INTO p FROM profitia_profile.email_policies WHERE login_role=session_user AND enabled FOR SHARE;
  d:=profitia_profile.email_descriptor();
  IF NOT FOUND OR d IS NULL OR p_until IS NULL OR p_until <= extract(epoch FROM clock_timestamp())*1000
    OR p_until > extract(epoch FROM clock_timestamp())*1000+5000
    OR p_command IS NULL OR octet_length(p_command)>65536 OR p_signature IS NULL
    OR p_signature !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'EMAIL_DENIED' USING ERRCODE='PT403'; END IF;
  expected:=encode(public.hmac(convert_to(concat_ws(chr(31),d->>'environment',d->>'applicationId',session_user::text,
    p.service_id,p.instance_id,txid_current()::text,p_until::text,p_command),'UTF8'),p.proof_key,'sha256'),'hex');
  IF expected<>p_signature THEN RAISE EXCEPTION 'EMAIL_DENIED' USING ERRCODE='PT403'; END IF;
  c:=p_command::jsonb; op:=c->>'op';
  allowed:=CASE op
    WHEN 'enqueue' THEN ARRAY['op','emailId','eventId','fingerprint','providerSubject','ciphertext','expiresAt']
    WHEN 'claim' THEN ARRAY['op']
    WHEN 'begin' THEN ARRAY['op','emailId','token']
    WHEN 'release' THEN ARRAY['op','emailId','token']
    WHEN 'settle' THEN ARRAY['op','emailId','token','status','providerId']
    ELSE NULL END;
  IF allowed IS NULL OR jsonb_typeof(c)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(c))<>cardinality(allowed)
    OR EXISTS(SELECT FROM jsonb_object_keys(c) AS k WHERE NOT k=ANY(allowed)) THEN
    RAISE EXCEPTION 'EMAIL_COMMAND_REJECTED' USING ERRCODE='PT403'; END IF;
  IF op='enqueue' THEN
    -- Serialize capacity checks per instance; concurrent duplicate delivery is
    -- idempotent even when Svix has assigned another event identifier.
    PERFORM pg_advisory_xact_lock(hashtextextended(p.instance_id,0));
    SELECT * INTO r FROM profitia_profile.email_outbox
      WHERE instance_id=p.instance_id AND (email_id=c->>'emailId' OR event_id=c->>'eventId') FOR UPDATE;
    IF FOUND THEN
      IF r.email_id<>c->>'emailId' OR r.fingerprint<>c->>'fingerprint' THEN
        RAISE EXCEPTION 'EMAIL_ID_COLLISION' USING ERRCODE='PT409'; END IF;
      RETURN jsonb_build_object('status','duplicate');
    END IF;
    v_expires:=to_timestamp((c->>'expiresAt')::double precision/1000);
    IF NOT isfinite(v_expires) OR v_expires<=v_now OR v_expires>v_now+interval '5 minutes' THEN
      RAISE EXCEPTION 'EMAIL_EXPIRY_REJECTED' USING ERRCODE='PT403'; END IF;
    IF (SELECT count(*) FROM profitia_profile.email_outbox WHERE instance_id=p.instance_id AND status IN ('queued','leased','sending'))>=p.max_pending THEN
      RAISE EXCEPTION 'EMAIL_CAPACITY' USING ERRCODE='PT503'; END IF;
    IF p.allow_language_projection AND c->>'providerSubject' IS NOT NULL THEN
      SELECT u.communication_language INTO v_language FROM profitia_access.external_identities e
        JOIN profitia_access.accounts a USING(user_id) JOIN profitia_profile.user_profiles u USING(user_id)
        WHERE e.issuer=p.issuer AND e.subject=c->>'providerSubject' AND e.status='ACTIVE' AND a.status='ACTIVE';
    END IF;
    INSERT INTO profitia_profile.email_outbox(instance_id,email_id,event_id,fingerprint,provider_subject,ciphertext,expires_at,communication_language)
      VALUES(p.instance_id,c->>'emailId',c->>'eventId',c->>'fingerprint',c->>'providerSubject',c->>'ciphertext',v_expires,coalesce(v_language,'en'));
    result:=jsonb_build_object('status','queued');
  ELSIF op='claim' THEN
    -- Bounded operational retention; five-minute forwarding age prevents a
    -- deleted seven-day deduplication tombstone from authorizing a replay.
    DELETE FROM profitia_profile.email_outbox WHERE instance_id=p.instance_id
      AND status IN ('accepted','rejected','unknown','expired') AND updated_at<v_now-interval '7 days';
    DELETE FROM profitia_profile.email_audit WHERE instance_id=p.instance_id AND recorded_at<v_now-interval '30 days';
    -- A process may die after the external service accepted. Never re-send a
    -- sending row, regardless of missing outcome; erase its secret instead.
    WITH swept AS (
      UPDATE profitia_profile.email_outbox SET status=CASE WHEN status='sending' THEN 'unknown' ELSE 'expired' END,
        ciphertext=NULL,claim_token=NULL,lease_until=NULL,updated_at=v_now
      WHERE instance_id=p.instance_id AND status IN ('queued','leased','sending')
        AND (expires_at<=v_now OR status='sending' AND lease_until<=v_now)
      RETURNING email_id,status
    ) INSERT INTO profitia_profile.email_audit(service_id,application_id,environment,instance_id,email_id,operation,outcome)
      SELECT p.service_id,d->>'applicationId','development',p.instance_id,email_id,'sweep',status FROM swept;
    SELECT * INTO r FROM profitia_profile.email_outbox WHERE instance_id=p.instance_id AND expires_at>v_now
      AND (status='queued' OR status='leased' AND lease_until<=v_now)
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','empty'); END IF;
    UPDATE profitia_profile.email_outbox SET status='leased',claim_token=gen_random_uuid(),lease_until=v_now+interval '60 seconds',updated_at=v_now
      WHERE instance_id=p.instance_id AND email_id=r.email_id RETURNING * INTO r;
    result:=jsonb_build_object('status','leased','emailId',r.email_id,'token',r.claim_token,'ciphertext',r.ciphertext);
  ELSE
    SELECT * INTO r FROM profitia_profile.email_outbox WHERE instance_id=p.instance_id AND email_id=c->>'emailId' FOR UPDATE;
    IF NOT FOUND OR r.claim_token IS NULL OR r.claim_token::text IS DISTINCT FROM c->>'token'
      OR r.lease_until<=v_now THEN RAISE EXCEPTION 'EMAIL_CLAIM_REJECTED' USING ERRCODE='PT409'; END IF;
    IF op='begin' THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(p.instance_id,1));
      IF (SELECT count(*) FROM profitia_profile.email_audit WHERE instance_id=p.instance_id AND operation='begin'
        AND recorded_at>v_now-interval '1 hour')>=p.max_per_hour THEN
        RAISE EXCEPTION 'EMAIL_HOURLY_LIMIT' USING ERRCODE='PT429'; END IF;
      IF r.status<>'leased' OR r.expires_at<=v_now THEN RAISE EXCEPTION 'EMAIL_CLAIM_EXPIRED' USING ERRCODE='PT409'; END IF;
      -- This is an explicit SERVICE projection, not an ACCOUNT session. The
      -- human session lease is not extended; current account and mapping must
      -- remain active. Caller additionally verifies live Clerk ownership.
      IF p.allow_avatar_projection AND r.provider_subject IS NOT NULL THEN
        SELECT COALESCE(u.avatar_sex,'neutral') INTO v_avatar FROM profitia_access.external_identities e
          JOIN profitia_access.accounts a USING(user_id)
          JOIN profitia_profile.user_profiles u USING(user_id)
          WHERE e.issuer=p.issuer AND e.subject=r.provider_subject AND e.status='ACTIVE' AND a.status='ACTIVE';
      END IF;
      UPDATE profitia_profile.email_outbox SET status='sending',updated_at=v_now WHERE instance_id=p.instance_id AND email_id=r.email_id;
      -- A queued snapshot survives retries/preference changes, but revoking the
      -- projection grant or identity prevents release of private language data.
      v_language:='en';
      IF p.allow_language_projection AND EXISTS(SELECT FROM profitia_access.external_identities e
        JOIN profitia_access.accounts a USING(user_id) WHERE e.issuer=p.issuer AND e.subject=r.provider_subject
        AND e.status='ACTIVE' AND a.status='ACTIVE') THEN v_language:=r.communication_language; END IF;
      result:=jsonb_build_object('status','sending','avatar',COALESCE(v_avatar,'neutral'),'language',v_language);
    ELSIF op='release' THEN
      IF r.status<>'leased' THEN RAISE EXCEPTION 'EMAIL_CLAIM_REJECTED' USING ERRCODE='PT409'; END IF;
      -- Backoff without a new external submission. Lease makes retries bounded.
      UPDATE profitia_profile.email_outbox SET claim_token=NULL,lease_until=v_now+interval '15 seconds',updated_at=v_now
        WHERE instance_id=p.instance_id AND email_id=r.email_id;
      result:=jsonb_build_object('status','released');
    ELSE
      IF r.status NOT IN ('sending','leased') OR c->>'status' NOT IN ('accepted','rejected','unknown')
        OR r.status='leased' AND c->>'status'<>'rejected'
        OR c->>'status'='accepted' AND COALESCE(c->>'providerId','') !~ '^<[A-Za-z0-9_.@+-]+>$'
        OR c->>'status'<>'accepted' AND c->>'providerId' IS NOT NULL THEN
        RAISE EXCEPTION 'EMAIL_OUTCOME_REJECTED' USING ERRCODE='PT409'; END IF;
      UPDATE profitia_profile.email_outbox SET status=c->>'status',provider_id=c->>'providerId',ciphertext=NULL,
        claim_token=NULL,lease_until=NULL,updated_at=v_now WHERE instance_id=p.instance_id AND email_id=r.email_id;
      result:=jsonb_build_object('status',c->>'status');
    END IF;
  END IF;
  INSERT INTO profitia_profile.email_audit(service_id,application_id,environment,instance_id,email_id,operation,outcome)
    VALUES(p.service_id,d->>'applicationId','development',p.instance_id,COALESCE(c->>'emailId',r.email_id),op,result->>'status');
  RETURN result;
END $fn$;
