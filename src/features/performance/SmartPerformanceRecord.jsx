import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import Button from '../../components/common/Button'
import Combobox from '../../components/common/Combobox'
import Modal from '../../components/common/Modal'
import PageHeader from '../../components/common/PageHeader'
import api from '../../services/api'
import { JobDescriptionEditor, JDView } from './SmartPerformanceLibrary'
import PerformanceKpis from './SmartPerformanceKpis'
import { apiError, BackToPerformance, base, control, dayText, Download, Field, latest, LoadState, panel, Status, usePerformance } from './SmartPerformanceUi'

export default function PerformanceRecord({ employeeId }) {
  const [query, setQuery] = useSearchParams()
  const tab = query.get('tab') === 'kpis' ? 'kpis' : 'jd'
  const viewAs = query.get('viewAs') || 'HR'
  const readOnlyPreview = viewAs !== 'HR'
  const cycleId = query.get('cycle')
  const resource = usePerformance(`/employees/${employeeId}${cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : ''}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [editingJd, setEditingJd] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailNote, setEmailNote] = useState('')
  const { data } = resource

  function setParameter(name, value) {
    setQuery(current => {
      const next = new URLSearchParams(current)
      if (value) next.set(name, value)
      else next.delete(name)
      return next
    }, { replace: true })
    setError('')
    setStatus('')
  }

  async function sendJdEmail(event) {
    event.preventDefault()
    if (readOnlyPreview) return
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const response = await api.post(`${base}/employees/${employeeId}/jd-email`, { to: emailTo, note: emailNote })
      setStatus(response.data.message || 'Job description emailed.')
      setEmailOpen(false)
      setEmailTo('')
      setEmailNote('')
    } catch (error) {
      setError(apiError(error, 'Could not email the job description.'))
    } finally {
      setBusy(false)
    }
  }

  async function act(action, values = {}, success = 'Saved.') {
    if (readOnlyPreview) {
      setError('Preview mode is read-only. Switch View as back to HR to make changes.')
      return false
    }
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const response = await api.post(`${base}/employees/${employeeId}/${action}`, {
        revision: data.revision, values: { ...values, cycleId: data.settings.id },
      })
      resource.setData(response.data)
      const autoKpiMessage = action === 'jd-publish' ? response.data.kpiAutoMessage : ''
      if (response.data.kpiAutoGeneration === 'FAILED') setError(autoKpiMessage)
      setStatus(autoKpiMessage && response.data.kpiAutoGeneration !== 'FAILED' ? `${success} ${autoKpiMessage}` : success)
      return true
    } catch (error) {
      setError(apiError(error, 'Could not save this change.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  if (!data) return <><BackToPerformance /><div className="mt-3"><PageHeader title="Employee performance" /></div><LoadState {...resource} /></>
  const version = latest(data.jd)
  const displayData = readOnlyPreview ? { ...data, editor: false, managerEdit: false, own: false, canDecide: false, hr: false } : data
  const initials = data.name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('')
  return (
    <>
      {!data.own && <BackToPerformance />}
      {readOnlyPreview && <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Previewing the {viewAs} view in read-only mode. Your signed-in account and permissions have not changed.</div>}
      <div className="mt-3">
        <PageHeader title={data.own ? 'My performance' : 'Employee performance'}
          actions={<Download path={`/employees/${employeeId}/document?cycleId=${encodeURIComponent(data.settings.id)}`} filename={`performance-${employeeId}.html`}>Export JD & KPIs</Download>} />
      </div>
      <section aria-label="Employee details" className={`${panel} mb-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,10rem)] sm:p-5 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,10rem)_auto]`}>
        <div aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-indigo-100 text-base font-bold text-indigo-800">{initials || '—'}</div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 wrap-anywhere">{data.name}</h2>
          <p className="text-sm text-gray-600">{[data.designation, data.department].filter(Boolean).join(' · ') || data.company}</p>
        </div>
        <div className="col-span-full min-w-0 text-sm sm:col-span-1"><p className="text-xs font-medium text-gray-500">Reporting manager</p><p className="mt-1 font-medium text-gray-900 wrap-anywhere">{data.manager || 'Unassigned'}</p></div>
        <Field label="Cycle" className="col-span-full w-full lg:col-span-1 lg:w-auto">
          <select className={control} value={data.settings.id} onChange={event => setParameter('cycle', event.target.value === data.cycles[0]?.id ? '' : event.target.value)}>
            {(data.cycles || []).map(c => <option key={c.id} value={c.id}>{dayText(c.start)} – {dayText(c.end)}</option>)}
          </select>
        </Field>
      </section>
      <div aria-label="Employee record sections" className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {[['jd', 'Job Description'], ['kpis', 'KPIs & Performance']].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setParameter('tab', id === 'jd' ? '' : id)}
            className={`border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-indigo-700'}`}>
            {label}
          </button>
        ))}
      </div>
      {error && <div className="mb-3"><LoadState error={error} retry={resource.retry} /></div>}
      {status && <p role="status" className="mb-3 flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircleIcon className="size-4 shrink-0" />{status}</p>}
      {tab === 'kpis' ? <PerformanceKpis key={data.settings.id} data={displayData} act={act} busy={busy} initialEditing={!readOnlyPreview && query.get('addKpi') === '1'} /> : (
        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900">Job description</h3>
              {version && <p className="mt-0.5 text-xs text-gray-500">Version {version.version} · {dayText(version.at)}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Status value={version?.acknowledgement ? 'ACKNOWLEDGED' : version ? 'PUBLISHED' : data.jd.draft ? 'DRAFT' : 'NOT_ASSIGNED'} />
              {displayData.editor && version && !editingJd && <Button type="button" variant="secondary" onClick={() => setEmailOpen(true)}>
                <EnvelopeIcon className="mr-1.5 size-4" aria-hidden="true" /> Email JD
              </Button>}
              {displayData.editor && !editingJd && <Button type="button" variant="secondary" onClick={() => setEditingJd(true)}>
                {data.jd.draft ? 'Edit draft' : version ? 'Edit job description' : 'Create job description'}
              </Button>}
              {displayData.own && version && !version.acknowledgement && <Button type="button" disabled={busy}
                onClick={() => act('jd-acknowledge', { version: version.version }, 'Job description acknowledged.')}>Acknowledge JD</Button>}
            </div>
          </div>
          {editingJd && displayData.editor ? <div className="p-4 sm:p-6">
            <JobDescriptionEditor key={data.revision} employeeId={employeeId}
              fields={{ ...(data.jd.draft || version?.fields || {}), reportingTo: data.manager || '' }}
              managerId={data.managerId} managerName={data.manager}
              onManagerAssigned={manager => resource.setData({ ...data, ...manager })}
              busy={busy} onSave={async (fields, publish) => {
                if (await act(publish ? 'jd-publish' : 'jd-save', fields, publish ? 'Job description published.' : 'JD draft saved.')) setEditingJd(false)
              }}>
              <LibraryAssignment busy={busy} act={act} defaultRole={data.roleId} />
            </JobDescriptionEditor>
          </div> : <JDView version={version} title={data.designation || 'Job description'} company={data.company} employee={data.name} department={data.department} />}
          {!editingJd && (data.jd.versions || []).length > 1 && (
            <details className="border-t border-gray-100 p-4 text-sm sm:px-6">
              <summary className="cursor-pointer font-medium">Previous JD versions</summary>
              {[...data.jd.versions].slice(0, -1).reverse().map(old => <details key={old.version} className="mt-2 rounded-xl border border-gray-200">
                <summary className="cursor-pointer p-3">Version {old.version} · {dayText(old.at)}</summary><JDView version={old} title={data.designation || 'Job description'} company={data.company} employee={data.name} department={data.department} />
              </details>)}
            </details>
          )}
        </section>
      )}
      <div className="mt-4"><Link to={`/performance/archive?employee=${employeeId}`} className="text-sm text-indigo-700 hover:underline">Previous performance records</Link></div>
      <Modal open={emailOpen && !readOnlyPreview} onClose={() => { if (!busy) setEmailOpen(false) }} title="Email job description"
        footer={<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setEmailOpen(false)}>Cancel</Button>
          <Button type="submit" form="email-job-description" loading={busy}>Send JD</Button></div>}>
        <form id="email-job-description" onSubmit={sendJdEmail} className="space-y-4">
          <p className="text-sm leading-6 text-gray-600">Send a professionally formatted copy of {data.designation || 'this job description'} using your company email settings.</p>
          <Field label="Recipient email"><input className={control} type="email" required maxLength={254} autoComplete="email" value={emailTo} onChange={event => setEmailTo(event.target.value)} placeholder="name@example.com" /></Field>
          <Field label="Message (optional)"><textarea className={control} rows={3} maxLength={2000} value={emailNote} onChange={event => setEmailNote(event.target.value)} placeholder="Add a short note for the recipient." /></Field>
          {error && <LoadState error={error} />}
          <p className="rounded-lg bg-indigo-50 p-3 text-xs leading-5 text-indigo-900">The email includes the role, company, employee, version, publish date, and the complete JD sections.</p>
        </form>
      </Modal>
    </>
  )
}

function LibraryAssignment({ busy, act, defaultRole }) {
  const { data } = usePerformance('/library')
  const choices = data?.roles?.filter(role => latest(role.document)) || []
  const [selected, setSelected] = useState(null)
  const choice = selected ?? (choices.some(role => role.id === defaultRole) ? defaultRole : '')
  if (!choices.length) return null
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3">
      <div className="w-full sm:max-w-sm">
        <Combobox label="Or use a published master JD" value={choice} onChange={setSelected}
          placeholder="Search published roles" emptyText="No published role matches"
          options={choices.map(role => ({ value: role.id, label: role.name }))} />
      </div>
      <Button type="button" variant="secondary" disabled={busy || !choice}
        onClick={() => act('jd-assign', { roleId: choice }, 'Master JD copied to this employee’s draft.')}>Copy to draft</Button>
    </div>
  )
}
