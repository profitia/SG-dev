-- Structural allowance for an exact, separately owner-admitted ECR scope.
-- Existing rights stay unchanged; no licence, grant or retention is activated.
DO $guard$ BEGIN
 IF current_user<>'source_hub_development_owner' OR to_regclass('source_hub.result_consumer_storage') IS NULL
 THEN RAISE EXCEPTION 'SourceHub owner and accepted result storage predecessor required';END IF;
END $guard$;
DO $scopes$ DECLARE t text;c record;n integer;BEGIN
 FOREACH t IN ARRAY ARRAY['result_consumer_storage','result_consumer_storage_history'] LOOP
  n:=0;
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid=format('source_hub.%I',t)::regclass AND contype='c' AND(conname LIKE '%dataset_id_check' OR conname LIKE '%series_ids_check') LOOP
   EXECUTE format('ALTER TABLE source_hub.%I DROP CONSTRAINT %I',t,c.conname);n:=n+1;
  END LOOP;
  IF n<>2 THEN RAISE EXCEPTION 'Reconcile exact existing ECR scope constraints';END IF;
  EXECUTE format($sql$ALTER TABLE source_hub.%I ADD CONSTRAINT expanded_dataset_check CHECK(dataset_id IN('petroleum/stoc/wstk','petroleum/sum/sndw','petroleum/pri/gnd','petroleum/pri/wfr'))$sql$,t);
  EXECUTE format($sql$ALTER TABLE source_hub.%I ADD CONSTRAINT expanded_series_check CHECK(cardinality(series_ids)>0 AND CASE dataset_id
   WHEN 'petroleum/stoc/wstk' THEN series_ids<@ARRAY['WCESTUS1','WGTSTUS1','WDISTUS1','WKJSTUS1','WPRSTUS1','W_EPOOXE_SAE_NUS_MBBL']
   WHEN 'petroleum/sum/sndw' THEN series_ids<@ARRAY['WCRFPUS2','WCRRIUS2','WPULEUS3']
   WHEN 'petroleum/pri/gnd' THEN series_ids<@ARRAY['EMM_EPMR_PTE_NUS_DPG','EMD_EPD2D_PTE_NUS_DPG']
   WHEN 'petroleum/pri/wfr' THEN series_ids<@ARRAY['W_EPD2F_PRS_NUS_DPG','W_EPD2F_PWR_NUS_DPG','W_EPLLPA_PRS_NUS_DPG','W_EPLLPA_PWR_NUS_DPG']
   ELSE false END)$sql$,t);
 END LOOP;
END $scopes$;
