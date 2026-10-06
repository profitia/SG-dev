-- CEIDG searches share SRM's tenant-scoped request/snapshot pipeline.
-- The source, entity class and section remain distinguishable at every layer.
ALTER TABLE srm.lookup_requests
  ADD COLUMN entity_type text NOT NULL DEFAULT 'COMPANY'
  CHECK (entity_type IN ('COMPANY', 'JDG'));

ALTER TABLE srm.provider_attempts
  DROP CONSTRAINT provider_attempts_section_check,
  DROP CONSTRAINT provider_attempts_provider_check,
  DROP CONSTRAINT provider_attempts_check,
  ADD CONSTRAINT provider_attempts_section_check CHECK (section IN ('general', 'financial', 'kys', 'jdg')),
  ADD CONSTRAINT provider_attempts_provider_check CHECK (provider IN ('MGBI', 'VERCLY', 'CEIDG')),
  ADD CONSTRAINT provider_attempts_check CHECK (
    (section = 'kys' AND provider = 'VERCLY') OR
    (section IN ('general', 'financial') AND provider = 'MGBI') OR
    (section = 'jdg' AND provider = 'CEIDG')
  );

ALTER TABLE srm.source_snapshots
  DROP CONSTRAINT source_snapshots_section_check,
  DROP CONSTRAINT source_snapshots_data_class_check,
  DROP CONSTRAINT source_snapshots_check,
  ADD CONSTRAINT source_snapshots_section_check CHECK (section IN ('general', 'financial', 'kys', 'jdg')),
  ADD CONSTRAINT source_snapshots_data_class_check CHECK (data_class IN ('COMPANY', 'FINANCIAL', 'KYS_REDACTED', 'JDG_REGISTRY')),
  ADD CONSTRAINT source_snapshots_check CHECK (
    (section = 'kys' AND data_class = 'KYS_REDACTED') OR
    (section = 'jdg' AND data_class = 'JDG_REGISTRY') OR
    (section = 'general' AND data_class = 'COMPANY') OR
    (section = 'financial' AND data_class = 'FINANCIAL')
  );

ALTER TABLE srm.section_projections
  DROP CONSTRAINT section_projections_section_check,
  ADD CONSTRAINT section_projections_section_check CHECK (section IN ('general', 'financial', 'kys', 'jdg'));
