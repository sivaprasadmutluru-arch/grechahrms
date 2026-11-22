export function shiftDurationHours(start, end) {
  const minutes = value => {
    const match = typeof value === 'string' ? /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value) : null
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null
    return Number(match[1]) * 60 + Number(match[2])
  }
  const from = minutes(start)
  const to = minutes(end)
  if (from == null || to == null || from === to) return ''
  return ((to - from + 1440) % 1440) / 60
}

export function storedShiftHours(hours) {
  if (hours == null || hours === '') return null
  const value = Number(hours)
  if (!Number.isFinite(value) || value <= 0) return null
  // Existing backend representation: whole hours, or minutes for fractional hours.
  return Number.isInteger(value) ? value : Math.round(value * 60)
}

export function readShiftHours(value) {
  if (value == null) return ''
  return value <= 24 ? value : value <= 1440 ? value / 60 : value / 3600
}

export function formatShiftHours(value) {
  if (value == null || value === '') return '—'
  const minutes = Math.round(Number(value) * 60)
  if (!Number.isFinite(minutes)) return '—'
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return [hours ? `${hours}h` : '', remaining ? `${remaining}m` : ''].filter(Boolean).join(' ') || '0h'
}
