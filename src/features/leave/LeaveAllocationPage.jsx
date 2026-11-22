import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  fetchAllocationRequests, createAllocationRequest, approveAllocationRequest,
  rejectAllocationRequest, requestAllocationAdjustment, fetchLeaveTypes, selectAllocationRequests, selectLoading
} from './leaveSlice'
import { fetchAll as fetchEmployees, selectAll as selectEmployees } from '../employees/employeesSlice'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import { STATUS_COLORS } from '../../config/constants'
import useAuth from '../../hooks/useAuth'

export default function LeaveAllocationPage() {
  const dispatch = useDispatch()
  const { isEmployee } = useAuth()
  const allocationRequests = useSelector(selectAllocationRequests)
  const loading = useSelector(selectLoading)
  const leaveTypes = useSelector(s => s.leave.leaveTypes)
  const employees = useSelector(selectEmployees)
  const [modalOpen, setModalOpen] = useState(false)
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, reason: '' })
  const [adjustmentModal, setAdjustmentModal] = useState({ open: false, source: null, mode: 'AMEND', leaveTypeId: '', requestedDays: '', reason: '' })
  const [showHistory, setShowHistory] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => {
    dispatch(fetchAllocationRequests())
    dispatch(fetchLeaveTypes())
    dispatch(fetchEmployees({ page: 0, size: 200 }))
  }, [dispatch])

  const handleApprove = async (id) => {
    try {
      await dispatch(approveAllocationRequest(id)).unwrap()
      // Approval can supersede or cancel a separate source allocation. Refresh
      // the complete set so both rows immediately disappear from the active view.
      dispatch(fetchAllocationRequests())
      toast.success('Allocation request approved')
    } catch (e) { toast.error(e || 'Failed') }
  }

  const handleReject = (id) => {
    setRejectModal({ open: true, id, reason: '' })
  }
  const submitReject = async () => {
    try {
      await dispatch(rejectAllocationRequest({ id: rejectModal.id, reason: rejectModal.reason || undefined })).unwrap()
      dispatch(fetchAllocationRequests())
      toast.success('Allocation request rejected')
      setRejectModal({ open: false, id: null, reason: '' })
    } catch (e) { toast.error(e || 'Failed') }
  }

  const onSubmit = async (formData) => {
    try {
      await dispatch(createAllocationRequest({
        employee: { id: Number(formData.employeeId) },
        leaveType: { id: Number(formData.leaveTypeId) },
        requestedDays: Number(formData.requestedDays),
        description: formData.description,
      })).unwrap()
      toast.success('Allocation request submitted')
      setModalOpen(false)
      reset()
    } catch (e) { toast.error(e || 'Error') }
  }

  const openAdjustment = (source, mode) => {
    setAdjustmentModal({
      open: true,
      source,
      mode,
      leaveTypeId: String(source.leaveTypeId || ''),
      requestedDays: String(source.appliedDays ?? source.requestedDays ?? ''),
      reason: '',
    })
  }

  const submitAdjustment = async () => {
    const { source, mode, leaveTypeId, requestedDays, reason } = adjustmentModal
    if (!reason.trim()) return toast.error('A reason is required')
    if (mode === 'AMEND' && (requestedDays === '' || Number(requestedDays) < 0 || !leaveTypeId)) {
      return toast.error('Enter a valid leave type and adjusted days')
    }
    try {
      await dispatch(requestAllocationAdjustment({
        id: source.id,
        data: mode === 'CANCEL'
          ? { cancel: true, reason: reason.trim() }
          : { cancel: false, leaveTypeId: Number(leaveTypeId), requestedDays: Number(requestedDays), reason: reason.trim() },
      })).unwrap()
      toast.success(mode === 'CANCEL' ? 'Cancellation request submitted for approval' : 'Adjustment request submitted for approval')
      setAdjustmentModal({ open: false, source: null, mode: 'AMEND', leaveTypeId: '', requestedDays: '', reason: '' })
    } catch (e) { toast.error(e || 'Failed to submit adjustment') }
  }

  const columns = [
    { id: 'employee', header: 'Employee', cell: ({ row }) => row.original.employeeName || '—' },
    { id: 'leaveType', header: 'Leave Type', cell: ({ row }) => row.original.leaveTypeName || '—' },
    { accessorKey: 'requestedDays', header: 'Days Requested' },
    { accessorKey: 'requestedDate', header: 'Requested On' },
    { accessorKey: 'description', header: 'Description', cell: ({ getValue }) => <span className="max-w-xs truncate block">{getValue() || '—'}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge label={getValue()} variant={STATUS_COLORS[getValue()?.toLowerCase()] || 'default'} /> },
    { id: 'actions', header: '', cell: ({ row }) => {
      const request = row.original
      if (request.status === 'REQUESTED' && !isEmployee()) return (
        <div className="flex gap-2">
          <Button size="sm" variant="success" onClick={() => handleApprove(request.id)}>Approve</Button>
          <Button size="sm" variant="danger" onClick={() => handleReject(request.id)}>Reject</Button>
        </div>
      )
      if (request.status === 'APPROVED' && (request.lifecycleStatus || 'ACTIVE') === 'ACTIVE' && !isEmployee()) return (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openAdjustment(request, 'AMEND')}>Request edit</Button>
          <Button size="sm" variant="danger" onClick={() => openAdjustment(request, 'CANCEL')}>Request cancel</Button>
        </div>
      )
      return null
    } },
  ]

  // The default is an operational queue: pending decisions and allocations that
  // are still effective. Historical grants, amendments and cancellations remain
  // retained server-side, but do not clutter everyday allocation work.
  const displayedRequests = useMemo(() => {
    if (showHistory) return allocationRequests
    return allocationRequests.filter(request => {
      if (request.status === 'REQUESTED') return true
      return request.status === 'APPROVED'
        && (request.lifecycleStatus || 'ACTIVE') === 'ACTIVE'
        && request.allocationAction !== 'CANCEL'
    })
  }, [allocationRequests, showHistory])

  return (
    <div>
      <PageHeader title="Leave Allocation Requests" subtitle="Employee requests for additional leave days"
        actions={<div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowHistory(value => !value)}>
            {showHistory ? 'Hide history' : 'View history'}
          </Button>
          <Button onClick={() => { reset(); setModalOpen(true) }}>+ New Request</Button>
        </div>} />
      <DataTable columns={columns} data={displayedRequests} loading={loading} />
      {/* Reject Allocation Request Modal */}
      <Modal open={rejectModal.open} onClose={() => setRejectModal(m => ({ ...m, open: false }))} title="Reject Allocation Request"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectModal(m => ({ ...m, open: false }))}>Cancel</Button>
            <Button variant="danger" onClick={submitReject}>Reject</Button>
          </div>
        }>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rejection reason (optional)</label>
          <textarea
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            value={rejectModal.reason}
            onChange={e => setRejectModal(m => ({ ...m, reason: e.target.value }))}
            placeholder="Enter a reason…"
          />
        </div>
      </Modal>

      <Modal open={adjustmentModal.open} onClose={() => setAdjustmentModal(m => ({ ...m, open: false }))}
        title={adjustmentModal.mode === 'CANCEL' ? 'Request Allocation Cancellation' : 'Request Allocation Amendment'}
        footer={<div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAdjustmentModal(m => ({ ...m, open: false }))}>Cancel</Button>
          <Button onClick={submitAdjustment}>Submit for approval</Button>
        </div>}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">The original approved allocation remains in the audit trail. The balance changes only after this request is approved.</p>
          {adjustmentModal.mode === 'AMEND' && <>
            <Select label="New Leave Type" options={leaveTypes.map(lt => ({ value: lt.id, label: lt.name }))}
              value={adjustmentModal.leaveTypeId} onChange={e => setAdjustmentModal(m => ({ ...m, leaveTypeId: e.target.value }))} />
            <Input label="Adjusted Days" type="number" min="0" step="0.5" value={adjustmentModal.requestedDays}
              onChange={e => setAdjustmentModal(m => ({ ...m, requestedDays: e.target.value }))} />
          </>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" rows={3}
              value={adjustmentModal.reason} onChange={e => setAdjustmentModal(m => ({ ...m, reason: e.target.value }))}
              placeholder={adjustmentModal.mode === 'CANCEL' ? 'Why should this allocation be cancelled?' : 'Why should this allocation be changed?'} />
          </div>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Request Leave Allocation"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)}>Submit</Button>
          </div>
        }>
        <div className="space-y-4">
          <Select label="Employee" options={employees.map(e => ({ value: e.id, label: e.fullName || e.email }))}
            error={errors.employeeId?.message} {...register('employeeId', { required: 'Required' })} />
          <Select label="Leave Type" options={leaveTypes.map(lt => ({ value: lt.id, label: lt.name }))}
            error={errors.leaveTypeId?.message} {...register('leaveTypeId', { required: 'Required' })} />
          <Input label="Days Requested" type="number" step="0.5"
            error={errors.requestedDays?.message} {...register('requestedDays', { required: 'Required', min: 0.5 })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3} {...register('description')} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
