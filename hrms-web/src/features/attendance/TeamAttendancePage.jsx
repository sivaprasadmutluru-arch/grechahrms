import { useEffect, useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import useAuth from '../../hooks/useAuth'
import { formatAttendanceTime, formatDate } from '../../utils/formatters'

const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const labels = { future: 'Upcoming', absent: 'No punches', weekly_off: 'Weekly off', holiday: 'Holiday', on_leave: 'On leave', present: 'Present', irregular: 'Irregular', exempt: 'Not required', on_time: 'Regular', regularised: 'Regularised', regularisation_pending: 'Correction pending' }
const colors = { present: 'bg-emerald-100 text-emerald-800', irregular: 'bg-amber-100 text-amber-900', on_leave: 'bg-indigo-100 text-indigo-800', holiday: 'bg-sky-100 text-sky-800' }
const time = (local, utc) => local || utc ? formatAttendanceTime(local, utc) : '—'
function hours(value) {
  if (value == null) return '—'
  const minutes = Math.round(value * 60)
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function useScopedRead(path, params, companyId) {
  const [state, setState] = useState({ key: '', data: null, error: '' })
  const key = path ? `${companyId}:${path}:${JSON.stringify(params)}` : ''
  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    api.get(path, { params, signal: controller.signal, headers: companyId ? { 'X-Company-Id': companyId } : {} })
      .then(({ data }) => { if (!controller.signal.aborted) setState({ key, data, error: '' }) })
      .catch(err => {
        if (!controller.signal.aborted) setState({ key, data: null, error: err.response?.status === 403
          ? 'Attendance is available only for your direct reports in the selected company.'
          : 'Could not load attendance. Please try again.' })
      })
    return () => controller.abort()
    // The key includes the complete request identity, including the date and company.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state.key === key ? state : { data: null, error: '', loading: Boolean(key) }
}

export default function TeamAttendancePage() {
  const { effectiveCompanyId, user } = useAuth()
  return <Workspace key={`${user?.userId ?? user?.id}:${effectiveCompanyId}`} companyId={effectiveCompanyId} />
}

function Workspace({ companyId }) {
  const [search, setSearch] = useSearchParams()
  const [date, setDate] = useState(today)
  const [version, setVersion] = useState(0)
  const team = useScopedRead('/team/employees', { refresh: version }, companyId)
  const members = team.data || []
  const member = members.find(item => String(item.id) === search.get('employee')) || members[0]
  const [year, month] = date.split('-').map(Number)
  const base = member ? `/team/employees/${member.id}/attendance` : null
  const history = useScopedRead(base, { year, month, refresh: version }, companyId)
  const days = history.data?.days || []
  const records = useMemo(() => {
    const map = new Map()
    for (const item of history.data?.records || []) {
      if (!map.has(item.attendanceDate) || Number(item.id) > Number(map.get(item.attendanceDate).id))
        map.set(item.attendanceDate, item)
    }
    return map
  }, [history.data])
  const selected = days.find(day => day.date === date)
  const record = records.get(date)
  const sessions = useScopedRead(base && record ? `${base}/sessions` : null, { date, refresh: version }, companyId)
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
  const blanks = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  function moveMonth(offset) {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10)
    setDate(next)
  }
  const retry = () => setVersion(value => value + 1)
  const status = record?.checkoutNeedsReview ? 'Checkout needs review' : record?.missingCheckout ? 'Missing checkout'
    : record?.checkIn && !record?.checkOut ? 'Checkout not recorded'
    : labels[selected?.status] || labels[selected?.dayType] || record?.attendanceStatus || 'No record'

  return <main className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">My team</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Team attendance</h1>
        <p className="mt-1 text-sm text-gray-600">Review daily check-in, checkout, worked time, and sessions for a direct report.</p>
      </div>
      <Link to="/attendance/regularisation" className="text-sm font-semibold text-indigo-700 hover:underline">Attendance approvals →</Link>
    </header>
    {team.error ? <p role="alert" className="text-sm text-red-700">{team.error} <button className="underline" onClick={retry}>Retry</button></p>
      : team.loading ? <p role="status" className="text-sm text-gray-600">Loading your team…</p>
      : !member ? <p className="rounded-xl border bg-white p-5 text-sm text-gray-600">No direct reports in the selected company.</p> : <>
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <label className="min-w-52 flex-1 text-sm font-medium text-gray-800">Team member
          <select className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2" value={member.id}
            onChange={event => setSearch({ employee: event.target.value }, { replace: true })}>
            {members.map(item => <option key={item.id} value={item.id}>{item.fullName}{item.badgeId ? ` · ${item.badgeId}` : ''}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-800">Jump to date
          <input type="date" value={date} min="1900-01-01" max={today()} onChange={event => {
            if (event.target.value && event.target.validity.valid) setDate(event.target.value)
          }} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2" />
        </label>
        <button type="button" onClick={() => { setDate(today()); retry() }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-indigo-700">Today</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(290px,340px)_minmax(0,1fr)]">
        <section aria-label="Attendance calendar" className="self-start rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" aria-label="Previous month" disabled={date.startsWith('1900-01')}
              onClick={() => moveMonth(-1)} className="rounded p-2 hover:bg-gray-100 disabled:opacity-30"><ChevronLeftIcon className="size-4" /></button>
            <h2 className="font-semibold text-gray-900">{monthLabel}</h2>
            <button type="button" aria-label="Next month" disabled={date.slice(0, 7) >= today().slice(0, 7)}
              onClick={() => moveMonth(1)} className="rounded p-2 hover:bg-gray-100 disabled:opacity-30"><ChevronRightIcon className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {week.map(day => <div key={day} className="pb-1 text-gray-500">{day}</div>)}
            {Array.from({ length: blanks }, (_, i) => <span key={`blank-${i}`} />)}
            {days.map(day => <button type="button" key={day.date} aria-pressed={date === day.date}
              aria-label={`${formatDate(day.date)}: ${labels[day.dayType] || day.dayType}`}
              disabled={day.dayType === 'future'} onClick={() => setDate(day.date)}
              className={`aspect-square rounded-lg font-medium disabled:opacity-40 ${date === day.date ? 'bg-indigo-700 text-white' : colors[day.dayType] || 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
              {Number(day.date.slice(-2))}
            </button>)}
          </div>
          {history.loading && <p role="status" className="mt-3 text-sm text-gray-500">Loading month…</p>}
          {history.error && <p role="alert" className="mt-3 text-sm text-red-700">{history.error} <button onClick={retry} className="underline">Retry</button></p>}
        </section>
        <section aria-label="Selected day's punches" className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-500">{member.companyName} {member.departmentName ? `· ${member.departmentName}` : ''}</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">{member.fullName} · {formatDate(date)}</h2>
          {history.data && <>
            <p className="mt-1 text-sm text-gray-600">{status}{selected?.leaveTypeName || selected?.holidayName ? ` · ${selected.leaveTypeName || selected.holidayName}` : ''}</p>
            <dl className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries({
                'Check-in': time(record?.checkIn, record?.checkInUtc), 'Checkout': time(record?.checkOut, record?.checkOutUtc),
                'Worked time': hours(record?.workedHour), 'Shift': record?.shiftName || selected?.shiftName || '—',
                'Required time': hours(record?.minimumHour), 'Overtime': hours(record?.attendanceOvertime ?? selected?.overtime),
              }).map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-gray-600">{label}</dt><dd className="mt-1 text-sm font-semibold text-gray-900">{value}</dd>
              </div>)}
            </dl>
            {record ? <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Source:</strong> {record.clockInSource || '—'} → {record.clockOutSource || '—'}</p>
              <p><strong>Check-in location:</strong> {record.checkInAddress || 'Not recorded'}</p>
              <p><strong>Checkout location:</strong> {record.checkOutAddress || 'Not recorded'}</p>
              {record.workTypeName && <p><strong>Work type:</strong> {record.workTypeName}</p>}
              {record.deductionMinutes > 0 && <p><strong>Deduction:</strong> {record.deductionMinutes} min{selected?.types?.length ? ` · ${selected.types.map(type => type.replaceAll('_', ' ').toLowerCase()).join(', ')}` : ''}</p>}
              <h3 className="pt-3 font-semibold text-gray-900">Sessions</h3>
              {sessions.loading && <p role="status">Loading sessions…</p>}
              {sessions.error && <p role="alert" className="text-red-700">{sessions.error}</p>}
              {sessions.data?.length === 0 && <p>No separate sessions recorded for this day.</p>}
              {sessions.data?.map((session, i) => <div key={i} className="rounded-lg border border-gray-200 p-3">
                <div className="font-medium">{time(session.checkIn)} → {time(session.checkOut)}{session.checkOutDate && session.checkOutDate !== date ? ` · ${formatDate(session.checkOutDate)}` : ''}</div>
                {(session.checkInAddress || session.checkOutAddress) && <div className="text-xs text-gray-600">{session.checkInAddress || '—'} → {session.checkOutAddress || '—'}</div>}
              </div>)}
            </div> : <p className="text-sm text-gray-500">No punches are recorded for this date.</p>}
          </>}
        </section>
      </div>
      {history.data && <section aria-label="Monthly attendance log" className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">Daily log · {monthLabel}</h2>
          <p className="text-xs text-gray-600">Select a date to see its full details. Punch times are shown in Dubai time.</p></div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[510px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-gray-600"><tr>
              {['Date', 'Check-in', 'Checkout', 'Worked time', 'Status'].map(label => <th key={label} scope="col" className="px-4 py-2">{label}</th>)}
            </tr></thead>
            <tbody>{days.filter(day => day.dayType !== 'future').map(day => {
              const entry = records.get(day.date)
              const dayStatus = entry?.checkoutNeedsReview ? 'Checkout needs review' : entry?.missingCheckout ? 'Missing checkout'
                : entry?.checkIn && !entry?.checkOut ? 'Checkout not recorded' : labels[day.status] || labels[day.dayType] || '—'
              return <tr key={day.date} className={`border-t border-slate-100 ${day.date === date ? 'bg-indigo-50' : ''}`}>
                <td className="px-4 py-2"><button type="button" aria-pressed={day.date === date} onClick={() => setDate(day.date)}
                  className="font-medium text-indigo-700 hover:underline">{formatDate(day.date)}</button></td>
                <td className="whitespace-nowrap px-4 py-2">{time(entry?.checkIn, entry?.checkInUtc)}</td>
                <td className="whitespace-nowrap px-4 py-2">{time(entry?.checkOut, entry?.checkOutUtc)}</td>
                <td className="px-4 py-2">{hours(entry?.workedHour)}</td><td className="px-4 py-2">{dayStatus}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </section>}
    </>}
  </main>
}
