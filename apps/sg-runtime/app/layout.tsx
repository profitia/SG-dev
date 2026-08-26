import './globals.css'

// Root layout — minimal shell required by Next.js App Router.
// The locale-specific <html> and <body> are provided by app/[locale]/layout.tsx.
// globals.css is imported here so it applies globally regardless of locale.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children as React.ReactElement
}
