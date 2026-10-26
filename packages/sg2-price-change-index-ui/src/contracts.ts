export type PriceChangeIndexView='pci1'|'pci2'|'pci3';
export type PriceChangeIndexTheme='light'|'dark';
export interface PriceChangeIndexData{pci1:typeof import('./data-contracts/pci1');pci2:typeof import('./data-contracts/pci2');pci3:typeof import('./data-contracts/pci3');}
export interface PriceChangeIndexAction{view:PriceChangeIndexView;kind:'interaction'|'save'|'theme';label:string;}
export interface PriceChangeIndexContent{headerTitle?:string;homeTitle?:string;homeDescription?:string;}
export interface PriceChangeIndexProps{view:PriceChangeIndexView;data:PriceChangeIndexData;content?:PriceChangeIndexContent;theme?:PriceChangeIndexTheme;onThemeChange?:(theme:PriceChangeIndexTheme)=>void;onAction?:(event:PriceChangeIndexAction)=>void;resetKey?:string|number;className?:string;}
