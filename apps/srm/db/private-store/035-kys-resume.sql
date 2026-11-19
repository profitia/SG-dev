-- Optional KYS continuation adoption after SQL034. No new role, grant or access purpose.
-- Install only in the verified private SRM store, in one controlled transaction.
-- Provider identifiers are continuation metadata, never report content.
ALTER TABLE srm.catalog_kys_reports
 ADD COLUMN provider_correlation_id text CHECK(provider_correlation_id IS NULL OR provider_correlation_id ~ '^[A-Za-z0-9_-]{8,100}$'),
 ADD COLUMN resume_until timestamptz CHECK(resume_until IS NULL OR isfinite(resume_until));
ALTER TABLE srm.catalog_kys_reports ADD CONSTRAINT kys_resume_requires_order
 CHECK(resume_until IS NULL OR (provider_correlation_id IS NOT NULL AND lease_owner IS NOT NULL AND lease_until='infinity'::timestamptz));

-- Replace only the KYS cache branch of the exact accepted guard. Preserve the
-- installed version's remaining JDG/private acquisition rules byte for byte.
DO $kys_resume$
DECLARE definition text; original text; start_at integer; end_at integer;
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO original,definition FROM pg_proc
  WHERE oid='srm.guard_sensitive_supplier_write(text,text,jsonb,jsonb)'::regprocedure;
 IF md5(original) NOT IN ('1e8bce5fad3e4e1d6feac5de4596fc3f','292e772752029a76bd0f12a6d6fcf4e6') THEN
  RAISE EXCEPTION 'Accepted sensitive guard source required'; END IF;
 start_at:=strpos(definition,' IF p_table=''catalog_kys_reports'' THEN');
 end_at:=strpos(substr(definition,start_at),' IF p_op=''DELETE'' THEN')+start_at-1;
 IF start_at<1 OR end_at<=start_at THEN RAISE EXCEPTION 'Sensitive cache branch not found'; END IF;
 definition:=substr(definition,1,start_at-1)||$cache_branch$
 IF p_table='catalog_kys_reports' THEN
  IF p_op='DELETE' OR srm.sensitive_cache_scope(org,v->>'nip',v->>'entity_type',(v->>'retrieved_at')::timestamptz,(v->>'retention_until')::timestamptz,'WRITE') IS NOT TRUE THEN RETURN false;END IF;
  IF p_op='UPDATE' AND (n-ARRAY['report_json','report_sha256','retrieved_at','retention_until','source_organization_id','source_snapshot_id','lease_owner','lease_until','updated_at','provider_correlation_id','resume_until'])
   IS DISTINCT FROM(o-ARRAY['report_json','report_sha256','retrieved_at','retention_until','source_organization_id','source_snapshot_id','lease_owner','lease_until','updated_at','provider_correlation_id','resume_until']) THEN RETURN false;END IF;
  IF u='SRM_KYS_CACHE_CLAIM' THEN
   IF p_op='UPDATE' AND o->>'lease_until'='infinity' AND o->>'provider_correlation_id' ~ '^[A-Za-z0-9_-]{8,100}$'
    AND(o->>'resume_until' IS NULL OR(o->>'resume_until')::timestamptz<=clock_timestamp()) THEN
    RETURN n->>'lease_owner' IS NOT NULL AND n->>'lease_owner' IS DISTINCT FROM o->>'lease_owner'
     AND isfinite((n->>'resume_until')::timestamptz) AND(n->>'resume_until')::timestamptz>clock_timestamp()
     AND(n->>'resume_until')::timestamptz<=clock_timestamp()+interval '5 minutes'
     AND(n-ARRAY['lease_owner','resume_until'])=(o-ARRAY['lease_owner','resume_until']);
   END IF;
   RETURN n->>'provider_correlation_id' IS NULL AND n->>'resume_until' IS NULL
    AND n->'report_json' IS NOT DISTINCT FROM coalesce(o->'report_json','null'::jsonb)
   AND n->>'lease_owner' IS NOT NULL AND (n->>'lease_until')::timestamptz>clock_timestamp()
   AND (n->>'lease_until')::timestamptz<=clock_timestamp()+interval '5 minutes'
   AND(p_op='INSERT' OR (n-ARRAY['lease_owner','lease_until','updated_at'])=(o-ARRAY['lease_owner','lease_until','updated_at']));
  ELSIF p_op<>'UPDATE' THEN RETURN false;
  ELSIF u='SRM_KYS_CACHE_SAVE' THEN RETURN o->>'lease_owner' IS NOT NULL AND (o->>'lease_until')::timestamptz>clock_timestamp()
   AND n->>'lease_owner' IS NULL AND n->>'lease_until' IS NULL
   AND n->>'provider_correlation_id' IS NULL AND n->>'resume_until' IS NULL AND n->>'source_organization_id'=org::text
   AND n->'report_json'->>'status'='SUCCESS' AND n->'report_json'->'source'->>'provider'='VERCLY'
   AND jsonb_typeof(n->'report_json'->'data'->'pepMatches')='array'
   AND(n->'report_json'->>'retrievedAt')::timestamptz=(n->>'retrieved_at')::timestamptz;
  ELSIF u='SRM_KYS_CACHE_HOLD' THEN RETURN o->>'lease_owner' IS NOT NULL AND n->>'lease_until'='infinity'
   AND(n-ARRAY['lease_until','provider_correlation_id','resume_until'])=(o-ARRAY['lease_until','provider_correlation_id','resume_until'])
   AND((n->>'provider_correlation_id' IS NOT DISTINCT FROM o->>'provider_correlation_id' AND n->>'resume_until' IS NULL)
    OR((o->>'provider_correlation_id' IS NULL OR n->>'provider_correlation_id'=o->>'provider_correlation_id') AND n->>'provider_correlation_id' ~ '^[A-Za-z0-9_-]{8,100}$'
     AND isfinite((n->>'resume_until')::timestamptz) AND(n->>'resume_until')::timestamptz>clock_timestamp()
     AND(n->>'resume_until')::timestamptz<=clock_timestamp()+interval '5 minutes'));
  ELSIF u='SRM_KYS_CACHE_RENEW' THEN RETURN o->>'lease_owner' IS NOT NULL AND (o->>'lease_until')::timestamptz>clock_timestamp()
   AND(n-'lease_until')=(o-'lease_until') AND((n->>'lease_until'='infinity' AND o->>'lease_until'='infinity')
    OR((n->>'lease_until')::timestamptz>clock_timestamp() AND(n->>'lease_until')::timestamptz<=clock_timestamp()+interval '5 minutes'));
  ELSIF u='SRM_KYS_CACHE_RELEASE' THEN RETURN o->>'provider_correlation_id' IS NULL AND n->>'lease_owner' IS NULL AND n->>'lease_until' IS NULL
   AND(n-ARRAY['lease_owner','lease_until'])=(o-ARRAY['lease_owner','lease_until']);
  ELSIF u='SRM_SENSITIVE_PURGE' THEN RETURN n->>'report_json' IS NULL AND n->>'report_sha256' IS NULL
   AND(n-ARRAY['report_json','report_sha256'])=(o-ARRAY['report_json','report_sha256']);END IF;
  RETURN false;
 END IF;
$cache_branch$||substr(definition,end_at);
 EXECUTE definition;
END $kys_resume$;
