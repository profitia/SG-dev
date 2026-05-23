'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/layout/ThemeProvider'

const nav = [
  {
    group: 'execution',
    items: [
      {
        label: 'Roadmap',
        href: '/roadmap',
        shortcut: 'r',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5h10M2 7h7M2 10.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        label: 'Execution Logs',
        href: '/logs',
        shortcut: null,
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M4.5 5.5h5M4.5 8h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        label: 'Timeline',
        href: '/timeline',
        shortcut: 't',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="3.5" cy="4" r="1.25" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="3.5" cy="10" r="1.25" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="3.5" cy="7" r="1.25" stroke="currentColor" strokeWidth="1.4" />
            <path d="M6.5 4h4M6.5 7h3M6.5 10h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'architecture',
    items: [
      {
        label: 'Decisions',
        href: '/decisions',
        shortcut: 'd',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5L12.5 12H1.5L7 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M7 6v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="7" cy="10.5" r="0.6" fill="currentColor" />
          </svg>
        ),
      },
      {
        label: 'Warnings',
        href: '/warnings',
        shortcut: 'w',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2.5L12 11H2L7 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M7 6v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.6" fill="currentColor" />
          </svg>
        ),
      },
      {
        label: 'Principles',
        href: '/principles',
        shortcut: null,
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M7 4.5V7l1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'context',
    items: [
      {
        label: 'Prompts',
        href: '/prompts',
        shortcut: 'p',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5h8M2 7h5.5M2 10.5h6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M10.5 6l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        label: 'Changed Files',
        href: '/changed-files',
        shortcut: null,
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2h6l3 3v7H3V2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M5 7.5h4M5 9.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'cognition',
    items: [
      {
        label: 'Conversations',
        href: '/conversations',
        shortcut: 'c',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 3h10v6H8l-2 2V9H2V3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M4.5 6h5M4.5 7.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-52 flex-shrink-0 border-r border-bg-border flex flex-col bg-bg-base">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-bg-border flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group min-w-0">
          <div className="w-5 h-5 rounded bg-accent flex items-center justify-center flex-shrink-0">
            <span className="text-white text-3xs font-bold leading-none tracking-tight">P</span>
          </div>
          <div className="min-w-0">
            <p className="text-text-primary text-xs font-semibold leading-tight tracking-wide group-hover:text-accent transition-colors">
              PMOS SpendGuru 2.0 development
            </p>
            <p className="text-text-tertiary text-3xs leading-tight tracking-wide">PMOS Runtime</p>
          </div>
        </Link>
        <ThemeToggle />
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1.5">
        <button
          type="button"
          onClick={() => document.dispatchEvent(new CustomEvent('pmos:open-search'))}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-text-tertiary text-2xs bg-bg-surface border border-bg-border hover:border-bg-hover hover:text-text-secondary transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
            <circle cx="5.5" cy="5.5" r="3.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8.5 8.5L10.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-3xs border border-bg-border rounded px-1 font-mono">/</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1.5 overflow-y-auto space-y-3">
        {nav.map(({ group, items }) => (
          <div key={group}>
            <p className="px-2 mb-1 text-3xs font-medium uppercase tracking-widest text-text-muted">{group}</p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                const shortcut = item.shortcut
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-2 px-2 py-1.5 rounded text-2xs transition-colors group
                      ${active
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                      }
                    `}
                  >
                    <span className={`flex-shrink-0 ${active ? 'text-accent' : 'text-text-tertiary group-hover:text-text-secondary'} transition-colors`}>
                      {item.icon}
                    </span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    {shortcut && (
                      <kbd className={`text-3xs font-mono opacity-0 group-hover:opacity-60 transition-opacity border border-bg-border rounded px-1 ${active ? 'text-accent/60' : 'text-text-tertiary'}`}>
                        {shortcut}
                      </kbd>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer — runtime status */}
      <div className="px-4 py-3 border-t border-bg-border">
        <Link
          href="/prompts/new"
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-2xs bg-accent/10 text-accent hover:bg-accent/20 transition-colors mb-2.5"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Log execution
        </Link>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500/70 flex-shrink-0" />
          <p className="text-text-tertiary text-3xs font-mono tracking-wide">ETAP 6.8</p>
        </div>
      </div>
    </aside>
  )
}

