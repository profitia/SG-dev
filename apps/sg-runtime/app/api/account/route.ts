import { readSelfServiceAccount, accountUnavailable } from '@/lib/platform/account-session'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const GET = (request: Request) => readSelfServiceAccount(request)
export const POST = () => accountUnavailable(405)
export const PUT = POST
export const PATCH = POST
export const DELETE = POST
export const OPTIONS = POST
