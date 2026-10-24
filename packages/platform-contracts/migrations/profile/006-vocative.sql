-- Additive Development salutation protocol. Dictionary gender never selects an avatar.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit))
 OR NOT EXISTS(SELECT FROM profitia_profile.registration_installation WHERE singleton AND schema_digest='78af6bfebf483db2d49df5a11caf7fecfc608ac5768725f20adacdc1079cedd1')
 OR NOT EXISTS(SELECT FROM profitia_access.installation WHERE singleton AND environment='development')
 THEN RAISE EXCEPTION 'VOCATIVE_INSTALLATION_REJECTED'; END IF;
END $guard$;
ALTER TABLE profitia_profile.email_policies ADD COLUMN allow_salutation_projection boolean NOT NULL DEFAULT false;
CREATE TABLE profitia_profile.vocative_installation(singleton boolean PRIMARY KEY CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_digest text NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),review_digest text NOT NULL CHECK(review_digest~'^[a-f0-9]{64}$'),dictionary_version text NOT NULL);
CREATE TABLE profitia_profile.vocative_source(source_row integer PRIMARY KEY,original_name text NOT NULL,supplied_vocative text NOT NULL,supplied_gender text NOT NULL,name_key text NOT NULL);
CREATE TABLE profitia_profile.vocative_dictionary(name_key text PRIMARY KEY,canonical_name text NOT NULL,vocative text NOT NULL,name_gender text NOT NULL CHECK(name_gender IN ('Male','Female')),dictionary_version text NOT NULL);
DO $rls$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['vocative_installation','vocative_source','vocative_dictionary'] LOOP
 EXECUTE format('ALTER TABLE profitia_profile.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE profitia_profile.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON profitia_profile.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
 EXECUTE format('REVOKE ALL ON profitia_profile.%I FROM PUBLIC',t);
 END LOOP;
END $rls$;
ALTER TABLE profitia_profile.user_profiles ADD COLUMN first_name text CHECK(length(first_name) BETWEEN 1 AND 160),
 ADD COLUMN first_name_source text NOT NULL DEFAULT 'unknown' CHECK(first_name_source IN ('unknown','registration','clerk-backfill')),
 ADD COLUMN name_vocative text,ADD COLUMN name_gender text NOT NULL DEFAULT 'Unknown' CHECK(name_gender IN ('Male','Female','Unknown')),
 ADD COLUMN name_resolution text NOT NULL DEFAULT 'missing' CHECK(name_resolution IN ('missing','language-ineligible','reviewed','fallback')),
 ADD COLUMN name_dictionary_version text;
ALTER TABLE profitia_profile.registration_attempts ADD COLUMN first_name text CHECK(length(first_name) BETWEEN 1 AND 160),
 ADD COLUMN name_vocative text,ADD COLUMN name_gender text NOT NULL DEFAULT 'Unknown' CHECK(name_gender IN ('Male','Female','Unknown')),
 ADD COLUMN name_resolution text NOT NULL DEFAULT 'missing' CHECK(name_resolution IN ('missing','language-ineligible','reviewed','fallback')),
 ADD COLUMN name_dictionary_version text;
ALTER TABLE profitia_profile.email_outbox ADD COLUMN salutation_first_name text,ADD COLUMN salutation_vocative text;

CREATE FUNCTION profitia_profile.resolve_vocative(p_name text,p_language text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE k text;r profitia_profile.vocative_dictionary;v text;ver text;
BEGIN
 SELECT dictionary_version INTO ver FROM profitia_profile.vocative_installation WHERE singleton;
 IF p_name IS NULL THEN RETURN jsonb_build_object('vocative',NULL,'gender','Unknown','resolution','missing','version',ver); END IF;
 IF length(p_name)>160 OR btrim(p_name)='' OR p_name~'[[:cntrl:]]' THEN RAISE EXCEPTION 'VOCATIVE_NAME_REJECTED' USING ERRCODE='PT400'; END IF;
 IF p_language IS DISTINCT FROM 'pl' THEN RETURN jsonb_build_object('vocative',NULL,'gender','Unknown','resolution','language-ineligible','version',ver); END IF;
 k:=translate(lower(normalize(btrim(regexp_replace(p_name,'[[:space:]]+',' ','g')),NFC)),'ĄĆĘŁŃÓŚŹŻ','ąćęłńóśźż');
 SELECT * INTO r FROM profitia_profile.vocative_dictionary WHERE name_key=k AND dictionary_version=ver;
 IF NOT FOUND THEN RETURN jsonb_build_object('vocative',NULL,'gender','Unknown','resolution','fallback','version',ver); END IF;
 v:=CASE WHEN p_name=upper(p_name) THEN translate(upper(r.vocative),'ąćęłńóśźż','ĄĆĘŁŃÓŚŹŻ') WHEN p_name=lower(p_name) THEN lower(r.vocative) ELSE r.vocative END;
 RETURN jsonb_build_object('vocative',v,'gender',r.name_gender,'resolution','reviewed','version',ver);
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.resolve_vocative(text,text) FROM PUBLIC;
CREATE FUNCTION profitia_profile.persist_vocative() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE r jsonb;lang text;
BEGIN
 IF TG_TABLE_NAME='user_profiles' THEN lang:=NEW.communication_language;ELSE lang:=NEW.language;END IF;
 r:=profitia_profile.resolve_vocative(NEW.first_name,lang);
 NEW.name_vocative:=r->>'vocative';NEW.name_gender:=r->>'gender';NEW.name_resolution:=r->>'resolution';NEW.name_dictionary_version:=r->>'version';RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.persist_vocative() FROM PUBLIC;
CREATE TRIGGER profile_vocative BEFORE INSERT OR UPDATE OF first_name,communication_language ON profitia_profile.user_profiles FOR EACH ROW EXECUTE FUNCTION profitia_profile.persist_vocative();
CREATE TRIGGER attempt_vocative BEFORE INSERT OR UPDATE OF first_name,language ON profitia_profile.registration_attempts FOR EACH ROW EXECUTE FUNCTION profitia_profile.persist_vocative();
CREATE FUNCTION profitia_profile.vocative_descriptor() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
 SELECT profitia_profile.email_descriptor() || jsonb_build_object('vocativeSchemaDigest',schema_digest,'dictionaryVersion',dictionary_version,'dictionaryDigest',review_digest,'salutationEnabled',(SELECT allow_salutation_projection FROM profitia_profile.email_policies WHERE login_role=session_user AND enabled)) FROM profitia_profile.vocative_installation WHERE singleton;
$fn$;
REVOKE ALL ON FUNCTION profitia_profile.vocative_descriptor() FROM PUBLIC;

-- Preserve v5's authorization, state transitions, locks, rate limits and audit.
-- Only an authenticated start receives one extra field; re-sign the reduced
-- exact command inside this controlled boundary, never in the client.
ALTER FUNCTION profitia_profile.registration_command(text,bigint,text) RENAME TO registration_command_v5;
REVOKE ALL ON FUNCTION profitia_profile.registration_command_v5(text,bigint,text) FROM PUBLIC,identity_b1_runtime;
CREATE FUNCTION profitia_profile.registration_command(p_command text,p_until bigint,p_signature text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE c jsonb;r jsonb;p profitia_profile.email_policies;d jsonb;expected text;body text;sig text;n text;
BEGIN
 IF p_command IS NULL OR octet_length(p_command)>12000 THEN RAISE EXCEPTION 'REGISTRATION_DENIED' USING ERRCODE='PT403';END IF;
 c:=p_command::jsonb;body:=p_command;sig:=p_signature;
 IF c->>'op'='start' AND c?'firstName' THEN
  SELECT * INTO p FROM profitia_profile.email_policies WHERE login_role=session_user AND enabled FOR SHARE;
  d:=profitia_profile.registration_descriptor();
  IF NOT FOUND OR NOT p.allow_salutation_projection OR d IS NULL OR p_until IS NULL OR p_until<=extract(epoch FROM clock_timestamp())*1000 OR p_until>extract(epoch FROM clock_timestamp())*1000+5000
   OR p_signature IS NULL OR p_signature!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'REGISTRATION_DENIED' USING ERRCODE='PT403';END IF;
  expected:=encode(public.hmac(convert_to(concat_ws(chr(31),'registration-v1',d->>'environment',d->>'applicationId',session_user::text,p.service_id,p.instance_id,txid_current()::text,p_until::text,p_command),'UTF8'),p.proof_key,'sha256'),'hex');
  IF expected<>p_signature OR jsonb_typeof(c->'firstName')<>'string' THEN RAISE EXCEPTION 'REGISTRATION_DENIED' USING ERRCODE='PT403';END IF;
  n:=c->>'firstName';PERFORM profitia_profile.resolve_vocative(n,c->>'language');
  body:=(c-'firstName')::text;
  sig:=encode(public.hmac(convert_to(concat_ws(chr(31),'registration-v1',d->>'environment',d->>'applicationId',session_user::text,p.service_id,p.instance_id,txid_current()::text,p_until::text,body),'UTF8'),p.proof_key,'sha256'),'hex');
 END IF;
 r:=profitia_profile.registration_command_v5(body,p_until,sig);
 IF c->>'op'='start' THEN
  -- Same 30-day retention as the encrypted registration draft.
  UPDATE profitia_profile.registration_attempts SET first_name=NULL WHERE created_at<clock_timestamp()-interval '30 days' AND first_name IS NOT NULL;
  IF r->>'status'='preparing' AND n IS NOT NULL THEN UPDATE profitia_profile.registration_attempts SET first_name=n WHERE id=(c->>'attemptId')::uuid;END IF;
 ELSIF c->>'op'='finish' AND r->>'status'='finished' THEN
  -- The legacy function has already verified the exact account and winning
  -- attempt. Never rewrite a completed profile from a later abandoned draft.
  UPDATE profitia_profile.user_profiles u SET first_name=a.first_name,first_name_source='registration'
   FROM profitia_profile.registrations reg JOIN profitia_profile.registration_attempts a ON a.registration_id=reg.id AND a.status='finished'
   WHERE u.user_id=(c->>'userId')::uuid AND reg.user_id=u.user_id AND u.first_name IS NULL AND a.first_name IS NOT NULL;
 END IF;
 RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.registration_command(text,bigint,text) FROM PUBLIC;

ALTER FUNCTION profitia_profile.email_command(text,bigint,text) RENAME TO email_command_v5;
REVOKE ALL ON FUNCTION profitia_profile.email_command_v5(text,bigint,text) FROM PUBLIC,identity_b1_runtime;
CREATE FUNCTION profitia_profile.email_command(p_command text,p_until bigint,p_signature text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE c jsonb;r jsonb;p profitia_profile.email_policies;o profitia_profile.email_outbox;n text;v text;
BEGIN
 -- No projection or mutation until the existing signed E1 service gate passes.
 r:=profitia_profile.email_command_v5(p_command,p_until,p_signature);c:=p_command::jsonb;
 SELECT * INTO p FROM profitia_profile.email_policies WHERE login_role=session_user AND enabled;
 IF c->>'op'='enqueue' AND r->>'status'='queued' AND p.allow_language_projection AND p.allow_salutation_projection THEN
  SELECT * INTO o FROM profitia_profile.email_outbox WHERE instance_id=p.instance_id AND email_id=c->>'emailId';
  IF o.registration_attempt_id IS NOT NULL THEN
   SELECT first_name,name_vocative INTO n,v FROM profitia_profile.registration_attempts WHERE id=o.registration_attempt_id;
  ELSE
   SELECT u.first_name,u.name_vocative INTO n,v FROM profitia_access.external_identities e JOIN profitia_access.accounts ac USING(user_id) JOIN profitia_profile.user_profiles u USING(user_id)
    WHERE e.issuer=p.issuer AND e.subject=o.provider_subject AND e.status='ACTIVE' AND ac.status='ACTIVE';
  END IF;
  UPDATE profitia_profile.email_outbox SET salutation_first_name=n,salutation_vocative=CASE WHEN communication_language='pl' THEN v END WHERE instance_id=p.instance_id AND email_id=o.email_id;
 ELSIF c->>'op'='begin' AND r->>'status'='sending' THEN
  SELECT * INTO o FROM profitia_profile.email_outbox WHERE instance_id=p.instance_id AND email_id=c->>'emailId';
  IF p.allow_language_projection AND p.allow_salutation_projection AND (o.registration_attempt_id IS NOT NULL OR EXISTS(SELECT FROM profitia_access.external_identities e JOIN profitia_access.accounts ac USING(user_id)
   WHERE e.issuer=p.issuer AND e.subject=o.provider_subject AND e.status='ACTIVE' AND ac.status='ACTIVE')) THEN
   r:=r || jsonb_build_object('firstName',o.salutation_first_name,'vocative',CASE WHEN r->>'language'='pl' THEN o.salutation_vocative END);
  ELSE r:=r || jsonb_build_object('firstName',NULL,'vocative',NULL);END IF;
 END IF;
 -- Clear transient name snapshots with the encrypted message at settle/sweep.
 IF c->>'op' IN ('claim','settle') THEN UPDATE profitia_profile.email_outbox SET salutation_first_name=NULL,salutation_vocative=NULL WHERE instance_id=p.instance_id AND ciphertext IS NULL AND (salutation_first_name IS NOT NULL OR salutation_vocative IS NOT NULL);END IF;
 RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.email_command(text,bigint,text) FROM PUBLIC;
