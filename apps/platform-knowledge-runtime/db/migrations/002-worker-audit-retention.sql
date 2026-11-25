-- Additive repair: retain immutable SQL001 and its installed schema digest.
-- Existing DELETE needs only the timestamp predicate, never audit contents.
DO $$ BEGIN
 IF current_database()<>'platform_knowledge' OR current_user<>'platform_knowledge_owner'
 THEN RAISE EXCEPTION 'PK_MIGRATION_BINDING_REJECTED'; END IF;
END $$;
GRANT SELECT(created_at) ON platform_knowledge.audit TO platform_knowledge_worker;
