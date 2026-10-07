-- The Development runtime may remove only expired personal KYS projections and snapshots.
-- Tenant scope remains enforced by the existing FORCE RLS policies.
GRANT DELETE ON srm.section_projections, srm.source_snapshots TO srm_app_runtime;

CREATE POLICY kys_expired_personal_projection_delete ON srm.section_projections
  AS RESTRICTIVE FOR DELETE TO srm_app_runtime
  USING (EXISTS (
    SELECT 1 FROM srm.source_snapshots AS snapshot
    WHERE snapshot.organization_id = section_projections.organization_id
      AND snapshot.id = section_projections.snapshot_id
      AND snapshot.data_class = 'KYS_PERSONAL'
      AND snapshot.retention_until < now()
  ));

CREATE POLICY kys_expired_personal_snapshot_delete ON srm.source_snapshots
  AS RESTRICTIVE FOR DELETE TO srm_app_runtime
  USING (data_class = 'KYS_PERSONAL' AND retention_until < now());
