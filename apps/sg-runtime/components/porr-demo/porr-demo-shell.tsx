type PorrDemoShellProps = {
  children: React.ReactNode
  locale: 'pl' | 'en'
  activeRoute: 'home' | 'benchmark-finder'
}

export async function PorrDemoShell({ children }: PorrDemoShellProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f2ea_0%,#fbfaf8_48%,#f4f0e8_100%)] px-6 py-6 sm:px-10 sm:py-8">
      <div className="mx-auto max-w-7xl rounded-[32px] border border-slate-200 bg-white/90 shadow-[0_30px_120px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="px-6 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>
    </main>
  )
}