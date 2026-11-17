-- Existing owner-issued invitation consumption uses a current READ proof.
-- Owner-only edits, acquisition, invitation creation and revocation keep WRITE.
-- No grant, schema ownership, provider admission or historic migration changes.
DO $guard$ BEGIN
 IF current_user<>'newsfeed_development_owner'
 OR NOT EXISTS(SELECT 1 FROM newsfeed.installation WHERE singleton AND environment='development'
  AND application_id='profitia-newsfeed-api-development' AND database_name=current_database() AND schema_version='1.0.0')
 OR NOT EXISTS(SELECT 1 FROM newsfeed.saved_search_migrations WHERE version='1.2.0' AND digest='d818a0868a57ea68c551c4162c4e2f01b0744044d8ac5dfa620d4277cb7d4442')
 OR (SELECT encode(public.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex') FROM pg_proc WHERE oid='newsfeed.claim_invitation(text,uuid)'::regprocedure)
  IS DISTINCT FROM '7ec28b21ec5036c4b9c74ef7726c4217b5c8d87728060b6095dca27bf01ce2ec'
 THEN RAISE EXCEPTION 'EXACT_READER_INVITATION_PREDECESSOR_REQUIRED';END IF;
END $guard$;
CREATE OR REPLACE FUNCTION newsfeed.claim_invitation(p_digest text,p_share_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE actor uuid;v newsfeed.share_invitations%ROWTYPE;
BEGIN
 actor:=newsfeed.shared_actor(false);
 IF NOT EXISTS(SELECT 1 FROM newsfeed.saved_search_migrations WHERE version='1.2.1-reader-invitation' AND digest='__READER_INVITATION_SCHEMA_DIGEST__')
 THEN RAISE EXCEPTION 'Reader invitation installation required' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM newsfeed.share_invitations WHERE token_digest=p_digest
 AND environment=current_setting('profitia.environment',true) AND application_id=current_setting('profitia.application_id',true)
 AND organisation_id::text=current_setting('profitia.organisation_id',true) FOR UPDATE;
 IF NOT FOUND OR v.owner_user_id=actor OR v.expires_at<=clock_timestamp() OR v.claimed_by_user_id IS NOT NULL
 THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='PT404'; END IF;
 -- The recipient is taken only from the freshly verified E1 actor. No
 -- directory copy, caller-supplied recipient ID or artificial membership.
 INSERT INTO newsfeed.observation_shares(id,environment,application_id,organisation_id,owner_user_id,observation_id,access_kind,recipient_user_id)
 VALUES(p_share_id,v.environment,v.application_id,v.organisation_id,v.owner_user_id,v.observation_id,'USER',actor) ON CONFLICT DO NOTHING;
 UPDATE newsfeed.share_invitations SET claimed_by_user_id=actor,claimed_at=clock_timestamp() WHERE id=v.id;
 RETURN v.observation_id;
END $fn$;
