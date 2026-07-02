// PCOS Cognition Explorer — Navigation Registry
// Derives navigation items from the Domain Registry.
// Sidebar consumes this — it no longer maintains its own NAV_ITEMS.

import { getAllDatasets } from "@/datasets/dataset-registry";
import { EXPLORER_IS_MOCK_PREVIEW } from "@/lib/org";
import { getDomainsByGroup, type NavigationGroup as DomainGroupKey } from "./domain-registry";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NavigationLeaf {
  kind: "leaf";
  id: string;
  label: string;
  href: string;
  iconName: string;
}

export interface NavigationGroupItem {
  kind: "group";
  id: string;
  label: string;
  iconName: string;
  children: NavigationLeaf[];
}

export type NavigationItem = NavigationLeaf | NavigationGroupItem;

// ── Group metadata (label + icon per navigation group) ───────────────────────

const GROUP_META: Record<DomainGroupKey, { label: string; iconName: string }> = {
  cognition: { label: "Cognition", iconName: "BrainCircuit" },
  lifecycle: { label: "Lifecycle", iconName: "GitBranch" },
  "cross-domain": { label: "Domains", iconName: "Building2" },
};

// ── Navigation derivation ─────────────────────────────────────────────────────

/** Returns the navigation tree derived from the Domain Registry. */
export function getNavigationItems(): NavigationItem[] {
  const items: NavigationItem[] = [];

  // Dashboard is always first — not domain-specific
  items.push({
    kind: "leaf",
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    iconName: "LayoutDashboard",
  });

  if (!EXPLORER_IS_MOCK_PREVIEW) {
    const groupOrder: DomainGroupKey[] = ["cognition", "lifecycle", "cross-domain"];

    for (const groupKey of groupOrder) {
      const domains = getDomainsByGroup(groupKey);
      if (domains.length === 0) continue;

      const meta = GROUP_META[groupKey];

      if (domains.length === 1) {
        const d = domains[0];
        items.push({
          kind: "leaf",
          id: d.id,
          label: d.label,
          href: d.href,
          iconName: d.iconName,
        });
      } else {
        const groupItem: NavigationGroupItem = {
          kind: "group",
          id: groupKey,
          label: meta.label,
          iconName: meta.iconName,
          children: domains.map((d) => ({
            kind: "leaf" as const,
            id: d.id,
            label: d.label,
            href: d.href,
            iconName: d.iconName,
          })),
        };
        items.push(groupItem);
      }
    }
  }

  const datasets = getAllDatasets();
  if (datasets.length > 0) {
    items.push({
      kind: "group",
      id: "datasets",
      label: "Datasets",
      iconName: "Database",
      children: [
        {
          kind: "leaf" as const,
          id: "datasets-list",
          label: "All datasets",
          href: "/datasets",
          iconName: "Database",
        },
        ...datasets.map((dataset) => ({
          kind: "leaf" as const,
          id: dataset.id,
          label: dataset.title,
          href: dataset.href,
          iconName: "BarChart3",
        })),
      ],
    });
  }

  return items;
}
