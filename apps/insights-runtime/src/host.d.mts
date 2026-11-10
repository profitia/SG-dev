export interface InstalledInsightsRuntime {
 api(request:Request):Promise<Response>;
 subscriptionsApi(request:Request):Promise<Response>;
 runner:{start(...args:unknown[]):Promise<unknown>;run(...args:unknown[]):Promise<unknown>};
 scheduler:{tick(options?:{controlled?:boolean}):Promise<unknown>};
 tick(options?:{controlled?:boolean}):Promise<void>;
 serveWorker(options:{signal:AbortSignal;intervalMs?:number}):Promise<void>;
 stop():void;close():Promise<void>;
}
export declare function createInstalledInsightsRuntime(options:{
 env?:Record<string,string|undefined>;python:string;
 canonicalPorts:{marketRead(input:{seriesId:string;asOf:string;organisationId:string}):Promise<unknown>;
 forecastRead(input:{seriesId:string;asOf:string;organisationId:string}):Promise<unknown>};
 monitoring?:{span?:(name:string,fn:()=>Promise<unknown>,data:unknown)=>Promise<unknown>;capture?:(error:Error,data:Record<string,unknown>)=>void};
}):Promise<InstalledInsightsRuntime>;
