/**
 * CSS module type declarations for PMOS.
 *
 * This file allows TypeScript to accept CSS side-effect imports
 * (e.g., `import './globals.css'` in layout.tsx).
 *
 * Next.js normally provides these declarations via next-env.d.ts,
 * which is auto-generated on `next dev`/`next build` and excluded from git.
 * This file covers the template source before next-env.d.ts is generated.
 */

declare module '*.css' {
  const content: Record<string, string>
  export default content
}
