import React, {createContext, forwardRef, useContext} from 'react';
import {AdpSelect} from './dropdown';
import type {AdpLocale, AdpWorkspaceProps, AdpLocalEvent} from './types';

export const UiContext = createContext<{props:AdpWorkspaceProps;prefix:string;emit:(event:AdpLocalEvent)=>void}|null>(null);
export function useUi(){const value=useContext(UiContext);if(!value)throw new Error('ADP presentation host is required');return value;}
export function useLabel(){const {props}=useUi();return (pl:string,en:string)=>props.locale==='en'?en:pl;}
export function chooseCopy(locale:AdpLocale,pl:string,en:string){return locale==='en'?en:pl;}
export const Button=forwardRef<HTMLButtonElement,React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'link'|'danger'}>(function Button({variant='secondary',className='',type='button',onClick,...p},ref){return <button {...p} type={type} ref={ref} className={`adp-button adp-button-${variant} ${className}`} onClick={event=>{event.currentTarget.focus({preventScroll:true});onClick?.(event);}}/>;});
export const Input=forwardRef<HTMLInputElement,React.InputHTMLAttributes<HTMLInputElement>>(function Input({className='',...p},ref){return <input {...p} ref={ref} className={`adp-input ${className}`}/>;});
export const Textarea=forwardRef<HTMLTextAreaElement,React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({className='',...p},ref){return <textarea {...p} ref={ref} className={`adp-input ${className}`}/>;});
export const Select=forwardRef<HTMLSelectElement,React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(p,ref){const {props}=useUi();return <AdpSelect {...p} disabled={p.disabled||props.active===false} lang={props.locale} ref={ref}/>;});
export function Heading({children}:{children:React.ReactNode}){return <h2 className="ws-heading">{children}</h2>;}
export function Flow({children}:{children:React.ReactNode}){
 type Entry={node:React.ReactNode;key:string};
 const flatten=(nodes:React.ReactNode,prefix=''):Entry[]=>React.Children.toArray(nodes).flatMap((node,i)=>{
  const key=prefix+String(React.isValidElement(node)?node.key??i:i);
  return React.isValidElement(node)&&node.type===React.Fragment?flatten((node.props as {children?:React.ReactNode}).children,`${key}/`):[{node,key}];
 });
 const groups:React.ReactNode[]=[];let text:Entry[]=[];
 const flush=()=>{if(text.length){groups.push(<div className="ws-text-stack" key={`text-${text[0].key}`}>{text.map(e=><React.Fragment key={e.key}>{e.node}</React.Fragment>)}</div>);text=[];}};
 for(const {node,key} of flatten(children)){
  const e=React.isValidElement(node)?node:null;const heading=!!e&&(e.type===Heading||typeof e.type==='string'&&/^h[1-6]$/.test(e.type));
  const copy=heading||!!e&&typeof e.type==='string'&&['p','span','strong','small'].includes(e.type);
  if(copy){if(heading)flush();text.push({node,key});}else{flush();groups.push(<React.Fragment key={`block-${key}`}>{node}</React.Fragment>);}
 }
 flush();return <div className="ws-flow">{groups}</div>;
}
export function Box({children,className=''}:{children:React.ReactNode;className?:string}){return <section className={`ws-box ${className}`}><Flow>{children}</Flow></section>;}
export function Empty({children}:{children:React.ReactNode}){return <div className="ws-empty">{children}</div>;}
export function Badge({children,tone=''}:{children:React.ReactNode;tone?:string}){return <span className={`ws-badge ${tone}`}>{children}</span>;}
export function Icon({kind='chevron',back=false}:{kind?:'chevron'|'close'|'search'|'chart';back?:boolean}){return <svg aria-hidden="true" width={kind==='search'||kind==='chart'?24:16} height={kind==='search'||kind==='chart'?24:16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{kind==='close'?<path d="m6 6 12 12M18 6 6 18"/>:kind==='search'?<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>:kind==='chart'?<path d="M4 4v16h16M7 15l4-5 4 2 5-7"/>:<path d={back?'m14 6-6 6 6 6':'m9 6 6 6-6 6'}/>}</svg>;}
export function DisplayDate({value}:{value?:string}){const l=useLabel();return <>{value?/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('.'):value:l('Brak daty','No date')}</>;}
