import { createHash } from "node:crypto";

export type Seed = { nip: string; name: string; city: string | null; source: "BZP"; noticeId: string; publishedAt: string };
export const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function validNip(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const nip = value.trim().replace(/^PL\s*/i, "").replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(nip) || /^(\d)\1{9}$/.test(nip)) return null;
  const sum = [6, 5, 7, 2, 3, 4, 5, 6, 7].reduce((total, weight, i) => total + weight * Number(nip[i]), 0);
  return sum % 11 === Number(nip[9]) ? nip : null;
}
export function seedFromNotices(payload: unknown): Seed[] {
  if (!Array.isArray(payload)) throw new Error("BZP_INVALID_RESPONSE");
  return payload.flatMap(raw => {
    const notice = object(raw);
    if (!Array.isArray(notice.contractors)) return [];
    return notice.contractors.flatMap(rawContractor => {
      const contractor = object(rawContractor);
      if (contractor.contractorCountry !== "PL") return [];
      const nip = validNip(contractor.contractorNationalId);
      const name = typeof contractor.contractorName === "string" ? contractor.contractorName.trim().slice(0, 500) : "";
      const noticeId = typeof notice.objectId === "string" ? notice.objectId : typeof notice.noticeNumber === "string" ? notice.noticeNumber : "";
      const publishedAt = typeof notice.publicationDate === "string" ? notice.publicationDate : "";
      if (!nip || !name || !noticeId || !publishedAt) return [];
      return [{ nip, name, city: typeof contractor.contractorCity === "string" ? contractor.contractorCity.slice(0, 150) : null,
        source: "BZP" as const, noticeId, publishedAt }];
    });
  });
}
export function mergeSeeds(existing: Seed[], incoming: Seed[]): Seed[] {
  const rows = new Map<string, Seed>();
  for (const row of [...existing, ...incoming]) {
    const previous = rows.get(row.nip);
    if (!previous || `${row.publishedAt}:${row.noticeId}:${row.name}` > `${previous.publishedAt}:${previous.noticeId}:${previous.name}`) rows.set(row.nip, row);
  }
  return [...rows.values()].sort((a, b) => a.nip.localeCompare(b.nip));
}
export const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function sampleSeeds(rows: Seed[], size: number, seed: string): Seed[] {
  const unique = mergeSeeds([], rows);
  if (!Number.isSafeInteger(size) || size < 1 || size > 10_000 || size > unique.length || !seed) throw new Error("SAMPLE_SIZE_OR_SEED_INVALID");
  return unique.sort((a, b) => digest([seed, a.nip]).localeCompare(digest([seed, b.nip])) || a.nip.localeCompare(b.nip)).slice(0, size);
}

export function bzpUrl(from: string, to: string, searchAfter: string | null = null): URL {
  for (const date of [from, to]) if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error("BZP_INVALID_DATES");
  if (from >= to || searchAfter !== null && !/^[a-f0-9-]{36}$/i.test(searchAfter)) throw new Error("BZP_INVALID_WINDOW_OR_CURSOR");
  const url = new URL("https://ezamowienia.gov.pl/mo-board/api/v1/notice");
  for (const [key, value] of Object.entries({ NoticeType: "TenderResultNotice", PublicationDateFrom: from, PublicationDateTo: to, PageSize: "100" })) url.searchParams.set(key, value);
  if (searchAfter) url.searchParams.set("SearchAfter", searchAfter);
  return url;
}

export type BzpWindow = { cursorScheme: "objectId-v1"; nextAfter: string | null; pages: number; complete: boolean; pageDigests: string[] };
export function advanceBzpWindow(previous: BzpWindow, notices: unknown[]): BzpWindow {
  if (notices.length > 100) throw new Error("BZP_PAGE_SIZE_EXCEEDED");
  const ids = notices.map(notice => object(notice).objectId);
  if (ids.some(id => typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) || new Set(ids).size !== ids.length) throw new Error("BZP_INVALID_NOTICE_IDS");
  const fingerprint = digest(ids);
  if (notices.length && (previous.pageDigests.includes(fingerprint) || ids.includes(previous.nextAfter))) throw new Error("BZP_REPEATED_PAGE_OR_CURSOR");
  return { cursorScheme: "objectId-v1", nextAfter: ids.length ? ids.at(-1) as string : previous.nextAfter, pages: previous.pages + 1,
    complete: notices.length < 100, pageDigests: [...previous.pageDigests, fingerprint] };
}
