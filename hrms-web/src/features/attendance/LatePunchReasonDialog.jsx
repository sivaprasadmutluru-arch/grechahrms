import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { clearPunchReasonPrompt } from '../ess/essSlice'
import { submitRequest } from './regularisationSlice'

function ReasonForm({ punch }) {
  const dispatch = useDispatch()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const checkIn = punch.punchReasonType === 'LATE_CHECK_IN_REASON'
  const close = () => dispatch(clearPunchReasonPrompt())

  const submit = async () => {
    if (submitting || !reason.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await dispatch(submitRequest({
        attendanceId: punch.id,
        requestType: punch.punchReasonType,
        reason: reason.trim(),
      })).unwrap()
      toast.success('Regularisation request submitted')
      close()
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Could not submit the reason. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Modal open title={checkIn ? 'Late check-in' : 'Late checkout'}
      onClose={() => { if (!submitting) close() }}
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={close} disabled={submitting}>Not now</Button>
        <Button onClick={submit} loading={submitting} disabled={submitting || !reason.trim()}>Submit reason</Button>
      </div>}>
      <p className="mb-4 text-sm text-gray-600">
        Your {checkIn ? 'check-in' : 'checkout'} has been saved. You can explain why it was late now, or add a reason later in Attendance under Regularisation.
      </p>
      <p className="mb-4 text-sm text-gray-600">
        If approved, the day will be marked Regularised. Your recorded times and overtime won’t change.
      </p>
      <label htmlFor="late-punch-reason" className="mb-1 block text-sm font-medium">Reason</label>
      <textarea id="late-punch-reason" value={reason} onChange={event => setReason(event.target.value)}
        disabled={submitting} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        placeholder="Enter a reason for the late punch" />
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}

export default function LatePunchReasonDialog() {
  const punch = useSelector(state => state.ess.punchReasonPrompt)
  return punch?.id ? <ReasonForm key={`${punch.id}:${punch.punchReasonType}`} punch={punch} /> : null
}
