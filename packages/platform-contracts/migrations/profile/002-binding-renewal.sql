-- Additive candidate: install once in an owner-controlled transaction.
-- Keeps SQL001, its digest, existing runtime descriptor and all defaults intact.
-- No role, key, policy activation, account or permission grant is created here.
DO $guard$ BEGIN
  IF current_user <> 'profitia_access_owner' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
    AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole))
    OR NOT EXISTS(SELECT 1 FROM profitia_profile.installation WHERE singleton AND schema_version='1.0.0'
      AND schema_digest='a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3')
    OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND database_name=current_database()
      AND schema_version='1.0.0' AND schema_digest='356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2')
  THEN RAISE EXCEPTION 'Accepted B1 installation and controlled owner required'; END IF;
END $guard$;

ALTER TABLE profitia_profile.runtime_policies
  ADD COLUMN allow_binding_renewal boolean NOT NULL DEFAULT false,
  ADD COLUMN allow_expired_binding_recovery boolean NOT NULL DEFAULT false,
  ADD COLUMN expired_recovery_max_age_ms integer NOT NULL DEFAULT 0
    CHECK(expired_recovery_max_age_ms BETWEEN 0 AND 604800000),
  ADD CHECK(NOT allow_expired_binding_recovery OR
    (allow_binding_renewal AND expired_recovery_max_age_ms>0));

CREATE TABLE profitia_profile.binding_renewal_installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$')
);
ALTER TABLE profitia_profile.binding_renewal_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_profile.binding_renewal_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_profile.binding_renewal_installation
  TO profitia_access_owner USING(true) WITH CHECK(true);

CREATE FUNCTION profitia_profile.binding_renewal_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb; digest text;
BEGIN
  d:=profitia_profile.runtime_descriptor();
  SELECT schema_digest INTO digest FROM profitia_profile.binding_renewal_installation
    WHERE singleton AND schema_version='1.0.0';
  IF digest IS NULL OR d->>'profileSchemaDigest'<>'a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3'
  THEN RAISE EXCEPTION 'Renewal installation unavailable' USING ERRCODE='PT403'; END IF;
  RETURN d||jsonb_build_object('renewalSchemaDigest',digest);
END $fn$;

CREATE FUNCTION profitia_profile.binding_renewal_metadata(
  p_issuer text,p_subject text,p_identity_until bigint,p_until bigint,p_signature text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE p profitia_profile.runtime_policies%ROWTYPE; e profitia_access.external_identities%ROWTYPE;
  av bigint; rev bigint;
BEGIN
  SELECT revision INTO rev FROM profitia_access.installation WHERE singleton FOR UPDATE;
  PERFORM profitia_profile.binding_renewal_descriptor();
  SELECT * INTO p FROM profitia_profile.runtime_policies WHERE login_role=session_user AND enabled;
  IF p_issuer IS DISTINCT FROM p.issuer OR p_subject IS NULL OR length(p_subject) NOT BETWEEN 1 AND 256
    OR p_subject ~ '[[:cntrl:]]' OR p_identity_until IS NULL
    OR p_identity_until<=floor(extract(epoch FROM clock_timestamp())*1000)
    OR p_until IS NULL OR p_until>p_identity_until
    OR profitia_profile.valid_attestation('identity.binding.inspect',p_subject,p_issuer,p_until,p_identity_until,p_signature) IS NOT TRUE
  THEN RAISE EXCEPTION 'Verified identity required' USING ERRCODE='PT403'; END IF;
  SELECT * INTO e FROM profitia_access.external_identities WHERE issuer=p_issuer AND subject=p_subject;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF e.status<>'ACTIVE' THEN RAISE EXCEPTION 'Binding unavailable' USING ERRCODE='PT403'; END IF;
  SELECT version INTO av FROM profitia_access.accounts WHERE user_id=e.user_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='PT403'; END IF;
  RETURN jsonb_build_object('userId',e.user_id,'version',e.binding_id::text||':'||e.version::text||':'||av::text,
    'expiresAt',e.expires_at,'revision',rev,'allowRenewal',p.allow_binding_renewal,
    'allowExpiredRecovery',p.allow_expired_binding_recovery,'maxRecoveryAgeMs',p.expired_recovery_max_age_ms);
END $fn$;

CREATE FUNCTION profitia_profile.renew_binding(p_issuer text,p_subject text,p_expected_version text,p_mode text,
  p_expected_revision bigint,p_identity_until bigint,p_until bigint,p_signature text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb; p profitia_profile.runtime_policies%ROWTYPE; e profitia_access.external_identities%ROWTYPE;
  av bigint; rev bigint; ms bigint; deadline timestamptz; principal text;
BEGIN
  SELECT revision INTO rev FROM profitia_access.installation WHERE singleton FOR UPDATE;
  d:=profitia_profile.binding_renewal_descriptor();
  SELECT * INTO p FROM profitia_profile.runtime_policies WHERE login_role=session_user AND enabled;
  ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  IF p.allow_binding_renewal IS DISTINCT FROM true OR p_issuer IS DISTINCT FROM p.issuer
    OR p_subject IS NULL OR length(p_subject) NOT BETWEEN 1 AND 256 OR p_subject ~ '[[:cntrl:]]'
    OR p_mode IS NULL OR p_mode NOT IN ('RENEW','RECOVER_EXPIRED')
    OR p_identity_until IS NULL OR p_identity_until<=ms OR p_until IS NULL OR p_until>p_identity_until
  THEN RAISE EXCEPTION 'Renewal denied' USING ERRCODE='PT403'; END IF;
  IF p_expected_revision IS DISTINCT FROM rev THEN RAISE EXCEPTION 'Authority changed' USING ERRCODE='PT409'; END IF;
  SELECT * INTO e FROM profitia_access.external_identities WHERE issuer=p_issuer AND subject=p_subject;
  IF NOT FOUND OR e.status<>'ACTIVE' THEN RAISE EXCEPTION 'Binding unavailable' USING ERRCODE='PT403'; END IF;
  SELECT version INTO av FROM profitia_access.accounts WHERE user_id=e.user_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='PT403'; END IF;
  IF p_expected_version IS DISTINCT FROM e.binding_id::text||':'||e.version::text||':'||av::text
  THEN RAISE EXCEPTION 'Binding changed' USING ERRCODE='PT409'; END IF;
  principal:=encode(public.digest(convert_to(concat_ws(chr(31),'binding-renewal-v1',p_subject,
    p_expected_version,p_mode,p_expected_revision::text),'UTF8'),'sha256'),'hex');
  IF profitia_profile.valid_attestation('identity.binding.renew',principal,p_issuer,p_until,p_identity_until,p_signature) IS NOT TRUE
  THEN RAISE EXCEPTION 'Proof unavailable' USING ERRCODE='PT403'; END IF;
  IF e.expires_at<=clock_timestamp() THEN
    IF p_mode<>'RECOVER_EXPIRED' OR NOT p.allow_expired_binding_recovery OR p.expired_recovery_max_age_ms<=0
      OR e.expires_at<clock_timestamp()-p.expired_recovery_max_age_ms*interval '1 millisecond'
    THEN RAISE EXCEPTION 'Recovery policy denied' USING ERRCODE='PT403'; END IF;
  ELSIF p_mode<>'RENEW' OR e.expires_at>clock_timestamp()+interval '30 seconds' THEN
    RAISE EXCEPTION 'Renewal not due' USING ERRCODE='PT403';
  END IF;
  deadline:=to_timestamp(least(p_identity_until,ms+p.max_binding_lifetime_ms)/1000.0);
  IF deadline<=clock_timestamp() OR deadline<=e.expires_at
  THEN RAISE EXCEPTION 'Fresh proof required' USING ERRCODE='PT403'; END IF;
  UPDATE profitia_access.external_identities SET expires_at=deadline
    WHERE binding_id=e.binding_id AND version=e.version AND status='ACTIVE' RETURNING version INTO e.version;
  IF NOT FOUND THEN RAISE EXCEPTION 'Binding changed' USING ERRCODE='PT409'; END IF;
  PERFORM profitia_access.append_audit(jsonb_build_object('applicationId',d->>'applicationId','environment',d->>'environment',
    'decisionId',gen_random_uuid()::text,'phase','DECISION','decision','ALLOW','reasonCode','SUCCEEDED',
    'operation','identity.binding.renew','actorId',e.user_id::text,'actorKind','HUMAN','organisationId',NULL,
    'identityIssuer',p_issuer,'identityProofRef','binding-renewal-v1:'||p_mode,
    'accessVersion',e.binding_id::text||':'||e.version::text||':'||av::text,
    'accessSourceRef','previous-binding:'||p_expected_version,
    'policyVersion','access-v1:'||(SELECT revision FROM profitia_access.installation WHERE singleton)));
  RETURN profitia_access.identity_binding(p_issuer,p_subject);
END $fn$;

REVOKE ALL ON TABLE profitia_profile.binding_renewal_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_profile.binding_renewal_descriptor() FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_profile.binding_renewal_metadata(text,text,bigint,bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_profile.renew_binding(text,text,text,text,bigint,bigint,bigint,text) FROM PUBLIC;
-- The owner must separately register this exact digest, grant only these APIs
-- to the existing ordinary runtime, and explicitly choose disabled policy values.
