import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { bulkUpdateEmployees } from './employeesSlice'
import { fetchAll as fetchDepartments } from '../departments/departmentsSlice'
import { fetchShiftSchedules, fetchWorkTypes, fetchJobPositions } from '../base/baseExtrasSlice'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import { beginMutation } from '../../services/mutationLoading'

export default function BulkUpdateModal({ employeeIds, onClose, onSuccess }) {
  const dispatch = useDispatch()
  const departments = useSelector(s => s.departments?.data || [])
  const shiftSchedules = useSelector(s => s.baseExtras?.shiftSchedules || [])
  const workTypes = useSelector(s => s.baseExtras?.workTypes || [])
  const jobPositions = useSelector(s => s.baseExtras?.jobPositions || [])
  const { register, handleSubmit } = useForm()
  const submissionInFlight = useRef(false)
  const [saving, setSaving] = useState(false)
  const close = () => { if (!submissionInFlight.current) onClose() }

  useEffect(() => {
    dispatch(fetchDepartments())
    dispatch(fetchShiftSchedules())
    dispatch(fetchWorkTypes())
    dispatch(fetchJobPositions())
  }, [dispatch])

  const onSubmit = async (data) => {
    if (submissionInFlight.current) return
    // Only include fields that are filled; send IDs to backend
    const payload = { employeeIds }
    if (data.departmentId) payload.departmentId = Number(data.departmentId)
    if (data.shiftId) payload.shiftId = Number(data.shiftId)
    if (data.workTypeId) payload.workTypeId = Number(data.workTypeId)
    if (data.jobPositionId) payload.jobPositionId = Number(data.jobPositionId)

    submissionInFlight.current = true
    const finish = beginMutation(`Updating ${employeeIds.length} employees…`)
    setSaving(true)
    try {
      await dispatch(bulkUpdateEmployees(payload)).unwrap()
      toast.success(`Updated ${employeeIds.length} employees`)
      onSuccess?.()
      onClose()
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to bulk update employees')
    } finally {
      finish()
      submissionInFlight.current = false
      setSaving(false)
    }
  }

  return (
    <Modal open title={`Bulk Update (${employeeIds.length} employees)`} onClose={close}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-gray-500">Leave fields blank to keep existing values.</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select
            {...register('departmentId')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— No change —</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
          <select
            {...register('shiftId')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— No change —</option>
            {shiftSchedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Work Type</label>
          <select
            {...register('workTypeId')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— No change —</option>
            {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Position</label>
          <select
            {...register('jobPositionId')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— No change —</option>
            {jobPositions.map(jp => <option key={jp.id} value={jp.id}>{jp.name}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" disabled={saving} onClick={close}>Cancel</Button>
          <Button type="submit" disabled={saving}>Update Employees</Button>
        </div>
      </form>
    </Modal>
  )
}
