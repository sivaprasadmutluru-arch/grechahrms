import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MegaphoneIcon } from '@heroicons/react/24/outline'
import { useDispatch } from 'react-redux'
import api from '../../services/api'
import { fetchUnreadCount } from '../notifications/notificationsSlice'

export default function AnnouncementAlert() {
  const dispatch = useDispatch()
  const [alerts, setAlerts] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const acknowledged = useRef(new Set())

  useEffect(() => {
    const controller = new AbortController()
    let loading = false
    async function refresh() {
      if (loading || document.visibilityState === 'hidden') return
      loading = true
      try {
        const { data } = await api.get('/notifications/announcement-alerts', { signal: controller.signal })
        if (!controller.signal.aborted) setAlerts(data.filter(item => !acknowledged.current.has(item.id)))
      } catch { /* The next poll retries without interrupting the employee's work. */ }
      finally { loading = false }
    }
    refresh()
    const timer = setInterval(refresh, 30000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const alert = alerts[0]
  async function dismiss() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/notifications/${alert.id}/read`)
      acknowledged.current.add(alert.id)
      setAlerts(current => current.filter(item => item.id !== alert.id))
      dispatch(fetchUnreadCount())
    } catch {
      setError('Could not mark this announcement as read. Please retry.')
    } finally {
      setBusy(false)
    }
  }

  if (!alert) return null
  return (
    <section aria-label="New announcement" className="fixed right-3 top-16 z-40 w-[calc(100%-1.5rem)] max-w-sm rounded-xl border border-indigo-200 bg-white p-4 shadow-xl sm:right-5">
      <div role="status" className="flex items-start gap-3">
        <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700"><MegaphoneIcon aria-hidden="true" className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Company announcement</p>
          <p className="mt-1 break-words text-sm font-semibold text-gray-900">{alert.title}</p>
          {alert.message && <p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words text-sm text-gray-600">{alert.message}</p>}
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-3 flex items-center justify-end gap-3 text-sm">
        <Link to="/notifications" className="font-medium text-indigo-700 hover:underline">View notifications</Link>
        <button type="button" disabled={busy} onClick={dismiss}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy ? 'Saving…' : 'Mark read'}
        </button>
      </div>
    </section>
  )
}
