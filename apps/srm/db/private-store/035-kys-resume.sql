-- Optional KYS continuation adoption after SQL034. No new role, grant or access purpose.
-- Install only in the verified private SRM store, in one controlled transaction.
-- Provider identifiers are continuation metadata, never report content.
ALTER TABLE srm.catalog_kys_reports
 ADD COLUMN provider_correlation_id text CHECK(provider_correlation_id IS NULL OR provider_correlation_id ~ '^[A-Za-z0-9_-]{8,100}$'),
 ADD COLUMN resume_until timestamptz CHECK(resume_until IS NULL OR isfinite(resume_until));
ALTER TABLE srm.catalog_kys_reports ADD CONSTRAINT kys_resume_requires_order
 CHECK(resume_until IS NULL OR (provider_correlation_id IS NOT NULL AND lease_owner IS NOT NULL AND lease_until='infinity'::timestamptz));

CREATE OR REPLACE FUNCTION srm.guard_sensitive_supplier_write(p_table text,p_op text,n jsonb,o jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;u text;v jsonb;org uuid;req uuid;sid uuid;section text;row_snapshot srm.source_snapshots%ROWTYPE;BEGIN
 v:=CASE WHEN p_op='DELETE' THEN o ELSE n END;
 IF v IS NULL OR p_op IS NULL OR p_op NOT IN('INSERT','UPDATE','DELETE') THEN RETURN false;END IF;
 org:=(v->>'organization_id')::uuid;d:=srm.current_supplier_work(org);
 IF d IS NULL OR d->>'sensitiveWork' IS DISTINCT FROM 'true' OR d->>'accessMode'<>'WRITE' THEN RETURN false;END IF;
 IF d->>'section' IS NOT NULL AND v->>'section' IS NOT NULL AND d->>'section' IS DISTINCT FROM v->>'section' THEN RETURN false;END IF;
 IF p_table IN('lookup_requests','catalog_kys_reports') AND d->>'entityType' IS NOT NULL AND d->>'entityType' IS DISTINCT FROM v->>'entity_type' THEN RETURN false;END IF;
 u:=d->>'unitId';req:=(d->>'requestId')::uuid;
 IF p_op='UPDATE' AND (n->>'organization_id') IS DISTINCT FROM (o->>'organization_id') THEN RETURN false;END IF;
 IF p_table='catalog_kys_reports' THEN
  IF p_op='DELETE' OR srm.sensitive_cache_scope(org,v->>'nip',v->>'entity_type',(v->>'retrieved_at')::timestamptz,(v->>'retention_until')::timestamptz,'WRITE') IS NOT TRUE THEN RETURN false;END IF;
  IF p_op='UPDATE' AND (n-ARRAY['report_json','report_sha256','retrieved_at','retention_until','source_organization_id','source_snapshot_id','lease_owner','lease_until','updated_at','provider_correlation_id','resume_until'])
   IS DISTINCT FROM(o-ARRAY['report_json','report_sha256','retrieved_at','retention_until','source_organization_id','source_snapshot_id','lease_owner','lease_until','updated_at']) THEN RETURN false;END IF;
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
 IF p_op='DELETE' THEN
  IF u<>'SRM_SENSITIVE_PURGE' THEN RETURN false;END IF;
  IF p_table='source_snapshots' THEN RETURN v->>'data_class' IN('KYS_PERSONAL','JDG_REGISTRY') AND(v->>'retention_until')::timestamptz<=clock_timestamp();
  ELSIF p_table='section_projections' THEN RETURN srm.sensitive_supplier_row(p_table,org,(v->>'id')::uuid,(v->>'snapshot_id')::uuid,(v->>'supplier_id')::uuid,NULL,v->>'section','DELETE');END IF;
  RETURN false;
 ELSIF p_table='suppliers' THEN RETURN u='SRM_SENSITIVE_REGISTER' AND n->>'nip'=d->>'nip'
  AND(p_op='INSERT' OR(n-'updated_at')=(o-'updated_at'));
 ELSIF p_table='lookup_requests' THEN RETURN p_op='INSERT' AND u='SRM_SENSITIVE_REGISTER' AND n->>'id'=req::text
  AND n->>'identifier_type'='NIP' AND n->>'identifier'=d->>'nip' AND n->>'entity_type' IN('COMPANY','JDG')
  AND EXISTS(SELECT 1 FROM srm.suppliers z WHERE z.organization_id=org AND z.id=(n->>'supplier_id')::uuid AND z.nip=d->>'nip');
 ELSIF p_table='provider_attempts' THEN RETURN srm.sensitive_supplier_row(p_table,org,(n->>'id')::uuid,(n->>'request_id')::uuid,NULL,NULL,n->>'section','WRITE')
  AND(p_op='INSERT' OR(n-ARRAY['status','completed_at','correlation_id','provider_record_id','error_code'])=(o-ARRAY['status','completed_at','correlation_id','provider_record_id','error_code']));
 END IF;
 IF p_op<>'INSERT' OR p_table NOT IN('source_snapshots','section_projections') THEN RETURN false;END IF;
 section:=n->>'section';IF section NOT IN('kys','jdg') THEN RETURN false;END IF;
 IF p_table='source_snapshots' THEN
  RETURN srm.sensitive_supplier_row(p_table,org,(n->>'id')::uuid,(n->>'attempt_id')::uuid,(n->>'supplier_id')::uuid,NULL,section,'WRITE')
   AND n->>'data_class'=CASE section WHEN 'kys' THEN 'KYS_PERSONAL' ELSE 'JDG_REGISTRY' END
   AND isfinite((n->>'retrieved_at')::timestamptz) AND isfinite((n->>'retention_until')::timestamptz)
   AND(n->>'retention_until')::timestamptz>(n->>'retrieved_at')::timestamptz
   AND(n->>'retention_until')::timestamptz<=(n->>'retrieved_at')::timestamptz+CASE section WHEN 'kys' THEN interval '7 days' ELSE interval '30 days' END;
 END IF;
 SELECT * INTO row_snapshot FROM srm.source_snapshots z WHERE z.organization_id=org AND z.id=(n->>'snapshot_id')::uuid AND z.supplier_id=(n->>'supplier_id')::uuid;
 IF NOT FOUND OR row_snapshot.section<>section OR jsonb_typeof(n->'private_envelope') IS DISTINCT FROM 'object' THEN RETURN false;END IF;
 RETURN srm.sensitive_supplier_row(p_table,org,(n->>'id')::uuid,(n->>'snapshot_id')::uuid,(n->>'supplier_id')::uuid,NULL,section,'WRITE')
  AND n->'private_envelope'->'data'=n->'data_json'
  AND n->'private_envelope'->'source'->>'provider'=CASE section WHEN 'kys' THEN 'VERCLY' ELSE 'CEIDG' END
  AND(n->'private_envelope'->'source'->>'recordId') IS NOT DISTINCT FROM row_snapshot.source_record_id
  AND(n->'private_envelope'->>'retrievedAt')::timestamptz=row_snapshot.retrieved_at;
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN RETURN false;
END $fn$;
