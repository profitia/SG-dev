export function subMonths(value: Date, months: number): Date {
  const next = new Date(value)
  next.setMonth(next.getMonth() - months)
  return next
}
