-- Provider identifiers are continuation metadata, never report content.
ALTER TABLE srm.catalog_kys_reports
 ADD COLUMN provider_correlation_id text CHECK(provider_correlation_id IS NULL OR provider_correlation_id ~ '^[A-Za-z0-9_-]{8,100}$'),
 ADD COLUMN resume_until timestamptz CHECK(resume_until IS NULL OR isfinite(resume_until));
ALTER TABLE srm.catalog_kys_reports ADD CONSTRAINT kys_resume_requires_order
 CHECK(resume_until IS NULL OR (provider_correlation_id IS NOT NULL AND lease_owner IS NOT NULL AND lease_until='infinity'::timestamptz));

-- Reconcile only a single unambiguous accepted order from the original flight.
-- An unknown POST remains fenced. No order, payload or successful report is changed.
WITH accepted AS (
 SELECT c.nip,c.entity_type,min(a.correlation_id) AS correlation_id
 FROM srm.catalog_kys_reports c
 JOIN srm.lookup_requests l ON l.identifier_type='NIP' AND l.identifier=c.nip AND l.entity_type=c.entity_type
 JOIN srm.provider_attempts a ON a.organization_id=l.organization_id AND a.request_id=l.id
 WHERE c.lease_until='infinity'::timestamptz AND c.report_json IS NULL
  AND a.provider='VERCLY' AND a.section='kys' AND a.retrieval_method='PROVIDER'
  AND a.started_at>=c.updated_at AND a.correlation_id ~ '^[A-Za-z0-9_-]{8,100}$'
 GROUP BY c.nip,c.entity_type HAVING count(DISTINCT a.correlation_id)=1
)
UPDATE srm.catalog_kys_reports c SET provider_correlation_id=a.correlation_id
 FROM accepted a WHERE c.nip=a.nip AND c.entity_type=a.entity_type;
