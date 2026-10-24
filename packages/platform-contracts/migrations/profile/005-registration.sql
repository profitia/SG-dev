-- Additive Development registration protocol IR01. Controlled owner only.
-- Installer pins this file's digest; grants and enablement are separate actions.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit))
 OR NOT EXISTS(SELECT FROM profitia_profile.language_installation WHERE singleton AND schema_digest='1fdff82e8d9638338662f898c06b41c54bed6a23fc2fd8dc710bf36687fecd2b')
 OR NOT EXISTS(SELECT FROM profitia_access.installation WHERE singleton AND environment='development')
 THEN RAISE EXCEPTION 'REGISTRATION_INSTALLATION_REJECTED'; END IF;
END $guard$;
CREATE TABLE profitia_profile.registration_installation(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'));
CREATE TABLE profitia_profile.registration_policies(
 login_role name PRIMARY KEY REFERENCES profitia_profile.email_policies(login_role),enabled boolean NOT NULL DEFAULT false,
 max_per_hour integer NOT NULL DEFAULT 30 CHECK(max_per_hour BETWEEN 1 AND 500),max_pending integer NOT NULL DEFAULT 1000 CHECK(max_pending BETWEEN 1 AND 10000));
CREATE TABLE profitia_profile.registrations(
 id uuid PRIMARY KEY,instance_id text NOT NULL REFERENCES profitia_profile.email_policies(instance_id),email_key text NOT NULL CHECK(email_key ~ '^[a-f0-9]{64}$'),
 provider_subject text CHECK(provider_subject ~ '^user_[A-Za-z0-9]{4,120}$'),email_address_id text CHECK(email_address_id ~ '^idn_[A-Za-z0-9]{4,120}$'),
 registration_status text NOT NULL DEFAULT 'Unfinished' CHECK(registration_status IN ('Unfinished','Finished')),
 organisation_status text NOT NULL DEFAULT 'Unassigned' CHECK(organisation_status IN ('Unassigned','Assigned')),
 user_id uuid REFERENCES profitia_access.accounts(user_id),active_attempt uuid,lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(instance_id,email_key),UNIQUE(instance_id,provider_subject),CHECK((registration_status='Finished')=(user_id IS NOT NULL)));
CREATE TABLE profitia_profile.registration_attempts(
 id uuid PRIMARY KEY,registration_id uuid NOT NULL REFERENCES profitia_profile.registrations(id),token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 avatar text NOT NULL CHECK(avatar IN ('male','female')),language text NOT NULL CHECK(language IN ('pl','en')),
 ciphertext text CHECK(length(ciphertext) BETWEEN 60 AND 8000),verification_id text,
 status text NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','ready','verifying','verified','ticketed','finished','failed')),
 verification_attempts integer NOT NULL DEFAULT 0 CHECK(verification_attempts BETWEEN 0 AND 5),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '15 minutes',
 verified_at timestamptz,lease_until timestamptz);
CREATE INDEX registration_attempt_record ON profitia_profile.registration_attempts(registration_id,created_at);
CREATE TABLE profitia_profile.registration_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 actor_kind text NOT NULL DEFAULT 'SERVICE' CHECK(actor_kind='SERVICE'),instance_id text NOT NULL,registration_id uuid,operation text NOT NULL,outcome text NOT NULL);
DO $rls$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['registration_installation','registration_policies','registrations','registration_attempts','registration_audit'] LOOP
 EXECUTE format('ALTER TABLE profitia_profile.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE profitia_profile.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON profitia_profile.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
 EXECUTE format('REVOKE ALL ON profitia_profile.%I FROM PUBLIC',t);
 END LOOP;
END $rls$;
CREATE TRIGGER registration_policy_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_profile.registration_policies FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER registration_policy_truncate_fence BEFORE TRUNCATE ON profitia_profile.registration_policies FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
-- Internal accounts already exist only after verified account provisioning.
-- Pending reservations have no internal user or E1 binding until completion.
SELECT revision FROM profitia_access.installation WHERE singleton FOR UPDATE;
ALTER TABLE profitia_profile.user_profiles ADD COLUMN registration_status text NOT NULL DEFAULT 'Finished' CHECK(registration_status IN ('Unfinished','Finished')),
 ADD COLUMN organisation_status text NOT NULL DEFAULT 'Unassigned' CHECK(organisation_status IN ('Unassigned','Assigned'));
INSERT INTO profitia_profile.user_profiles(user_id) SELECT user_id FROM profitia_access.accounts ON CONFLICT DO NOTHING;
UPDATE profitia_profile.user_profiles u SET organisation_status='Assigned' WHERE EXISTS(SELECT FROM profitia_access.memberships m WHERE m.user_id=u.user_id);
-- Assignment records affiliation, not permission. Suspension/expiry continues
-- to be enforced by E1; removing the last membership removes the affiliation.
CREATE FUNCTION profitia_profile.sync_organisation_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid;
BEGIN
 FOR uid IN SELECT DISTINCT x FROM unnest(ARRAY[CASE WHEN TG_OP<>'INSERT' THEN OLD.user_id END,CASE WHEN TG_OP<>'DELETE' THEN NEW.user_id END]) x WHERE x IS NOT NULL LOOP
 UPDATE profitia_profile.user_profiles SET organisation_status=CASE WHEN EXISTS(SELECT FROM profitia_access.memberships m WHERE m.user_id=uid) THEN 'Assigned' ELSE 'Unassigned' END WHERE user_id=uid;
 UPDATE profitia_profile.registrations SET organisation_status=CASE WHEN EXISTS(SELECT FROM profitia_access.memberships m WHERE m.user_id=uid) THEN 'Assigned' ELSE 'Unassigned' END WHERE user_id=uid;
 END LOOP; RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.sync_organisation_status() FROM PUBLIC;
CREATE TRIGGER registration_organisation_sync AFTER INSERT OR UPDATE OR DELETE ON profitia_access.memberships FOR EACH ROW EXECUTE FUNCTION profitia_profile.sync_organisation_status();
CREATE FUNCTION profitia_profile.registration_descriptor() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
 SELECT profitia_profile.email_descriptor() || jsonb_build_object('registrationSchemaDigest',i.schema_digest,'registrationEnabled',p.enabled)
 FROM profitia_profile.registration_installation i JOIN profitia_profile.registration_policies p ON p.login_role=session_user WHERE i.singleton;
$fn$;
REVOKE ALL ON FUNCTION profitia_profile.registration_descriptor() FROM PUBLIC;
CREATE FUNCTION profitia_profile.registration_command(p_command text,p_until bigint,p_signature text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE p profitia_profile.email_policies; policy profitia_profile.registration_policies; d jsonb;c jsonb;op text;allowed text[];expected text;
 r profitia_profile.registrations;a profitia_profile.registration_attempts;result jsonb;v_now timestamptz:=clock_timestamp();uid uuid;
BEGIN
 SELECT * INTO p FROM profitia_profile.email_policies WHERE login_role=session_user AND enabled FOR SHARE;
 d:=profitia_profile.registration_descriptor();
 SELECT * INTO policy FROM profitia_profile.registration_policies WHERE login_role=session_user AND enabled FOR SHARE;
 IF NOT FOUND OR d IS NULL OR p_until IS NULL OR p_until<=extract(epoch FROM v_now)*1000 OR p_until>extract(epoch FROM v_now)*1000+5000
 OR p_command IS NULL OR octet_length(p_command)>12000 OR p_signature IS NULL OR p_signature !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'REGISTRATION_DENIED' USING ERRCODE='PT403'; END IF;
 expected:=encode(public.hmac(convert_to(concat_ws(chr(31),'registration-v1',d->>'environment',d->>'applicationId',session_user::text,p.service_id,p.instance_id,txid_current()::text,p_until::text,p_command),'UTF8'),p.proof_key,'sha256'),'hex');
 IF expected<>p_signature THEN RAISE EXCEPTION 'REGISTRATION_DENIED' USING ERRCODE='PT403'; END IF;
 c:=p_command::jsonb;op:=c->>'op';
 allowed:=CASE op
 WHEN 'start' THEN ARRAY['op','emailKey','attemptId','tokenHash','ciphertext','avatar','language']
 WHEN 'bind' THEN ARRAY['op','attemptId','tokenHash','subject','emailAddressId']
 WHEN 'ready' THEN ARRAY['op','attemptId','tokenHash','verificationId']
 WHEN 'verify' THEN ARRAY['op','attemptId','tokenHash']
 WHEN 'verified' THEN ARRAY['op','attemptId','tokenHash','verified']
 WHEN 'ticket' THEN ARRAY['op','attemptId','tokenHash']
 WHEN 'finish' THEN ARRAY['op','userId','tokenHash']
 ELSE NULL END;
 IF allowed IS NULL OR jsonb_typeof(c)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(c))<>cardinality(allowed)
 OR EXISTS(SELECT FROM jsonb_object_keys(c) k WHERE NOT k=ANY(allowed)) THEN RAISE EXCEPTION 'REGISTRATION_COMMAND_REJECTED' USING ERRCODE='PT403'; END IF;
 IF op='start' THEN
 PERFORM pg_advisory_xact_lock(hashtextextended(p.instance_id,5));
 -- Erase abandoned personal drafts; retain a minimal provider reservation so
 -- it can be resumed without duplicating or automatically deleting accounts.
 UPDATE profitia_profile.registration_attempts SET ciphertext=NULL WHERE created_at<v_now-interval '30 days' AND ciphertext IS NOT NULL;
 DELETE FROM profitia_profile.registration_audit WHERE recorded_at<v_now-interval '30 days';
 IF (SELECT count(*) FROM profitia_profile.registration_audit WHERE instance_id=p.instance_id AND operation='start' AND recorded_at>v_now-interval '1 hour')>=policy.max_per_hour
 THEN RETURN jsonb_build_object('status','retry'); END IF;
 SELECT * INTO r FROM profitia_profile.registrations WHERE instance_id=p.instance_id AND email_key=c->>'emailKey' FOR UPDATE;
 IF FOUND THEN
 IF r.registration_status='Finished' THEN RETURN jsonb_build_object('status','login'); END IF;
 IF r.lease_until>v_now OR r.updated_at>v_now-interval '30 seconds' OR (SELECT count(*) FROM profitia_profile.registration_attempts WHERE registration_id=r.id AND created_at>v_now-interval '1 hour')>=5 THEN RETURN jsonb_build_object('status','retry'); END IF;
 ELSE
 IF (SELECT count(*) FROM profitia_profile.registrations WHERE instance_id=p.instance_id AND registration_status='Unfinished')>=policy.max_pending THEN RETURN jsonb_build_object('status','retry'); END IF;
 INSERT INTO profitia_profile.registrations(id,instance_id,email_key) VALUES(gen_random_uuid(),p.instance_id,c->>'emailKey') RETURNING * INTO r;
 END IF;
 INSERT INTO profitia_profile.registration_attempts(id,registration_id,token_hash,ciphertext,avatar,language)
 VALUES((c->>'attemptId')::uuid,r.id,c->>'tokenHash',c->>'ciphertext',c->>'avatar',c->>'language');
 UPDATE profitia_profile.registrations SET active_attempt=(c->>'attemptId')::uuid,lease_until=v_now+interval '60 seconds',updated_at=v_now WHERE id=r.id;
 result:=jsonb_build_object('status','preparing','registrationId',r.id,'subject',r.provider_subject,'emailAddressId',r.email_address_id);
 ELSIF op='finish' THEN
 uid:=(c->>'userId')::uuid;
 SELECT reg.* INTO r FROM profitia_profile.registrations reg JOIN profitia_access.external_identities e ON e.issuer=p.issuer AND e.subject=reg.provider_subject
 JOIN profitia_access.accounts ac ON ac.user_id=e.user_id WHERE reg.instance_id=p.instance_id AND e.user_id=uid AND e.status='ACTIVE' AND ac.status='ACTIVE' FOR UPDATE OF reg;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','existing'); END IF;
 IF r.registration_status='Finished' THEN RETURN jsonb_build_object('status','finished'); END IF;
 -- The provisioning transaction has independently authenticated the official
 -- Clerk session and verified primary email. A pending draft alone is useless.
 SELECT * INTO a FROM profitia_profile.registration_attempts WHERE registration_id=r.id AND verified_at IS NOT NULL AND status IN ('ticketed','finished')
 AND (c->>'tokenHash' IS NULL OR token_hash=c->>'tokenHash') ORDER BY verified_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REGISTRATION_PROOF_REQUIRED' USING ERRCODE='PT403'; END IF;
 UPDATE profitia_profile.user_profiles SET avatar_sex=a.avatar,communication_language=a.language,language_source='browser',registration_status='Finished',
 organisation_status=CASE WHEN EXISTS(SELECT FROM profitia_access.memberships WHERE user_id=uid) THEN 'Assigned' ELSE 'Unassigned' END WHERE user_id=uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'REGISTRATION_PROFILE_REQUIRED'; END IF;
 UPDATE profitia_profile.registrations SET registration_status='Finished',user_id=uid,organisation_status=(SELECT organisation_status FROM profitia_profile.user_profiles WHERE user_id=uid),updated_at=v_now,lease_until=NULL WHERE id=r.id;
 UPDATE profitia_profile.registration_attempts SET status='finished',ciphertext=NULL WHERE id=a.id;
 result:=jsonb_build_object('status','finished');
 ELSE
 -- Always lock the reservation before its attempt (same order as finish/start).
 SELECT reg.* INTO r FROM profitia_profile.registrations reg JOIN profitia_profile.registration_attempts att ON att.registration_id=reg.id
 WHERE att.id=(c->>'attemptId')::uuid AND att.token_hash=c->>'tokenHash' AND reg.instance_id=p.instance_id FOR UPDATE OF reg;
 IF NOT FOUND OR r.registration_status<>'Unfinished' THEN RAISE EXCEPTION 'REGISTRATION_STATE' USING ERRCODE='PT409'; END IF;
 SELECT * INTO a FROM profitia_profile.registration_attempts WHERE id=(c->>'attemptId')::uuid AND token_hash=c->>'tokenHash' FOR UPDATE;
 IF NOT FOUND OR a.expires_at<=v_now OR r.active_attempt<>a.id THEN RAISE EXCEPTION 'REGISTRATION_EXPIRED' USING ERRCODE='PT409'; END IF;
 IF op='bind' THEN
 IF a.status<>'preparing' OR r.active_attempt<>a.id OR r.lease_until<=v_now OR (r.provider_subject IS NOT NULL AND (r.provider_subject IS DISTINCT FROM c->>'subject' OR r.email_address_id IS DISTINCT FROM c->>'emailAddressId'))
 THEN RAISE EXCEPTION 'REGISTRATION_BINDING' USING ERRCODE='PT409'; END IF;
 UPDATE profitia_profile.registrations SET provider_subject=c->>'subject',email_address_id=c->>'emailAddressId' WHERE id=r.id;
 result:=jsonb_build_object('status','bound');
 ELSIF op='ready' THEN
 IF a.status<>'preparing' OR r.active_attempt<>a.id OR r.lease_until<=v_now OR r.provider_subject IS NULL OR coalesce(c->>'verificationId','') !~ '^[A-Za-z0-9_]{5,150}$' THEN RAISE EXCEPTION 'REGISTRATION_STATE' USING ERRCODE='PT409'; END IF;
 UPDATE profitia_profile.registration_attempts SET status='ready',verification_id=c->>'verificationId' WHERE id=a.id;
 UPDATE profitia_profile.registrations SET lease_until=NULL WHERE id=r.id;
 result:=jsonb_build_object('status','ready');
 ELSIF op='verify' THEN
 IF a.status NOT IN ('ready','verifying') OR a.lease_until>v_now OR a.verification_attempts>=5 THEN RAISE EXCEPTION 'REGISTRATION_STATE' USING ERRCODE='PT409'; END IF;
 UPDATE profitia_profile.registration_attempts SET status='verifying',verification_attempts=verification_attempts+1,lease_until=v_now+interval '30 seconds' WHERE id=a.id;
 -- Fence remote verification/ticket preparation against a concurrent resend.
 UPDATE profitia_profile.registrations SET lease_until=v_now+interval '60 seconds' WHERE id=r.id;
 result:=jsonb_build_object('status','verifying','subject',r.provider_subject,'emailAddressId',r.email_address_id,'verificationId',a.verification_id,'ciphertext',a.ciphertext);
 ELSIF op='verified' THEN
 IF a.status<>'verifying' OR a.lease_until<=v_now OR jsonb_typeof(c->'verified')<>'boolean' THEN RAISE EXCEPTION 'REGISTRATION_STATE' USING ERRCODE='PT409'; END IF;
 UPDATE profitia_profile.registration_attempts SET status=CASE WHEN (c->>'verified')::boolean THEN 'verified' WHEN verification_attempts>=5 THEN 'failed' ELSE 'ready' END,
 verified_at=CASE WHEN (c->>'verified')::boolean THEN v_now ELSE NULL END,lease_until=NULL WHERE id=a.id;
 UPDATE profitia_profile.registrations SET lease_until=CASE WHEN (c->>'verified')::boolean THEN v_now+interval '60 seconds' ELSE NULL END WHERE id=r.id;
 result:=jsonb_build_object('status',CASE WHEN (c->>'verified')::boolean THEN 'verified' ELSE 'unverified' END);
 ELSE
 IF a.status<>'verified' OR a.verified_at<v_now-interval '2 minutes' THEN RAISE EXCEPTION 'REGISTRATION_STATE' USING ERRCODE='PT409'; END IF;
 UPDATE profitia_profile.registration_attempts SET status='ticketed' WHERE id=a.id;
 UPDATE profitia_profile.registrations SET lease_until=v_now+interval '60 seconds' WHERE id=r.id;
 result:=jsonb_build_object('status','ticketed','subject',r.provider_subject,'emailAddressId',r.email_address_id);
 END IF;
 END IF;
 INSERT INTO profitia_profile.registration_audit(instance_id,registration_id,operation,outcome) VALUES(p.instance_id,r.id,op,result->>'status');
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.registration_command(text,bigint,text) FROM PUBLIC;
ALTER TABLE profitia_profile.email_outbox ADD COLUMN registration_attempt_id uuid REFERENCES profitia_profile.registration_attempts(id),
 ADD COLUMN avatar_snapshot text NOT NULL DEFAULT 'neutral' CHECK(avatar_snapshot IN ('male','female','neutral'));

-- Preserve the durable outbox protocol; add signed attempt snapshot projection.
CREATE OR REPLACE FUNCTION profitia_profile.email_command(p_command text,p_until bigint,p_signature text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE p profitia_profile.email_policies; d jsonb; c jsonb; op text; expected text;
  r profitia_profile.email_outbox; result jsonb; v_avatar text:='neutral'; v_language text:='en'; allowed text[];
  v_now timestamptz:=clock_timestamp(); v_expires timestamptz; reg_id uuid;
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
  IF op='enqueue' AND c ? 'registrationAttemptId' THEN allowed:=allowed || ARRAY['registrationAttemptId','emailAddressId']; END IF;
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
    IF p.allow_avatar_projection AND c->>'providerSubject' IS NOT NULL THEN
      SELECT COALESCE(u.avatar_sex,'neutral') INTO v_avatar FROM profitia_access.external_identities e
        JOIN profitia_access.accounts ac USING(user_id) JOIN profitia_profile.user_profiles u USING(user_id)
        WHERE e.issuer=p.issuer AND e.subject=c->>'providerSubject' AND e.status='ACTIVE' AND ac.status='ACTIVE';
    END IF;
    IF c->>'registrationAttemptId' IS NOT NULL THEN
      SELECT a.id,a.avatar,a.language INTO reg_id,v_avatar,v_language FROM profitia_profile.registration_attempts a
        JOIN profitia_profile.registrations reg ON reg.id=a.registration_id
        JOIN profitia_profile.registration_policies rp ON rp.login_role=session_user AND rp.enabled
        WHERE a.id=(c->>'registrationAttemptId')::uuid AND reg.instance_id=p.instance_id AND reg.provider_subject=c->>'providerSubject'
          AND reg.email_address_id=c->>'emailAddressId' AND a.expires_at>v_now
          AND p.allow_avatar_projection AND p.allow_language_projection;
      IF NOT FOUND THEN RAISE EXCEPTION 'EMAIL_REGISTRATION_BINDING' USING ERRCODE='PT403'; END IF;
    END IF;
    INSERT INTO profitia_profile.email_outbox(instance_id,email_id,event_id,fingerprint,provider_subject,ciphertext,expires_at,communication_language,avatar_snapshot,registration_attempt_id)
      VALUES(p.instance_id,c->>'emailId',c->>'eventId',c->>'fingerprint',c->>'providerSubject',c->>'ciphertext',v_expires,coalesce(v_language,'en'),coalesce(v_avatar,'neutral'),reg_id);
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
      v_avatar:='neutral';v_language:='en';
      IF r.registration_attempt_id IS NOT NULL THEN
        IF NOT EXISTS(SELECT FROM profitia_profile.registration_attempts a JOIN profitia_profile.registrations reg ON reg.id=a.registration_id
          JOIN profitia_profile.registration_policies rp ON rp.login_role=session_user AND rp.enabled
          WHERE a.id=r.registration_attempt_id AND reg.instance_id=p.instance_id AND reg.provider_subject=r.provider_subject AND a.expires_at>v_now)
          OR NOT p.allow_avatar_projection OR NOT p.allow_language_projection THEN RAISE EXCEPTION 'EMAIL_REGISTRATION_REVOKED' USING ERRCODE='PT403'; END IF;
        v_avatar:=r.avatar_snapshot;v_language:=r.communication_language;
      ELSIF EXISTS(SELECT FROM profitia_access.external_identities e JOIN profitia_access.accounts ac USING(user_id)
        WHERE e.issuer=p.issuer AND e.subject=r.provider_subject AND e.status='ACTIVE' AND ac.status='ACTIVE') THEN
        IF p.allow_avatar_projection THEN v_avatar:=r.avatar_snapshot; END IF;
        IF p.allow_language_projection THEN v_language:=r.communication_language; END IF;
      END IF;
      UPDATE profitia_profile.email_outbox SET status='sending',updated_at=v_now WHERE instance_id=p.instance_id AND email_id=r.email_id;
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
