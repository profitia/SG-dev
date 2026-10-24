import fs from 'node:fs';
import {createHash} from 'node:crypto';

const base = new URL('../migrations/profile/', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
export const vocativeSchemaDigest = () => hash(fs.readFileSync(new URL('006-vocative.sql', base)));
export const nameKey = value => value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pl');

/** Read-only, deterministic import. Original source rows remain reviewable. */
export function vocativeDictionary() {
  const source = fs.readFileSync(new URL('vocative-source-v1.csv', base));
  const reviewedBytes = fs.readFileSync(new URL('vocative-reviewed-v1.json', base));
  const reviewed = JSON.parse(reviewedBytes);
  if (hash(source) !== reviewed.sourceSha256) throw Error('VOCATIVE_SOURCE_CHANGED');
  const lines = source.toString('utf8').replace(/^\uFEFF/u, '').split(/\r?\n/u);
  if (lines.shift() !== 'First Name Denominator;First Name Vocative;Sex') throw Error('VOCATIVE_HEADER');
  const rows = lines.map((line, i) => {
    const fields = line.split(';');
    if (fields.length !== 3 && line !== '') throw Error('VOCATIVE_SOURCE_FORMAT');
    const [name = '', vocative = '', gender = ''] = fields;
    return {row: i + 2, name, vocative, gender, key: nameKey(name)};
  }).filter(row => row.name.trim() || row.vocative.trim() || row.gender.trim());
  const keys = new Set();
  for (const entry of reviewed.entries) {
    entry.key = nameKey(entry.name);
    if (keys.has(entry.key) || !['Male','Female'].includes(entry.gender) || !entry.vocative
      || !rows.some(row => row.key === entry.key)) throw Error('VOCATIVE_REVIEW_INVALID');
    keys.add(entry.key);
  }
  return {sourceDigest: hash(source), reviewDigest: hash(reviewedBytes), version: reviewed.version,
    rows, entries: reviewed.entries};
}

/** Controlled installer only; caller owns transaction and role/environment checks. */
export async function installVocativeDictionary(query) {
  const d = vocativeDictionary();
  await query(`INSERT INTO profitia_profile.vocative_source(source_row, original_name, supplied_vocative, supplied_gender, name_key)
    SELECT row, name, vocative, gender, key FROM jsonb_to_recordset($1::jsonb) AS x(row integer,name text,vocative text,gender text,key text)`, [JSON.stringify(d.rows)]);
  await query(`INSERT INTO profitia_profile.vocative_dictionary(name_key, canonical_name, vocative, name_gender, dictionary_version)
    SELECT key,name,vocative,gender,$2 FROM jsonb_to_recordset($1::jsonb) AS x(key text,name text,vocative text,gender text)`, [JSON.stringify(d.entries),d.version]);
  await query('INSERT INTO profitia_profile.vocative_installation VALUES(true,$1,$2,$3,$4)',
    [vocativeSchemaDigest(), d.sourceDigest, d.reviewDigest, d.version]);
  return {sourceRows:d.rows.length,approvedNames:d.entries.length,version:d.version,schemaDigest:vocativeSchemaDigest()};
}
