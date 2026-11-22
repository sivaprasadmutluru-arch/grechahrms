import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { fetchShiftSchedules, createShiftSchedule, updateShiftSchedule, deleteShiftSchedule, selectShiftSchedules } from './baseExtrasSlice'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import DataTable from '../../components/common/DataTable'
import Modal from '../../components/common/Modal'
import Input from '../../components/common/Input'
import ConfirmModal from '../../components/common/ConfirmModal'
import useAuth from '../../hooks/useAuth'
import { effectiveWeekOffDays } from '../../utils/weekOffDays'
import { shiftDurationHours, storedShiftHours, readShiftHours, formatShiftHours } from '../../utils/shiftDuration'
import TimeSelector from '../../components/common/TimeSelector'

const DAYS = [
  { value: 'MONDAY', label: 'Mon' },
  { value: 'TUESDAY', label: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wed' },
  { value: 'THURSDAY', label: 'Thu' },
  { value: 'FRIDAY', label: 'Fri' },
  { value: 'SATURDAY', label: 'Sat' },
  { value: 'SUNDAY', label: 'Sun' },
]

function formatWeekOff(weeklyOffDays) {
  if (!weeklyOffDays) return '—'
  const values = weeklyOffDays.split(',').filter(Boolean)
  if (values.length === 0) return '—'
  return values.map(v => DAYS.find(d => d.value === v)?.label || v).join(', ')
}

export default function ShiftSchedulesPage() {
  const dispatch = useDispatch()
  const { effectiveCompanyId } = useAuth()
  const shifts = useSelector(selectShiftSchedules)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [weekOff, setWeekOff] = useState([])
  const [weekdayTimes, setWeekdayTimes] = useState({})
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, watch, getValues, setValue, formState: { errors } } = useForm()
  const standardStart = watch('startTime') || ''
  const standardEnd = watch('endTime') || ''
  const standardHours = watch('minimumWorkingHour') || ''

  useEffect(() => { dispatch(fetchShiftSchedules()) }, [dispatch, effectiveCompanyId])

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (row) => { setEditing(row); setModalOpen(true) }

  useEffect(() => {
    if (!modalOpen) return
    reset(editing ? {
      name: editing.name,
      startTime: editing.startTime,
      endTime: editing.endTime,
      minimumWorkingHour: readShiftHours(editing.minimumWorkingHour),
      overtimeCutoff: editing.overtimeCutoff || '',
      minimumOvertimeToApprove: editing.minimumOvertimeToApprove || '',
    } : {})
    const times = { ...(editing?.weekdayTimes || {}) }
    Object.entries(editing?.weekdayShiftIds || {}).forEach(([day, id]) => {
      if (times[day]) return
      const target = shifts.find(shift => Number(shift.id) === Number(id))
      if (target) {
        const configured = target.minimumWorkingHour
        times[day] = { startTime: target.startTime?.slice(0, 5) || '', endTime: target.endTime?.slice(0, 5) || '',
          minimumHours: readShiftHours(configured) }
      }
    })
    setWeekOff((editing?.weeklyOffDays?.split(',').filter(Boolean) || []).filter(day => !times[day]))
    setWeekdayTimes(times)
  }, [modalOpen, editing])

  const setDayMode = (day, mode) => {
    setWeekOff(previous => mode === 'off' ? [...previous.filter(value => value !== day), day] : previous.filter(value => value !== day))
    setWeekdayTimes(previous => {
      const next = { ...previous }
      if (mode === 'custom') next[day] = previous[day] || {
        startTime: standardStart.slice(0, 5), endTime: standardEnd.slice(0, 5),
        minimumHours: shiftDurationHours(standardStart, standardEnd),
      }
      else delete next[day]
      return next
    })
  }

  const updateDayTime = (day, field, value) => {
    setWeekdayTimes(previous => {
      const time = { ...previous[day], [field]: value }
      time.minimumHours = shiftDurationHours(time.startTime, time.endTime)
      return { ...previous, [day]: time }
    })
  }

  const onSubmit = async (data) => {
    if (saving) return
    if (!data.startTime || !data.endTime || !shiftDurationHours(data.startTime, data.endTime)
        || !(Number(data.minimumWorkingHour) >= 0.5)) {
      toast.error('Enter different start and end times, with a duration of at least 30 minutes.')
      return
    }
    for (const [day, time] of Object.entries(weekdayTimes)) {
      const start = time.startTime?.slice(0, 5)
      const end = time.endTime?.slice(0, 5)
      const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
      const span = start && end ? (minutes(end) - minutes(start) + 1440) % 1440 : 0
      if (!start || !end || !span || !(Number(time.minimumHours) >= 0.5) || Math.round(Number(time.minimumHours) * 60) > span) {
        toast.error(`Check ${day.toLowerCase()} times: required hours must fit between start and end.`)
        return
      }
    }
    const payload = {
      name: data.name,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      minimumWorkingHour: storedShiftHours(data.minimumWorkingHour),
      overtimeCutoff: data.overtimeCutoff || null,
      minimumOvertimeToApprove: data.minimumOvertimeToApprove || null,
      weeklyOffDays: weekOff.length ? weekOff.join(',') : null,
      weekdayTimes: Object.fromEntries(Object.entries(weekdayTimes).map(([day, time]) => [day, {
        startTime: time.startTime.slice(0, 5), endTime: time.endTime.slice(0, 5), minimumHours: Number(time.minimumHours),
      }])),
      // The header company switcher is the source of truth. A platform admin's
      // profile company can differ from the company they are currently managing.
      company: effectiveCompanyId ? { id: effectiveCompanyId } : undefined,
    }
    setSaving(true)
    try {
      if (editing) {
        await dispatch(updateShiftSchedule({ id: editing.id, data: payload })).unwrap()
        toast.success('Shift updated')
      } else {
        await dispatch(createShiftSchedule(payload)).unwrap()
        toast.success('Shift created')
      }
      setModalOpen(false)
      dispatch(fetchShiftSchedules())
    } catch (e) { toast.error(typeof e === 'string' ? e : 'Could not save shift') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      await dispatch(deleteShiftSchedule(deleteTarget.id)).unwrap()
      toast.success('Shift deleted')
      setDeleteTarget(null)
    } catch (e) { toast.error(e || 'Error') }
  }

  const columns = [
    { accessorKey: 'name', header: 'Shift Name' },
    { accessorKey: 'startTime', header: 'Start Time', cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'endTime', header: 'End Time', cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'minimumWorkingHour', header: 'Required hours', cell: ({ getValue }) => formatShiftHours(readShiftHours(getValue())) },
    { accessorKey: 'minimumOvertimeToApprove', header: 'Min OT', cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'overtimeCutoff', header: 'OT Cutoff', cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'weeklyOffDays', header: 'Week off', cell: ({ row }) => formatWeekOff(effectiveWeekOffDays(row.original).join(',')) },
    { accessorKey: 'weekdayShiftIds', header: 'Custom days', cell: ({ getValue }) => formatWeekOff(Object.keys(getValue() || {}).join(',')) },
    {
      id: 'actions', header: '', cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(row.original)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteTarget(row.original)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Shift Schedules" subtitle="Manage work shift schedules" actions={<Button onClick={openCreate}>+ New Shift</Button>} />
      <DataTable columns={columns} data={shifts} />

      <Modal open={modalOpen} size="xl" onClose={() => { if (!saving) setModalOpen(false) }}
        title={editing ? `Edit weekly schedule — ${editing.name}` : 'Create weekly schedule'}
        pendingMessage={saving ? 'Saving weekly schedule…' : undefined}
        footer={<div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">Changes apply to employees assigned to this schedule.</p>
          <div className="flex gap-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSubmit(onSubmit)}>Save schedule</Button></div>
        </div>}>
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Standard working hours</h3>
          <Input label="Shift Name" error={errors.name?.message} {...register('name', { required: 'Required' })} />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TimeSelector id="standard-start" label="Start time" value={standardStart} onChange={value => {
              setValue('startTime', value, { shouldDirty: true })
              setValue('minimumWorkingHour', shiftDurationHours(value, getValues('endTime')), { shouldDirty: true })
            }} />
            <TimeSelector id="standard-end" label="End time" value={standardEnd} onChange={value => {
              setValue('endTime', value, { shouldDirty: true })
              setValue('minimumWorkingHour', shiftDurationHours(getValues('startTime'), value), { shouldDirty: true })
            }} />
            <input type="hidden" {...register('startTime')} />
            <input type="hidden" {...register('endTime')} />
            <Input label="Required hours" readOnly value={formatShiftHours(standardHours)}
              helperText="Recalculates when start or end time changes." />
            <input type="hidden" {...register('minimumWorkingHour')} />
          </div>
          </div>
          <details className="rounded-lg border border-gray-200 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-600">Overtime settings (optional)</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input label="Min OT to Approve (HH:MM)" placeholder="00:30" {...register('minimumOvertimeToApprove')} />
            <Input label="OT Cutoff (HH:MM)" placeholder="02:00" {...register('overtimeCutoff')} />
          </div>
          </details>
          <section>
            <h3 className="text-base font-semibold text-gray-900">Working hours by day</h3>
            <p className="mb-4 mt-1 text-sm text-gray-500">Standard uses the hours above. Custom lets you set different times. Week off means a non-working day.</p>
            <p className="mb-3 text-xs text-gray-500">Hours recalculate from start and end times, including overnight shifts. Break time is not deducted.</p>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="hidden grid-cols-[95px_110px_minmax(170px,1fr)_minmax(170px,1fr)_85px] gap-3 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500 lg:grid">
                <span>Day</span><span>Schedule</span><span>Start time</span><span>End time</span><span>Required hours</span>
              </div>
              {DAYS.map(day => {
                const timing = weekdayTimes[day.value]
                const mode = timing ? 'custom' : weekOff.includes(day.value) ? 'off' : 'standard'
                const label = day.value.charAt(0) + day.value.slice(1).toLowerCase()
                const start = mode === 'off' ? '' : (timing?.startTime ?? standardStart).slice(0, 5)
                const end = mode === 'off' ? '' : (timing?.endTime ?? standardEnd).slice(0, 5)
                const hours = mode === 'off' ? '' : timing?.minimumHours ?? standardHours
                const fieldClass = 'w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm disabled:border-transparent disabled:bg-transparent disabled:text-gray-600'
                return <div key={day.value} className={`grid grid-cols-2 items-start gap-3 border-t border-gray-100 p-4 lg:grid-cols-[95px_110px_minmax(170px,1fr)_minmax(170px,1fr)_85px] ${mode === 'off' ? 'bg-gray-50' : 'bg-white'}`}>
                  <span className="pt-2 text-sm font-semibold text-gray-900">{label}</span>
                  <select aria-label={`${label} schedule`} value={mode} className={fieldClass}
                    onChange={event => setDayMode(day.value, event.target.value)}>
                    <option value="standard">Standard</option>
                    <option value="custom">Custom</option>
                    <option value="off">Week off</option>
                  </select>
                  <div className="col-span-2 sm:col-span-1">
                    <TimeSelector id={`start-${day.value}`} label={`${label} start time`} value={start} disabled={mode !== 'custom'}
                      onChange={value => updateDayTime(day.value, 'startTime', value)} hideLabel />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <TimeSelector id={`end-${day.value}`} label={`${label} end time`} value={end} disabled={mode !== 'custom'}
                      onChange={value => updateDayTime(day.value, 'endTime', value)} hideLabel />
                    {start && end && end < start && <p className="mt-1 text-xs font-medium text-indigo-700">Ends next day</p>}
                  </div>
                  <div>
                    <label htmlFor={`hours-${day.value}`} className="mb-1 block text-xs text-gray-500 lg:sr-only">{label} required hours</label>
                    <input id={`hours-${day.value}`} className={fieldClass} type="text" readOnly
                      value={formatShiftHours(hours)} disabled={mode === 'off'} title="Calculated from start and end time" />
                  </div>
                </div>
              })}
            </div>
          </section>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Shift" message={`Delete shift "${deleteTarget?.name}"?`} confirmLabel="Delete" />
    </div>
  )
}
