export function shiftStartRemaining(startsAt, now = Date.now()) {
  const start = startsAt ? new Date(startsAt).getTime() : NaN
  return Number.isFinite(start) ? Math.max(0, Math.ceil((start - now) / 1000)) : 0
}

export function formatShiftCountdown(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return [hours ? `${hours}h` : '', `${minutes}m`, `${seconds % 60}s`].filter(Boolean).join(' ')
}
