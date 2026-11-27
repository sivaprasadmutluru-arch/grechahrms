import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarDaysIcon, ClockIcon, EnvelopeIcon, PlusIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import Spinner from '../../components/common/Spinner'
import useAuth from '../../hooks/useAuth'
import api from '../../services/api'

const WEEKDAYS = [
  { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' }, { value: 7, label: 'Sunday' },
]
const ZONES = [
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (Dubai)' }, { value: 'Asia/Kolkata', label: 'India Standard Time' },
  { value: 'Asia/Riyadh', label: 'Arabia Standard Time (Riyadh)' }, { value: 'Europe/London', label: 'United Kingdom time' },
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
]
const EMPTY_FORM = { name: '', frequency: 'DAILY', dayOfWeek: 1, dayOfMonth: 1, sendAt: '09:00', timeZone: 'Asia/Dubai', recipientEmployeeIds: [], enabled: true }
const API = '/attendance/report-schedules'

function cadenceLabel(schedule) {
  if (schedule.frequency === 'WEEKLY') return `Every ${WEEKDAYS.find(d => d.value === Number(schedule.dayOfWeek))?.label || 'week'} at ${schedule.sendAt}`
  if (schedule.frequency === 'MONTHLY') return `Monthly on day ${schedule.dayOfMonth} at ${schedule.sendAt}`
  return `Every day at ${schedule.sendAt}`
}

export default function AttendanceReportSchedulesPage() {
  const { user, effectiveCompanyId } = useAuth()
  const companyId = effectiveCompanyId || user?.companyId || user?.company?.id
  const [employees, setEmployees] = useState([])
  const [schedules, setSchedules] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return }
    setLoading(true)
    try {
      const [employeeResponse, scheduleResponse] = await Promise.all([
        api.get(`${API}/employees`, { params: { companyId } }),
        api.get(API, { params: { companyId } }),
      ])
      setEmployees(employeeResponse.data || [])
      setSchedules(scheduleResponse.data || [])
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load report schedules')
    } finally { setLoading(false) }
  }, [companyId])

  useEffect(() => { load() }, [load])

  const employeeById = useMemo(() => new Map(employees.map(e => [Number(e.id), e])), [employees])
  const eligibleEmployees = useMemo(() => employees.filter(e => e.eligible && `${e.name} ${e.employeeCode || ''} ${e.email || ''}`.toLowerCase().includes(search.toLowerCase())), [employees, search])
  const activeCount = schedules.filter(s => s.enabled).length

  const beginCreate = () => { setEditingId(null); setForm({ ...EMPTY_FORM, name: 'Attendance report' }); setSearch(''); setShowForm(true) }
  const beginEdit = (schedule) => {
    setEditingId(schedule.id)
    setForm({ ...EMPTY_FORM, ...schedule, recipientEmployeeIds: (schedule.recipientEmployeeIds || []).map(Number), sendAt: String(schedule.sendAt || '09:00').slice(0, 5) })
    setSearch('')
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setSearch('') }
  const patchForm = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const toggleRecipient = (id) => setForm(current => {
    const ids = new Set(current.recipientEmployeeIds.map(Number))
    ids.has(Number(id)) ? ids.delete(Number(id)) : ids.add(Number(id))
    return { ...current, recipientEmployeeIds: [...ids] }
  })
  const selectVisible = () => setForm(current => {
    const ids = new Set(current.recipientEmployeeIds.map(Number))
    const allVisibleSelected = eligibleEmployees.length > 0 && eligibleEmployees.every(e => ids.has(Number(e.id)))
    eligibleEmployees.forEach(e => allVisibleSelected ? ids.delete(Number(e.id)) : ids.add(Number(e.id)))
    return { ...current, recipientEmployeeIds: [...ids] }
  })

  const save = async (event) => {
    event.preventDefault()
    if (!companyId) return toast.error('Select a company first')
    if (!form.recipientEmployeeIds.length) return toast.error('Choose at least one employee to receive the report')
    if (form.frequency === 'WEEKLY' && !form.dayOfWeek) return toast.error('Choose a day of the week')
    if (form.frequency === 'MONTHLY' && !form.dayOfMonth) return toast.error('Choose a day of the month')
    setSaving(true)
    try {
      const payload = { ...form, name: form.name.trim(), recipientEmployeeIds: form.recipientEmployeeIds.map(Number), dayOfWeek: form.frequency === 'WEEKLY' ? Number(form.dayOfWeek) : null, dayOfMonth: form.frequency === 'MONTHLY' ? Number(form.dayOfMonth) : null }
      if (editingId) await api.put(`${API}/${editingId}`, payload, { params: { companyId } })
      else await api.post(API, payload, { params: { companyId } })
      toast.success(editingId ? 'Schedule updated' : 'Report schedule created')
      closeForm()
      await load()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save this schedule')
    } finally { setSaving(false) }
  }

  const toggleSchedule = async (schedule) => {
    try {
      await api.patch(`${API}/${schedule.id}/enabled`, { enabled: !schedule.enabled }, { params: { companyId } })
      setSchedules(current => current.map(s => s.id === schedule.id ? { ...s, enabled: !s.enabled } : s))
      toast.success(schedule.enabled ? 'Schedule paused' : 'Schedule enabled')
    } catch (error) { toast.error(error.response?.data?.message || 'Could not update schedule') }
  }

  const removeSchedule = async (schedule) => {
    if (!window.confirm(`Delete “${schedule.name}”? Its future emails will stop.`)) return
    try {
      await api.delete(`${API}/${schedule.id}`, { params: { companyId } })
      setSchedules(current => current.filter(s => s.id !== schedule.id))
      toast.success('Schedule deleted')
    } catch (error) { toast.error(error.response?.data?.message || 'Could not delete schedule') }
  }

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Spinner /></div>

  return (
    <div className="space-y-6">
      <PageHeader title="Scheduled attendance reports" subtitle="Automatically prepare attendance reports and email selected employees on a schedule." />
      {!companyId ? <Card><p className="p-6 text-sm text-gray-600">Select a company to manage its attendance report schedules.</p></Card> : <>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><div className="flex items-center gap-3 p-4"><CalendarDaysIcon className="h-8 w-8 text-indigo-600"/><div><p className="text-2xl font-semibold text-gray-900">{schedules.length}</p><p className="text-sm text-gray-500">Total schedules</p></div></div></Card>
          <Card><div className="flex items-center gap-3 p-4"><ClockIcon className="h-8 w-8 text-emerald-600"/><div><p className="text-2xl font-semibold text-gray-900">{activeCount}</p><p className="text-sm text-gray-500">Active schedules</p></div></div></Card>
          <Card><div className="flex items-center gap-3 p-4"><UserGroupIcon className="h-8 w-8 text-violet-600"/><div><p className="text-2xl font-semibold text-gray-900">{employees.filter(e => e.eligible).length}</p><p className="text-sm text-gray-500">Employees with email</p></div></div></Card>
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div><h2 className="font-semibold text-gray-900">Report schedules</h2><p className="mt-1 text-sm text-gray-500">Daily reports cover yesterday, weekly reports cover Monday–Sunday, and monthly reports cover the previous month.</p></div>
            {!showForm && <Button onClick={beginCreate}><span className="inline-flex items-center gap-1"><PlusIcon className="h-4 w-4"/> Create schedule</span></Button>}
          </div>

          {showForm && <form onSubmit={save} className="space-y-5 border-b border-gray-100 bg-gray-50/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit report schedule' : 'Create report schedule'}</h3><p className="mt-1 text-sm text-gray-500">The Excel report is attached to an email sent to the employees selected below.</p></div><Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-medium text-gray-700">Schedule name<input required maxLength={120} value={form.name} onChange={e => patchForm('name', e.target.value)} placeholder="Daily attendance report" className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"/></label>
              <label className="text-sm font-medium text-gray-700">Frequency<select value={form.frequency} onChange={e => patchForm('frequency', e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select></label>
              {form.frequency === 'WEEKLY' && <label className="text-sm font-medium text-gray-700">Send every<select value={form.dayOfWeek} onChange={e => patchForm('dayOfWeek', Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal">{WEEKDAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>}
              {form.frequency === 'MONTHLY' && <label className="text-sm font-medium text-gray-700">Day of month<select value={form.dayOfMonth} onChange={e => patchForm('dayOfMonth', Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal">{Array.from({ length: 31 }, (_, i) => i + 1).map(day => <option key={day} value={day}>{day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}</option>)}</select><span className="mt-1 block text-xs font-normal text-gray-500">Runs on the last day of shorter months when needed.</span></label>}
              <label className="text-sm font-medium text-gray-700">Send time<input type="time" required value={form.sendAt} onChange={e => patchForm('sendAt', e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
              <label className="text-sm font-medium text-gray-700 md:col-span-2">Time zone<select value={form.timeZone} onChange={e => patchForm('timeZone', e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal">{ZONES.map(zone => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select></label>
            </div>
            <section className="rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3"><div><h4 className="font-medium text-gray-900">Email recipients</h4><p className="text-xs text-gray-500">{form.recipientEmployeeIds.length} selected · choose one or more employees with email addresses</p></div><button type="button" onClick={selectVisible} disabled={!eligibleEmployees.length} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:text-gray-400">Select all shown</button></div>
              <div className="p-4"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee name, ID, or email" className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"/><div className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
                {eligibleEmployees.length ? eligibleEmployees.map(employee => <label key={employee.id} className="flex cursor-pointer items-center gap-3 py-3"><input type="checkbox" checked={form.recipientEmployeeIds.map(Number).includes(Number(employee.id))} onChange={() => toggleRecipient(employee.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-gray-900">{employee.name}</span><span className="block truncate text-xs text-gray-500">{employee.employeeCode || 'No employee ID'} · {employee.department || 'No department'} · {employee.email}</span></span></label>) : <p className="py-6 text-center text-sm text-gray-500">No employees with an email address match this search.</p>}
              </div></div>
              {employees.some(e => !e.eligible) && <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">Employees without an email address cannot receive scheduled reports.</p>}
            </section>
            <div className="flex flex-wrap items-center justify-between gap-3"><label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.enabled} onChange={e => patchForm('enabled', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600"/> Enable as soon as it is saved</label><Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create schedule'}</Button></div>
          </form>}

          {schedules.length === 0 && !showForm ? <div className="px-5 py-14 text-center"><CalendarDaysIcon className="mx-auto h-10 w-10 text-gray-300"/><h3 className="mt-3 font-medium text-gray-900">No scheduled reports yet</h3><p className="mt-1 text-sm text-gray-500">Create a daily, weekly, or monthly schedule and choose who receives it.</p></div> : schedules.length > 0 && <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{['Schedule', 'Frequency', 'Recipients', 'Last delivery', 'Status', 'Actions'].map(label => <th key={label} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 bg-white">{schedules.map(schedule => <tr key={schedule.id} className="align-top"><td className="px-5 py-4"><p className="font-medium text-gray-900">{schedule.name}</p><p className="mt-1 text-xs text-gray-500">{schedule.timeZone}</p></td><td className="px-5 py-4"><p className="text-sm text-gray-800">{cadenceLabel(schedule)}</p><p className="mt-1 text-xs text-gray-500">{schedule.frequency === 'DAILY' ? 'Previous day' : schedule.frequency === 'WEEKLY' ? 'Previous Monday–Sunday' : 'Previous calendar month'}</p></td><td className="px-5 py-4"><p className="text-sm text-gray-800">{(schedule.recipientEmployeeIds || []).length} employee(s)</p><p className="mt-1 max-w-xs truncate text-xs text-gray-500">{(schedule.recipientEmployeeIds || []).map(id => employeeById.get(Number(id))?.name).filter(Boolean).join(', ') || 'No recipients'}</p></td><td className="px-5 py-4"><p className="text-sm text-gray-800">{schedule.lastRunDate || 'Not sent yet'}</p>{schedule.lastRunMessage && <p className="mt-1 text-xs text-gray-500">{schedule.lastRunMessage}</p>}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${schedule.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{schedule.enabled ? 'Active' : 'Paused'}</span>{schedule.lastRunStatus && <p className={`mt-1 text-xs ${schedule.lastRunStatus === 'SENT' ? 'text-emerald-700' : schedule.lastRunStatus === 'PARTIAL' ? 'text-amber-700' : 'text-red-600'}`}>Last run: {schedule.lastRunStatus.toLowerCase()}</p>}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => beginEdit(schedule)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Edit</button><button type="button" onClick={() => toggleSchedule(schedule)} className="text-sm font-medium text-gray-600 hover:text-gray-900">{schedule.enabled ? 'Pause' : 'Enable'}</button><button type="button" onClick={() => removeSchedule(schedule)} className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4"/>Delete</button></div></td></tr>)}</tbody></table></div>}
        </Card>
        <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950"><EnvelopeIcon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600"/><p>Reports are sent as Excel attachments using the company email configuration. Configure an active SMTP account before the scheduled time. Delivery history shows the result of the last run.</p></div>
      </>}
    </div>
  )
}
