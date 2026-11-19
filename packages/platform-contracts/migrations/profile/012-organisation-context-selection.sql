-- Additive own-account organisation selection. URL/UUID input is never a grant.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole))
  OR to_regclass('profitia_profile.organisation_context_installation') IS NULL
 THEN RAISE EXCEPTION 'CONTROLLED_ORGANISATION_OWNER_REQUIRED';END IF;
END $guard$;
ALTER TABLE profitia_profile.organisation_context_installation
 ADD COLUMN selection_schema_digest text CHECK(selection_schema_digest~'^[a-f0-9]{64}$');
CREATE FUNCTION profitia_profile.organisation_selection_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE d jsonb;dg text;
BEGIN
 d:=profitia_profile.organisation_context_descriptor();
 SELECT selection_schema_digest INTO dg FROM organisation_context_installation WHERE singleton;
 IF dg IS NULL THEN RAISE EXCEPTION 'ORGANISATION_SELECTION_INSTALLATION_REQUIRED' USING ERRCODE='PT403';END IF;
 RETURN d||jsonb_build_object('selectionSchemaDigest',dg);
END $fn$;
CREATE FUNCTION profitia_profile.organisation_selection_require(p_decision uuid,p_resource text,p_digest text,p_operation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;uid uuid;
BEGIN
 d:=profitia_profile.organisation_selection_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF p_operation NOT IN('account.settings.read','account.settings.write') OR uid IS NULL OR profitia_access.scope_allows(d->>'applicationId',NULL,uid) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM profitia_access.security_events WHERE application_id=d->>'applicationId' AND decision_id=p_decision
   AND phase='INTENT' AND event->>'contractId'='profitia.operation-context' AND event->>'contractVersion'='1.0.0'
   AND event->>'implementationVersion'='1.0.0-candidate.16' AND event->>'operation'=p_operation
   AND event->>'resourceId'=p_resource AND event->>'actorId'=uid::text
   AND event->>'actorKind'='HUMAN' AND event->>'organisationId' IS NULL AND event->>'decision'='ALLOW'
   AND event->>'payloadDigest'=p_digest)
 THEN RAISE EXCEPTION 'CURRENT_ACCOUNT_ROOT_INTENT_REQUIRED' USING ERRCODE='PT403';END IF;
 RETURN d||jsonb_build_object('userId',uid);
END $fn$;
CREATE FUNCTION profitia_profile.read_organisation_choices(p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;uid uuid;choices jsonb;deadline timestamptz;p organisation_context_policies%ROWTYPE;n bigint;
BEGIN
 d:=profitia_profile.organisation_selection_require(p_decision,'organisation-choices','44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a','account.settings.read');
 uid:=(d->>'userId')::uuid;
 SELECT * INTO p FROM organisation_context_policies WHERE login_role=session_user FOR SHARE;
 SELECT count(*),coalesce(jsonb_agg(jsonb_build_object('organisationId',q.organisation_id,'slug',q.slug,'name',q.legal_name)
  ORDER BY q.legal_name NULLS LAST,q.slug NULLS LAST,q.organisation_id),'[]'::jsonb),min(q.expires_at)
 INTO n,choices,deadline FROM(
  SELECT m.organisation_id,pr.slug,nullif(left(pr.company->>'legalName',320),'') AS legal_name,m.expires_at
  FROM profitia_access.memberships m JOIN profitia_access.organisations o USING(organisation_id)
  LEFT JOIN organisation_profiles pr USING(organisation_id)
  WHERE m.user_id=uid AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND o.status='ACTIVE'
   AND(pr.organisation_id IS NOT NULL OR m.organisation_id=p.legacy_default_organisation_id)
  ORDER BY m.organisation_id LIMIT 51
 )q;
 IF n>50 THEN RAISE EXCEPTION 'ORGANISATION_SELECTION_LIMIT_EXCEEDED' USING ERRCODE='PT403';END IF;
 deadline:=least((d->>'expiresAt')::timestamptz,nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz,coalesce(deadline,'infinity'::timestamptz));
 RETURN jsonb_build_object('userId',uid,'choices',choices,'expiresAt',deadline);
END $fn$;
CREATE FUNCTION profitia_profile.read_selected_organisation_context(p_decision uuid,p_organisation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;uid uuid;p organisation_context_policies%ROWTYPE;deadline timestamptz;membership_until timestamptz;dg text;
BEGIN
 IF p_organisation IS NULL THEN RAISE EXCEPTION 'EXPLICIT_ORGANISATION_REQUIRED' USING ERRCODE='PT403';END IF;
 dg:=encode(sha256(convert_to('{"organisationId":"'||p_organisation::text||'"}','UTF8')),'hex');
 d:=profitia_profile.organisation_selection_require(p_decision,'selected-organisation-context',dg,'account.settings.read');uid:=(d->>'userId')::uuid;
 SELECT * INTO p FROM organisation_context_policies WHERE login_role=session_user FOR SHARE;
 SELECT m.expires_at INTO membership_until FROM profitia_access.memberships m
 JOIN profitia_access.organisations o USING(organisation_id)
 LEFT JOIN organisation_profiles pr USING(organisation_id)
 WHERE m.user_id=uid AND m.organisation_id=p_organisation AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND o.status='ACTIVE'
  AND(pr.organisation_id IS NOT NULL OR m.organisation_id=p.legacy_default_organisation_id)
 FOR SHARE OF m,o;
 IF NOT FOUND THEN RAISE EXCEPTION 'CURRENT_ORGANISATION_MEMBERSHIP_REQUIRED' USING ERRCODE='PT403';END IF;
 deadline:=least((d->>'expiresAt')::timestamptz,nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz,membership_until);
 RETURN jsonb_build_object('userId',uid,'organisationId',p_organisation,'expiresAt',deadline);
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.organisation_selection_descriptor(),
 profitia_profile.organisation_selection_require(uuid,text,text,text),profitia_profile.read_organisation_choices(uuid),
 profitia_profile.read_selected_organisation_context(uuid,uuid) FROM PUBLIC;

CREATE TABLE profitia_profile.organisation_entry_context(
 user_id uuid PRIMARY KEY REFERENCES profitia_access.accounts(user_id),
 organisation_id uuid NOT NULL REFERENCES profitia_access.organisations(organisation_id));
ALTER TABLE profitia_profile.organisation_entry_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_profile.organisation_entry_context FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_profile.organisation_entry_context TO profitia_access_owner USING(true) WITH CHECK(true);
REVOKE ALL ON profitia_profile.organisation_entry_context FROM PUBLIC;
-- An account preference is not an access grant. Selection verifies current
-- membership and writes only the verified user's own context, under Root16.
CREATE FUNCTION profitia_profile.select_own_organisation(p_decision uuid,p_organisation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;uid uuid;p organisation_context_policies%ROWTYPE;deadline timestamptz;membership_until timestamptz;dg text;
BEGIN
 IF p_organisation IS NULL THEN RAISE EXCEPTION 'EXPLICIT_ORGANISATION_REQUIRED' USING ERRCODE='PT403';END IF;
 dg:=encode(sha256(convert_to('{"organisationId":"'||p_organisation::text||'"}','UTF8')),'hex');
 d:=profitia_profile.organisation_selection_require(p_decision,'organisation-entry-context',dg,'account.settings.write');uid:=(d->>'userId')::uuid;
 SELECT * INTO p FROM organisation_context_policies WHERE login_role=session_user FOR SHARE;
 SELECT m.expires_at INTO membership_until FROM profitia_access.memberships m
 JOIN profitia_access.organisations o USING(organisation_id)
 LEFT JOIN organisation_profiles pr USING(organisation_id)
 WHERE m.user_id=uid AND m.organisation_id=p_organisation AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND o.status='ACTIVE'
  AND(pr.organisation_id IS NOT NULL OR m.organisation_id=p.legacy_default_organisation_id)
 FOR SHARE OF m,o;
 IF NOT FOUND THEN RAISE EXCEPTION 'CURRENT_ORGANISATION_MEMBERSHIP_REQUIRED' USING ERRCODE='PT403';END IF;
 INSERT INTO organisation_entry_context(user_id,organisation_id) VALUES(uid,p_organisation)
 ON CONFLICT(user_id) DO UPDATE SET organisation_id=excluded.organisation_id;
 IF EXISTS(SELECT 1 FROM organisation_profiles WHERE organisation_id=p_organisation) THEN
  INSERT INTO organisation_user_context(user_id,organisation_id) VALUES(uid,p_organisation)
  ON CONFLICT(user_id) DO UPDATE SET organisation_id=excluded.organisation_id;
 END IF;
 deadline:=least((d->>'expiresAt')::timestamptz,nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz,membership_until);
 RETURN jsonb_build_object('userId',uid,'organisationId',p_organisation,'expiresAt',deadline);
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.select_own_organisation(uuid,uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION profitia_profile.read_current_organisation_context(p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;p organisation_context_policies%ROWTYPE;uid uuid;oid uuid;membership_until timestamptz;deadline timestamptz;
BEGIN
 d:=profitia_profile.organisation_context_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF uid IS NULL OR profitia_access.scope_allows(d->>'applicationId',NULL,uid) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM profitia_access.security_events WHERE application_id=d->>'applicationId' AND decision_id=p_decision
   AND phase='INTENT' AND event->>'contractId'='profitia.operation-context' AND event->>'contractVersion'='1.0.0'
   AND event->>'implementationVersion'='1.0.0-candidate.16' AND event->>'operation'='account.settings.read'
   AND event->>'resourceId'='current-organisation-context' AND event->>'actorId'=uid::text
   AND event->>'actorKind'='HUMAN' AND event->>'organisationId' IS NULL AND event->>'decision'='ALLOW'
   AND event->>'payloadDigest'='44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a')
 THEN RAISE EXCEPTION 'CURRENT_ACCOUNT_ROOT_INTENT_REQUIRED' USING ERRCODE='PT403';END IF;
 SELECT * INTO p FROM organisation_context_policies WHERE login_role=session_user FOR SHARE;
 -- A prior explicit choice must never silently fall back to another tenant.
 SELECT organisation_id INTO oid FROM organisation_entry_context WHERE user_id=uid;
 IF FOUND THEN
  SELECT m.expires_at INTO membership_until FROM profitia_access.memberships m
   JOIN profitia_access.organisations o USING(organisation_id)
   LEFT JOIN organisation_profiles pr USING(organisation_id)
   WHERE m.user_id=uid AND m.organisation_id=oid AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND o.status='ACTIVE'
    AND(pr.organisation_id IS NOT NULL OR m.organisation_id=p.legacy_default_organisation_id)
   FOR SHARE OF m,o;
  IF NOT FOUND THEN RAISE EXCEPTION 'CURRENT_ORGANISATION_MEMBERSHIP_REQUIRED' USING ERRCODE='PT403';END IF;
  deadline:=least((d->>'expiresAt')::timestamptz,nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz,membership_until);
  RETURN jsonb_build_object('userId',uid,'organisationId',oid,'expiresAt',deadline);
 END IF;
 -- Same preference ordering as the Identity lifecycle and Limits reader.
 SELECT pr.organisation_id,m.expires_at INTO oid,membership_until
  FROM organisation_profiles pr JOIN profitia_access.memberships m USING(organisation_id)
  JOIN profitia_access.organisations o USING(organisation_id)
  LEFT JOIN organisation_user_context c ON c.user_id=m.user_id
  WHERE m.user_id=uid AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND o.status='ACTIVE'
  ORDER BY(pr.organisation_id=c.organisation_id) DESC NULLS LAST,pr.created_at DESC,pr.organisation_id LIMIT 1 FOR SHARE OF pr,m,o;
 IF NOT FOUND AND p.legacy_default_organisation_id IS NOT NULL THEN
  SELECT m.organisation_id,m.expires_at INTO oid,membership_until FROM profitia_access.memberships m
   JOIN profitia_access.organisations o USING(organisation_id)
   WHERE m.user_id=uid AND m.organisation_id=p.legacy_default_organisation_id AND m.status='ACTIVE'
    AND m.expires_at>clock_timestamp() AND o.status='ACTIVE' FOR SHARE OF m,o;
 END IF;
 deadline:=least((d->>'expiresAt')::timestamptz,nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz,
  coalesce(membership_until,'infinity'::timestamptz));
 RETURN jsonb_build_object('userId',uid,'organisationId',oid,'expiresAt',deadline);
END $fn$;
