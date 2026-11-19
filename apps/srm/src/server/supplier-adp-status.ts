/** Read-only metadata port. The source is bound by the accepted SRM host,
 * never chosen by an HTTP URL or a client-supplied status. */
export type AdpStatus = 'UNKNOWN' | 'MISSING' | 'CURRENT' | 'OUTDATED' | 'RENEWAL_REQUIRED';
export interface AdpStatusSnapshot {
  status: AdpStatus; projectionVersion: 1; sourceLabel?: string;
  confirmedAt?: string; asOf?: string; signedAt?: string; validUntil?: string;
}
export interface AdpMetadata {
  status: Exclude<AdpStatus, 'UNKNOWN'>; sourceLabel: string;
  confirmedAt?: string; asOf?: string; signedAt?: string; validUntil?: string;
}
export interface SupplierAdpStatusReader {
  read(scope: Readonly<{ organisationId: string; supplierId: string; signal?: AbortSignal }>): Promise<AdpMetadata | null>;
}
const unknown = (): AdpStatusSnapshot => ({ status: 'UNKNOWN', projectionVersion: 1 });
const instant = (s: unknown): number | null => typeof s === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(Date.UTC(Number(s.slice(0,4)),Number(s.slice(5,7))-1,Number(s.slice(8,10)))).toISOString().slice(0,10) === s.slice(0,10) ? Date.parse(s) : null;
function civilStart(date: string, timeZone: string): number | null {
  const [y,m,d] = date.split('-').map(Number);
  const utc = Date.UTC(y,m-1,d);
  if (new Date(utc).toISOString().slice(0,10) !== date) return null;
  const fmt = new Intl.DateTimeFormat('en-GB',{ timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' });
  let candidate = utc;
  for (let i=0; i<4; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(candidate)).map(p=>[p.type,p.value]));
    const seen = Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
    const delta = utc - seen;
    candidate += delta;
    if (delta === 0) return candidate;
  }
  return null;
}
function expiry(value: string, timeZone: string): number | null {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return instant(value);
  const [y,m,d] = value.split('-').map(Number);
  if (new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10) !== value) return null;
  const tomorrow = new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10);
  const start = civilStart(tomorrow,timeZone);
  return start === null ? null : start-1;
}
export async function readSupplierAdpStatus(
  scope: Readonly<{ organisationId: string; supplierId: string; signal?: AbortSignal }>,
  reader?: SupplierAdpStatusReader,
  options: Readonly<{ now?: () => number; timeZone?: string }> = {},
): Promise<AdpStatusSnapshot> {
  if (!reader) return unknown();
  try {
    const source = await reader.read(scope), now = (options.now ?? Date.now)(), zone = options.timeZone ?? 'Europe/Warsaw';
    if (!source || !['MISSING','CURRENT','OUTDATED','RENEWAL_REQUIRED'].includes(source.status)
      || typeof source.sourceLabel !== 'string' || source.sourceLabel.length < 1 || source.sourceLabel.length > 128
      || /[\u0000-\u001f\u007f]|https?:\/\/|postgres|Bearer\s/i.test(source.sourceLabel)) return unknown();
    const result: AdpStatusSnapshot = { status:source.status,projectionVersion:1,sourceLabel:source.sourceLabel };
    for (const key of ['confirmedAt','asOf','signedAt'] as const) {
      if (source[key] !== undefined) {
        const t = instant(source[key]);
        if (t === null || t > now) return unknown();
        result[key] = source[key];
      }
    }
    if (source.signedAt && (source.status === 'MISSING' || Date.parse(source.signedAt) > Date.parse(source.confirmedAt ?? source.asOf ?? source.signedAt))) return unknown();
    if (source.validUntil !== undefined) {
      const until = expiry(source.validUntil,zone);
      if (until === null || source.status === 'MISSING') return unknown();
      if (source.signedAt && until < Date.parse(source.signedAt)) return unknown();
      result.validUntil = source.validUntil;
      if (until < now) result.status = 'OUTDATED';
    }
    // No inference of signedAt + three years and no invented confirmation date.
    return Object.freeze(result);
  } catch { return unknown(); }
}
