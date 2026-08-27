export function assertDatabaseUrl(scriptName: string): void {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) return
  throw new Error(
    `${scriptName}: missing DATABASE_URL. Run this command through the npm script that loads .env.local, for example: npm run pmos:context, npm run pmos:save, or npm run repair:runtime.`,
  )
}