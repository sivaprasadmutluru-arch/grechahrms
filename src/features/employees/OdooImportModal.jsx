import { useState } from 'react'
import api from '../../services/api'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'

export default function OdooImportModal({ companyId, onClose, onImported, kind = 'EMPLOYEES', inline = false }) {
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const historical = kind !== 'EMPLOYEES'
  const path = `/employees/odoo/${companyId}${historical ? `/history/${kind}` : ''}`
  const config = { headers: { 'X-Company-Id': companyId }, timeout: 300000 }

  async function fetchPreview(event) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const fields = new FormData(form)
    setBusy(true)
    setError('')
    try {
      const source = {
        url: fields.get('url').trim(),
        database: fields.get('database').trim(),
        apiKey: fields.get('apiKey').trim(),
        sourceCompanyId: Number(fields.get('sourceCompanyId')),
      }
      const { data } = await api.post(`${path}/preview`, historical
        ? { source, from: fields.get('from'), to: fields.get('to') } : source, config)
      setPreview(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not fetch the Odoo preview.')
    } finally {
      form.reset()
      setBusy(false)
    }
  }

  async function confirm() {
    if (busy || !preview) return
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post(`${path}/import`, { previewToken: preview.token }, config)
      setResult(data)
      onImported()
    } catch (err) {
      setPreview(null)
      setError(err.response?.data?.message || 'Import status could not be confirmed. Fetch a new preview before retrying.')
    } finally {
      setBusy(false)
    }
  }

  const count = preview?.rows.filter(row => row.ready).length ?? 0
  const actions = preview && !result && <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => setPreview(null)}>Start over</Button>
        <Button disabled={!count || busy} loading={busy} onClick={confirm}>Import {count} {kind === 'EMPLOYEES' ? 'employees' : 'records'}</Button>
      </div>
  const content = <>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      {!preview && <form className="space-y-3" onSubmit={fetchPreview}>
        <p className="text-sm text-gray-600">{historical ? 'Choose a past date range after importing employees. The key needs read access to Employees and this module.' : 'Preview active employees from one Odoo Online company. Requires the JSON-2 API and a key with read access to Employees.'}</p>
        <Input label="Odoo Online URL" id="odoo-url" name="url" type="url" placeholder="https://your-company.odoo.com" maxLength={200} required />
        <Input label="Database name (if required)" id="odoo-database" name="database" maxLength={100} />
        <Input label="Odoo company ID" id="odoo-company" name="sourceCompanyId" type="number" min="1" step="1" required />
        <Input label="Odoo API key" id="odoo-api-key" name="apiKey" type="password" autoComplete="off" maxLength={256} required />
        {historical && <div className="grid gap-3 sm:grid-cols-2">
          <Input label="From date" id="odoo-from" name="from" type="date" required />
          <Input label="To date" id="odoo-to" name="to" type="date" required />
        </div>}
        <p className="text-xs text-gray-500">The key is used only for the preview and is not saved.</p>
        <Button type="submit" loading={busy} disabled={busy}>Fetch preview</Button>
      </form>}
      {preview && !result && <div className="space-y-3">
        <p className="text-sm"><strong>Destination: {preview.companyName}</strong> · {count} ready, {preview.rows.length - count} skipped</p>
        <p className="text-sm text-gray-600">{kind === 'LEAVE' ? 'Approved leave history only. Opening balances are not imported. Set up matching leave types in Grecha first.'
          : kind === 'ATTENDANCE' ? 'Closed sessions are combined into one daily record. Existing attendance is not overwritten and source overtime is not imported. Imported history can affect future payroll calculations for these dates.'
          : 'Existing employees will not be changed. New accounts with work email follow Grecha’s standard setup email flow. Unmatched departments and jobs are left blank.'}</p>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50"><tr>{(historical ? ['Employee', 'Date', 'Details', 'Result'] : ['Employee', 'Department / position', 'Reporting manager', 'Result']).map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
            <tbody>{preview.rows.map((row, i) => historical ? <tr key={i} className="border-t">
              <td className="p-2">{row.employee || '—'}</td><td className="p-2">{row.date || '—'}</td>
              <td className="p-2">{row.detail || '—'}</td><td className="p-2">{row.note}</td>
            </tr> : <tr key={row.sourceId} className="border-t">
              <td className="p-2">{row.name || `#${row.sourceId}`}<div className="text-xs text-gray-500">{row.email}</div></td>
              <td className="p-2">{[row.department, row.job].filter(Boolean).join(' / ') || '—'}</td>
              <td className="p-2">{row.manager || '—'}</td><td className="p-2">{row.note}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {!preview.rows.length && <p className="text-sm text-gray-600">No matching records found. Verify the Odoo company, date range, and key permissions.</p>}
      </div>}
      {result && <div className="space-y-3">
        <p className="text-sm">Imported <strong>{result.imported}</strong> {historical ? `records; ${result.skipped} skipped.` : `employees into ${preview.companyName}. Linked ${result.linkedManagers} reporting managers.`}</p>
        {result.warnings?.length > 0 && <ul className="max-h-56 list-disc overflow-auto pl-5 text-sm text-amber-800">{result.warnings.map(message => <li key={message}>{message}</li>)}</ul>}
        <Button onClick={onClose}>Done</Button>
      </div>}
    </>
  if (inline) return <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">{content}{actions}</section>
  return <Modal open title="Import from Odoo" size="xl" footer={actions} onClose={() => { if (!busy) onClose() }}>{content}</Modal>
}
