-- Additive Development candidate. No grants, enablement or live migration.
-- Execute as the existing constrained owner, inside an operator transaction.
DO $guard$ BEGIN
  IF current_user <> 'profitia_access_owner' OR EXISTS (
    SELECT FROM pg_roles WHERE rolname=current_user AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit)
  ) OR NOT EXISTS (SELECT FROM profitia_profile.installation WHERE singleton
    AND schema_digest='a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3')
    OR NOT EXISTS (SELECT FROM profitia_access.installation WHERE singleton AND environment='development')
  THEN RAISE EXCEPTION 'EMAIL_INSTALLATION_REJECTED'; END IF;
END $guard$;
CREATE TABLE profitia_profile.email_installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$')
);
CREATE TABLE profitia_profile.email_policies (
  login_role name PRIMARY KEY REFERENCES profitia_access.runtime_bindings(login_role),
  issuer text NOT NULL CHECK(issuer ~ '^https://[^/?#]+$'),
  instance_id text NOT NULL UNIQUE CHECK(instance_id ~ '^ins_[A-Za-z0-9]{4,120}$'),
  service_id text NOT NULL UNIQUE CHECK(service_id ~ '^[a-z0-9-]{3,100}$'),
  enabled boolean NOT NULL DEFAULT false,
  allow_avatar_projection boolean NOT NULL DEFAULT false,
  proof_key bytea NOT NULL CHECK(octet_length(proof_key)=32),
  max_pending integer NOT NULL DEFAULT 1000 CHECK(max_pending BETWEEN 1 AND 10000),
  max_per_hour integer NOT NULL DEFAULT 60 CHECK(max_per_hour BETWEEN 1 AND 1000)
);
CREATE TABLE profitia_profile.email_outbox (
  instance_id text NOT NULL REFERENCES profitia_profile.email_policies(instance_id),
  email_id text NOT NULL CHECK(email_id ~ '^ema_[A-Za-z0-9]{4,120}$'),
  event_id text NOT NULL CHECK(event_id ~ '^msg_[A-Za-z0-9]{4,120}$'),
  fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
  provider_subject text CHECK(provider_subject ~ '^user_[A-Za-z0-9]{4,120}$'),
  ciphertext text CHECK(length(ciphertext) BETWEEN 60 AND 50000),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','leased','sending','accepted','rejected','unknown','expired')),
  claim_token uuid, lease_until timestamptz,
  provider_id text CHECK(length(provider_id)<=255),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(instance_id,email_id), UNIQUE(instance_id,event_id)
);
CREATE INDEX email_pending ON profitia_profile.email_outbox(instance_id,created_at) WHERE status IN ('queued','leased','sending');
CREATE TABLE profitia_profile.email_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_kind text NOT NULL DEFAULT 'SERVICE' CHECK(actor_kind='SERVICE'),
  service_id text NOT NULL,
  application_id text NOT NULL,
  environment text NOT NULL CHECK(environment='development'),
  instance_id text NOT NULL,
  email_id text,
  operation text NOT NULL,
  outcome text NOT NULL
);
DO $rls$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['email_installation','email_policies','email_outbox','email_audit'] LOOP
    EXECUTE format('ALTER TABLE profitia_profile.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE profitia_profile.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY controlled_owner ON profitia_profile.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
    EXECUTE format('REVOKE ALL ON profitia_profile.%I FROM PUBLIC',t);
  END LOOP;
END $rls$;
CREATE TRIGGER email_policy_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_profile.email_policies
FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER email_policy_truncate_fence BEFORE TRUNCATE ON profitia_profile.email_policies
FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();

CREATE FUNCTION profitia_profile.email_descriptor() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
  SELECT profitia_access.runtime_descriptor() || jsonb_build_object(
    'emailSchemaDigest',i.schema_digest,'issuer',p.issuer,'instanceId',p.instance_id,
    'serviceId',p.service_id,'enabled',p.enabled)
  FROM profitia_profile.email_installation i,profitia_profile.email_policies p
  WHERE i.singleton AND p.login_role=session_user AND p.enabled
    AND (profitia_access.runtime_descriptor()->>'environment')='development'
    AND EXISTS(SELECT FROM pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit);
$fn$;

-- One closed service command. No human impersonation, email lookup, arbitrary
-- SQL or profile mutation. HMAC binds exact command bytes to one transaction.
CREATE FUNCTION profitia_profile.email_command(p_command text,p_until bigint,p_signature text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE p profitia_profile.email_policies; d jsonb; c jsonb; op text; expected text;
  r profitia_profile.email_outbox; result jsonb; v_avatar text:='neutral'; allowed text[];
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
    INSERT INTO profitia_profile.email_outbox(instance_id,email_id,event_id,fingerprint,provider_subject,ciphertext,expires_at)
      VALUES(p.instance_id,c->>'emailId',c->>'eventId',c->>'fingerprint',c->>'providerSubject',c->>'ciphertext',v_expires);
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
      result:=jsonb_build_object('status','sending','avatar',COALESCE(v_avatar,'neutral'));
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
REVOKE ALL ON FUNCTION profitia_profile.email_descriptor(),profitia_profile.email_command(text,bigint,text) FROM PUBLIC;
