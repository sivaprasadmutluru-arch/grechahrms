import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import useAuth from '../../hooks/useAuth'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Modal from '../../components/common/Modal'
import PageHeader from '../../components/common/PageHeader'
import { canContactPlatform } from './HelpCenterPage'
import { formatDate } from '../../utils/formatters'

const endpoint = '/helpdesk/platform-support'
const statuses = { OPEN: ['Open', 'warning'], IN_PROGRESS: ['In progress', 'info'], RESOLVED: ['Resolved', 'success'] }
const fieldClass = 'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'
const errorText = (error) => error.response?.data?.message || 'Could not complete this request. Please try again.'

function SupportWorkspace() {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [inbox, setInbox] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    api.get(endpoint, { params: { page }, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setInbox(data) })
      .catch(error => { if (!controller.signal.aborted) setError(errorText(error)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, revision])

  function loadPage(next) {
    setLoading(true)
    setError('')
    setPage(next)
    setRevision(value => value + 1)
  }

  function openForm(ticket) {
    setFormError('')
    setForm(ticket ? { id: ticket.id, status: ticket.status, response: ticket.response || '' } : { subject: '', description: '' })
  }

  async function save(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setFormError('')
    try {
      if (form.id) {
        await api.put(`${endpoint}/${form.id}/response`, { status: form.status, response: form.response.trim() })
      } else {
        await api.post(endpoint, { subject: form.subject.trim(), description: form.description.trim() })
      }
      setForm(null)
      loadPage(form.id ? page : 0)
    } catch (error) {
      setFormError(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link className="mb-4 inline-block text-sm font-medium text-indigo-700 hover:underline" to="/help">Back to Help</Link>
      <PageHeader title={inbox?.management ? 'Support Inbox' : 'Contact Support'}
        subtitle={inbox?.companyName ? `Requests for ${inbox.companyName}` : 'Support for organisation-level Grecha issues'}
        actions={inbox && !inbox.management && <Button onClick={() => openForm()}>New request</Button>} />
      {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error} <button className="ml-2 underline" onClick={() => loadPage(page)}>Retry</button>
      </div> : loading ? <p role="status" className="text-sm text-gray-600">Loading support requests…</p>
        : inbox?.requests.length === 0 ? <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600">No support requests yet.</p>
          : <div className="space-y-3">
            {inbox?.requests.map(ticket => (
              <article key={ticket.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <details>
                  <summary className="cursor-pointer font-medium text-gray-900">
                    #{ticket.id} {ticket.subject}{' '}
                    <Badge label={statuses[ticket.status]?.[0]} variant={statuses[ticket.status]?.[1]} />
                  </summary>
                  <p className="mt-2 text-xs text-gray-500">{ticket.companyName} · {formatDate(ticket.createdAt)}</p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-700">{ticket.description}</p>
                  {ticket.response && <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="font-semibold">Response from Support</p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{ticket.response}</p>
                  </div>}
                  {inbox.management && <Button className="mt-3" size="sm" onClick={() => openForm(ticket)}>Respond</Button>}
                </details>
              </article>
            ))}
          </div>}
      {!loading && !error && (page > 0 || inbox?.hasMore) && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" disabled={page === 0} onClick={() => loadPage(page - 1)}>Previous</Button>
          <Button variant="secondary" disabled={!inbox?.hasMore} onClick={() => loadPage(page + 1)}>Next</Button>
        </div>
      )}
      {form && <Modal open title={form.id ? `Respond to request #${form.id}` : 'New platform support request'}
        onClose={() => { if (!saving) setForm(null) }}
        pendingMessage={saving ? 'Saving support request…' : undefined}
        footer={<div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
          <Button type="submit" form="platform-support-form">Submit</Button>
        </div>}>
        <form id="platform-support-form" onSubmit={save} className="space-y-4">
          {form.id ? <>
            <label className="block text-sm font-medium">Status
              <select className={fieldClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {Object.entries(statuses).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Response
              <textarea className={fieldClass} required maxLength={4000} rows={4} value={form.response}
                onChange={e => setForm({ ...form, response: e.target.value })} />
            </label>
          </> : <>
            <p className="text-sm text-gray-600">Sending for {inbox.companyName}. Don’t include passwords or sensitive employee records.</p>
            <Input id="platform-support-subject" label="Subject" required maxLength={160}
              value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
            <label className="block text-sm font-medium">Describe the issue
              <textarea className={fieldClass} required maxLength={4000} rows={4} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </label>
          </>}
          {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
        </form>
      </Modal>}
    </div>
  )
}

export default function PlatformSupportPage() {
  const auth = useAuth()
  if (!auth.isPlatformAdmin() && !canContactPlatform(auth)) {
    return <p className="text-sm text-gray-600">For help, please contact your <Link className="text-indigo-700 underline" to="/helpdesk">organisation’s Helpdesk</Link>.</p>
  }
  return <SupportWorkspace key={`${auth.user?.id ?? auth.user?.userId}:${auth.effectiveCompanyId}:${auth.isPlatformAdmin()}`} />
}
