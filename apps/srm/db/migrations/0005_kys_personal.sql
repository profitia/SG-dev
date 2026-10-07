-- The full KYS projection contains named people and PESEL values.
-- Keep the older redacted class for historical reports and require a bounded TTL for new personal snapshots.
ALTER TABLE srm.source_snapshots
  DROP CONSTRAINT source_snapshots_data_class_check,
  DROP CONSTRAINT source_snapshots_check,
  ADD CONSTRAINT source_snapshots_data_class_check CHECK (data_class IN ('COMPANY', 'FINANCIAL', 'KYS_REDACTED', 'KYS_PERSONAL', 'JDG_REGISTRY')),
  ADD CONSTRAINT source_snapshots_check CHECK (
    (section = 'kys' AND data_class IN ('KYS_REDACTED', 'KYS_PERSONAL')) OR
    (section = 'jdg' AND data_class = 'JDG_REGISTRY') OR
    (section = 'general' AND data_class = 'COMPANY') OR
    (section = 'financial' AND data_class = 'FINANCIAL')
  ),
  ADD CONSTRAINT kys_personal_retention_check CHECK (
    data_class <> 'KYS_PERSONAL' OR
    (retention_until IS NOT NULL AND retention_until > retrieved_at AND retention_until <= retrieved_at + interval '7 days')
  );

CREATE INDEX source_snapshots_kys_personal_expiry
  ON srm.source_snapshots (organization_id, retention_until)
  WHERE data_class = 'KYS_PERSONAL';
