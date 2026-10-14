-- The legacy payload_sha256 describes the original wire serialization, whose key
-- order JSONB does not retain. Preserve it; do not pretend to verify it retroactively.
-- Adopt a checksum of the existing stored representation at this governed migration.
ALTER TABLE srm.mgbi_source_archives ADD COLUMN payload_jsonb_sha256 text;
UPDATE srm.mgbi_source_archives
SET payload_jsonb_sha256 = encode(sha256(convert_to(payload_json::text, 'UTF8')), 'hex');
ALTER TABLE srm.mgbi_source_archives ALTER COLUMN payload_jsonb_sha256 SET NOT NULL;
ALTER TABLE srm.mgbi_source_archives ADD CONSTRAINT mgbi_archive_jsonb_checksum_format
  CHECK (payload_jsonb_sha256 ~ '^[0-9a-f]{64}$');

-- Compatible with existing writers during the migration/deployment interval.
-- A source write stamps the stored bytes; reconstruction never restamps an archive.
CREATE FUNCTION srm.stamp_mgbi_archive_jsonb_checksum() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  NEW.payload_jsonb_sha256 := encode(sha256(convert_to(NEW.payload_json::text, 'UTF8')), 'hex');
  RETURN NEW;
END;
$$;
CREATE TRIGGER mgbi_archive_jsonb_checksum BEFORE INSERT OR UPDATE OF payload_json
ON srm.mgbi_source_archives FOR EACH ROW
EXECUTE FUNCTION srm.stamp_mgbi_archive_jsonb_checksum();

-- A receipt binds a derived document to the exact same-tenant source snapshot.
-- NULL means an older projection must be checked/reconstructed on its next read.
ALTER TABLE srm.financial_source_documents ADD COLUMN archive_jsonb_sha256 text
  CHECK (archive_jsonb_sha256 IS NULL OR archive_jsonb_sha256 ~ '^[0-9a-f]{64}$');

-- The source checksum and reconstruction receipt do not hash the derived JSON.
-- Keep an independent persisted-byte checksum for that representation as well.
ALTER TABLE srm.financial_source_documents ADD COLUMN document_jsonb_sha256 text;
UPDATE srm.financial_source_documents
SET document_jsonb_sha256 = encode(sha256(convert_to(document_json::text, 'UTF8')), 'hex');
ALTER TABLE srm.financial_source_documents ALTER COLUMN document_jsonb_sha256 SET NOT NULL;
ALTER TABLE srm.financial_source_documents ADD CONSTRAINT financial_document_jsonb_checksum_format
  CHECK (document_jsonb_sha256 ~ '^[0-9a-f]{64}$');
CREATE FUNCTION srm.stamp_financial_document_jsonb_checksum() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  NEW.document_jsonb_sha256 := encode(sha256(convert_to(NEW.document_json::text, 'UTF8')), 'hex');
  RETURN NEW;
END;
$$;
CREATE TRIGGER financial_document_jsonb_checksum BEFORE INSERT OR UPDATE OF document_json
ON srm.financial_source_documents FOR EACH ROW
EXECUTE FUNCTION srm.stamp_financial_document_jsonb_checksum();
