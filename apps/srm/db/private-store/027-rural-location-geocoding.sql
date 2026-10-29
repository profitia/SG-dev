-- Optional main Development adoption. No schema/data/role or provider-policy reset.
-- The original MGBI text and Source evidence remain in every projection/history.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_location_installation WHERE singleton
   AND schema_digest='b3f05a4c56f32bd32c0c59dcc8b60c486d4d4813823665301ce08318f793704b') THEN
  RAISE EXCEPTION 'Exact controlled location installation required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM profitia_access.installation WHERE singleton AND environment='development' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Development installation required' USING ERRCODE='42501';END IF;
END $guard$;

DO $adopt$ DECLARE old_body text;definition text;needle text;replacement text;BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO old_body,definition FROM pg_proc
  WHERE oid='srm.location_sync_write(uuid,uuid,bigint,uuid,text,text,jsonb)'::regprocedure
   AND proowner='profitia_access_owner'::regrole AND prosecdef AND md5(prosrc)='57578f92d59197e8b677813e9ac872a1';
 IF old_body IS NULL THEN RAISE EXCEPTION 'Exact current location reconciliation required';END IF;
 needle:='  IF old.location_id IS NOT NULL AND old.address_version=row->>''addressVersion'' AND old.body->''coordinates''<>''null''::jsonb';
 IF position(needle in old_body)=0 THEN RAISE EXCEPTION 'Location uncertainty fence insertion point missing';END IF;
 replacement:=$patch$  -- A representation-only rural correction must never clear an uncertain send.
  -- Hold the existing row lock and preserve the original E1/Source admission.
  IF old.location_id IS NOT NULL AND old.address_version IS DISTINCT FROM row->>'addressVersion'
   AND old.body->>'geocodingStatus'='DELIVERY_UNCERTAIN'
   AND old.body->'address'->>'line1' ~ '^[0-9]{1,6}[a-zA-Z]?([/-][0-9]{1,6}[a-zA-Z]?)?(/[0-9a-zA-Z-]+)?$'
   AND row->'address'=jsonb_set(old.body->'address','{line1}',to_jsonb(concat(old.body->'address'->>'locality',' ',old.body->'address'->>'line1')))
   AND row->'originalAddress' IS NOT DISTINCT FROM old.body->'originalAddress' THEN
   v_body:=v_body||jsonb_build_object('geocodingStatus','DELIVERY_UNCERTAIN');
  END IF;
$patch$||needle;
 EXECUTE replace(definition,old_body,replace(old_body,needle,replacement));

 SELECT prosrc,pg_get_functiondef(oid) INTO old_body,definition FROM pg_proc
  WHERE oid='srm.location_installation_descriptor()'::regprocedure
   AND proowner='profitia_access_owner'::regrole AND prosecdef AND md5(prosrc)='2de9ffe414a087d3af6bb671eaa1c8a6';
 IF old_body IS NULL THEN RAISE EXCEPTION 'Exact current location descriptor required';END IF;
 needle:='''locationBusinessSourceRef'',i.source_ref);';
 IF position(needle in old_body)=0 THEN RAISE EXCEPTION 'Location descriptor insertion point missing';END IF;
 EXECUTE replace(definition,old_body,replace(old_body,needle,
  '''locationBusinessSourceRef'',i.source_ref,''ruralAddressNormalization'',''srm-polish-rural-address-v1'');'));
END $adopt$;
