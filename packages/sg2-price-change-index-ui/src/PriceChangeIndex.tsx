import React,{useLayoutEffect,useMemo,useRef,useState} from 'react';import {createPortal} from 'react-dom';
import {createCCIKlIkalnyPrzepYwAnalizyKosztW} from './revisions/pci1/CCIKlIkalnyPrzepYwAnalizyKosztW';
import {createCCIWersja2AnalizaCenyIOfertyDostawcy} from './revisions/pci2/CCIWersja2AnalizaCenyIOfertyDostawcy';
import {createCCIWersja3KontekstZakupowyICieKiWejCia} from './revisions/pci3/CCIWersja3KontekstZakupowyICieKiWejCia';
import pci1css0 from './revisions/pci1/base.css?inline';
import pci1css1 from './revisions/pci1/canon-dropdown.css?inline';
import pci1css2 from './revisions/pci1/canon-header.css?inline';
import pci1css3 from './revisions/pci1/canon-shared.css?inline';
import pci1css4 from './revisions/pci1/canon-side-menu.css?inline';
import pci1css5 from './revisions/pci1/cci.css?inline';
import pci1css6 from './revisions/pci1/chart-time-presets.css?inline';
import pci1css7 from './revisions/pci1/srm-color-tokens.css?inline';
import pci1css8 from './revisions/pci1/srm-history-detail.css?inline';
import pci1css9 from './revisions/pci1/srm-history-table.css?inline';
import pci1css10 from './revisions/pci1/srm-interaction-motion.css?inline';
import pci2css0 from './revisions/pci2/base.css?inline';
import pci2css1 from './revisions/pci2/canon-dropdown.css?inline';
import pci2css2 from './revisions/pci2/canon-header.css?inline';
import pci2css3 from './revisions/pci2/canon-shared.css?inline';
import pci2css4 from './revisions/pci2/canon-side-menu.css?inline';
import pci2css5 from './revisions/pci2/price-analysis-v2.css?inline';
import pci2css6 from './revisions/pci2/srm-color-tokens.css?inline';
import pci2css7 from './revisions/pci2/srm-history-detail.css?inline';
import pci2css8 from './revisions/pci2/srm-history-table.css?inline';
import pci2css9 from './revisions/pci2/srm-interaction-motion.css?inline';
import pci3css0 from './revisions/pci3/base.css?inline';
import pci3css1 from './revisions/pci3/canon-header.css?inline';
import pci3css2 from './revisions/pci3/canon-shared.css?inline';
import pci3css3 from './revisions/pci3/canon-side-menu.css?inline';
import pci3css4 from './revisions/pci3/price-analysis-v2.css?inline';
import pci3css5 from './revisions/pci3/price-analysis-v3.css?inline';
import pci3css6 from './revisions/pci3/srm-color-tokens.css?inline';
import pci3css7 from './revisions/pci3/srm-history-detail.css?inline';
import pci3css8 from './revisions/pci3/srm-history-table.css?inline';
import pci3css9 from './revisions/pci3/srm-interaction-motion.css?inline';
import pci3css10 from './revisions/pci3/stacked-price-chart.css?inline';
import pci3ThemeBindings from './revisions/pci3/canon-theme.css?inline';
import canonTheme from './canon/theme.css?inline';import {createPresentationScope,PresentationScopeProvider,ContentProvider,type PresentationScope} from './PresentationScope';import {ThemeProvider} from './Theme';import {Inspector} from './Inspector';import type {PriceChangeIndexProps} from './contracts';
// Owner approved visible phone scenarios using the pinned C07 compact variant.
// The immutable view CSS stays intact; these are explicit responsive adapters.
const phoneScenarioStyles=(view:'pci1'|'pci2')=>{const bar=view==='pci1'?'.cci-prototype-bar':'.ca-prototype';const label=view==='pci1'?'.cci-scenario':'.ca-prototype>label';return `
@media(max-width:${view==='pci1'?960:1050}px){
 ${bar}{display:block;overflow:visible;}
 ${bar}>nav{height:45px;width:100%;overflow-x:auto;scrollbar-width:none;}
 ${bar}>nav::-webkit-scrollbar{display:none;}
 ${label}{display:flex;width:100%;height:48px;min-height:48px;margin:0;padding:8px 0;box-sizing:border-box;gap:8px;font-size:12px;align-items:center;}
 ${label}>.pci-scenario-compact{flex:1;min-width:0;width:auto;}
 ${label} .srm-dropdown-trigger{height:32px;min-height:32px;font-size:12px;border-radius:8px;padding:0 12px;line-height:1.4;font-weight:400;}
}
@media(max-width:${view==='pci1'?480:760}px){${bar}>nav{height:${view==='pci1'?40:42}px;}}
`;};
const styles={
pci1:[pci1css0,canonTheme,pci1css6,pci1css4,pci1css1,pci1css2,pci1css8,pci1css7,pci1css3,pci1css10,pci1css5,pci1css9,phoneScenarioStyles('pci1')].join("\n"),
pci2:[pci2css0,canonTheme,pci2css1,pci2css2,pci2css4,pci2css7,pci2css6,pci2css3,pci2css9,pci2css8,pci2css5,phoneScenarioStyles('pci2')].join("\n"),
pci3:[pci3css0,canonTheme,pci3ThemeBindings,pci3css1,pci3css2,pci3css3,pci3css4,pci3css6,pci3css7,pci3css8,pci3css9,pci3css10,pci3css5].join("\n")};
export function PriceChangeIndex(props:PriceChangeIndexProps){const latestProps=useRef(props);latestProps.current=props;const mount=useRef<HTMLDivElement>(null);const [scope,setScope]=useState<PresentationScope|null>(null);useLayoutEffect(()=>{const host=mount.current!;const shadow=host.shadowRoot??host.attachShadow({mode:'open'});const surface=document.createElement('div');surface.className='pci-surface';shadow.append(surface);const context=createPresentationScope(shadow,surface,locked=>latestProps.current.onScrollLockChange?.(locked));setScope(context);return()=>{context.dispose();};},[]);
const presentation=useMemo(()=>scope?{...scope,onNavigate:(screen:string)=>props.onNavigate?.({view:props.view,screen})}:null,[scope,props.view,props.onNavigate]);
const View=useMemo(()=>props.view==='pci1'?createCCIKlIkalnyPrzepYwAnalizyKosztW(props.data.pci1).CCIKlIkalnyPrzepYwAnalizyKosztW:props.view==='pci2'?createCCIWersja2AnalizaCenyIOfertyDostawcy(props.data.pci2).CCIWersja2AnalizaCenyIOfertyDostawcy:createCCIWersja3KontekstZakupowyICieKiWejCia(props.data.pci3).CCIWersja3KontekstZakupowyICieKiWejCia,[props.view,props.data]);
return <div ref={mount} className={props.className} data-price-change-index={props.view} style={{display:'block',width:'100%'}}>{scope&&createPortal(<PresentationScopeProvider value={presentation!}><ContentProvider value={props.content??{}}><ThemeProvider key={props.resetKey??0} initialTheme={props.theme} onChange={theme=>{props.onThemeChange?.(theme);props.onAction?.({view:props.view,kind:'theme',label:theme});}}><style>{styles[props.view]}</style><div style={{width:"100%",minWidth:0}} onClickCapture={e=>{const target=(e.target as Element).closest('button,a');if(target){const label=(target.getAttribute('aria-label')??target.textContent??'').trim();props.onAction?.({view:props.view,kind:/zapisz|zachowaj/i.test(label)?'save':'interaction',label});}}}><View key={String(props.resetKey??0)+props.view}/></div><Inspector view={props.view}/></ThemeProvider></ContentProvider></PresentationScopeProvider>,scope.surface)}</div>;}
