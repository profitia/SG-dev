import React,{createContext,useContext} from 'react';
import type {PriceChangeIndexContent} from './contracts';
export interface PresentationScope{surface:HTMLDivElement;document:Document;onNavigate?:(screen:string)=>void;dispose:()=>void;}
const Context=createContext<PresentationScope|null>(null);
const ContentContext=createContext<PriceChangeIndexContent>({});
export const PresentationScopeProvider=Context.Provider;
export const ContentProvider=ContentContext.Provider;
export function useContent(){return useContext(ContentContext);}
export function usePresentationScope(){const value=useContext(Context);if(!value)throw new Error('Price Change Index presentation scope is missing');return value;}
export function createPresentationScope(shadow:ShadowRoot,surface:HTMLDivElement):PresentationScope{
const owner=surface.ownerDocument;
const listeners=new Set<{type:string;listener:EventListener;wrapper:EventListener;options?:boolean|AddEventListenerOptions}>();
const document={body:surface,documentElement:surface,get activeElement(){return shadow.activeElement;},querySelector:shadow.querySelector.bind(shadow),querySelectorAll:shadow.querySelectorAll.bind(shadow),
addEventListener(type:string,listener:EventListener,options?:boolean|AddEventListenerOptions){const wrapper:EventListener=e=>{const origin=e.composedPath()[0];const proxy=new Proxy(e,{get(target,key){if(key==='target')return origin;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});listener(proxy);};listeners.add({type,listener,wrapper,options});owner.addEventListener(type,wrapper,options);},
removeEventListener(type:string,listener:EventListener,options?:boolean|EventListenerOptions){for(const item of listeners){if(item.type===type&&item.listener===listener&&Boolean(typeof item.options==='boolean'?item.options:item.options?.capture)===Boolean(typeof options==='boolean'?options:options?.capture)){owner.removeEventListener(type,item.wrapper,item.options);listeners.delete(item);}}}} as unknown as Document;
return {surface,document,dispose(){for(const item of listeners)owner.removeEventListener(item.type,item.wrapper,item.options);listeners.clear();surface.remove();}};
}
