import { useEffect, useState } from 'react'
import api from '../../services/api'
import useAuth from '../../hooks/useAuth'

const endpoint = '/attendance/auto-checkout'

export default function AutoCheckoutSettings({ companyId, companyName }) {
  const { hasRole } = useAuth()
  const canManage = hasRole('PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN', 'COMPANY_ADMIN', 'ENTERPRISE_ADMIN')
  const [configuration, setConfiguration] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!companyId) return
    const controller = new AbortController()
    api.get(endpoint, { params: { targetCompanyId: companyId }, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setConfiguration(data) })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load automatic checkout settings.') })
    return () => controller.abort()
  }, [companyId, attempt])

  async function toggle() {
    const enabled = !configuration.enabled
    setSaving(true)
    setError('')
    try {
      const { data } = await api.put(endpoint, { enabled }, { params: { targetCompanyId: companyId } })
      setConfiguration(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save automatic checkout. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-4 max-w-lg rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <h3 id="auto-checkout-title" className="text-lg font-semibold text-gray-800">Automatic checkout</h3>
      {!companyId && <p className="mt-2 text-sm text-gray-600">Select an organization in the company switcher.</p>}
      {companyId && !configuration && !error && <p role="status" className="mt-2 text-sm text-gray-600">Loading setting…</p>}
      {configuration && (
        <>
          <p id="auto-checkout-description" className="mt-2 text-sm text-gray-600">
            If an employee is still checked in {configuration.graceMinutes} minutes after their shift ends,
            HRMS records the scheduled end time as their checkout.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 wrap-anywhere text-sm font-medium text-gray-800">
              {companyName} <span className="text-gray-500">· {saving ? 'Saving…' : configuration.enabled ? 'On' : 'Off'}</span>
            </p>
            <button
              type="button"
              role="switch"
              aria-labelledby="auto-checkout-title"
              aria-describedby="auto-checkout-description"
              aria-checked={configuration.enabled}
              disabled={saving || !configuration.headOffice || !canManage}
              onClick={toggle}
              className={`relative flex h-7 w-12 shrink-0 items-center rounded-full p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 ${
                configuration.enabled ? 'bg-indigo-600' : 'bg-gray-400'
              }`}
            >
              <span className={`size-5 rounded-full bg-white shadow ${configuration.enabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {configuration.headOffice
              ? 'This setting applies to the head office and its branches.'
              : 'This setting is managed from the organization’s head office.'}
          </p>
        </>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {error && !configuration && (
        <button type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }} className="mt-2 text-sm font-medium text-indigo-700 underline">
          Retry
        </button>
      )}
    </section>
  )
}
