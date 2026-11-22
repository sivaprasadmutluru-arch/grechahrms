import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'
import { formatShiftCountdown, shiftStartRemaining } from '../../utils/shiftStart'

export default function ShiftStartDialog({ open, onClose, status, serverMessage }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!open) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [open])
  const remaining = shiftStartRemaining(status?.shiftStartsAt, now)
  const startLabel = status?.shiftStartsAt ? new Date(status.shiftStartsAt).toLocaleTimeString('en', {
    hour: 'numeric', minute: '2-digit', timeZone: status?.shiftTimeZone || 'Asia/Dubai',
  }) : ''
  return (
    <Modal open={open} onClose={onClose} title={remaining || !status?.shiftStartsAt ? 'Shift hasn’t started yet' : 'Your shift has started'}
      footer={<div className="flex justify-end"><Button onClick={onClose}>{remaining ? 'Got it' : 'Close'}</Button></div>}>
      <div className="py-3 text-center">
        <Clock className="mx-auto mb-4 h-10 w-10 text-indigo-600" aria-hidden="true" />
        <p className="text-base font-medium text-gray-900">
          {remaining ? 'Your shift starts in' : status?.shiftStartsAt
            ? 'Your shift has started. You can now check in.' : serverMessage || 'Please refresh to see your shift start time.'}
        </p>
        {remaining > 0 && <p className="my-3 text-3xl font-bold tabular-nums text-indigo-700">{formatShiftCountdown(remaining)}</p>}
        {startLabel && <p className="mt-3 text-sm text-gray-600">Scheduled start: {startLabel} ({status?.shiftTimeZone || 'Asia/Dubai'})</p>}
        <p className="mt-2 text-sm text-gray-500">No attendance has been recorded. Close this dialog and check in when your shift starts.</p>
      </div>
    </Modal>
  )
}
