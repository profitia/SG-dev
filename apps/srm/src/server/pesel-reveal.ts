import { createHmac, timingSafeEqual } from "node:crypto";
import type { SectionEnvelope, VerclyKysData } from "@profitia/srm-xray";
import { toPublicSection } from "./xray-lookup";
import { kysCacheTtlMs, kysExpiry } from "./kys-cache";

export type PersonList = "relatedPersons" | "beneficialOwners";
export type PeselReference = { snapshotId: string; list: PersonList; index: number };

type TokenPayload = PeselReference & { version: 1; expiresAt: number };
const snapshotIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issuePeselToken(secret: string, reference: PeselReference, expiresAt: number): string {
  if (secret.length < 32 || !snapshotIdPattern.test(reference.snapshotId) ||
    !["relatedPersons", "beneficialOwners"].includes(reference.list) ||
    !Number.isSafeInteger(reference.index) || reference.index < 0 || !Number.isSafeInteger(expiresAt)) {
    throw new Error("Invalid PESEL reveal token input");
  }
  const payload = Buffer.from(JSON.stringify({ version: 1, ...reference, expiresAt } satisfies TokenPayload)).toString("base64url");
  return `${payload}.${sign(secret, payload)}`;
}

export function verifyPeselToken(secret: string, token: unknown, now = Date.now()): PeselReference | null {
  if (secret.length < 32 || typeof token !== "string" || token.length > 1000 || !tokenPattern.test(token)) return null;
  const [payload, signature] = token.split(".");
  const expected = Buffer.from(sign(secret, payload), "base64url");
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received) || received.toString("base64url") !== signature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<TokenPayload>;
    if (parsed.version !== 1 || typeof parsed.snapshotId !== "string" || !snapshotIdPattern.test(parsed.snapshotId) ||
      (parsed.list !== "relatedPersons" && parsed.list !== "beneficialOwners") ||
      !Number.isSafeInteger(parsed.index) || parsed.index! < 0 || parsed.index! > 10000 ||
      !Number.isSafeInteger(parsed.expiresAt) || parsed.expiresAt! <= now || parsed.expiresAt! > now + kysCacheTtlMs()) return null;
    return { snapshotId: parsed.snapshotId, list: parsed.list, index: parsed.index! };
  } catch { return null; }
}

export function toPublicKysSection(
  section: SectionEnvelope<VerclyKysData>, snapshotId: string | null, secret: string,
): Omit<SectionEnvelope<VerclyKysData>, "source"> {
  const display = toPublicSection(section);
  if (!display.data) return display;
  const expiresAt = section.retrievedAt ? kysExpiry(section.retrievedAt).getTime() : 0;
  const people = (list: PersonList): VerclyKysData["relatedPersons"] => display.data?.[list]?.map((person, index) => ({
    ...person,
    pesel: null,
    peselRevealToken: snapshotId && expiresAt > Date.now() && /^\d{11}$/.test(person.pesel ?? "")
      ? issuePeselToken(secret, { snapshotId, list, index }, expiresAt) : null,
  }));
  return { ...display, data: { ...display.data, relatedPersons: people("relatedPersons"), beneficialOwners: people("beneficialOwners") } };
}
