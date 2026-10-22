export class ContractError extends Error {
  constructor(readonly code: string = 'INVALID_CONTRACT') { super(code) }
}
export function demand(value: unknown, code = 'INVALID_CONTRACT'): asserts value {
  if (!value) throw new ContractError(code)
}
export function record(value: unknown): Record<string, unknown> {
  demand(value !== null && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}
export function closed(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const r = record(value)
  demand(Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r, k)))
  return r
}
export const text = (v: unknown, max = 256): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\ud800-\udfff]/u.test(v)
export const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
export const krs = (v: unknown): v is string => typeof v === 'string' && /^\d{10}$/.test(v) && v !== '0000000000'
export const nip = (v: unknown): v is string => {
  if (!krs(v)) return false
  const n = [...v].map(Number), weights = [6,5,7,2,3,4,5,6,7]
  return weights.reduce((s,w,i) => s + w * n[i]!, 0) % 11 === n[9]
}
export const regon = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^(?:\d{9}|\d{14})$/.test(v) || /^0+$/.test(v)) return false
  const weights = v.length === 9 ? [8,9,2,3,4,5,6,7] : [2,4,8,5,0,9,7,3,6,1,2,4,8]
  const remainder = weights.reduce((s,w,i) => s + w * Number(v[i]), 0) % 11
  return (remainder === 10 ? 0 : remainder) === Number(v.at(-1)) && (v.length === 9 || regon(v.slice(0,9)))
}
export const calendarDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(v + 'T00:00:00.000Z')
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v
}
export const instant = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) return false
  const d = new Date(v); return Number.isFinite(d.getTime()) && d.toISOString() === v
}
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') { demand(Number.isFinite(value)); return JSON.stringify(value) }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  const r = record(value)
  return '{' + Object.keys(r).sort().map(k => JSON.stringify(k) + ':' + canonical(r[k])).join(',') + '}'
}
export async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const result = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return [...new Uint8Array(result)].map(b => b.toString(16).padStart(2,'0')).join('')
}
/** Bounded JSON decoder rejects duplicate decoded keys, nonfinite numbers and excessive nesting. */
export function parseJson(input: string, maximumBytes = 65536): unknown {
  demand(new TextEncoder().encode(input).length <= maximumBytes, 'OVERSIZED_JSON')
  let i = 0
  const ws = () => { while (/\s/.test(input[i] ?? '') && i < input.length) i++ }
  const string = (): string => {
    const start = i++; demand(input[start] === '"')
    while (i < input.length) { const c = input[i++]; if (c === '\\') i++; else if (c === '"') return JSON.parse(input.slice(start,i)) as string }
    throw new ContractError()
  }
  const value = (depth: number): unknown => {
    demand(depth <= 64); ws(); const c = input[i]
    if (c === '"') return string()
    if (c === '{') {
      i++; ws(); const r: Record<string,unknown> = Object.create(null)
      if (input[i] === '}') {i++; return r}
      while (true) {ws(); const k = string(); demand(!Object.hasOwn(r,k),'DUPLICATE_JSON_KEY'); ws(); demand(input[i++] === ':'); r[k] = value(depth+1); ws(); const n = input[i++]; if (n === '}') return r; demand(n === ',')}
    }
    if (c === '[') {
      i++; ws(); const r: unknown[] = []; if (input[i] === ']') {i++;return r}
      while (true) {r.push(value(depth+1));ws();const n=input[i++];if(n===']')return r;demand(n===',')}
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(input.slice(i))?.[0]
    demand(token); i += token.length; const parsed: unknown = JSON.parse(token); demand(typeof parsed !== 'number' || Number.isFinite(parsed)); return parsed
  }
  const result = value(0); ws(); demand(i === input.length); return result
}
