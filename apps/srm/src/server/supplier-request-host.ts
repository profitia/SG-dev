import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {createSrmPrivateOperationHost} from './private-operation-host'
import {readSupplierRequest,supplierRequestResourceId,projectSupplierRequest,SUPPLIER_REQUEST_PROJECTION,PRIVATE_SUPPLIER_REQUEST_PROJECTION,privateSupplierRequestResourceId,readSupplierPrivateAcquisition,type SupplierPrivateAcquisition} from './supplier-request-operation'
type DriverOptions=Parameters<typeof createSrmPrivateOperationHost>[0]

type RequestOptions=Omit<DriverOptions, 'readResources' | 'projectOutput' | 'prepareInputs' | 'describeOutcome' | 'requestLedger'> & {
  requestLedger: { schemaDigest: string; externalSchemaDigest: string; operationSchemaDigest?:string; quotaSchemaDigest?:string }; commandBoundaryDigest: string
  privateAcquisition?:SupplierPrivateAcquisition
}

/** The command resource and projection are shared by the ordinary Root host
 * and the producer-owned FRESH composition. They grant no authority alone. */
export function srmSupplierRequestDefinition(options:RequestOptions){
  const acquisition=options.privateAcquisition===undefined?undefined:readSupplierPrivateAcquisition(options.privateAcquisition)
  const operation=acquisition?'supplier.private.refresh':'supplier.report.refresh'
  if (options.application.operations.length !== 1 || options.application.operations[0] !== operation
    || (acquisition?!/^[a-f0-9]{64}$/.test(options.requestLedger.operationSchemaDigest??''):options.requestLedger.operationSchemaDigest!==undefined)
    || !/^[a-f0-9]{64}$/.test(options.commandBoundaryDigest)) throw new TypeError('Explicit supplier request and command boundary required')
  const digest = options.commandBoundaryDigest
  const operationSchemaDigest=options.requestLedger.operationSchemaDigest
  const resourceId=(command:ReturnType<typeof readSupplierRequest>)=>acquisition?privateSupplierRequestResourceId(command,{entityType:acquisition.entityType,section:acquisition.section}):supplierRequestResourceId(command)
  const definition:Pick<DriverOptions,'readResources'|'projectOutput'>={
    readResources: async ({ actor, request, scope, query }) => {
      const command = readSupplierRequest(request.payload)
      if (actor.kind !== 'HUMAN' || !scope.organisationId || !scope.userId
        || request.operation!==operation||request.resourceId !== resourceId(command)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      const receipt = await query("SELECT source_ref FROM profitia_supplier_requests.installation WHERE singleton AND schema_version='1.0.0' AND boundary_digest=$1", [digest])
      if (receipt.rows.length !== 1 || typeof receipt.rows[0].source_ref !== 'string'
        || !receipt.rows[0].source_ref.length || receipt.rows[0].source_ref.length > 256) throw new OperationDenied('POLICY_UNAVAILABLE')
      if(acquisition){
        const descriptor=(await query('SELECT srm.private_acquisition_descriptor() AS descriptor')).rows[0]?.descriptor as Record<string,unknown>|null|undefined
        if(!descriptor||descriptor.privateAcquisitionSchemaVersion!=='1.0.0'||descriptor.privateAcquisitionBoundaryDigest!==acquisition.boundaryDigest
          ||descriptor.operationSchemaDigest!==operationSchemaDigest
          ||descriptor.commandBoundaryDigest!==digest)throw new OperationDenied('POLICY_UNAVAILABLE')
        if(acquisition.section==='web'){const web=(await query('SELECT srm.web_installation_descriptor() AS descriptor')).rows[0]?.descriptor as Record<string,unknown>|undefined
          if(!web||web.webSchemaVersion!=='1.0.0'||web.webBoundaryDigest!==acquisition.webBoundaryDigest||web.privateAcquisitionBoundaryDigest!==acquisition.boundaryDigest)throw new OperationDenied('POLICY_UNAVAILABLE')}
      }
      return { resource: { id: request.resourceId, type: acquisition?'supplier_private_request':'supplier_report_request', dataClass: 'OPERATION_AUDIT',
        environment: scope.environment, ownerOrganisationId: scope.organisationId, ownerUserId: scope.userId,
        version: 'srm-private-command-v1', projectionVersion: acquisition?PRIVATE_SUPPLIER_REQUEST_PROJECTION:SUPPLIER_REQUEST_PROJECTION } }
    },
    projectOutput: projectSupplierRequest,
  }
  return definition
}

export function createSrmSupplierRequestOperationHost(options:RequestOptions){
  return createSrmPrivateOperationHost({...options,...srmSupplierRequestDefinition(options)})
}
