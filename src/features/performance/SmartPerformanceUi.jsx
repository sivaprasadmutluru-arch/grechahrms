import { useEffect, useId, useState } from 'react'
import { Link, NavLink, useSearchParams } from 'react-router-dom'
import { ArrowsPointingOutIcon, ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline'
import api from '../../services/api'
import Spinner from '../../components/common/Spinner'

export const base = '/smart-performance'
export const jdFields = [
  ['purpose', 'Role purpose'],
  ['reportingTo', 'Reporting to'],
  ['responsibleFor', 'Responsible for'],
  ['responsibilities', 'Roles & responsibilities'],
  ['qualifications', 'Qualifications & education'],
  ['experience', 'Experience'],
  ['skills', 'Skills & competencies'],
  ['workConditions', 'Work conditions'],
  ['successMeasures', 'Role outcomes & success measures'],
]
export const control = 'w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50'
export const panel = 'min-w-0 rounded-2xl border border-gray-200 bg-white'

export const latest = track => track?.versions?.at(-1)
export const apiError = (error, fallback = 'Could not load Performance. Try again.') =>
  error?.response?.data?.message || error?.response?.data?.detail || fallback

export function usePerformance(path) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    api.get(base + path, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setResult({ path, data })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ path, error: apiError(error) })
    })
    return () => controller.abort()
  }, [path, attempt])
  return {
    data: result?.path === path ? result.data : null,
    error: result?.path === path ? result.error : null,
    loading: Boolean(path) && result?.path !== path,
    retry: () => { setResult(null); setAttempt(n => n + 1) },
    setData: data => setResult({ path, data }),
  }
}

export function PerformanceNav({ editor, hr }) {
  if (!editor && !hr) return null
  const [params, setParams] = useSearchParams()
  const viewAs = params.get('viewAs') || 'HR'
  const setViewAs = value => setParams(current => {
    const next = new URLSearchParams(current)
    if (value === 'HR') next.delete('viewAs')
    else next.set('viewAs', value)
    return next
  }, { replace: true })
  const tabs = editor
    ? [['Job Description', '/performance/library'], ['Performance Review', '/performance'], ...(hr ? [['Settings', '/performance/settings']] : [])]
    : (hr ? [['Performance Review', '/performance'], ['Settings', '/performance/settings']] : [])
  return (
    <nav aria-label="Performance" className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200">
      <div className="flex flex-wrap gap-5">
        {tabs.map(([label, to]) => (
          <NavLink end key={to} to={`${to}${viewAs === 'HR' ? '' : `?viewAs=${viewAs}`}`} className={({ isActive }) =>
            'border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors ' + (isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-indigo-700')}>
            {label}
          </NavLink>
        ))}
      </div>
      {hr && <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-600">
        <span>View as</span>
        <select aria-label="Preview Performance as" value={viewAs} onChange={event => setViewAs(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100">
          <option value="HR">HR</option><option value="Manager">Manager</option><option value="Employee">Employee</option>
        </select>
      </label>}
    </nav>
  )
}

export function LoadState({ loading, error, retry }) {
  if (loading) return <div role="status" aria-label="Loading Performance" className="flex justify-center py-14"><Spinner /></div>
  if (!error) return null
  if (error.toLowerCase().includes('please select a company')) return (
    <div role="alert" className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-indigo-950 sm:p-6">
      <h2 className="text-base font-semibold">Select a company to continue</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-indigo-900">
        Choose a company from the selector in the top bar. Then open an employee from the overview to create or assign a job description or KPI plan. Reporting managers are set on each employee profile.
      </p>
      {retry && <button type="button" onClick={retry} className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100">Try again</button>}
    </div>
  )
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {error}
      {retry && <button type="button" onClick={retry} className="ml-2 font-semibold underline">Retry</button>}
    </div>
  )
}

export function ExpandableTextarea({ label, value = '', onChange, rows = 4, maxLength = 3000, hint, placeholder, className = '', required = false }) {
  const id = useId()
  const titleId = `${id}-title`
  const [expanded, setExpanded] = useState(false)
  const current = value ?? ''
  const textareaClasses = `${control} min-h-28 resize-y leading-6 ${className}`

  useEffect(() => {
    if (!expanded) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = event => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [expanded])

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
        <button type="button" onClick={() => setExpanded(true)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <ArrowsPointingOutIcon className="size-3.5" aria-hidden="true" /> Expand editor
        </button>
      </div>
      <textarea id={id} rows={rows} className={textareaClasses} maxLength={maxLength} value={current} required={required}
        placeholder={placeholder} onChange={event => onChange(event.target.value)} />
      <div className="mt-1 flex flex-wrap justify-between gap-1 text-xs text-gray-500">
        <span>{hint || 'Use clear, specific language.'}</span><span>{current.length}/{maxLength}</span>
      </div>
      {expanded && <div className="fixed inset-0 z-[80] bg-gray-950/50 p-2 sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget) setExpanded(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-4 sm:px-6">
            <div className="min-w-0"><h2 id={titleId} className="font-semibold text-gray-900">{label}</h2><p className="mt-1 text-sm text-gray-600">{hint || 'Use clear, specific language.'}</p></div>
            <button type="button" aria-label="Close expanded editor" onClick={() => setExpanded(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"><XMarkIcon className="size-5" /></button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-5">
            <textarea autoFocus rows={1} className={`${control} min-h-0 flex-1 resize-none text-base leading-7`} maxLength={maxLength} value={current} required={required}
              placeholder={placeholder} onChange={event => onChange(event.target.value)} aria-label={label} />
            <div className="flex items-center justify-between gap-2 pt-3 text-xs text-gray-500"><span>Changes are kept in this draft.</span><span>{current.length}/{maxLength}</span></div>
          </div>
          <footer className="flex justify-end border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6"><button type="button" onClick={() => setExpanded(false)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Done</button></footer>
        </section>
      </div>}
    </div>
  )
}

export function Status({ value, label: labelOverride }) {
  const tones = {
    PUBLISHED: 'bg-indigo-50 text-indigo-700',
    ACKNOWLEDGED: 'bg-emerald-50 text-emerald-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    SUBMITTED: 'bg-amber-50 text-amber-800',
    CHANGES_REQUESTED: 'bg-rose-50 text-rose-700',
    RELEASED: 'bg-emerald-50 text-emerald-700',
    READY: 'bg-indigo-50 text-indigo-700',
    ON_TRACK: 'bg-emerald-50 text-emerald-700',
    AT_RISK: 'bg-amber-50 text-amber-800',
    OFF_TRACK: 'bg-rose-50 text-rose-700',
  }
  const labels = { NOT_ASSIGNED: 'Not assigned', NOT_STARTED: 'Not started', NOT_UPDATED: 'Not updated',
    NOT_RELEASED: 'Not released', CHANGES_REQUESTED: 'Changes requested', ON_TRACK: 'On track',
    AT_RISK: 'At risk', OFF_TRACK: 'Off track' }
  const label = labelOverride || labels[value] || (value ? value[0] + value.slice(1).toLowerCase() : 'Not assigned')
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[value] || 'bg-gray-100 text-gray-600'}`}>{label}</span>
}

export const dayText = value => value
  ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' })
      .format(new Date(value.length === 10 ? value + 'T12:00:00+04:00' : value))
  : '—'

export function Field({ label, children, className = '' }) {
  return (
    <label className={`block min-w-0 text-sm font-medium text-gray-700 ${className}`}>
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  )
}

export function Empty({ children }) {
  return <p className="px-5 py-10 text-center text-sm text-gray-500">{children}</p>
}

export function Download({ path, filename, children }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function download() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get(base + path, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError('Download failed. Try again.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div>
      <button type="button" disabled={loading} onClick={download}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
        <ArrowDownTrayIcon className="size-4 shrink-0" aria-hidden="true" />
        {loading ? 'Downloading…' : children}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  )
}

export function BackToPerformance() {
  return <Link to="/performance" className="text-sm font-medium text-indigo-700 hover:underline">← Performance overview</Link>
}
