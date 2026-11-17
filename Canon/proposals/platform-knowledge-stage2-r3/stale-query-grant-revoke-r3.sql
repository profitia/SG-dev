-- PROPOSED, NOT EXECUTED. Requires this execution amendment plus all original release/CI gates.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SET LOCAL idle_in_transaction_session_timeout='60s';
DO $baseline$ DECLARE got jsonb; BEGIN
 IF session_user<>'neondb_owner' OR current_user<>'neondb_owner' OR current_database()<>'platform_private' THEN RAISE EXCEPTION 'EXECUTOR_BINDING_REJECTED'; END IF;
 SELECT jsonb_agg(jsonb_build_object('oid',m.oid::bigint,'grantor',g.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.oid) INTO got
 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member JOIN pg_roles g ON g.oid=m.grantor WHERE r.rolname='profitia_access_owner' AND u.rolname='neondb_owner';
 IF got IS DISTINCT FROM '[{"oid":24577,"grantor":"cloud_admin","admin":true,"inherit":false,"set":false},{"oid":139949,"grantor":"neondb_owner","admin":false,"inherit":false,"set":false}]'::jsonb OR pg_has_role(session_user,'profitia_access_owner','SET') THEN RAISE EXCEPTION 'OWNER_MEMBERSHIP_BASELINE_CHANGED'; END IF;
END $baseline$;
GRANT profitia_access_owner TO neondb_owner WITH SET TRUE GRANTED BY neondb_owner;
SET LOCAL ROLE profitia_access_owner;
-- PREPARED ONLY. Final exact release and owner GO must be bound before execution.
DO $probe$ DECLARE n integer; BEGIN
 IF current_user<>'profitia_access_owner' THEN RAISE EXCEPTION 'EXACT_AUTHORITY_OWNER_REQUIRED';END IF;
 SELECT count(*) INTO n FROM profitia_e1_authority.knowledge_grants
 WHERE grant_id='cd095168-466f-581e-a99c-95fbc0db6912'::uuid
 AND user_id='092c2d9f-a84b-4c18-b3d6-e172a61399b8'::uuid AND scope='PROFITIA_SHARED'
 AND operation='document.query' AND effect='ALLOW' AND use_purpose='PROFITIA_INTERNAL'
 AND NOT binding_standard AND status='ACTIVE' AND version=1
 AND source_ref='ARCH-PK-STAGE2-TECHNICAL-GO-20261117@8c1e7e3fe9bfd719cce462ac21377916e791f32a'
 AND expires_at='2026-12-11T23:59:00Z'::timestamptz;
 IF n<>1 THEN RAISE EXCEPTION 'EXACT_OWN_QUERY_GRANT_BASELINE_REQUIRED';END IF;
 SELECT count(*) INTO n FROM profitia_e1_authority.knowledge_grants
 WHERE user_id='092c2d9f-a84b-4c18-b3d6-e172a61399b8'::uuid AND scope='PROFITIA_SHARED'
 AND operation='document.query' AND effect='ALLOW' AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF n<>1 THEN RAISE EXCEPTION 'FOREIGN_OR_DUPLICATE_GRANT_MUST_REMAIN_UNTOUCHED';END IF;
 UPDATE profitia_e1_authority.knowledge_grants SET status='REVOKED',version=2
 WHERE grant_id='cd095168-466f-581e-a99c-95fbc0db6912'::uuid AND status='ACTIVE' AND version=1;
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'OWN_GRANT_COMPARE_AND_SET_FAILED';END IF;
END $probe$;
SET LOCAL ROLE NONE;
GRANT profitia_access_owner TO neondb_owner WITH SET FALSE GRANTED BY neondb_owner;
DO $baseline$ DECLARE got jsonb; BEGIN
 IF session_user<>'neondb_owner' OR current_user<>'neondb_owner' OR current_database()<>'platform_private' THEN RAISE EXCEPTION 'EXECUTOR_BINDING_REJECTED'; END IF;
 SELECT jsonb_agg(jsonb_build_object('oid',m.oid::bigint,'grantor',g.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.oid) INTO got
 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member JOIN pg_roles g ON g.oid=m.grantor WHERE r.rolname='profitia_access_owner' AND u.rolname='neondb_owner';
 IF got IS DISTINCT FROM '[{"oid":24577,"grantor":"cloud_admin","admin":true,"inherit":false,"set":false},{"oid":139949,"grantor":"neondb_owner","admin":false,"inherit":false,"set":false}]'::jsonb OR pg_has_role(session_user,'profitia_access_owner','SET') THEN RAISE EXCEPTION 'OWNER_MEMBERSHIP_BASELINE_CHANGED'; END IF;
END $baseline$;
COMMIT;
