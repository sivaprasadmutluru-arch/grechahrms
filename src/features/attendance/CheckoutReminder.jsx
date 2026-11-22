import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClockIcon } from '@heroicons/react/24/outline'
import api from '../../services/api'
import { notificationChime, readSoundPreference } from '../../utils/notificationChime'

/** HRMS notification, not a browser/phone push: polls while the portal is open. */
export default function CheckoutReminder({ userId }) {
  const [alerts, setAlerts] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dismissed = useRef(new Set())
  const navigate = useNavigate()
  const [soundPreference, setSoundPreference] = useState(() => {
    try { return readSoundPreference(window.localStorage, userId) } catch { return null }
  })
  const soundEnabled = soundPreference === 'on'
  const [audioReady, setAudioReady] = useState(false)
  const played = useRef(new Set())

  useEffect(() => {
    if (!soundEnabled) return // Audio is opt-in; ordinary clicks never grant consent.
    let active = true
    const unlock = () => { notificationChime.unlock().then(ready => { if (active) setAudioReady(ready) }) }
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
    return () => {
      active = false
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [soundEnabled])

  useEffect(() => {
    const controller = new AbortController()
    let loading = false
    async function refresh() {
      if (loading || document.visibilityState === 'hidden') return
      loading = true
      try {
        const { data } = await api.get('/attendance/checkout-reminders', { signal: controller.signal })
        if (!controller.signal.aborted) setAlerts(data.filter(item => !dismissed.current.has(item.id)))
      } catch { /* The next poll retries; do not interrupt other work on a network error. */ }
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
  useEffect(() => {
    if (!alert || !soundEnabled || !audioReady || played.current.has(alert.id)) return
    const key = `grecha.checkoutChime:${userId}:${alert.id}`
    try { if (sessionStorage.getItem(key)) { played.current.add(alert.id); return } } catch { /* Storage is optional. */ }
    if (notificationChime.play()) {
      played.current.add(alert.id)
      try { sessionStorage.setItem(key, 'played') } catch { /* Keep the in-memory guard. */ }
    }
  }, [alert?.id, soundEnabled, audioReady, userId])

  async function toggleSound() {
    const enabled = !soundEnabled || !audioReady
    if (enabled) {
      const ready = await notificationChime.unlock()
      setAudioReady(ready)
      if (!ready) {
        setError('Your browser could not enable audio. Check its sound settings and try again.')
        return
      }
      if (ready && !alert) notificationChime.play() // Preview only after the employee explicitly allows sound.
    }
    setError('')
    setSoundPreference(enabled ? 'on' : 'off')
    try { localStorage.setItem(`grecha.notificationSound:${userId}`, enabled ? 'on' : 'off') } catch { /* Storage is optional. */ }
  }

  function declineSound() {
    setSoundPreference('off')
    try { localStorage.setItem(`grecha.notificationSound:${userId}`, 'off') } catch { /* Storage is optional. */ }
  }
  async function acknowledge(openDashboard = false) {
    if (!alert || busy) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/notifications/${alert.id}/read`)
      dismissed.current.add(alert.id)
      setAlerts(current => current.filter(item => item.id !== alert.id))
      if (openDashboard) navigate('/dashboard')
    } catch { setError('Unable to dismiss the reminder. Please try again.') }
    finally { setBusy(false) }
  }

  if (!alert && soundPreference !== null) return null
  if (!alert) return (
    <section aria-label="Notification sound permission" className="fixed bottom-5 left-3 z-40 w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-indigo-200 bg-white p-5 shadow-xl sm:left-auto sm:right-20">
      <h2 className="font-semibold text-gray-900">Enable notification sound?</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">Allow a short chime for checkout reminders on this browser. Each reminder includes a mute option.</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" onClick={declineSound} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">Not now</button>
        <button type="button" onClick={toggleSound} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white">Enable notification sound</button>
      </div>
    </section>
  )
  return (
    <section role="status" aria-label="Checkout reminder" className="fixed bottom-5 left-3 z-40 w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-indigo-200 bg-white p-5 shadow-xl sm:left-auto sm:right-20">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-indigo-50 p-2 text-indigo-700"><ClockIcon className="h-6 w-6" aria-hidden="true" /></span>
        <div>
          <h2 className="font-semibold text-gray-900">{alert.title}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">{alert.message}</p>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <button type="button" onClick={toggleSound} className="mt-3 text-xs font-medium text-indigo-700 hover:underline" aria-pressed={soundEnabled && audioReady}>
        {soundEnabled && audioReady ? 'Sound on · Mute' : 'Enable notification sound'}
      </button>
      <div className="mt-4 flex justify-end gap-3">
        <button disabled={busy} onClick={() => acknowledge()} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">Dismiss</button>
        <button disabled={busy} onClick={() => acknowledge(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Go to Check Out</button>
      </div>
    </section>
  )
}
