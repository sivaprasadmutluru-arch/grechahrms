import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import WeeklyShiftDialog from './WeeklyShiftDialog'

function timeLabel(value) {
  if (!value) return ''
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return ''
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default function TodayShiftSummary({ status, fallbackName }) {
  const [now, setNow] = useState(Date.now)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  const start = timeLabel(status?.shiftStartTime)
  const end = timeLabel(status?.shiftEndTime)
  const beforeStart = !status?.online && status?.shiftStartsAt && now < new Date(status.shiftStartsAt).getTime()
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Today’s shift</p>
      {status?.shiftName || fallbackName ? <button type="button"
        onClick={() => setScheduleOpen(true)} aria-haspopup="dialog" aria-expanded={scheduleOpen}
        title="View weekly shift schedule"
        className="mt-0.5 inline-flex max-w-full items-center gap-2 rounded text-left text-sm font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-4 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <span className="break-words">{status?.shiftName || fallbackName}</span>
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button> : <p className="mt-0.5 text-sm text-gray-500">Not assigned</p>}
      {start && end && <p className="mt-1 text-sm font-medium text-gray-700">
        {start} – {end}{status?.shiftEndsNextDay && <span className="ml-1 text-xs text-gray-500">(next day)</span>}
      </p>}
      {status?.shiftDayOff ? <p className="mt-1 text-xs text-gray-500">Scheduled day off</p>
        : beforeStart && start && status?.attendanceRequired !== false && (
          <p className="mt-1 text-xs font-medium text-indigo-700" role="status">Shift starts at {start}</p>
        )}
      <WeeklyShiftDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
    </div>
  )
}
