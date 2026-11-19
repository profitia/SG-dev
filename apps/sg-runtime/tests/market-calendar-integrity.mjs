// Build/test-only producer-consumer adoption. No runtime permission is granted.
import {sdkContinuationPredecessor} from '../../../packages/platform-contracts/test/organisation-sdk-compatibility.mjs'
import {marketCalendarSourcePredecessor} from '../../architecture-lab/market-calendar-source.mjs'
export {
 MARKET_CALENDAR_CONSUMER_RECORD,
 MARKET_CALENDAR_CONSUMER_PATHS,
 MARKET_CALENDAR_PRODUCER_RECORD,
 MARKET_CALENDAR_PRODUCER_RECORD_SHA
} from '../../architecture-lab/market-calendar-source.mjs'

/** Authenticate the complete current registration graph before its separately
 * accepted Calendar view. Legacy and predecessor readers keep their original
 * verifier; read/parse/access failures are never converted into acceptance. */
export function marketCalendarPredecessor(current,historical){
 let bytes
 try{bytes=current('apps/sg-runtime/operation-integration.json')}
 catch(error){if(error?.code==='ENOENT')return marketCalendarSourcePredecessor(current,historical);throw error}
 const receipt=JSON.parse(bytes)
 const sdk=receipt.sdkSourceContinuations===undefined?null:sdkContinuationPredecessor(receipt,current,historical)
 return marketCalendarSourcePredecessor(sdk?.calendarCurrent??current,historical)
}
