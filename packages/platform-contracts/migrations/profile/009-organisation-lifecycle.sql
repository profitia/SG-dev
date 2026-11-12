-- Additive Stage I lifecycle. Controlled NOLOGIN owner only; no policy, grant,
-- source budget, product entitlement, transport secret or activation is installed.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole))
  OR to_regclass('profitia_profile.organisation_profiles') IS NULL
 THEN RAISE EXCEPTION 'Accepted organisation schema and controlled owner required';END IF;
END $guard$;
CREATE TABLE profitia_profile.organisation_lifecycle_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'));
CREATE TABLE profitia_profile.organisation_lifecycle_policies(
 login_role name PRIMARY KEY REFERENCES profitia_profile.runtime_policies(login_role),enabled boolean NOT NULL DEFAULT false,
 policy_id uuid NOT NULL UNIQUE,version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 150 AND source_ref!~'[[:cntrl:]]'),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 membership_expires_at timestamptz NOT NULL CHECK(isfinite(membership_expires_at)),
 operations jsonb NOT NULL CHECK(jsonb_typeof(operations)='array'),
 member_permissions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(member_permissions)='array' AND jsonb_array_length(member_permissions)<=64),
 source_policy_ref text CHECK(source_policy_ref IS NULL OR length(source_policy_ref) BETWEEN 1 AND 150));
CREATE TRIGGER organisation_lifecycle_policy_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_profile.organisation_lifecycle_policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER organisation_lifecycle_policy_truncate_fence BEFORE TRUNCATE ON profitia_profile.organisation_lifecycle_policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TABLE profitia_profile.organisation_user_context(
 user_id uuid PRIMARY KEY REFERENCES profitia_access.accounts(user_id),organisation_id uuid NOT NULL REFERENCES profitia_profile.organisation_profiles(organisation_id));
CREATE TABLE profitia_profile.organisation_procurement_versions(
 organisation_id uuid NOT NULL,user_id uuid NOT NULL,version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(organisation_id,user_id),FOREIGN KEY(organisation_id,user_id) REFERENCES profitia_access.memberships(organisation_id,user_id));
CREATE TABLE profitia_profile.organisation_company_snapshots(
 nip text NOT NULL CHECK(nip~'^[0-9]{10}$'),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
 version text NOT NULL CHECK(length(version) BETWEEN 1 AND 256),company jsonb NOT NULL CHECK(jsonb_typeof(company)='object'),
 source_policy_ref text NOT NULL CHECK(length(source_policy_ref) BETWEEN 1 AND 150),
 retrieved_at timestamptz NOT NULL,valid_until timestamptz NOT NULL CHECK(isfinite(valid_until)),PRIMARY KEY(nip,source_ref,version));
CREATE TABLE profitia_profile.organisation_invitations(
 invitation_id uuid PRIMARY KEY,organisation_id uuid NOT NULL REFERENCES profitia_profile.organisation_profiles(organisation_id),
 inviter_user_id uuid NOT NULL REFERENCES profitia_access.accounts(user_id),recipient_key text NOT NULL CHECK(recipient_key~'^[a-f0-9]{64}$'),
 token_hash text NOT NULL UNIQUE CHECK(token_hash~'^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','ACCEPTED','EXPIRED','CANCELLED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 accepted_by uuid REFERENCES profitia_access.accounts(user_id),accepted_at timestamptz,
 CHECK(expires_at-created_at=interval '7 days'));
CREATE UNIQUE INDEX organisation_pending_recipient ON profitia_profile.organisation_invitations(organisation_id,recipient_key) WHERE status='PENDING';
CREATE TABLE profitia_profile.organisation_invitation_batches(
 organisation_id uuid NOT NULL,user_id uuid NOT NULL,command_id uuid NOT NULL,payload_digest text NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),
 receipt jsonb NOT NULL CHECK(jsonb_typeof(receipt)='object'),PRIMARY KEY(organisation_id,user_id,command_id),
 FOREIGN KEY(organisation_id,user_id) REFERENCES profitia_access.memberships(organisation_id,user_id));
CREATE TABLE profitia_profile.organisation_invitation_outbox(
 invitation_id uuid PRIMARY KEY REFERENCES profitia_profile.organisation_invitations(invitation_id),
 encrypted_payload jsonb NOT NULL CHECK(jsonb_typeof(encrypted_payload)='object' AND octet_length(encrypted_payload::text)<=36000),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','CLAIMED','SENDING','ACCEPTED','REJECTED','UNKNOWN','CANCELLED')),
 lease_id uuid,lease_until timestamptz,nonce text,provider_id text,updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['organisation_lifecycle_installation','organisation_lifecycle_policies','organisation_user_context','organisation_procurement_versions','organisation_company_snapshots','organisation_invitations','organisation_invitation_batches','organisation_invitation_outbox'] LOOP
  EXECUTE format('ALTER TABLE profitia_profile.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_profile.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_profile.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('REVOKE ALL ON profitia_profile.%I FROM PUBLIC',t);
 END LOOP;
END $policies$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE d jsonb;p profitia_profile.organisation_lifecycle_policies%ROWTYPE;dg text;e jsonb;
BEGIN
 d:=profitia_profile.runtime_descriptor();
 SELECT * INTO p FROM profitia_profile.organisation_lifecycle_policies WHERE login_role=session_user AND enabled
  AND expires_at>clock_timestamp() AND membership_expires_at>clock_timestamp();
 IF NOT FOUND OR d->>'environment'<>'development' OR d->>'fixedOrganisationId' IS NOT NULL
 THEN RAISE EXCEPTION 'Lifecycle policy unavailable' USING ERRCODE='PT403';END IF;
 SELECT schema_digest INTO dg FROM profitia_profile.organisation_lifecycle_installation WHERE singleton AND schema_version='1.0.0';
 IF dg IS NULL OR jsonb_array_length(p.operations) NOT BETWEEN 1 AND 8
  OR NOT(p.operations <@ '["organisation.onboarding.read","organisation.company.lookup","organisation.slug.check","organisation.procurement.write","organisation.invitation.create","organisation.invitation.accept","organisation.activation.read","organisation.access.synchronise"]'::jsonb)
  OR jsonb_array_length(p.operations)<>(SELECT count(DISTINCT v) FROM jsonb_array_elements(p.operations) AS a(v))
 THEN RAISE EXCEPTION 'Lifecycle installation unavailable' USING ERRCODE='PT403';END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p.member_permissions) LOOP
  IF jsonb_typeof(e)<>'object' OR(SELECT count(*) FROM jsonb_object_keys(e))<>2
   OR NOT(e?'operation' AND e?'feature') OR jsonb_typeof(e->'operation') IS DISTINCT FROM 'string' OR jsonb_typeof(e->'feature') IS DISTINCT FROM 'string' OR e->>'operation'!~'^[a-z][a-z0-9_.]{1,127}$'
   OR e->>'feature'!~'^[a-z][a-z0-9_]{1,127}$'
   OR e->>'operation' IN('organisation.create','organisation.invitation.create','identity.provision','job.execute','knowledge.ingest')
  THEN RAISE EXCEPTION 'Explicit bounded member permissions required' USING ERRCODE='PT403';END IF;
 END LOOP;
 RETURN jsonb_build_object('schemaDigest',dg,'policyId',p.policy_id,'policyVersion',p.version::text,
  'sourceRef',p.source_ref,'operations',p.operations,'sourcePolicyRef',p.source_policy_ref,
  'expiresAt',least(p.expires_at,clock_timestamp()+interval '30 seconds'));
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_lock() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
BEGIN PERFORM profitia_profile.organisation_lifecycle_descriptor();PERFORM revision FROM profitia_access.installation WHERE singleton FOR UPDATE;END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_context(p_until bigint,p_signature text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;uid uuid;oid uuid;org jsonb;cats jsonb;pv text;profile jsonb;
BEGIN
 d:=profitia_profile.runtime_descriptor();PERFORM profitia_profile.organisation_lifecycle_descriptor();
 uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF uid IS NULL OR profitia_access.scope_allows(d->>'applicationId',NULL,uid) IS NOT TRUE
  OR profitia_profile.valid_attestation('organisation.lifecycle.context',uid::text,'',p_until,0,p_signature) IS NOT TRUE
 THEN RAISE EXCEPTION 'Verified own context required' USING ERRCODE='PT403';END IF;
 -- A separately enrolled registry receiver needs the own-account proof only,
 -- never the user's industry, categories, avatar or organisation profile.
 IF EXISTS(SELECT 1 FROM organisation_lifecycle_policies WHERE login_role=session_user
  AND operations='["organisation.company.lookup"]'::jsonb) THEN
  RETURN jsonb_build_object('userId',uid,'organisationId',NULL,'organisation',NULL,'categories','[]'::jsonb,
   'procurementVersion','0','profile',NULL,'version','1');
 END IF;
 SELECT p.organisation_id INTO oid FROM profitia_profile.organisation_profiles p
 JOIN profitia_access.memberships m ON m.organisation_id=p.organisation_id AND m.user_id=uid
 JOIN profitia_access.organisations o ON o.organisation_id=p.organisation_id
 LEFT JOIN profitia_profile.organisation_user_context c ON c.user_id=uid
 WHERE m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND o.status='ACTIVE'
 ORDER BY(p.organisation_id=c.organisation_id) DESC NULLS LAST,p.created_at DESC,p.organisation_id LIMIT 1;
 IF oid IS NOT NULL THEN
  SELECT jsonb_build_object('organisationId',organisation_id,'slug',slug,'industry',industry,'teamRange',team_range,'company',company)
   INTO org FROM profitia_profile.organisation_profiles WHERE organisation_id=oid;
  SELECT coalesce(jsonb_agg(jsonb_build_object('catalogueId',c.catalogue_id,'label',c.label,'key',c.category_key,'source',c.source) ORDER BY c.category_key),'[]'::jsonb)
   INTO cats FROM profitia_profile.user_procurement_categories u JOIN profitia_profile.organisation_categories c USING(organisation_id,category_id)
   WHERE u.organisation_id=oid AND u.user_id=uid;
  SELECT version::text INTO pv FROM profitia_profile.organisation_procurement_versions WHERE organisation_id=oid AND user_id=uid;
 END IF;
 SELECT to_jsonb(p)||jsonb_build_object('version',version::text) INTO profile FROM profitia_profile.user_profiles p WHERE user_id=uid;
 RETURN jsonb_build_object('userId',uid,'organisationId',oid,'organisation',org,'categories',coalesce(cats,'[]'::jsonb),
  'procurementVersion',coalesce(pv,CASE WHEN jsonb_array_length(coalesce(cats,'[]'::jsonb))>0 THEN '1' ELSE '0' END),'profile',profile,'version','1');
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_admit(p_operation text,p_resource text,p_digest text,p_org uuid,p_until bigint,p_signature text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;p jsonb;uid uuid;
BEGIN
 d:=profitia_profile.runtime_descriptor();p:=profitia_profile.organisation_lifecycle_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF uid IS NULL OR NOT(p->'operations'?p_operation) OR p_resource IS DISTINCT FROM 'current-'||replace(p_operation,'.','-')
  OR p_digest!~'^[a-f0-9]{64}$' OR profitia_access.scope_allows(d->>'applicationId',p_org,uid) IS NOT TRUE
  OR profitia_profile.valid_attestation('organisation.lifecycle.admit',uid::text,p_operation||':'||p_resource||':'||p_digest||':'||coalesce(p_org::text,''),p_until,0,p_signature) IS NOT TRUE
  OR(p_operation IN('organisation.onboarding.read','organisation.company.lookup','organisation.slug.check','organisation.invitation.accept')) IS DISTINCT FROM(p_org IS NULL)
 THEN RAISE EXCEPTION 'Verified lifecycle scope required' USING ERRCODE='PT403';END IF;
 PERFORM set_config('profitia.lifecycle.operation',p_operation,true),set_config('profitia.lifecycle.resource',p_resource,true),
  set_config('profitia.lifecycle.digest',p_digest,true),set_config('profitia.lifecycle.organisation',coalesce(p_org::text,''),true),
  set_config('profitia.lifecycle.until',p_until::text,true),set_config('profitia.lifecycle.signature',p_signature,true);
 RETURN(p-ARRAY['operations','sourcePolicyRef'])||jsonb_build_object('actorId',uid,'applicationId',d->>'applicationId',
  'environment',d->>'environment','operation',p_operation,'organisationId',p_org,'resourceId',p_resource,'payloadDigest',p_digest,'transactionId',txid_current()::text);
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_require(p_operation text,p_decision uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;uid uuid;oid uuid;r text;dg text;until_ms bigint;
BEGIN
 d:=profitia_profile.runtime_descriptor();PERFORM profitia_profile.organisation_lifecycle_descriptor();
 uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;oid:=nullif(current_setting('profitia.lifecycle.organisation',true),'')::uuid;
 r:=current_setting('profitia.lifecycle.resource',true);dg:=current_setting('profitia.lifecycle.digest',true);until_ms:=nullif(current_setting('profitia.lifecycle.until',true),'')::bigint;
 IF uid IS NULL OR current_setting('profitia.lifecycle.operation',true) IS DISTINCT FROM p_operation
  OR profitia_access.scope_allows(d->>'applicationId',oid,uid) IS NOT TRUE
  OR profitia_profile.valid_attestation('organisation.lifecycle.admit',uid::text,p_operation||':'||r||':'||dg||':'||coalesce(oid::text,''),until_ms,0,current_setting('profitia.lifecycle.signature',true)) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM profitia_access.security_events WHERE application_id=d->>'applicationId' AND decision_id=p_decision AND phase='INTENT'
   AND event->>'operation'=p_operation AND event->>'actorId'=uid::text AND(event->>'organisationId') IS NOT DISTINCT FROM oid::text
   AND event->>'payloadDigest'=dg AND event->>'resourceId'=r AND event->>'decision'='ALLOW' AND event->>'implementationVersion'='1.0.0-candidate.23')
 THEN RAISE EXCEPTION 'Current lifecycle Root intent required' USING ERRCODE='PT403';END IF;
 RETURN uid;
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_slug(p_slug text,p_decision uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
BEGIN
 PERFORM profitia_profile.organisation_lifecycle_require('organisation.slug.check',p_decision);
 IF p_slug IS NULL OR length(p_slug) NOT BETWEEN 3 AND 48 OR p_slug!~'^[a-z0-9][a-z0-9-]+[a-z0-9]$' OR p_slug~'--'
  OR p_slug IN('www','app','api','admin','auth','identity','account','accounts','login','register','registration','onboarding','mail','email','smtp','support','help','docs','status','billing','payments','assets','static','cdn','staging','development','production','localhost','root','system','dashboard','x-ray','dev','test','spendguru','profitia')
 THEN RETURN false;END IF;
 RETURN NOT EXISTS(SELECT 1 FROM profitia_profile.organisation_profiles WHERE slug=p_slug);
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_company(p_nip text,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE result jsonb;p jsonb;
BEGIN
 PERFORM profitia_profile.organisation_lifecycle_require('organisation.company.lookup',p_decision);p:=profitia_profile.organisation_lifecycle_descriptor();
 IF p_nip IS NULL OR p_nip!~'^[0-9]{10}$' THEN RAISE EXCEPTION 'Invalid identifier' USING ERRCODE='PT403';END IF;
 SELECT jsonb_build_object('company',company,'sourceRef',source_ref,'version',version) INTO result
  FROM profitia_profile.organisation_company_snapshots WHERE nip=p_nip AND valid_until>clock_timestamp()
  AND source_policy_ref=p->>'sourcePolicyRef' ORDER BY retrieved_at DESC,version DESC LIMIT 1;
 RETURN result;
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_categories(p_expected bigint,p_categories jsonb,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE uid uuid;oid uuid;v bigint;c jsonb;cid uuid;
BEGIN
 uid:=profitia_profile.organisation_lifecycle_require('organisation.procurement.write',p_decision);
 oid:=nullif(current_setting('profitia.lifecycle.organisation',true),'')::uuid;
 IF p_expected IS NULL OR p_expected<0 OR p_expected>=9223372036854775807 OR jsonb_typeof(p_categories) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_categories) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid categories' USING ERRCODE='PT403';END IF;
 INSERT INTO profitia_profile.organisation_procurement_versions(organisation_id,user_id,version) VALUES(oid,uid,1) ON CONFLICT DO NOTHING;
 SELECT version INTO v FROM profitia_profile.organisation_procurement_versions WHERE organisation_id=oid AND user_id=uid FOR UPDATE;
 IF(p_expected=0 AND v<>1) OR(p_expected<>0 AND p_expected<>v) THEN RAISE EXCEPTION 'Procurement version conflict' USING ERRCODE='PT409';END IF;
 IF p_expected=0 AND EXISTS(SELECT 1 FROM profitia_profile.user_procurement_categories WHERE organisation_id=oid AND user_id=uid)
 THEN RAISE EXCEPTION 'Procurement version conflict' USING ERRCODE='PT409';END IF;
 DELETE FROM profitia_profile.user_procurement_categories WHERE organisation_id=oid AND user_id=uid;
 FOR c IN SELECT value FROM jsonb_array_elements(p_categories) LOOP
  IF jsonb_typeof(c)<>'object' OR(SELECT count(*) FROM jsonb_object_keys(c))<>4 OR NOT(c?'catalogueId' AND c?'label' AND c?'key' AND c?'source')
   OR c->>'source' IS DISTINCT FROM 'USER' OR jsonb_typeof(c->'label') IS DISTINCT FROM 'string' OR length(c->>'label') NOT BETWEEN 1 AND 100
   OR c->>'label'~'[[:cntrl:]]' OR jsonb_typeof(c->'key') IS DISTINCT FROM 'string' OR length(c->>'key') NOT BETWEEN 1 AND 100
   OR jsonb_typeof(c->'catalogueId') NOT IN('string','null') THEN RAISE EXCEPTION 'Invalid category' USING ERRCODE='PT403';END IF;
  INSERT INTO profitia_profile.organisation_categories(organisation_id,category_key,label,catalogue_id,created_by,source)
   VALUES(oid,c->>'key',c->>'label',c->>'catalogueId',uid,'USER') ON CONFLICT(organisation_id,category_key)
   DO UPDATE SET category_key=excluded.category_key RETURNING category_id INTO cid;
  INSERT INTO profitia_profile.user_procurement_categories VALUES(oid,uid,cid) ON CONFLICT DO NOTHING;
 END LOOP;
 UPDATE profitia_profile.organisation_procurement_versions SET version=CASE WHEN p_expected=0 THEN 1 ELSE version+1 END WHERE organisation_id=oid AND user_id=uid RETURNING version INTO v;
 RETURN jsonb_build_object('version',v::text);
END $fn$;
-- No grants here. Controlled installation must record the exact digest and
-- separately enrol only the intended Development runtime policy/functions.

CREATE FUNCTION profitia_profile.organisation_lifecycle_commit(p_operation text,p_payload text,p_until bigint,p_signature text,p_decision uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid;dg text;
BEGIN
 uid:=profitia_profile.organisation_lifecycle_require(p_operation,p_decision);
 IF p_payload IS NULL OR octet_length(p_payload)>131072 THEN RAISE EXCEPTION 'Bounded payload required' USING ERRCODE='PT403';END IF;
 dg:=encode(public.digest(convert_to(p_payload,'UTF8'),'sha256'),'hex');
 IF profitia_profile.valid_attestation(p_operation||'.commit',uid::text,dg,p_until,0,p_signature) IS NOT TRUE
 THEN RAISE EXCEPTION 'Bound server payload required' USING ERRCODE='PT403';END IF;
 RETURN uid;
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_inviter(p_org uuid,p_user uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;
BEGIN
 d:=profitia_profile.runtime_descriptor();PERFORM profitia_profile.organisation_lifecycle_descriptor();
 RETURN EXISTS(SELECT 1 FROM profitia_access.memberships m JOIN profitia_access.organisations o USING(organisation_id)
  JOIN profitia_access.accounts a ON a.user_id=m.user_id WHERE m.organisation_id=p_org AND m.user_id=p_user
  AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND o.status='ACTIVE' AND a.status='ACTIVE')
 AND EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND user_id=p_user
  AND effect='ALLOW' AND operation='organisation.invitation.create' AND feature='organisation_admin'
  AND(resource_id IS NULL OR resource_id='current-organisation-invitation-create'))
 AND NOT EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND user_id=p_user
  AND effect='DENY' AND operation='organisation.invitation.create' AND feature='organisation_admin'
  AND(resource_id IS NULL OR resource_id='current-organisation-invitation-create'));
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_enqueue(p_payload text,p_until bigint,p_signature text,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE uid uuid;oid uuid;d jsonb;q jsonb;e jsonb;receipt jsonb;items jsonb:='[]'::jsonb;seen text[]:=ARRAY[]::text[];
 b profitia_profile.organisation_invitation_batches%ROWTYPE;candidate uuid;m profitia_access.memberships%ROWTYPE;s text;created timestamptz;expiry timestamptz;
BEGIN
 uid:=profitia_profile.organisation_lifecycle_commit('organisation.invitation.create',p_payload,p_until,p_signature,p_decision);
 oid:=nullif(current_setting('profitia.lifecycle.organisation',true),'')::uuid;d:=profitia_profile.runtime_descriptor();q:=p_payload::jsonb;
 IF profitia_profile.organisation_lifecycle_inviter(oid,uid) IS NOT TRUE OR jsonb_typeof(q) IS DISTINCT FROM 'object'
  OR(SELECT count(*) FROM jsonb_object_keys(q))<>2 OR NOT(q?'commandId' AND q?'items')
  OR jsonb_typeof(q->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(q->'items') NOT BETWEEN 1 AND 20
 THEN RAISE EXCEPTION 'Current explicit invitation permission required' USING ERRCODE='PT403';END IF;
 -- One per-organisation advisory lock serialises email deduplication and command
 -- replay, while the normal authority fence protects current rights.
 PERFORM pg_advisory_xact_lock(hashtextextended('organisation-invitations:'||oid::text,0));
 SELECT * INTO b FROM profitia_profile.organisation_invitation_batches WHERE organisation_id=oid AND user_id=uid AND command_id=(q->>'commandId')::uuid;
 IF FOUND THEN
  IF b.payload_digest IS DISTINCT FROM current_setting('profitia.lifecycle.digest',true) THEN RAISE EXCEPTION 'Invitation command conflict' USING ERRCODE='PT409';END IF;
  RETURN b.receipt;
 END IF;
 UPDATE profitia_profile.organisation_invitations SET status='EXPIRED' WHERE organisation_id=oid AND status='PENDING' AND expires_at<=clock_timestamp();
 FOR e IN SELECT value FROM jsonb_array_elements(q->'items') LOOP
  IF jsonb_typeof(e) IS DISTINCT FROM 'object' OR(e->>'index')!~'^[0-9]{1,2}$'
   OR(e->>'index')::integer<>jsonb_array_length(items) OR NOT(e?'recipientKey' AND e?'subject' AND e?'delivery')
  THEN RAISE EXCEPTION 'Ordered server invitation items required' USING ERRCODE='PT403';END IF;
  s:='ENQUEUED';candidate:=NULL;m:=NULL;
  IF e->'recipientKey'='null'::jsonb THEN s:='INVALID_EMAIL';
  ELSIF e->>'recipientKey'!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Private recipient index required' USING ERRCODE='PT403';
  ELSIF e->>'recipientKey'=ANY(seen) THEN s:='DUPLICATE';
  ELSE
   seen:=array_append(seen,e->>'recipientKey');
   -- Subject is an exact verified-primary-email match supplied by the official
   -- Clerk lookup, never a partial search hit or a browser-supplied user ID.
   IF e->'subject'<>'null'::jsonb THEN
    SELECT user_id INTO candidate FROM profitia_access.external_identities WHERE issuer=d->>'issuer' AND subject=e->>'subject';
   END IF;
   IF candidate=uid THEN s:='SELF';
   ELSIF candidate IS NOT NULL THEN
    SELECT * INTO m FROM profitia_access.memberships WHERE organisation_id=oid AND user_id=candidate;
    IF FOUND THEN s:=CASE WHEN m.status='ACTIVE' AND m.expires_at>clock_timestamp() THEN 'ALREADY_MEMBER' ELSE 'MEMBERSHIP_REQUIRES_REVIEW' END;END IF;
   END IF;
   IF s='ENQUEUED' AND EXISTS(SELECT 1 FROM profitia_profile.organisation_invitations WHERE organisation_id=oid AND recipient_key=e->>'recipientKey' AND status='PENDING') THEN s:='ALREADY_INVITED';END IF;
  END IF;
  IF s='ENQUEUED' THEN
   IF jsonb_typeof(e->'delivery') IS DISTINCT FROM 'object' OR(e->'delivery'->>'tokenHash')!~'^[a-f0-9]{64}$'
    OR jsonb_typeof(e->'delivery'->'encryptedPayload') IS DISTINCT FROM 'object'
   THEN RAISE EXCEPTION 'Encrypted delivery required' USING ERRCODE='PT403';END IF;
   created:=(e->'delivery'->>'createdAt')::timestamptz;expiry:=(e->'delivery'->>'expiresAt')::timestamptz;
   IF NOT isfinite(created) OR NOT isfinite(expiry) OR created>clock_timestamp() OR created<clock_timestamp()-interval '1 minute'
    OR expiry-created<>interval '7 days' THEN RAISE EXCEPTION 'Seven-day invitation required' USING ERRCODE='PT403';END IF;
   INSERT INTO profitia_profile.organisation_invitations(invitation_id,organisation_id,inviter_user_id,recipient_key,token_hash,created_at,expires_at)
    VALUES((e->'delivery'->>'invitationId')::uuid,oid,uid,e->>'recipientKey',e->'delivery'->>'tokenHash',created,expiry);
   INSERT INTO profitia_profile.organisation_invitation_outbox(invitation_id,encrypted_payload)
    VALUES((e->'delivery'->>'invitationId')::uuid,e->'delivery'->'encryptedPayload');
  END IF;
  items:=items||jsonb_build_array(jsonb_build_object('index',(e->>'index')::integer,'status',s));
 END LOOP;
 receipt:=jsonb_build_object('items',items);
 INSERT INTO profitia_profile.organisation_invitation_batches VALUES(oid,uid,(q->>'commandId')::uuid,current_setting('profitia.lifecycle.digest',true),receipt);
 RETURN receipt;
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_accept(p_payload text,p_until bigint,p_signature text,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE uid uuid;d jsonb;q jsonb;i profitia_profile.organisation_invitations%ROWTYPE;m profitia_access.memberships%ROWTYPE;
 p profitia_profile.organisation_lifecycle_policies%ROWTYPE;e jsonb;result jsonb;
BEGIN
 uid:=profitia_profile.organisation_lifecycle_commit('organisation.invitation.accept',p_payload,p_until,p_signature,p_decision);
 d:=profitia_profile.runtime_descriptor();q:=p_payload::jsonb;
 IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR(SELECT count(*) FROM jsonb_object_keys(q))<>3
  OR NOT(q?'commandId' AND q?'tokenHash' AND q?'recipientKeys') OR q->>'tokenHash'!~'^[a-f0-9]{64}$'
  OR jsonb_typeof(q->'recipientKeys') IS DISTINCT FROM 'array' OR jsonb_array_length(q->'recipientKeys') NOT BETWEEN 1 AND 20
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(q->'recipientKeys') k WHERE k!~'^[a-f0-9]{64}$')
 THEN RAISE EXCEPTION 'Verified proof and primary email required' USING ERRCODE='PT403';END IF;
 SELECT * INTO i FROM profitia_profile.organisation_invitations WHERE token_hash=q->>'tokenHash' FOR UPDATE;
 IF NOT FOUND OR NOT(q->'recipientKeys'?i.recipient_key) THEN RETURN jsonb_build_object('status','INVITATION_UNAVAILABLE');END IF;
 IF i.status='ACCEPTED' AND i.accepted_by=uid THEN
  SELECT * INTO m FROM profitia_access.memberships WHERE organisation_id=i.organisation_id AND user_id=uid;
  IF FOUND AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() THEN
   INSERT INTO profitia_profile.organisation_user_context VALUES(uid,i.organisation_id) ON CONFLICT(user_id) DO UPDATE SET organisation_id=excluded.organisation_id;
   RETURN jsonb_build_object('status','ACCEPTED');
  END IF;
  RETURN jsonb_build_object('status','MEMBERSHIP_REQUIRES_REVIEW');
 END IF;
 IF i.status<>'PENDING' OR i.expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('status','INVITATION_UNAVAILABLE');END IF;
 IF profitia_profile.organisation_lifecycle_inviter(i.organisation_id,i.inviter_user_id) IS NOT TRUE THEN RETURN jsonb_build_object('status','INVITATION_UNAVAILABLE');END IF;
 SELECT * INTO m FROM profitia_access.memberships WHERE organisation_id=i.organisation_id AND user_id=uid;
 IF FOUND THEN
  IF m.status<>'ACTIVE' OR m.expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('status','MEMBERSHIP_REQUIRES_REVIEW');END IF;
  result:=jsonb_build_object('status','ALREADY_MEMBER');
 ELSE
  SELECT * INTO p FROM profitia_profile.organisation_lifecycle_policies WHERE login_role=session_user;
  INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at)
   VALUES(i.organisation_id,uid,'ACTIVE',p.source_ref||':invitation:'||i.invitation_id::text,p.membership_expires_at);
  INSERT INTO profitia_profile.organisation_member_profiles VALUES(i.organisation_id,uid,'MEMBER');
  FOR e IN SELECT value FROM jsonb_array_elements(p.member_permissions) LOOP
   INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id)
    VALUES(gen_random_uuid(),d->>'applicationId',i.organisation_id,uid,'ALLOW',e->>'operation',e->>'feature',NULL) ON CONFLICT DO NOTHING;
  END LOOP;
  result:=jsonb_build_object('status','ACCEPTED');
 END IF;
 UPDATE profitia_profile.organisation_invitations SET status='ACCEPTED',accepted_by=uid,accepted_at=clock_timestamp() WHERE invitation_id=i.invitation_id;
 UPDATE profitia_profile.organisation_invitation_outbox SET status='CANCELLED',encrypted_payload='{}'::jsonb,updated_at=clock_timestamp()
  WHERE invitation_id=i.invitation_id AND status IN('PENDING','CLAIMED');
 INSERT INTO profitia_profile.organisation_user_context VALUES(uid,i.organisation_id) ON CONFLICT(user_id) DO UPDATE SET organisation_id=excluded.organisation_id;
 -- Same exclusive fence was acquired before lock_access. Only rights created by
 -- this transaction advance its revision; identity and policy expiries stay fixed.
 PERFORM set_config('profitia.policy_version','access-v1:'||(SELECT revision::text FROM profitia_access.installation WHERE singleton),true);
 RETURN result;
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_delivery_claim(p_lease uuid,p_nonce text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE r record;result jsonb;
BEGIN
 PERFORM profitia_profile.organisation_lifecycle_descriptor();
 IF p_lease IS NULL OR p_nonce!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Bound delivery lease required' USING ERRCODE='PT403';END IF;
 UPDATE profitia_profile.organisation_invitation_outbox SET status='UNKNOWN',encrypted_payload='{}'::jsonb,updated_at=clock_timestamp()
  WHERE status='SENDING' AND lease_until<=clock_timestamp();
 UPDATE profitia_profile.organisation_invitation_outbox SET status='PENDING',lease_id=NULL,lease_until=NULL,nonce=NULL,updated_at=clock_timestamp()
  WHERE status='CLAIMED' AND lease_until<=clock_timestamp();
 SELECT o.*,i.organisation_id,i.inviter_user_id,i.recipient_key,i.token_hash,i.created_at,i.expires_at
  INTO r FROM profitia_profile.organisation_invitation_outbox o JOIN profitia_profile.organisation_invitations i USING(invitation_id)
  WHERE o.status='PENDING' AND i.status='PENDING' AND i.expires_at>clock_timestamp()
  ORDER BY i.created_at,i.invitation_id FOR UPDATE OF o SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF profitia_profile.organisation_lifecycle_inviter(r.organisation_id,r.inviter_user_id) IS NOT TRUE THEN
  UPDATE profitia_profile.organisation_invitation_outbox SET status='CANCELLED',encrypted_payload='{}'::jsonb WHERE invitation_id=r.invitation_id;
  RETURN NULL;
 END IF;
 UPDATE profitia_profile.organisation_invitation_outbox SET status='CLAIMED',lease_id=p_lease,nonce=p_nonce,lease_until=clock_timestamp()+interval '30 seconds',updated_at=clock_timestamp() WHERE invitation_id=r.invitation_id;
 SELECT jsonb_build_object('invitationId',r.invitation_id,'organisationId',r.organisation_id,'inviterUserId',r.inviter_user_id,
  'recipientKey',r.recipient_key,'tokenHash',r.token_hash,'createdAt',r.created_at,'expiresAt',r.expires_at,
  'encryptedPayload',r.encrypted_payload,'leaseId',p_lease,'nonce',p_nonce,
  'identity',(SELECT jsonb_build_object('issuer',e.issuer,'subject',e.subject,'environment',d->>'environment')
   FROM profitia_access.external_identities e CROSS JOIN LATERAL profitia_profile.runtime_descriptor() d
   WHERE e.user_id=r.inviter_user_id AND e.status='ACTIVE' ORDER BY e.version DESC,e.subject LIMIT 1))
 INTO result;
 RETURN result;
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_delivery_begin(p_invitation uuid,p_lease uuid,p_nonce text,p_message_digest text,p_until bigint,p_signature text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE r record;
BEGIN
 PERFORM profitia_profile.organisation_lifecycle_descriptor();PERFORM revision FROM profitia_access.installation WHERE singleton FOR SHARE;
 SELECT o.*,i.organisation_id,i.inviter_user_id,i.status AS invitation_status,i.expires_at INTO r
  FROM profitia_profile.organisation_invitation_outbox o JOIN profitia_profile.organisation_invitations i USING(invitation_id)
  WHERE o.invitation_id=p_invitation FOR UPDATE OF o;
 IF NOT FOUND OR r.status<>'CLAIMED' OR r.lease_id<>p_lease OR r.nonce IS DISTINCT FROM p_nonce OR r.lease_until<=clock_timestamp()
  OR r.invitation_status<>'PENDING' OR r.expires_at<=clock_timestamp() OR p_message_digest!~'^[a-f0-9]{64}$'
  OR profitia_profile.organisation_lifecycle_inviter(r.organisation_id,r.inviter_user_id) IS NOT TRUE
  OR profitia_profile.valid_attestation('organisation.invitation.delivery',p_invitation::text,p_lease::text||':'||p_nonce||':'||p_message_digest,p_until,0,p_signature) IS NOT TRUE
 THEN RETURN false;END IF;
 UPDATE profitia_profile.organisation_invitation_outbox SET status='SENDING',updated_at=clock_timestamp() WHERE invitation_id=p_invitation;
 RETURN true;
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_delivery_settle(p_invitation uuid,p_lease uuid,p_nonce text,p_status text,p_provider text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE actual text;
BEGIN
 PERFORM profitia_profile.organisation_lifecycle_descriptor();
 IF p_status NOT IN('RELEASE','ACCEPTED','REJECTED','UNKNOWN','CANCELLED') OR(p_provider IS NOT NULL AND p_provider!~'^<[A-Za-z0-9_.@+-]+>$')
 THEN RAISE EXCEPTION 'Bound delivery result required' USING ERRCODE='PT403';END IF;
 SELECT status INTO actual FROM profitia_profile.organisation_invitation_outbox WHERE invitation_id=p_invitation
  AND lease_id=p_lease AND nonce=p_nonce FOR UPDATE;
 IF NOT FOUND OR actual NOT IN('CLAIMED','SENDING') OR actual='SENDING' AND p_status='RELEASE' OR actual='CLAIMED' AND p_status='ACCEPTED' THEN RETURN false;END IF;
 UPDATE profitia_profile.organisation_invitation_outbox SET status=CASE WHEN p_status='RELEASE' THEN 'PENDING' ELSE p_status END,
  encrypted_payload=CASE WHEN p_status='RELEASE' THEN encrypted_payload ELSE '{}'::jsonb END,
  provider_id=p_provider,lease_id=NULL,lease_until=NULL,nonce=NULL,updated_at=clock_timestamp() WHERE invitation_id=p_invitation;
 IF p_status IN('REJECTED','CANCELLED') THEN UPDATE profitia_profile.organisation_invitations SET status='CANCELLED' WHERE invitation_id=p_invitation AND status='PENDING';END IF;
 RETURN true;
END $fn$;

CREATE FUNCTION profitia_profile.organisation_lifecycle_snapshot(p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid;draft jsonb;
BEGIN
 uid:=profitia_profile.organisation_lifecycle_require('organisation.onboarding.read',p_decision);
 SELECT jsonb_build_object('version',version::text,'answers',answers) INTO draft FROM profitia_profile.organisation_onboarding_drafts WHERE user_id=uid;
 RETURN coalesce(draft,jsonb_build_object('version','0','answers','{}'::jsonb));
END $fn$;
-- Basic public-company projection only. It does not acquire a source, reveal
-- another organisation or read its archives; policy/freshness still apply.
CREATE FUNCTION profitia_profile.organisation_lifecycle_stored_company(p_nip text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE p jsonb;result jsonb;
BEGIN
 p:=profitia_profile.organisation_lifecycle_descriptor();
 IF p_nip IS NULL OR p_nip!~'^[0-9]{10}$' THEN RAISE EXCEPTION 'Invalid identifier' USING ERRCODE='PT403';END IF;
 SELECT jsonb_build_object('company',company,'sourceRef',source_ref,'version',version) INTO result
 FROM profitia_profile.organisation_company_snapshots WHERE nip=p_nip AND valid_until>clock_timestamp() AND source_policy_ref=p->>'sourcePolicyRef'
 ORDER BY retrieved_at DESC,version DESC LIMIT 1;
 RETURN result;
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_recipient_salutation(p_subject text,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE uid uuid;result jsonb;d jsonb;
BEGIN
 uid:=profitia_profile.organisation_lifecycle_require('organisation.invitation.create',p_decision);
 d:=profitia_profile.runtime_descriptor();
 IF profitia_profile.organisation_lifecycle_inviter(nullif(current_setting('profitia.lifecycle.organisation',true),'')::uuid,uid) IS NOT TRUE
 THEN RAISE EXCEPTION 'Invitation recipient scope required' USING ERRCODE='PT403';END IF;
 -- This internal mail-only projection is never returned by the HTTP batch API.
 SELECT jsonb_build_object('firstName',to_jsonb(p)->>'first_name','vocative',to_jsonb(p)->>'name_vocative','dictionaryVersion',to_jsonb(p)->>'name_dictionary_version')
 INTO result FROM profitia_profile.user_profiles p JOIN profitia_access.external_identities e USING(user_id)
 WHERE e.issuer=d->>'issuer' AND e.subject=p_subject;
 RETURN result;
END $fn$;

CREATE FUNCTION profitia_profile.organisation_lifecycle_lookup_draft(p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid;draft jsonb;
BEGIN
 uid:=profitia_profile.organisation_lifecycle_require('organisation.company.lookup',p_decision);
 SELECT jsonb_build_object('version',version::text,'answers',answers,'organisationExists',
  EXISTS(SELECT 1 FROM profitia_profile.organisation_profiles p WHERE p.country='PL' AND p.nip=d.answers->>'nip'))
 INTO draft FROM profitia_profile.organisation_onboarding_drafts d WHERE user_id=uid;
 RETURN draft;
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_company_store(p_payload text,p_until bigint,p_signature text,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid;q jsonb;co jsonb;p jsonb;retrieved timestamptz;until_ts timestamptz;selected_nip text;draft_nip text;
BEGIN
 uid:=profitia_profile.organisation_lifecycle_commit('organisation.company.lookup',p_payload,p_until,p_signature,p_decision);
 p:=profitia_profile.organisation_lifecycle_descriptor();q:=p_payload::jsonb;co:=q->'company';
 IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR(SELECT count(*) FROM jsonb_object_keys(q))<>6
  OR NOT(q?'company' AND q?'sourceRef' AND q?'version' AND q?'sourcePolicyRef' AND q?'retrievedAt' AND q?'validUntil')
  OR p->>'sourcePolicyRef' IS NULL OR q->>'sourcePolicyRef' IS DISTINCT FROM p->>'sourcePolicyRef'
  OR jsonb_typeof(q->'sourceRef') IS DISTINCT FROM 'string' OR length(q->>'sourceRef') NOT BETWEEN 1 AND 256 OR q->>'sourceRef'~'[[:cntrl:]]'
  OR jsonb_typeof(q->'version') IS DISTINCT FROM 'string' OR length(q->>'version') NOT BETWEEN 1 AND 256 OR q->>'version'~'[[:cntrl:]]'
  OR jsonb_typeof(co) IS DISTINCT FROM 'object' OR(SELECT count(*) FROM jsonb_object_keys(co))<>8
  OR NOT(co?'entityType' AND co?'country' AND co?'nip' AND co?'krs' AND co?'regon' AND co?'legalName' AND co?'address' AND co?'postalCode')
  OR co->>'entityType' IS DISTINCT FROM 'COMPANY' OR co->>'country' IS DISTINCT FROM 'PL'
  OR co->>'nip'!~'^[0-9]{10}$' OR co->>'krs'!~'^[0-9]{10}$' OR co->>'krs'='0000000000'
  OR co->>'regon'!~'^([0-9]{9}|[0-9]{14})$' OR co->>'postalCode'!~'^[0-9]{2}-[0-9]{3}$'
  OR jsonb_typeof(co->'legalName') IS DISTINCT FROM 'string' OR length(co->>'legalName') NOT BETWEEN 1 AND 300
  OR jsonb_typeof(co->'address') IS DISTINCT FROM 'string' OR length(co->>'address') NOT BETWEEN 1 AND 500
 THEN RAISE EXCEPTION 'Governed minimal company snapshot required' USING ERRCODE='PT403';END IF;
 retrieved:=(q->>'retrievedAt')::timestamptz;until_ts:=(q->>'validUntil')::timestamptz;selected_nip:=co->>'nip';
 SELECT answers->>'nip' INTO draft_nip FROM profitia_profile.organisation_onboarding_drafts WHERE user_id=uid;
 IF draft_nip IS DISTINCT FROM selected_nip OR NOT isfinite(retrieved) OR NOT isfinite(until_ts) OR retrieved>clock_timestamp()
  OR until_ts<=clock_timestamp() OR until_ts-retrieved>interval '7 days'
 THEN RAISE EXCEPTION 'Current licensed source selection required' USING ERRCODE='PT403';END IF;
 INSERT INTO profitia_profile.organisation_company_snapshots(nip,source_ref,version,company,source_policy_ref,retrieved_at,valid_until)
 VALUES(selected_nip,q->>'sourceRef',q->>'version',co,q->>'sourcePolicyRef',retrieved,until_ts)
 ON CONFLICT(nip,source_ref,version) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM profitia_profile.organisation_company_snapshots c WHERE c.nip=selected_nip AND c.source_ref=q->>'sourceRef' AND c.version=q->>'version'
  AND c.company=co AND c.source_policy_ref=q->>'sourcePolicyRef' AND c.retrieved_at=retrieved AND c.valid_until=until_ts)
 THEN RAISE EXCEPTION 'Immutable source snapshot conflict' USING ERRCODE='PT409';END IF;
 RETURN jsonb_build_object('stored',true);
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_invitation_replay(p_command uuid,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid;oid uuid;r profitia_profile.organisation_invitation_batches%ROWTYPE;
BEGIN
 uid:=profitia_profile.organisation_lifecycle_require('organisation.invitation.create',p_decision);
 oid:=nullif(current_setting('profitia.lifecycle.organisation',true),'')::uuid;
 SELECT * INTO r FROM profitia_profile.organisation_invitation_batches WHERE organisation_id=oid AND user_id=uid AND command_id=p_command;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF r.payload_digest IS DISTINCT FROM current_setting('profitia.lifecycle.digest',true) THEN RAISE EXCEPTION 'Invitation command conflict' USING ERRCODE='PT409';END IF;
 RETURN r.receipt;
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_recipient_salutations(p_subjects text[],p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE uid uuid;d jsonb;result jsonb;
BEGIN
 uid:=profitia_profile.organisation_lifecycle_require('organisation.invitation.create',p_decision);d:=profitia_profile.runtime_descriptor();
 IF p_subjects IS NULL OR cardinality(p_subjects)>20
  OR profitia_profile.organisation_lifecycle_inviter(nullif(current_setting('profitia.lifecycle.organisation',true),'')::uuid,uid) IS NOT TRUE
 THEN RAISE EXCEPTION 'Bound recipient salutation batch required' USING ERRCODE='PT403';END IF;
 SELECT coalesce(jsonb_object_agg(e.subject,jsonb_build_object('firstName',to_jsonb(p)->>'first_name','vocative',to_jsonb(p)->>'name_vocative',
  'dictionaryVersion',to_jsonb(p)->>'name_dictionary_version')),'{}'::jsonb)
 INTO result FROM profitia_profile.user_profiles p JOIN profitia_access.external_identities e USING(user_id)
 WHERE e.issuer=d->>'issuer' AND e.subject=ANY(p_subjects);
 RETURN result;
END $fn$;

-- Licensed basic-company envelope for the separately admitted native registry receiver.
-- It carries no private archive and is available only under actual current Root lookup intent.
CREATE FUNCTION profitia_profile.organisation_lifecycle_company_envelope(p_nip text,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid;p organisation_lifecycle_policies%ROWTYPE;
BEGIN
 uid:=organisation_lifecycle_require('organisation.company.lookup',p_decision);
 SELECT * INTO p FROM organisation_lifecycle_policies WHERE login_role=session_user AND enabled;
 IF NOT FOUND OR p_nip!~'^[0-9]{10}$' THEN RAISE EXCEPTION 'Current company scope required' USING ERRCODE='PT403';END IF;
 IF NOT EXISTS(SELECT 1 FROM organisation_onboarding_drafts WHERE user_id=uid AND answers->>'nip'=p_nip)
 THEN RAISE EXCEPTION 'Own current company draft required' USING ERRCODE='PT403';END IF;
 RETURN(SELECT jsonb_build_object('company',company,'sourceRef',source_ref,'version',version,'sourcePolicyRef',source_policy_ref,
  'retrievedAt',retrieved_at,'validUntil',valid_until) FROM organisation_company_snapshots
  WHERE nip=p_nip AND source_policy_ref=p.source_policy_ref AND valid_until>clock_timestamp()
  ORDER BY retrieved_at DESC,source_ref,version LIMIT 1);
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.organisation_lifecycle_company_envelope(text,uuid) FROM PUBLIC;
