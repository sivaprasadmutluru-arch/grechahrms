import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  fetchMyRequests, submitRequest,
  fetchPendingApproval, approveRequest, rejectRequest,
  fetchAllForCompany,
  selectMyRequests, selectPendingApproval, selectAllRequests, selectRegLoading,
} from './regularisationSlice'
import { fetchAll as fetchAttendance, selectAll as selectAttendance } from './attendanceSlice'
import useAuth from '../../hooks/useAuth'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import { formatAttendanceTime, formatDate } from '../../utils/formatters'
import api from '../../services/api'
import useTeamRegularisation from './useTeamRegularisation'

const REQUEST_TYPES = [
  { value: 'LATE_ARRIVAL',              label: 'Late Arrival' },
  { value: 'LATE_CHECK_IN_REASON',     label: 'Late check-in explanation' },
  { value: 'LATE_CHECK_OUT_REASON',    label: 'Late checkout explanation' },
  { value: 'MISSING_PUNCH',             label: 'Missing Punch' },
  { value: 'WORKING_HOURS_CORRECTION',  label: 'Working Hours Correction' },
  { value: 'OVERTIME_REQUEST',          label: 'Overtime Request' },
  { value: 'WRONG_STATUS',             label: 'Wrong Status' },
  { value: 'HALF_TO_FULL_DAY',         label: 'Half Day → Full Day' },
  { value: 'WORK_FROM_HOME',           label: 'Work From Home' },
  { value: 'OFFICIAL_DUTY',            label: 'Official Duty' },
]

const STATUS_COLORS = {
  PENDING:  'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

const STATUS_LABELS = {
  PENDING:  'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export default function AttendanceRegularisationPage() {
  const { user, effectiveCompanyId } = useAuth()
  return <RegularisationWorkspace key={`${user?.id}:${effectiveCompanyId}`} />
}

function RegularisationWorkspace() {
  const dispatch = useDispatch()
  const {
    isEmployee, isHRManager, isBranchAdmin, isEnterpriseAdmin, isPlatformAdmin,
    effectiveCompanyId,
  } = useAuth()
  const companyId = effectiveCompanyId
  const team = useTeamRegularisation(companyId)
  const isEmp = isEmployee()
  const canApprove = isPlatformAdmin() || isEnterpriseAdmin() || isBranchAdmin() || isHRManager()
  const loading = useSelector(selectRegLoading)
  const myRequests = useSelector(selectMyRequests)
  const pendingApproval = useSelector(selectPendingApproval)
  const allRequests = useSelector(selectAllRequests)
  const attendanceRecords = useSelector(selectAttendance)

  // Tabs visible to the current user
  const tabs = [
    'My Requests',
    ...(team.available ? ['Team Approvals'] : []),
    ...(canApprove ? ['Pending Approval', 'All Requests'] : []),
  ]
  const [tab, setTab] = useState('My Requests')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [selectedApprovalId, setSelectedApprovalId] = useState(null)
  const [approvalSearch, setApprovalSearch] = useState('')
  const [reviewRemarks, setReviewRemarks] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm()
  const selectedType = watch('requestType')

  // Only IRREGULAR records with no pending request can be submitted
  const irregularRecords = attendanceRecords.filter(
    a => a.attendanceStatus === 'IRREGULAR' && a.regularisationStatus === 'NONE'
  )

  useEffect(() => {
    dispatch(fetchMyRequests())
    // Load irregular attendance records for submit form
    dispatch(fetchAttendance({ page: 0, size: 200, status: 'IRREGULAR' }))
  }, [dispatch])

  useEffect(() => {
    if (tab === 'Pending Approval' && companyId) dispatch(fetchPendingApproval(companyId))
    if (tab === 'All Requests' && companyId) dispatch(fetchAllForCompany(companyId))
  }, [tab, dispatch, companyId])

  const onSubmit = async (data) => {
    try {
      await dispatch(submitRequest(data)).unwrap()
      toast.success('Regularisation request submitted')
      setSubmitOpen(false)
      reset()
      dispatch(fetchMyRequests())
      dispatch(fetchAttendance({ page: 0, size: 200, status: 'IRREGULAR' }))
    } catch (e) { toast.error(e || 'Failed to submit') }
  }

  const approvalQueue = tab === 'Team Approvals' ? team.pending : pendingApproval
  const visibleApprovalQueue = useMemo(() => {
    const query = approvalSearch.trim().toLowerCase()
    if (!query) return approvalQueue
    return approvalQueue.filter(request => [request.employeeName, request.employeeBadgeId, request.employeeId, request.requestType, request.reason, request.attendanceDate]
      .some(value => String(value || '').toLowerCase().includes(query)))
  }, [approvalQueue, approvalSearch])
  const selectedApproval = approvalQueue.find(request => String(request.id) === String(selectedApprovalId)) || null

  const openApproval = (id) => {
    setSelectedApprovalId(id)
    setReviewRemarks('')
    setReviewError('')
  }

  const closeApproval = () => {
    setSelectedApprovalId(null)
    setReviewRemarks('')
    setReviewError('')
  }

  const reviewRequest = async (action) => {
    if (!selectedApproval) return
    const id = selectedApproval.id
    const remarks = reviewRemarks.trim()
    if (action === 'reject' && !remarks) {
      setReviewError('Please enter a reason before rejecting this request.')
      return
    }
    const currentIndex = visibleApprovalQueue.findIndex(request => request.id === id)
    const nextRequest = [...visibleApprovalQueue.slice(currentIndex + 1), ...visibleApprovalQueue.slice(0, currentIndex)]
      .find(request => request.id !== id)
    setReviewing(true)
    try {
      if (tab === 'Team Approvals') {
        await api.post(`/team/regularisation/${id}/${action}`, { remarks }, {
          headers: { 'X-Company-Id': companyId, 'X-Filter-Company-Id': companyId },
        })
        team.refresh()
      }
      else if (action === 'approve') await dispatch(approveRequest({ id, remarks })).unwrap()
      else if (action === 'reject') await dispatch(rejectRequest({ id, remarks })).unwrap()
      toast.success(action === 'approve' ? 'Request approved' : 'Request rejected')
      setReviewRemarks('')
      setReviewError('')
      setSelectedApprovalId(nextRequest?.id ?? null)
    } catch (e) { toast.error(e?.response?.data?.message || (typeof e === 'string' ? e : 'Unable to review request')) }
    finally { setReviewing(false) }
  }

  const requestTypeLabel = request => REQUEST_TYPES.find(type => type.value === request?.requestType)?.label || request?.requestType || '—'
  const evidenceValue = value => value || 'Not provided'

  const renderApprovalQueue = (isTeam = false) => {
    const requests = visibleApprovalQueue
    return (
      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Requests awaiting your review</h2>
            <p className="mt-1 text-sm text-gray-500">Review each request, check the attendance details, then approve or reject it.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">{isTeam ? team.pending.length : pendingApproval.length} pending</span>
            <Button variant="secondary" size="sm" onClick={isTeam ? team.refresh : () => dispatch(fetchPendingApproval(companyId))}>Refresh</Button>
          </div>
        </div>
        <div className="p-4 border-b border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="regularisation-approval-search">Find a request</label>
          <input id="regularisation-approval-search" value={approvalSearch} onChange={event => setApprovalSearch(event.target.value)}
            placeholder="Search employee, date, request type or reason"
            className="w-full sm:max-w-xl rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        {loading || (isTeam && team.loading) ? <div className="p-10 text-center text-sm text-gray-500">Loading requests…</div> : requests.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-gray-700">{approvalSearch ? 'No matching requests' : 'You’re all caught up'}</p>
            <p className="mt-1 text-sm text-gray-500">{approvalSearch ? 'Try another name, date or request type.' : 'There are no attendance requests waiting for your review.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map(request => (
              <article key={request.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-gray-50">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{request.employeeName || `Employee ${request.employeeId || ''}`}</h3>
                    <Badge label={requestTypeLabel(request)} variant="info" />
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{formatDate(request.attendanceDate)} <span className="text-gray-300">·</span> Submitted {request.createdAt ? formatDate(request.createdAt) : '—'}</p>
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">{request.reason || 'No reason provided'}</p>
                </div>
                <Button size="sm" onClick={() => openApproval(request.id)}>Review request</Button>
              </article>
            ))}
          </div>
        )}
      </section>
    )
  }

  const baseColumns = [
    { id: 'employee', header: 'Employee', cell: ({ row }) => row.original.employeeName || '—' },
    { id: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.attendanceDate) },
    { id: 'type', header: 'Request Type', cell: ({ row }) => {
      const t = REQUEST_TYPES.find(r => r.value === row.original.requestType)
      return t ? t.label : row.original.requestType || '—'
    }},
    { id: 'reason', header: 'Reason', cell: ({ row }) => (
      <span className="max-w-[180px] truncate block text-gray-600 text-xs">{row.original.reason || '—'}</span>
    )},
    { id: 'status', header: 'Status', cell: ({ row }) => {
      const s = row.original.status
      return <Badge label={STATUS_LABELS[s] || s} variant={STATUS_COLORS[s] || 'default'} />
    }},
  ]

  const myColumns = [
    { id: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.attendanceDate) },
    { id: 'type', header: 'Request Type', cell: ({ row }) => {
      const t = REQUEST_TYPES.find(r => r.value === row.original.requestType)
      return t ? t.label : row.original.requestType || '—'
    }},
    { id: 'reason', header: 'Reason', cell: ({ row }) => (
      <span className="max-w-[200px] truncate block text-gray-600 text-xs">{row.original.reason || '—'}</span>
    )},
    { id: 'status', header: 'Status', cell: ({ row }) => {
      const s = row.original.status
      return <Badge label={STATUS_LABELS[s] || s} variant={STATUS_COLORS[s] || 'default'} />
    }},
    { id: 'remarks', header: 'Remarks', cell: ({ row }) => {
      const r = row.original
      return (
        <span className="text-xs text-gray-500">
          {r.status === 'REJECTED' ? r.rejectionRemarks || '—' : r.hrRemarks || r.managerRemarks || '—'}
        </span>
      )
    }},
  ]

  const showTimings = ['MISSING_PUNCH', 'WORKING_HOURS_CORRECTION'].includes(selectedType)
  const showOT = selectedType === 'OVERTIME_REQUEST'

  return (
    <div>
      <PageHeader title="Attendance Regularisation" subtitle="Request corrections for irregular attendance records"
        actions={
          <Button onClick={() => { reset(); setSubmitOpen(true) }} disabled={irregularRecords.length === 0 && isEmp}>
            + New Request
          </Button>
        }
      />

      {team.error && <div role="alert" className="mb-4 text-sm text-red-600">{team.error} <button onClick={team.refresh} className="underline">Retry</button></div>}
      {team.available && <Link to="/attendance/my-team" className="mb-4 mr-5 inline-block text-sm font-semibold text-indigo-700 hover:underline">View team attendance →</Link>}
      {team.available && tab !== 'Team Approvals' && (
        <button className="mb-4 text-sm font-medium text-indigo-600 underline" onClick={() => setTab('Team Approvals')}>
          My team: {team.members.length} employees · {team.pending.length} attendance requests awaiting approval
        </button>
      )}

      <div className="flex gap-2 border-b border-gray-200 mb-4">
        {tabs.map(t => (
          <button key={t} onClick={() => { closeApproval(); setTab(t) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
            {t === 'Pending Approval' && pendingApproval.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingApproval.length}</span>
            )}
            {t === 'Team Approvals' && <span className="ml-2">({team.pending.length})</span>}
          </button>
        ))}
      </div>

      {tab === 'My Requests' && (
        <>
          {myRequests.length === 0 && !loading && (
            <div className="text-center text-gray-400 py-12 text-sm">
              No regularisation requests yet.
              {irregularRecords.length > 0 && (
                <span className="block mt-1 text-indigo-600 cursor-pointer hover:underline" onClick={() => setSubmitOpen(true)}>
                  You have {irregularRecords.length} irregular record(s) — submit a request.
                </span>
              )}
            </div>
          )}
          <DataTable columns={myColumns} data={myRequests} loading={loading} />
        </>
      )}

      {tab === 'Pending Approval' && (
        renderApprovalQueue()
      )}

      {tab === 'Team Approvals' && team.available && (
        <>
          <p className="mb-3 text-sm text-gray-600">Showing attendance requests from your {team.members.length} direct reports.</p>
          {renderApprovalQueue(true)}
        </>
      )}

      {tab === 'All Requests' && (
        <DataTable columns={baseColumns} data={allRequests} loading={loading} />
      )}

      {/* Submit request modal */}
      <Modal
        open={submitOpen}
        onClose={() => { setSubmitOpen(false); reset() }}
        title="Submit Regularisation Request"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setSubmitOpen(false); reset() }}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={loading}>Submit</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Attendance selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Irregular Attendance Record</label>
            <select
              {...register('attendanceId', { required: 'Select an attendance record' })}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${errors.attendanceId ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select date</option>
              {irregularRecords.map(a => (
                <option key={a.id} value={a.id}>
                  {a.attendanceDate} — {a.checkIn || 'No check-in'} / {a.checkOut || 'No check-out'}
                </option>
              ))}
            </select>
            {errors.attendanceId && <span className="text-red-500 text-xs mt-1 block">{errors.attendanceId.message}</span>}
            {irregularRecords.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No irregular attendance records found.</p>
            )}
          </div>

          {/* Request type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
            <select
              {...register('requestType', { required: 'Select a request type' })}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${errors.requestType ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select type</option>
              {REQUEST_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {errors.requestType && <span className="text-red-500 text-xs mt-1 block">{errors.requestType.message}</span>}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              {...register('reason', { required: 'Reason is required' })}
              rows={3}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${errors.reason ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="Explain the reason for this request..."
            />
            {errors.reason && <span className="text-red-500 text-xs mt-1 block">{errors.reason.message}</span>}
          </div>

          {/* Conditional: check-in / check-out times */}
          {showTimings && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requested Check In</label>
                <input
                  type="time"
                  {...register('requestedCheckIn')}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requested Check Out</label>
                <input
                  type="time"
                  {...register('requestedCheckOut')}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Conditional: overtime hours */}
          {showOT && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requested Overtime Hours</label>
              <input
                type="number"
                step="0.5"
                min="0"
                {...register('requestedOvertimeHours', { min: 0 })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. 2.5"
              />
            </div>
          )}

          {/* Attachment URL (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attachment URL <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="url"
              {...register('attachmentUrl')}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="https://..."
            />
          </div>
        </div>
      </Modal>

      {/* One request at a time, with the full context needed to review it. */}
      <Modal open={!!selectedApproval} onClose={closeApproval} title="Review attendance request" size="lg">
        {selectedApproval && (() => {
          const currentIndex = visibleApprovalQueue.findIndex(request => request.id === selectedApproval.id)
          const previous = visibleApprovalQueue[currentIndex - 1]
          const next = visibleApprovalQueue[currentIndex + 1]
          const detail = (label, value) => (
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
              <dd className="mt-1 text-sm text-gray-900 break-words">{value || '—'}</dd>
            </div>
          )
          return (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{selectedApproval.employeeName || `Employee ${selectedApproval.employeeId || ''}`}</p>
                  <p className="mt-1 text-sm text-gray-600">{formatDate(selectedApproval.attendanceDate)} · {requestTypeLabel(selectedApproval)}</p>
                </div>
                <Badge label={STATUS_LABELS[selectedApproval.status] || selectedApproval.status || 'Pending'} variant={STATUS_COLORS[selectedApproval.status] || 'default'} />
              </div>

              {visibleApprovalQueue.length > 1 && (
                <div className="flex items-center justify-between border-y border-gray-100 py-2">
                  <Button size="sm" variant="secondary" disabled={!previous} onClick={() => openApproval(previous.id)}>← Previous</Button>
                  <span className="text-sm text-gray-500">Request {currentIndex + 1} of {visibleApprovalQueue.length}</span>
                  <Button size="sm" variant="secondary" disabled={!next} onClick={() => openApproval(next.id)}>Next →</Button>
                </div>
              )}

              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-800">Request details</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {detail('Attendance date', formatDate(selectedApproval.attendanceDate))}
                  {detail('Request type', requestTypeLabel(selectedApproval))}
                  {detail('Recorded check-in', formatAttendanceTime(selectedApproval.recordedCheckIn, selectedApproval.recordedCheckInUtc))}
                  {detail('Requested check-in', formatAttendanceTime(selectedApproval.requestedCheckIn, selectedApproval.requestedCheckInUtc))}
                  {detail('Recorded check-out', formatAttendanceTime(selectedApproval.recordedCheckOut, selectedApproval.recordedCheckOutUtc))}
                  {detail('Requested check-out', formatAttendanceTime(selectedApproval.requestedCheckOut, selectedApproval.requestedCheckOutUtc))}
                  {selectedApproval.requestedOvertimeHours != null && detail('Overtime requested', `${selectedApproval.requestedOvertimeHours} hours`)}
                  {selectedApproval.shiftName && detail('Shift', selectedApproval.shiftName)}
                </dl>
              </section>

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Employee’s reason</h3>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg border border-gray-200 p-3 text-sm leading-6 text-gray-700">{evidenceValue(selectedApproval.reason)}</p>
                </div>
                {selectedApproval.attachmentUrl && (
                  <a className="inline-flex text-sm font-medium text-indigo-600 hover:underline" href={selectedApproval.attachmentUrl} target="_blank" rel="noreferrer">View attachment ↗</a>
                )}
                {(selectedApproval.managerRemarks || selectedApproval.hrRemarks) && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                    <span className="font-medium">Previous review note: </span>{selectedApproval.hrRemarks || selectedApproval.managerRemarks}
                  </div>
                )}
              </section>

              <div>
                <label htmlFor="regularisation-review-remarks" className="mb-1 block text-sm font-medium text-gray-700">Reviewer remarks <span className="font-normal text-gray-400">(optional for approval, required for rejection)</span></label>
                <textarea id="regularisation-review-remarks" value={reviewRemarks}
                  onChange={event => { setReviewRemarks(event.target.value); setReviewError('') }} rows={3}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${reviewError ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Add a note for the employee…" />
                {reviewError && <p role="alert" className="mt-1 text-sm text-red-600">{reviewError}</p>}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-gray-100 pt-4">
                <Button variant="secondary" onClick={closeApproval}>Close review</Button>
                <div className="flex flex-col-reverse sm:flex-row gap-2">
                  <Button variant="danger" disabled={loading || reviewing} onClick={() => reviewRequest('reject')}>Reject request</Button>
                  <Button variant="success" loading={loading || reviewing} onClick={() => reviewRequest('approve')}>Approve request</Button>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
