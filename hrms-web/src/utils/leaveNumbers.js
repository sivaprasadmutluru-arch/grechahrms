const leaveDays = new Intl.NumberFormat('en-US', {
  useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2,
})

/** Display formatting only: never use this string for accrual, balance updates or calculations. */
export function formatLeaveDays(value) {
  if (value == null || (typeof value === 'string' && !value.trim())) return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return leaveDays.format(Math.abs(number) < 0.005 ? 0 : number)
}
