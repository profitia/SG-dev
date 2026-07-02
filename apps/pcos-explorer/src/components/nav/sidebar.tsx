"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Network,
  BrainCircuit,
  Zap,
  FileSearch,
  Sparkles,
  GitBranch,
  ShieldCheck,
  Building2,
  BarChart3,
  PanelLeftDashed,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";
import { useState } from "react";
import type { NavigationItem, NavigationGroupItem } from "@/registry/navigation-registry";

// ── Icon map — maps iconName strings to Lucide components ─────────────────────
type LucideIcon = React.ComponentType<{ size?: number; className?: string }>;

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Database,
  Network,
  BrainCircuit,
  Zap,
  FileSearch,
  Sparkles,
  GitBranch,
  ShieldCheck,
  Building2,
  BarChart3,
  PanelLeftDashed,
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? BrainCircuit;
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({
  href,
  iconName,
  label,
  depth = 0,
}: {
  href: string;
  iconName: string;
  label: string;
  depth?: number;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  const Icon = resolveIcon(iconName);

  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150",
        depth > 0 ? "ml-5 py-2 text-[13px]" : "font-medium",
        isActive
          ? "bg-accent text-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
          : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
      )}
    >
      <Icon size={depth > 0 ? 13 : 15} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

// ── NavGroup ──────────────────────────────────────────────────────────────────

function NavGroup({
  iconName,
  label,
  hrefs,
  children,
}: {
  iconName: string;
  label: string;
  hrefs: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isChildActive = hrefs.some((href) => pathname === href);
  const [open, setOpen] = useState<boolean>(isChildActive || true);
  const Icon = resolveIcon(iconName);

  return (
    <div>
      <button
        onClick={() => setOpen((v: boolean) => !v)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground"
      >
        <Icon size={14} className="shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div className="mt-0.5 space-y-0.5">{children}</div>}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar({
  orgId,
  env,
  navItems,
}: {
  orgId: string;
  env: string;
  navItems: NavigationItem[];
}) {
  return (
    <aside
      style={{ width: "var(--sidebar-width)" }}
      className="flex h-screen shrink-0 flex-col border-r border-border/80 bg-card/90 backdrop-blur-xl"
    >
      {/* Header */}
      <div className="border-b border-border/80 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pcos-accent shadow-[0_10px_20px_rgba(0,0,0,0.2)]">
            <PanelLeftDashed size={18} className="text-background" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-pcos-accent">
              PCOS Explorer
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cognition inspection dashboard
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-md border border-border bg-secondary px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {env}
          </span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {orgId}
          </span>
        </div>
      </div>

      {/* Nav — driven by Navigation Registry */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          if (item.kind === "group") {
            const hrefs = item.children.map((c) => c.href);
            return (
              <NavGroup
                key={item.id}
                iconName={item.iconName}
                label={item.label}
                hrefs={hrefs}
              >
                {item.children.map((child) => (
                  <NavLink
                    key={child.href}
                    href={child.href}
                    iconName={child.iconName}
                    label={child.label}
                    depth={1}
                  />
                ))}
              </NavGroup>
            );
          }
          return (
            <NavLink
              key={item.href}
              href={item.href!}
              iconName={item.iconName}
              label={item.label}
            />
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/80 px-4 py-3">
        <p className="text-[10px] leading-5 text-muted-foreground">
          Read-only · Cognition Inspection Layer
        </p>
      </div>
    </aside>
  );
}
