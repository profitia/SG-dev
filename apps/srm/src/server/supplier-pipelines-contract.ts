/**
 * SRM producer wire contract. No identity, database or UI authority is accepted
 * in these payloads. The receiving host supplies verified organisation/actor.
 */
export const SUPPLIER_PIPELINES_CONTRACT = Object.freeze({
  id: 'srm.supplier-pipelines', version: '1.0.0', projectionVersion: 1,
  maxPageSize: 100, defaultPageSize: 50, maxBodyBytes: 131072,
} as const);
export type WorkspaceOperation =
  | 'supplier.catalog.read' | 'supplier.catalog.write'
  | 'supplier.category.read' | 'supplier.category.write'
  | 'supplier.pipeline.read' | 'supplier.pipeline.write'
  | 'supplier.assignment.read' | 'supplier.assignment.write' | 'supplier.adp-status.read';
export const WORKSPACE_OPERATIONS: readonly WorkspaceOperation[] = Object.freeze([
  'supplier.catalog.read', 'supplier.catalog.write', 'supplier.category.read', 'supplier.category.write',
  'supplier.pipeline.read', 'supplier.pipeline.write', 'supplier.assignment.read',
  'supplier.assignment.write', 'supplier.adp-status.read',
]);
export type Lifecycle = 'ACTIVE' | 'ARCHIVED';
export type PipelineKind = 'SUPPLIER' | 'CATEGORY';
export type ErrorCode = 'NIP_REQUIRED' | 'INVALID_NIP' | 'FIELD_INVALID' | 'DUPLICATE_NIP'
  | 'ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS' | 'VERSION_CONFLICT' | 'PIPELINE_CHANGED'
  | 'IDEMPOTENCY_CONFLICT' | 'LAST_STAGE' | 'RECORD_ARCHIVED' | 'NOT_FOUND'
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'UNAVAILABLE' | 'UNSUPPORTED_CONTRACT' | 'BODY_TOO_LARGE';
const errorStatus: Record<ErrorCode, number> = {
  NIP_REQUIRED: 422, INVALID_NIP: 422, FIELD_INVALID: 422, DUPLICATE_NIP: 409,
  ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS: 409, VERSION_CONFLICT: 409, PIPELINE_CHANGED: 409,
  IDEMPOTENCY_CONFLICT: 409, LAST_STAGE: 409, RECORD_ARCHIVED: 409, NOT_FOUND: 404,
  UNAUTHENTICATED: 401, FORBIDDEN: 403, UNAVAILABLE: 503, UNSUPPORTED_CONTRACT: 409, BODY_TOO_LARGE: 413,
};
const messages: Record<ErrorCode, string> = {
  NIP_REQUIRED: 'Podaj NIP firmy.', INVALID_NIP: 'Podaj poprawny NIP firmy.',
  FIELD_INVALID: 'Sprawdź zaznaczone pola.', DUPLICATE_NIP: 'Ten dostawca istnieje już w katalogu.',
  ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS: 'Firma ma już aktywne przypisanie do pipeline’u Dostawcy.',
  VERSION_CONFLICT: 'Dane zostały zmienione. Odśwież widok.',
  PIPELINE_CHANGED: 'Konfiguracja lub liczba firm uległa zmianie. Odśwież i potwierdź ponownie.',
  IDEMPOTENCY_CONFLICT: 'Ten identyfikator zapisu dotyczy innej operacji.',
  LAST_STAGE: 'Pipeline musi mieć co najmniej jeden etap.',
  RECORD_ARCHIVED: 'Przywróć rekord przed wykonaniem tej operacji.',
  NOT_FOUND: 'Nie znaleziono rekordu.', UNAUTHENTICATED: 'Zaloguj się ponownie.',
  FORBIDDEN: 'Brak uprawnienia do tej operacji.', UNAVAILABLE: 'Funkcja jest chwilowo niedostępna.',
  UNSUPPORTED_CONTRACT: 'Wersja interfejsu nie jest obsługiwana.', BODY_TOO_LARGE: 'Przekroczono rozmiar danych.',
};
export interface ExistingSupplier { supplierId: string; displayName: string; lifecycle: Lifecycle }
export class SupplierPipelinesError extends Error {
  readonly status: number;
  constructor(readonly code: ErrorCode, readonly fieldErrors?: Readonly<Record<string, string>>,
    readonly existingSupplier?: ExistingSupplier) {
    super(messages[code]); this.name = 'SupplierPipelinesError'; this.status = errorStatus[code];
  }
}
export function fieldInvalid(field: string): never {
  throw new SupplierPipelinesError('FIELD_INVALID', { [field]: 'Sprawdź wartość pola.' });
}
export function requireContractVersion(value: unknown): void {
  if (value !== SUPPLIER_PIPELINES_CONTRACT.version) throw new SupplierPipelinesError('UNSUPPORTED_CONTRACT');
}
export function normalizeNip(value: unknown): string {
  if (typeof value !== 'string' || value.length > 32) {
    throw new SupplierPipelinesError(value == null || value === '' ? 'NIP_REQUIRED' : 'INVALID_NIP', { nip: messages.INVALID_NIP });
  }
  const normalized = value.replace(/[\s-]/gu, '');
  if (!normalized) throw new SupplierPipelinesError('NIP_REQUIRED', { nip: messages.NIP_REQUIRED });
  if (!/^[0-9]{10}$/.test(normalized) || normalized === '0000000000') {
    throw new SupplierPipelinesError('INVALID_NIP', { nip: messages.INVALID_NIP });
  }
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const checksum = weights.reduce((sum, w, i) => sum + Number(normalized[i]) * w, 0) % 11;
  if (checksum === 10 || checksum !== Number(normalized[9])) throw new SupplierPipelinesError('INVALID_NIP', { nip: messages.INVALID_NIP });
  return normalized;
}
export function normalizedName(value: string): string { return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pl-PL'); }
export function uuid(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) return fieldInvalid(field);
  return value.toLowerCase();
}
function object(value: unknown, allowed: readonly string[], required: readonly string[], field = 'body'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return fieldInvalid(field);
  const obj = value as Record<string, unknown>;
  if (Reflect.ownKeys(obj).some(k => typeof k !== 'string') || Object.values(Object.getOwnPropertyDescriptors(obj)).some(d => !('value' in d) || !d.enumerable)) return fieldInvalid(field);
  if (Object.keys(obj).some(k => !allowed.includes(k)) || required.some(k => !Object.hasOwn(obj, k))) return fieldInvalid(field);
  return obj;
}
function text(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) return fieldInvalid(field);
  const result = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!result) return fieldInvalid(field);
  return result;
}
function integer(value: unknown, field: string, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) return fieldInvalid(field);
  return value as number;
}
function ids(value: unknown, field: string, max = 50): string[] {
  if (!Array.isArray(value) || value.length > max) return fieldInvalid(field);
  const result = value.map((v, i) => uuid(v, field + '.' + i));
  if (new Set(result).size !== result.length) return fieldInvalid(field);
  return result;
}
export interface ContactInput { contactId?: string; name: string; role: string | null; email: string | null; phone: string | null }
function contacts(value: unknown): ContactInput[] {
  if (!Array.isArray(value) || value.length > 20) return fieldInvalid('contacts');
  const result = value.map((v, i) => {
    const p = 'contacts.' + i;
    const o = object(v, ['contactId', 'name', 'role', 'email', 'phone'], ['name'], p);
    const email = o.email == null ? null : text(o.email, p + '.email', 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return fieldInvalid(p + '.email');
    return { ...(o.contactId === undefined ? {} : { contactId: uuid(o.contactId, p + '.contactId') }),
      name: text(o.name, p + '.name'), role: o.role == null ? null : text(o.role, p + '.role'),
      email, phone: o.phone == null ? null : text(o.phone, p + '.phone', 40) };
  });
  const existingIds = result.flatMap(c => c.contactId ? [c.contactId] : []);
  if (new Set(existingIds).size !== existingIds.length) return fieldInvalid('contacts');
  return result;
}
export type CommandName =
  | 'SUPPLIER_CREATE' | 'SUPPLIER_UPDATE' | 'SUPPLIER_ARCHIVE' | 'SUPPLIER_RESTORE'
  | 'CATEGORY_CREATE' | 'CATEGORY_UPDATE' | 'CATEGORY_ARCHIVE' | 'CATEGORY_RESTORE'
  | 'SUPPLIER_CATEGORY_ADD' | 'SUPPLIER_CATEGORY_REMOVE'
  | 'PIPELINE_CREATE' | 'PIPELINE_UPDATE' | 'PIPELINE_ARCHIVE' | 'PIPELINE_RESTORE'
  | 'STAGE_ADD' | 'STAGES_UPDATE' | 'STAGE_REMOVE'
  | 'MEMBERSHIP_ADD' | 'MEMBERSHIP_MOVE' | 'MEMBERSHIP_END' | 'SUPPLIER_TRANSFER';
export interface WorkspaceCommand {
  readonly contractVersion: '1.0.0'; readonly idempotencyKey: string; readonly command: CommandName;
  readonly data: Readonly<Record<string, unknown>>;
}
const commandKeys: Record<CommandName, { allowed: string[]; required: string[] }> = {
  SUPPLIER_CREATE: { allowed: ['nip','displayName','contacts','categoryIds','relationshipOwnerAccountId'], required: ['nip','displayName'] },
  SUPPLIER_UPDATE: { allowed: ['supplierId','expectedVersion','nip','displayName','contacts','relationshipOwnerAccountId','confirmIdentifierChange'], required: ['supplierId','expectedVersion'] },
  SUPPLIER_ARCHIVE: { allowed: ['supplierId','expectedVersion','expectedCount'], required: ['supplierId','expectedVersion','expectedCount'] },
  SUPPLIER_RESTORE: { allowed: ['supplierId','expectedVersion'], required: ['supplierId','expectedVersion'] },
  CATEGORY_CREATE: { allowed: ['name'], required: ['name'] },
  CATEGORY_UPDATE: { allowed: ['categoryId','expectedVersion','name'], required: ['categoryId','expectedVersion','name'] },
  CATEGORY_ARCHIVE: { allowed: ['categoryId','expectedVersion'], required: ['categoryId','expectedVersion'] },
  CATEGORY_RESTORE: { allowed: ['categoryId','expectedVersion'], required: ['categoryId','expectedVersion'] },
  SUPPLIER_CATEGORY_ADD: { allowed: ['supplierId','categoryId','expectedVersion'], required: ['supplierId','categoryId','expectedVersion'] },
  SUPPLIER_CATEGORY_REMOVE: { allowed: ['supplierId','categoryId','expectedVersion'], required: ['supplierId','categoryId','expectedVersion'] },
  PIPELINE_CREATE: { allowed: ['name','kind','categoryId','stages'], required: ['name','kind','stages'] },
  PIPELINE_UPDATE: { allowed: ['pipelineId','expectedVersion','name'], required: ['pipelineId','expectedVersion','name'] },
  PIPELINE_ARCHIVE: { allowed: ['pipelineId','expectedVersion','expectedCount'], required: ['pipelineId','expectedVersion','expectedCount'] },
  PIPELINE_RESTORE: { allowed: ['pipelineId','expectedVersion'], required: ['pipelineId','expectedVersion'] },
  STAGE_ADD: { allowed: ['pipelineId','expectedVersion','name','order'], required: ['pipelineId','expectedVersion','name','order'] },
  STAGES_UPDATE: { allowed: ['pipelineId','expectedVersion','stages'], required: ['pipelineId','expectedVersion','stages'] },
  STAGE_REMOVE: { allowed: ['pipelineId','stageId','expectedPipelineVersion','expectedCount','targetStageId'], required: ['pipelineId','stageId','expectedPipelineVersion','expectedCount'] },
  MEMBERSHIP_ADD: { allowed: ['pipelineId','supplierId','stageId','expectedPipelineVersion'], required: ['pipelineId','supplierId','stageId','expectedPipelineVersion'] },
  MEMBERSHIP_MOVE: { allowed: ['membershipId','stageId','expectedVersion','expectedPipelineVersion'], required: ['membershipId','stageId','expectedVersion','expectedPipelineVersion'] },
  MEMBERSHIP_END: { allowed: ['membershipId','expectedVersion'], required: ['membershipId','expectedVersion'] },
  SUPPLIER_TRANSFER: { allowed: ['supplierId','sourceMembershipId','sourceVersion','targetPipelineId','targetStageId','expectedTargetVersion','reason'], required: ['supplierId','sourceMembershipId','sourceVersion','targetPipelineId','targetStageId','expectedTargetVersion'] },
};
export function operationForCommand(command: CommandName): WorkspaceOperation {
  if (command.startsWith('SUPPLIER_CATEGORY')) return 'supplier.category.write';
  if (command.startsWith('SUPPLIER_TRANSFER') || command.startsWith('MEMBERSHIP')) return 'supplier.assignment.write';
  if (command.startsWith('SUPPLIER')) return 'supplier.catalog.write';
  if (command.startsWith('CATEGORY')) return 'supplier.category.write';
  return 'supplier.pipeline.write';
}
export function parseWorkspaceCommand(value: unknown): WorkspaceCommand {
  const envelope = object(value, ['contractVersion','idempotencyKey','command','data'], ['contractVersion','idempotencyKey','command','data']);
  requireContractVersion(envelope.contractVersion);
  if (typeof envelope.command !== 'string' || !Object.hasOwn(commandKeys, envelope.command)) return fieldInvalid('command');
  const command = envelope.command as CommandName, shape = commandKeys[command];
  if (typeof envelope.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(envelope.idempotencyKey)) return fieldInvalid('idempotencyKey');
  const source = object(envelope.data, shape.allowed, shape.required, 'data');
  const data: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(source)) {
    if (key === 'nip') data[key] = normalizeNip(v);
    else if (key === 'relationshipOwnerAccountId') data[key] = v === null ? null : uuid(v, key);
    else if (key.endsWith('Id')) data[key] = v === null && key === 'targetStageId' ? null : uuid(v, key);
    else if (/Version$/.test(key) || key === 'sourceVersion') data[key] = integer(v, key, key === 'expectedVersion' && command.startsWith('SUPPLIER_') && command !== 'SUPPLIER_TRANSFER' ? 0 : 1);
    else if (key === 'expectedCount') data[key] = integer(v, key, 0);
    else if (key === 'order') data[key] = integer(v, key, 0, 49);
    else if (key === 'displayName' || key === 'name') data[key] = text(v, key);
    else if (key === 'reason') data[key] = text(v, key, 500);
    else if (key === 'contacts') data[key] = contacts(v);
    else if (key === 'categoryIds') data[key] = ids(v, key);
    else if (key === 'confirmIdentifierChange') { if (typeof v !== 'boolean') return fieldInvalid(key); data[key] = v; }
    else if (key === 'kind') { if (v !== 'SUPPLIER' && v !== 'CATEGORY') return fieldInvalid(key); data[key] = v; }
    else if (key === 'stages') {
      if (!Array.isArray(v) || v.length < 1 || v.length > 50) return fieldInvalid(key);
      data[key] = v.map((item, i) => {
        if (command === 'PIPELINE_CREATE') return { name: text(object(item, ['name'], ['name'], key + '.' + i).name, key + '.' + i + '.name'), order: i };
        const stage = object(item, ['stageId','name','order'], ['stageId','name','order'], key + '.' + i);
        return { stageId: uuid(stage.stageId, key + '.' + i + '.stageId'), name: text(stage.name, key + '.' + i + '.name'), order: integer(stage.order, key + '.' + i + '.order', 0, 49) };
      });
      const stages = data[key] as { stageId?: string; name: string; order: number }[];
      if (new Set(stages.map(x => normalizedName(x.name))).size !== stages.length ||
        new Set(stages.map(x => x.order)).size !== stages.length ||
        command === 'STAGES_UPDATE' && new Set(stages.map(x => x.stageId)).size !== stages.length ||
        stages.some((x, i, all) => !all.some(s => s.order === i))) return fieldInvalid(key);
    }
  }
  if (command === 'SUPPLIER_UPDATE' && !['nip','displayName','contacts','relationshipOwnerAccountId'].some(k => Object.hasOwn(data,k))) return fieldInvalid('data');
  if (command === 'PIPELINE_CREATE' && (data.kind === 'CATEGORY' ? !data.categoryId : Object.hasOwn(data,'categoryId'))) return fieldInvalid('categoryId');
  if (command === 'STAGE_REMOVE' && (data.expectedCount as number) > 0 && !data.targetStageId) return fieldInvalid('targetStageId');
  if (command === 'STAGE_REMOVE' && data.targetStageId === data.stageId) return fieldInvalid('targetStageId');
  function freeze(value: unknown): void { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } }
  freeze(data);
  return Object.freeze({ contractVersion: '1.0.0', idempotencyKey: envelope.idempotencyKey, command, data });
}
export type WorkspaceRead = Readonly<{
  kind: 'SUPPLIERS' | 'SUPPLIER_BY_NIP' | 'SUPPLIER_CARD' | 'CATEGORIES' | 'PIPELINES'
    | 'PIPELINE' | 'HISTORY' | 'ADP_STATUS';
  supplierId?: string; pipelineId?: string; nip?: string; q?: string; categoryId?: string;
  lifecycle?: Lifecycle; cursor?: string; limit?: number;
}>;
export function parseWorkspaceRead(value: unknown): WorkspaceRead {
  const o = object(value, ['kind','supplierId','pipelineId','nip','q','categoryId','lifecycle','cursor','limit'], ['kind']);
  const kind = o.kind as WorkspaceRead['kind'];
  if (!['SUPPLIERS','SUPPLIER_BY_NIP','SUPPLIER_CARD','CATEGORIES','PIPELINES','PIPELINE','HISTORY','ADP_STATUS'].includes(kind)) return fieldInvalid('kind');
  const out: Record<string, unknown> = { kind };
  for (const [k, v] of Object.entries(o)) {
    if (k.endsWith('Id')) out[k] = uuid(v, k);
    else if (k === 'nip') out.nip = normalizeNip(v);
    else if (k === 'q') { if (typeof v !== 'string' || v.length > 200 || /[\u0000-\u001f\u007f]/u.test(v)) return fieldInvalid(k); out.q = v.trim(); }
    else if (k === 'lifecycle') { if (v !== 'ACTIVE' && v !== 'ARCHIVED') return fieldInvalid(k); out.lifecycle = v; }
    else if (k === 'cursor') out.cursor = uuid(v, k);
    else if (k === 'limit') out.limit = integer(v, k, 1, 100);
  }
  if (['SUPPLIER_CARD','HISTORY','ADP_STATUS'].includes(kind) && !out.supplierId) return fieldInvalid('supplierId');
  if (kind === 'SUPPLIER_BY_NIP' && !out.nip) return fieldInvalid('nip');
  if (kind === 'PIPELINE' && !out.pipelineId) return fieldInvalid('pipelineId');
  // Reject selectors irrelevant to the selected endpoint; they must not alter scope.
  const allowed: Record<string, string[]> = {
    SUPPLIERS: ['q','categoryId','lifecycle','cursor','limit'], SUPPLIER_BY_NIP: ['nip'],
    SUPPLIER_CARD: ['supplierId'], CATEGORIES: ['q','lifecycle','cursor','limit'],
    PIPELINES: ['categoryId','lifecycle','cursor','limit'], PIPELINE: ['pipelineId','cursor','limit'],
    HISTORY: ['supplierId','cursor','limit'], ADP_STATUS: ['supplierId'],
  };
  if (Object.keys(out).some(k => k !== 'kind' && !allowed[kind].includes(k))) return fieldInvalid('query');
  if (['SUPPLIERS','CATEGORIES','PIPELINES','PIPELINE','HISTORY'].includes(kind)) out.limit ??= 50;
  return Object.freeze(out) as WorkspaceRead;
}
export function operationForRead(read: WorkspaceRead): WorkspaceOperation {
  if (read.kind === 'ADP_STATUS') return 'supplier.adp-status.read';
  if (read.kind === 'CATEGORIES') return 'supplier.category.read';
  if (read.kind === 'PIPELINES' || read.kind === 'PIPELINE') return 'supplier.pipeline.read';
  if (read.kind === 'HISTORY') return 'supplier.assignment.read';
  return 'supplier.catalog.read';
}
