import {createCurrentE1Authority,type CurrentE1Authority} from '@profitia/platform-contracts/current-e1-authority'
import type {AccessQuery,AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import type {RuntimeSdk} from './contracts.js'
/** Optional producer surface on the existing Identity Runtime. It introduces
 * neither an Identity database login nor a parallel directory/grant system. */
export function createCurrentAuthority(query:AccessQuery,client:RuntimeSdk,binding:AccessStoreBinding):CurrentE1Authority {
 return createCurrentE1Authority({query,client,binding})
}
