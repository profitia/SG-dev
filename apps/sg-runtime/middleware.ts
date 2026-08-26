import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// Locale-aware routing middleware.
// - Redirects / to /pl (the default locale).
// - Recognises /pl and /en as valid locale prefixes.
// - Stores the last locale in a cookie for future visits.
// /api routes are intentionally excluded by the matcher so /api/health is unaffected.
export default createMiddleware(routing)

export const config = {
  matcher: [
    // Match all pathnames except:
    // - /api/* (health route and future API routes must not be locale-redirected)
    // - /_next/* (Next.js internals)
    // - Static files (anything with a file extension: .ico, .png, .css, etc.)
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
