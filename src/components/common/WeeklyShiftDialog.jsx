import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import Badge from './Badge'
import api from '../../services/api'
import { splitTimeValue } from '../../utils/timeSelector'
import { formatShiftHours } from '../../utils/shiftDuration'

function timeLabel(value) {
  if (!value) return '—'
  const parts = splitTimeValue(value)
  return parts.hour ? `${parts.hour}:${parts.minute} ${parts.period}` : '—'
}

export default function WeeklyShiftDialog({ open, onClose }) {
  const [schedule, setSchedule] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setSchedule(null)
    api.get('/ess/my-shift-schedule', { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setSchedule(data) })
      .catch(error => {
        if (!controller.signal.aborted) setError(error.response?.data?.message || 'Could not load your shift schedule.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [open, attempt])

  const today = new Date().toLocaleDateString('en-CA', { timeZone: schedule?.timeZone || 'Asia/Dubai' })
  return (
    <Modal open={open} onClose={onClose} title="My weekly shift schedule" size="lg"
      footer={<div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>}>
      {loading ? <p role="status" className="py-8 text-center text-sm text-gray-500">Loading your schedule…</p>
        : error ? <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error} <button className="ml-2 font-medium underline" onClick={() => setAttempt(value => value + 1)}>Retry</button>
        </div>
          : !schedule?.days?.length ? <p className="py-4 text-sm text-gray-500">No shift schedule is assigned. Please contact your organisation’s HR team.</p>
            : <>
              <p className="font-semibold text-gray-900">{schedule.name}</p>
              <p className="mb-4 mt-1 text-xs text-gray-500">Current weekly pattern · All times in {schedule.timeZone}</p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr><th className="px-4 py-3">Day</th><th className="px-4 py-3">Working time</th><th className="px-4 py-3">Required hours</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {schedule.days.map(day => (
                      <tr key={day.date} className={day.date === today ? 'bg-indigo-50/70' : ''}>
                        <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                          {day.day.charAt(0) + day.day.slice(1).toLowerCase()}
                          {day.date === today && <span className="ml-2 text-xs text-indigo-700">Today</span>}
                        </th>
                        <td className="px-4 py-3 text-gray-700">
                          {day.weekOff ? <Badge label="Week off" /> : <>
                            <span className="whitespace-nowrap">{timeLabel(day.startTime)} – {timeLabel(day.endTime)}</span>
                            {day.endsNextDay && <p className="mt-1 text-xs text-indigo-700">Ends next day</p>}
                          </>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{day.weekOff ? '—' : formatShiftHours(day.requiredHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-gray-500">This is a view-only schedule. Contact your HR team if your assigned times are incorrect.</p>
            </>}
    </Modal>
  )
}
