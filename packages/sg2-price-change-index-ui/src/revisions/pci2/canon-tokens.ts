/** Canonical implementation tokens. Edit here; both views consume this object.
 * Content/data props belong to the application; appearance and interactions belong here.
 * The preview editor uses an explicit temporary draft, never localStorage as authority.
 */
export const canonTokens={
  version:'1.0',overviewHeight:300,overviewControl:24,overviewIcon:12,overviewStroke:1.4,overviewRadius:6,overviewBorder:0.75,
  actionRadius:7,actionFont:12,actionHeight:32,cardRadius:9,hoverAction:1.03,hoverText:1.025,hoverPill:1.06,motionMs:220,
};
export type CanonTokens=typeof canonTokens;
export function tokenVariables(t:CanonTokens){return Object.fromEntries(Object.entries(t).filter(([k])=>k!=='version').map(([k,v])=>['--canon-'+k,typeof v==='number'&&!/hover|Stroke/.test(k)?v+(k==='motionMs'?'ms':'px'):String(v)]));}


