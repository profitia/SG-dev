// Root page — redirects to the default locale (/pl).
// The middleware handles this redirect for most requests; this component is a
// safe fallback for any edge case where the middleware is bypassed.
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/pl')
}
