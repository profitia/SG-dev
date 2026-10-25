import {OperationDenied,type OperationContext} from '@profitia/platform-contracts/operation-context'
import {validateReportSelection} from './report-data'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Existing private report output fence, shared by the ordinary host and the
 * isolated PILOT2 composition. Classification and tenant authority belong to
 * the common host; the canonical projector retains the financial semantics. */
export async function projectSrmReportDataResponse(value:unknown,context:OperationContext):Promise<Response>{
      if (!(value instanceof Response) || !value.ok) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      const body: unknown = await value.clone().json()
      const selection = validateReportSelection(context.payload)
      const allowed = ['schemaVersion','nip','entityType','financial','kys','preferenceScope','locationSubject']
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some(key => !allowed.includes(key)) || !('schemaVersion' in body) || body.schemaVersion !== '1.0'
        || !('nip' in body) || body.nip !== selection.nip || !('entityType' in body) || body.entityType !== selection.entityType
        || !('financial' in body) || !body.financial || typeof body.financial !== 'object'
        || !('kys' in body) || !body.kys || typeof body.kys !== 'object'
        || ('locationSubject' in body && (!body.locationSubject || typeof body.locationSubject!=='object' || Array.isArray(body.locationSubject) || Object.keys(body.locationSubject).join(',')!=='supplierId' || !('supplierId' in body.locationSubject) || !uuid.test(String(body.locationSubject.supplierId))))
        || ('preferenceScope' in body && (typeof body.preferenceScope !== 'string' || !/^[a-f0-9]{64}$/.test(body.preferenceScope)))) {
        throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      }
      // projectReportData is the existing allowlisted field projection. This
      // version/selection fence does not replace its financial/PII tests or RLS.
      return value
}
