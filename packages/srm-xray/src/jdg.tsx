import React from "react";
import type { JdgField, JdgRegistryData, SectionEnvelope } from "./contracts";

type DisplaySection = Omit<SectionEnvelope<JdgRegistryData>, "source">;

function Field({ field, path = [] }: { field: JdgField; path?: readonly string[] }) {
  if (["terc", "simc", "ulic", "link"].includes(field.key.toLowerCase())) return null;
  const currentPath = [...path, field.key];
  const label = field.key === "kod" && path.some((part) => /pkd/i.test(part)) ? "Kod PKD" : field.label;
  if (field.children.length) return (
    <div className="jdg-nested-field">
      <strong>{label}</strong>
      <dl className="xray-facts">{field.children.map((child, index) => <Field field={child} path={currentPath} key={`${child.key}:${index}`} />)}</dl>
    </div>
  );
  return <><dt>{label}</dt><dd>{field.value ?? "brak danych"}</dd></>;
}

export function JdgRegistryMount({ section }: { section: DisplaySection }) {
  const state = section.status === "SUCCESS" ? "Dostępne" : section.status === "PARTIAL" ? "Dane częściowe"
    : section.status === "EMPTY" ? "Brak danych" : section.status === "PENDING" ? "Pobieranie" : "Źródło niedostępne";
  return (
    <section className="xray-section" aria-label="Dane JDG">
      <header className="xray-section-header"><h2>Dane działalności gospodarczej</h2><span>{state}</span></header>
      {section.data?.entries.length ? section.data.entries.map((entry) => (
        <article className="jdg-entry" key={entry.recordId}>
          <h3>{entry.name}</h3>
          <p className="jdg-entry-meta">NIP: {entry.nip} · REGON: {entry.regon ?? "brak danych"} · Status: {entry.status ?? "brak danych"}</p>
          <dl className="xray-facts">{entry.fields.map((field) => <Field field={field} key={field.key} />)}</dl>
        </article>
      )) : <p>{section.status === "PENDING" ? "Pobieranie danych…" : "brak danych"}</p>}
      {section.status === "PARTIAL" && <p className="xray-warning">Nie wszystkie wpisy zostały dopasowane do podanego NIP-u.</p>}
    </section>
  );
}
