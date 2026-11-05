import type {FirstPartySourceConfiguration} from '@profitia/platform-current-e1-authority/first-party'
import type {HubRequest,HubResponse} from './index.mjs'
export type FirstPartyExecution=Readonly<{kind:'HUMAN';organisationId:string;grantId?:never}|{kind:'SERVICE';organisationId:string;grantId:string}>
export declare function createFirstPartySourceHubClient(configuration:FirstPartySourceConfiguration,dependencies?:{fetchImpl?:typeof fetch;now?:()=>number;newRequestId?:()=>string}):Readonly<{acquire(input:{command:HubRequest;execution:FirstPartyExecution;idempotencyKey:string;request?:Request|null;signal?:AbortSignal}):Promise<HubResponse>}>
