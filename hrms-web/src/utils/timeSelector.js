export function splitTimeValue(value) {
  const match = typeof value === 'string' ? /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value) : null
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return { hour: '', minute: '', period: 'AM' }
  const hour = Number(match[1])
  return { hour: String(hour % 12 || 12).padStart(2, '0'), minute: match[2], period: hour >= 12 ? 'PM' : 'AM' }
}

export function updateTimeValue(value, field, selection) {
  const parts = { ...splitTimeValue(value), [field]: selection }
  const hour = Number(parts.hour || 12) % 12 + (parts.period === 'PM' ? 12 : 0)
  return `${String(hour).padStart(2, '0')}:${parts.minute || '00'}`
}
