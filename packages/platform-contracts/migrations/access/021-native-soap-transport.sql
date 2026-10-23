-- Additive SOAP wire admission over the existing Source engine. No grants,
-- budgets, active policies, credentials, counters or historical SQL are changed.
-- Run only as the accepted controlled owner in an explicitly approved database.
DO $soap$
DECLARE definition text;candidate text;
BEGIN
 IF current_user<>'profitia_ingestion_owner' THEN
  RAISE EXCEPTION 'Controlled Source owner required' USING ERRCODE='42501';
 END IF;
 SELECT pg_get_functiondef('profitia_external_native.valid_rules(jsonb)'::regprocedure) INTO definition;
 IF position('''NONE'',''JSON'',''FORM'',''SOAP''' IN definition)>0 THEN RETURN; END IF;
 IF position('''NONE'',''JSON'',''FORM''' IN definition)=0 THEN
  RAISE EXCEPTION 'Native request format policy drift' USING ERRCODE='42501';
 END IF;
 candidate:=replace(definition,'''NONE'',''JSON'',''FORM''','''NONE'',''JSON'',''FORM'',''SOAP''');
 -- Only add one enum value; all path rules, ACLs, ownership and policies survive.
 IF candidate=definition THEN RAISE EXCEPTION 'SOAP policy patch refused'; END IF;
 EXECUTE candidate;
END $soap$;
