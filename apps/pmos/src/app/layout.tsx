import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/layout/ThemeProvider'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'PMOS Event Ledger',
  description: 'PostgreSQL event ledger for PMOS runtime history',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash: apply theme class before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pmos-theme');document.documentElement.classList.add(t==='light'?'light':'dark')}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg-base text-text-primary font-sans antialiased">
        <ThemeProvider>
          <main className="h-screen overflow-y-auto">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
