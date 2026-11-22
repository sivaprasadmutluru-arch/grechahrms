const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export function effectiveWeekOffDays(schedule) {
  const off = new Set((schedule?.weeklyOffDays || '').split(',').map(day => day.trim().toUpperCase()).filter(Boolean))
  return DAYS.filter(day => {
    const custom = schedule?.weekdayTimes?.[day]
    return off.has(day) && !(custom?.startTime && custom?.endTime && custom.startTime !== custom.endTime)
  })
}
