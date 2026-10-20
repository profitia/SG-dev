export type PublicPage={url:string;body:Buffer;contentType:string}
export type PublicFetchOptions={signal?:AbortSignal;maxBytes?:number}
export type PublicFetch=(url:string,options?:PublicFetchOptions)=>Promise<PublicPage>
export declare const PUBLIC_WEB_TRANSPORT:Readonly<{id:'profitia.public-web-http';version:'1.0.0';maximumResponseBytes:2000000;timeoutMs:8000;maximumRedirects:4}>
export declare function isPublicAddress(address:string):boolean
export declare function publicUrl(value:string):URL
export declare function resolvePublicUrl(value:string,resolver?:(hostname:string)=>Promise<{address:string;family:number}[]>):Promise<{url:URL;address:{address:string;family:number}}>
export declare function createSafePublicFetch(fetcher:(url:string,options:PublicFetchOptions)=>Promise<Response>):PublicFetch
export declare const safePublicFetch:PublicFetch
