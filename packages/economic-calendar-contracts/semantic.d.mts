export const SEMANTIC_CONTRACT:'profitia.economic-calendar-semantics/1.0.0';
export const SEMANTIC_KINDS:readonly string[];
export const RELEVANCE_LEVELS:readonly ['DIRECT','STRONG','CONTEXTUAL'];
export const CURATION_STATES:readonly string[];
export function semanticId(value:unknown):string;
export function semanticChange(input:any):any;
export function semanticFilter(input?:any):any;
