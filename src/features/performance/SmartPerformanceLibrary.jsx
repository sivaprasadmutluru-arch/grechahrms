import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircleIcon, DocumentArrowUpIcon, EnvelopeIcon, PlusIcon, SparklesIcon, TrashIcon, UserPlusIcon } from '@heroicons/react/24/outline'
import Button from '../../components/common/Button'
import Combobox from '../../components/common/Combobox'
import Modal from '../../components/common/Modal'
import PageHeader from '../../components/common/PageHeader'
import api from '../../services/api'
import { apiError, base, control, dayText, Empty, ExpandableTextarea, Field, jdFields, latest, LoadState, panel, PerformanceNav, Status, usePerformance } from './SmartPerformanceUi'

function ReportingManagerSelect({ employeeId, managerId, managerName, roleValue, onChange }) {
  const [employees, setEmployees] = useState([])
  const [selectedId, setSelectedId] = useState(employeeId ? String(managerId || '') : '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    api.get('/employees', { params: { page: 0, size: 1000 } }).then(({ data }) => {
      if (live) setEmployees(data?.content || data || [])
    }).catch(failure => {
      if (live) setError(apiError(failure, 'Could not load employees for the manager list.'))
    }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])
  const options = employees.filter(employee => String(employee.id) !== String(employeeId))
  useEffect(() => {
    if (employeeId) setSelectedId(String(managerId || ''))
    else {
      const match = employees.find(employee => (employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.name || '').toLowerCase() === String(roleValue || '').trim().toLowerCase())
      setSelectedId(match ? String(match.id) : roleValue ? '__existing__' : '')
    }
  }, [employeeId, managerId, employees, roleValue])
  async function select(event) {
    const id = event.target.value
    const manager = options.find(employee => String(employee.id) === id)
    if (!employeeId) {
      setSelectedId(id)
      onChange({ managerId: manager?.id ?? null, manager: manager ? (manager.fullName || [manager.firstName, manager.lastName].filter(Boolean).join(' ') || manager.name) : '' }, false)
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data } = await api.put(`${base}/employees/${employeeId}/manager`, { managerId: id ? Number(id) : null })
      setSelectedId(String(data.managerId || ''))
      onChange({ managerId: data.managerId, manager: data.manager || '' }, true)
    } catch (failure) {
      setError(apiError(failure, 'Could not update the reporting manager.'))
    } finally {
      setSaving(false)
    }
  }
  return <div>
    <label className="block text-sm font-medium text-gray-700">Reporting to</label>
    <select aria-label="Reporting to" className={`${control} mt-1`} value={selectedId} onChange={select} disabled={loading || saving}>
      <option value="">{loading ? 'Loading employees…' : 'Select a reporting manager'}</option>
      {selectedId === '__existing__' && <option value="__existing__" disabled>{roleValue}</option>}
      {employeeId && managerId && !options.some(employee => String(employee.id) === String(managerId)) && <option value={managerId}>{managerName || 'Current reporting manager'}</option>}
      {options.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.name}</option>)}
    </select>
    <p className="mt-1 text-xs text-gray-500">{saving ? 'Saving manager assignment…' : employeeId ? (managerName ? `Currently reports to ${managerName}. Changes update the employee profile and this JD.` : 'Choose a manager to update the employee profile and this JD.') : 'Select the manager this position reports to. The selected name is included in the master JD.'}</p>
    {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
  </div>
}

export function JobDescriptionFields({ values, onChange, employeeId, managerId, managerName, onManagerAssigned }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {jdFields.map(([key, label]) => <div key={key} className={['responsibilities', 'qualifications', 'skills', 'successMeasures'].includes(key) ? 'sm:col-span-2' : ''}>
        {key === 'reportingTo' ? <ReportingManagerSelect employeeId={employeeId} managerId={managerId} managerName={managerName} roleValue={values?.reportingTo}
          onChange={(manager, persisted) => { onChange({ ...values, reportingTo: manager.manager }); if (persisted) onManagerAssigned?.(manager) }} />
          : <ExpandableTextarea label={label} rows={key === 'responsibilities' ? 7 : key === 'experience' || key === 'workConditions' ? 3 : 4} maxLength={6000}
            placeholder={key === 'purpose' ? 'Why this role exists and the outcomes it owns' : key === 'responsibleFor' ? 'Main areas of ownership' : key === 'responsibilities' ? 'List the key duties and expected outcomes' : key === 'qualifications' ? 'Required education, certifications, and equivalent experience. State only confirmed requirements.' : key === 'experience' ? 'Relevant experience expected for the role. Confirm years or level with the hiring manager if unspecified.' : key === 'skills' ? 'Role-specific technical, functional, communication, and leadership skills.' : key === 'workConditions' ? 'Work location, schedule, travel, physical requirements, or environment, where applicable.' : key === 'successMeasures' ? 'Describe the outcomes that define good performance. Avoid inventing numeric targets.' : 'Write clear, specific details.'}
            hint="Write specific, outcome-focused details."
            value={values?.[key] ?? ''} onChange={value => onChange({ ...values, [key]: value })} />}
      </div>)}
    </div>
  )
}

export function DraftTools({ employeeId, roleId, type = 'jd', sourceText, currentFields, onGenerate, onUpload }) {
  const [generating, setGenerating] = useState(false)
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState({ industry: '', industryDetails: '', roleLevel: '', workArrangement: '', workLocation: '', employmentType: '', teamResponsibilities: '', requiredQualifications: '', requiredSkills: '', toolsContext: '' })
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const input = useRef(null)
  const params = employeeId ? { employeeId } : { roleId }
  const hasCurrentContent = ['purpose', 'responsibleFor', 'responsibilities', 'qualifications', 'experience', 'skills', 'workConditions', 'successMeasures']
    .some(key => String(currentFields?.[key] || '').trim())
  const hasSource = Boolean(sourceText?.trim() || hasCurrentContent)
  const requiredContext = ['industry', 'roleLevel', 'workArrangement', 'workLocation', 'employmentType', 'teamResponsibilities', 'requiredQualifications', 'requiredSkills', 'toolsContext']
  const canGenerateJd = hasSource
    ? (fields.industry !== 'Other' || fields.industryDetails.trim())
    : requiredContext.every(key => String(fields[key] || '').trim()) && (fields.industry !== 'Other' || fields.industryDetails.trim())

  async function generate(event) {
    event.preventDefault()
    setError('')
    if (type === 'jd' && !canGenerateJd) { setError('Complete the required role details first. If a detail is unknown, enter “Not specified — confirm with the hiring manager.”'); return }
    setGenerating(true)
    try {
      const { data } = await api.post(`${base}/draft/${type}`, { ...fields, sourceText: sourceText || '', currentFields: currentFields || {} }, { params })
      onGenerate(data)
      setOpen(false)
    } catch (error) {
      setError(apiError(error, 'Could not generate a draft. Retry or enter it manually.'))
    } finally {
      setGenerating(false)
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Choose a file no larger than 2 MB.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.set('file', file)
      const { data } = await api.post(`${base}/upload`, form, { params })
      onUpload(data.text)
    } catch (error) {
      setError(apiError(error, 'Could not import this document. You can paste its text instead.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      {error && !open && <LoadState error={error} />}
      <div className="flex flex-wrap gap-2">
        {onUpload && <>
          <input ref={input} type="file" accept=".txt,.docx" className="hidden" onChange={upload} />
          <Button type="button" variant="secondary" loading={uploading} onClick={() => input.current.click()}>
            <DocumentArrowUpIcon className="mr-1.5 size-4" aria-hidden="true" /> Upload JD
          </Button>
        </>}
        <Button type="button" variant="secondary" onClick={() => { setError(''); setOpen(true) }}>
          <SparklesIcon className="mr-1.5 size-4" aria-hidden="true" /> {type === 'kpi' ? 'Generate KPIs' : 'Generate JD'}
        </Button>
      </div>
      <Modal open={open} size={type === 'jd' ? 'lg' : 'md'} onClose={() => { if (!generating) { setOpen(false); setError('') } }} title={type === 'kpi' ? 'Generate KPI draft' : 'Generate job description'}
        footer={<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={generating} onClick={() => { setOpen(false); setError('') }}>Cancel</Button>
          <Button type="submit" form={`performance-generate-${type}`} loading={generating} disabled={generating || (type === 'jd' && !canGenerateJd)}>Generate draft</Button></div>}>
        <form id={`performance-generate-${type}`} onSubmit={generate} className="space-y-4">
          <p className="text-sm text-gray-600">{type === 'kpi' ? 'Uses the published job description and available department measures. You’ll confirm the targets before submitting.' : hasSource ? 'AI will use the uploaded document and existing JD fields as its source, then complete the full JD. Add extra context only if needed.' : 'AI will draft every JD section. Provide the role details below; if something is unknown, mark it for manager confirmation.'}</p>
          <LoadState error={error} />
          {type === 'jd' && hasSource && <p role="status" className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">Source content is available. You don’t need to re-enter details already in the JD.</p>}
          {type === 'jd' && <>
            <Field label={`Industry${hasSource ? ' (optional)' : ' *'}`}><select required={!hasSource} className={control} value={fields.industry} onChange={event => setFields({ ...fields, industry: event.target.value, industryDetails: event.target.value === 'Other' ? fields.industryDetails : '' })}>
              <option value="">Select an industry</option>{industries.map(industry => <option key={industry} value={industry}>{industry}</option>)}
            </select></Field>
            {fields.industry === 'Other' && <Field label={`Industry details${hasSource ? ' (optional)' : ' *'}`}><input required={!hasSource} className={control} maxLength={250} value={fields.industryDetails} onChange={event => setFields({ ...fields, industryDetails: event.target.value })} placeholder="Describe the industry" /></Field>}
          </>}
          {type === 'jd' && !hasSource && <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Seniority level *"><select required className={control} value={fields.roleLevel} onChange={event => setFields({ ...fields, roleLevel: event.target.value })}>
                <option value="">Select seniority</option>{['Entry level', 'Junior', 'Mid-level', 'Senior', 'Lead', 'Manager', 'Director', 'Executive', 'Not specified — confirm with manager'].map(option => <option key={option}>{option}</option>)}
              </select></Field>
              <Field label="Employment type *"><select required className={control} value={fields.employmentType} onChange={event => setFields({ ...fields, employmentType: event.target.value })}>
                <option value="">Select employment type</option>{['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship', 'Not specified — confirm with manager'].map(option => <option key={option}>{option}</option>)}
              </select></Field>
              <Field label="Work arrangement *"><select required className={control} value={fields.workArrangement} onChange={event => setFields({ ...fields, workArrangement: event.target.value })}>
                <option value="">Select work arrangement</option>{['On-site', 'Hybrid', 'Remote', 'Field-based', 'Not specified — confirm with manager'].map(option => <option key={option}>{option}</option>)}
              </select></Field>
              <Field label="Work location *"><input required className={control} maxLength={180} value={fields.workLocation} onChange={event => setFields({ ...fields, workLocation: event.target.value })} placeholder="City / country, or Not specified — confirm with manager" /></Field>
            </div>
          </>}
          {type === 'jd' && !hasSource ? <>
            <ExpandableTextarea required label="Core responsibilities and outcomes *" rows={4} maxLength={3000}
              placeholder="Describe the main duties, products or services, customer or team responsibilities, and expected outcomes. Enter a confirmation note if unknown."
              value={fields.teamResponsibilities} onChange={value => setFields({ ...fields, teamResponsibilities: value })} />
            <ExpandableTextarea required label="Required qualifications and experience *" rows={3} maxLength={2000}
              placeholder="List confirmed education, certifications, licenses, and experience requirements, or state that they need manager confirmation."
              value={fields.requiredQualifications} onChange={value => setFields({ ...fields, requiredQualifications: value })} />
            <ExpandableTextarea required label="Required skills and competencies *" rows={3} maxLength={2000}
              placeholder="List confirmed functional, communication, leadership, and role-specific skills, or state that they need manager confirmation."
              value={fields.requiredSkills} onChange={value => setFields({ ...fields, requiredSkills: value })} />
            <ExpandableTextarea required label="Tools, systems and programming languages *" rows={3} maxLength={1500}
              hint="List confirmed items or enter Not applicable / Not specified — confirm with the hiring manager."
              placeholder="For example: confirmed software, systems, programming languages, tools, or certifications."
              value={fields.toolsContext} onChange={value => setFields({ ...fields, toolsContext: value })} />
            <p className="text-xs text-gray-500">* Required before generation. Use “Not specified — confirm with the hiring manager” when a detail is unknown so the AI does not invent it.</p>
          </> : <ExpandableTextarea label={type === 'jd' ? 'Additional context (optional)' : 'Industry or company context'} rows={3} maxLength={1500}
            placeholder={hasSource ? 'Add only information that is missing from the uploaded JD or existing draft.' : undefined}
            value={fields.teamResponsibilities} onChange={value => setFields({ ...fields, teamResponsibilities: value })} />}
        </form>
      </Modal>
    </>
  )
}

export function JobDescriptionEditor({ fields, employeeId, managerEmployeeId, roleId, managerId, managerName, onManagerAssigned, onSave, busy, children }) {
  const [values, setValues] = useState(fields || {})
  const [uploadText, setUploadText] = useState('')
  const [uploaded, setUploaded] = useState(false)
  return (
    <div className="space-y-4">
      <DraftTools employeeId={employeeId} roleId={roleId} sourceText={uploadText} currentFields={values} onGenerate={setValues}
        onUpload={text => { setUploadText(text); setUploaded(true) }} />
      {uploaded && <p role="status" className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">The document text is ready as the AI source. Choose Generate JD to turn it into a complete, structured JD; details already in the file don’t need to be entered again.</p>}
      {children}
      <JobDescriptionFields values={values} onChange={setValues} employeeId={employeeId || managerEmployeeId} managerId={managerId} managerName={managerName} onManagerAssigned={onManagerAssigned} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => onSave(values, false)}>Save draft</Button>
        <Button type="button" disabled={busy || jdFields.some(([name]) => !values[name]?.trim())} onClick={() => onSave(values, true)}>Publish JD</Button>
      </div>
    </div>
  )
}

export function JDView({ version, title, company, employee, department }) {
  if (!version) return <Empty>No published job description yet.</Empty>
  return <article className="overflow-hidden rounded-xl border border-gray-200 bg-white">
    <header className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-white p-5 sm:p-7">
      <p className="text-xs font-bold tracking-[0.16em] text-indigo-700">JOB DESCRIPTION</p>
      <h2 className="mt-2 text-xl font-bold text-gray-950 sm:text-2xl">{title || 'Position description'}</h2>
      <p className="mt-1 text-sm text-gray-600">{[company, department].filter(Boolean).join(' · ')}</p>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        {employee && <div><dt className="text-xs font-medium text-gray-500">Employee</dt><dd className="mt-1 font-semibold text-gray-800">{employee}</dd></div>}
        <div><dt className="text-xs font-medium text-gray-500">Document version</dt><dd className="mt-1 font-semibold text-gray-800">Version {version.version} · {dayText(version.at)}</dd></div>
      </dl>
    </header>
    <dl className="grid gap-5 p-5 sm:grid-cols-2 sm:gap-6 sm:p-7">
      {jdFields.map(([key, label]) => (
        <div key={key} className={['responsibilities', 'responsibleFor', 'qualifications', 'skills', 'successMeasures'].includes(key) ? 'sm:col-span-2' : ''}>
          <dt className="border-b border-gray-100 pb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{label}</dt>
          <dd className="mt-3 whitespace-pre-wrap wrap-anywhere text-sm leading-7 text-gray-700">{version.fields?.[key] || '—'}</dd>
        </div>
      ))}
    </dl>
  </article>
}

const industries = ['Agriculture and Food', 'Automotive and Mobility', 'Aviation and Aerospace', 'Banking and Financial Services', 'Beauty and Wellness', 'Construction and Real Estate', 'Education and Training', 'Energy and Utilities', 'Government and Public Sector', 'Healthcare and Life Sciences', 'Hospitality and Travel', 'Human Resources and Staffing', 'Insurance', 'Legal Services', 'Logistics and Supply Chain', 'Manufacturing', 'Media and Entertainment', 'Mining and Natural Resources', 'Non-profit and NGOs', 'Pharmaceuticals', 'Professional Services and Consulting', 'Retail and E-commerce', 'Security and Facilities', 'Software and Technology', 'Telecommunications', 'Transportation', 'Other']

export function PerformanceLibrary() {
  const resource = usePerformance('/library')
  const overview = usePerformance('/overview')
  const [search, setSearch] = useState('')
  const [roleId, setRoleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [assignTo, setAssignTo] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailNote, setEmailNote] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingJd, setEditingJd] = useState(false)
  const [newPositionOpen, setNewPositionOpen] = useState(false)
  const [positionName, setPositionName] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [departments, setDepartments] = useState([])
  const [departmentsLoading, setDepartmentsLoading] = useState(false)
  const [positionBusy, setPositionBusy] = useState(false)
  const [positionError, setPositionError] = useState('')
  const [createJdOpen, setCreateJdOpen] = useState(false)
  const [createJdPosition, setCreateJdPosition] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const detailsRef = useRef(null)
  const assignRef = useRef(null)
  const [params] = useSearchParams()
  const viewAs = params.get('viewAs') || 'HR'
  const canEditLibrary = overview.data?.hr && viewAs === 'HR'
  const { data } = resource
  const allRoles = data?.roles || []
  const employees = overview.data?.employees || []
  const previewEmployees = viewAs === 'Manager' ? employees.filter(employee => employee.managerEdit)
    : viewAs === 'Employee' ? employees.filter(employee => employee.own || String(employee.id) === String(overview.data?.selfId || '')) : employees
  const previewRoleIds = new Set(previewEmployees.map(employee => employee.roleId).filter(Boolean))
  const roles = canEditLibrary ? allRoles : viewAs === 'HR' ? allRoles : allRoles.filter(role => previewRoleIds.has(role.id))
  const shown = roles.filter(role => `${role.name} ${role.department || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const selected = shown.find(role => role.id === roleId)
  const visibleEmployees = previewEmployees.filter(employee => `${employee.name} ${employee.employeeCode || ''} ${employee.designation || ''} ${employee.department || ''}`.toLowerCase().includes(employeeSearch.trim().toLowerCase()))
    .sort((left, right) => Number(left.jdStatus === 'NOT_ASSIGNED') - Number(right.jdStatus === 'NOT_ASSIGNED') || left.name.localeCompare(right.name))
  const canAssignToEmployee = employee => !employee.own && (overview.data?.hr || employee.editor)
  const assignedEmployees = employees.filter(employee => employee.roleId === selected?.id)
  const eligibleEmployees = assignedEmployees.filter(canAssignToEmployee)
  const selectedPublished = latest(selected?.document)
  const selectedDraft = selected?.document?.draft
  const savedJd = Boolean(selectedPublished || selectedDraft)
  const previewVersion = selectedPublished || (selectedDraft ? { version: 'Draft', fields: selectedDraft } : null)

  async function openCreatePosition() {
    setPositionName('')
    setDepartmentId('')
    setPositionError('')
    setNewPositionOpen(true)
    setDepartmentsLoading(true)
    try {
      const { data } = await api.get('/departments')
      setDepartments(Array.isArray(data) ? data : data?.content || [])
    } catch (error) {
      setPositionError(apiError(error, 'Could not load departments.'))
    } finally {
      setDepartmentsLoading(false)
    }
  }

  async function createPosition(event) {
    event.preventDefault()
    if (!positionName.trim() || !departmentId) return
    setPositionBusy(true)
    setPositionError('')
    try {
      const { data: created } = await api.post('/job-positions', {
        name: positionName.trim(), department: { id: Number(departmentId) },
      })
      setRoleId(`position-${created.id}`)
      setAssignTo('')
      setEditingJd(true)
      setNewPositionOpen(false)
      setStatus(`Job position “${created.name}” created. Add its job description below.`)
      resource.retry()
    } catch (error) {
      setPositionError(apiError(error, 'Could not create the job position.'))
    } finally {
      setPositionBusy(false)
    }
  }

  function openPositionJd(role, action = 'manage') {
    setRoleId(role.id)
    setAssignTo('')
    setEditingJd(action === 'edit' || (action === 'create' && !latest(role.document) && !role.document?.draft))
    setShowHistory(action === 'history')
    setStatus('')
    setError('')
    setTimeout(() => (action === 'assign' ? assignRef.current : detailsRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  function startMasterJd() {
    const role = roles.find(item => item.id === createJdPosition)
    if (!role) return
    setCreateJdOpen(false)
    setSearch('')
    setRoleId(role.id)
    setAssignTo('')
    setEditingJd(true)
    setShowHistory(false)
    setStatus('')
    setError('')
    setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  async function save(fields, publish) {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const { data } = await api.put(`${base}/library/${selected.id}`, { revision: selected.revision, publish, fields })
      resource.setData(data)
      if (publish) resource.retry()
      setEditingJd(false)
      setStatus(publish ? 'Master job description published.' : 'Draft saved.')
    } catch (error) {
      setError(apiError(error, 'Could not save the job description.'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteSelected() {
    if (!selected) return
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const { data: updated } = await api.delete(`${base}/library/${selected.id}`, { data: { revision: selected.revision } })
      resource.setData(updated)
      setDeleteOpen(false)
      setEditingJd(false)
      setStatus(`Master JD for ${selected.name} deleted. Existing employee copies and history are unchanged.`)
    } catch (error) {
      setError(apiError(error, 'Could not delete the master job description.'))
    } finally {
      setBusy(false)
    }
  }

  async function sendMasterJdEmail(event) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const { data: result } = await api.post(`${base}/library/${selected.id}/email`, { to: emailTo, note: emailNote })
      setStatus(result.message || 'Job description emailed.')
      setEmailOpen(false)
      setEmailTo('')
      setEmailNote('')
    } catch (error) {
      setError(apiError(error, 'Could not email the job description.'))
    } finally {
      setBusy(false)
    }
  }

  async function assign() {
    setBusy(true)
    setStatus('')
    setError('')
    try {
      const { data: record } = await api.get(`${base}/employees/${assignTo}`)
      await api.post(`${base}/employees/${assignTo}/jd-assign`, { revision: record.revision, values: { roleId: selected.id } })
      overview.retry()
      setStatus('Assigned as an employee draft. Open the employee record to edit or publish it.')
      setAssignTo('')
    } catch (error) {
      setError(apiError(error, 'Could not assign the job description.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="JD Library" subtitle="Create and maintain reusable job descriptions by job position."
        actions={canEditLibrary && <><Link to={`/performance/library/create${viewAs === 'HR' ? '' : '?viewAs=' + viewAs}`} className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">Create JD</Link>
          <Button type="button" variant="secondary" onClick={openCreatePosition}><PlusIcon className="mr-1.5 size-4" aria-hidden="true" />Create job position</Button></>} />
      <PerformanceNav editor hr={overview.data?.hr} />
      {overview.data?.hr && viewAs !== 'HR' && <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Previewing the {viewAs} view in read-only mode. Your signed-in account and permissions have not changed.
      </div>}
      <LoadState {...resource} />
      {data && <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">
        <strong>How job descriptions are assigned</strong><p className="mt-1">Create a JD for a job position such as Sales Executive. The employee must already have that position on their profile. Assign the published JD to eligible employees below; each employee receives an editable draft.</p>
      </div>}
      {data && <div className="space-y-4">
        <section className={`${panel} overflow-hidden`}>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 p-4">
            <div className="w-full sm:max-w-sm"><Field label="Search job positions"><input className={control} value={search} onChange={e => setSearch(e.target.value)} placeholder="Position or department" /></Field></div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500"><tr>
                <th className="px-4 py-3">Job position</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Employees</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map(role => {
                  const positionEmployees = employees.filter(employee => employee.roleId === role.id)
                  const published = latest(role.document)
                  const isLegacy = role.kind === 'LEGACY_ROLE'
                  const assignable = positionEmployees.some(canAssignToEmployee)
                  return <tr key={role.id} className={selected?.id === role.id ? 'bg-indigo-50/60' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3"><span className="font-semibold text-gray-900">{role.name}</span>{isLegacy && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">Legacy JD</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{role.department || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{positionEmployees.length}</td>
                    <td className="px-4 py-3">{published ? <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">v{published.version}</span> : role.document?.draft ? <Status value="DRAFT" /> : <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap items-center gap-1">
                      {canEditLibrary && !isLegacy && <Link to={`/performance/library/create?position=${encodeURIComponent(role.id)}`} className="rounded-md px-2 py-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">{published || role.document?.draft ? 'Edit' : 'Create JD'}</Link>}
                      {(published || role.document?.versions?.length) && <Link to={`/performance/library/history?position=${encodeURIComponent(role.id)}`} className="rounded-md px-2 py-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">History</Link>}
                      {canEditLibrary && !isLegacy && <button type="button" disabled={!published || !assignable}
                        title={!published ? 'Publish the master JD before assigning it.' : !assignable ? 'No eligible employees have this job position.' : undefined}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => openPositionJd(role, 'assign')}>Assign</button>}
                      {!canEditLibrary && <button type="button" className="rounded-md px-2 py-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-50" onClick={() => { setRoleId(role.id); setEditingJd(false); setShowHistory(false) }}>Open JD</button>}
                      {isLegacy && !published && !role.document?.draft && <span className="text-xs text-gray-500">Legacy role</span>}
                    </div></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
          {!shown.length && <Empty>No matching job positions. Create a job position first, then create its JD.</Empty>}
        </section>
        {selected ? <section ref={detailsRef} className={`${panel} space-y-4 p-4 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-lg font-semibold text-gray-900">{selected.name}</h2><p className="mt-1 text-sm text-gray-600">{selected.department || 'Department not set'} · {assignedEmployees.length} assigned employee{assignedEmployees.length === 1 ? '' : 's'}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <Status value={selectedPublished ? 'PUBLISHED' : selectedDraft ? 'DRAFT' : 'NOT_ASSIGNED'} />
              {canEditLibrary && !editingJd && selected.kind !== 'LEGACY_ROLE' && <Button type="button" onClick={() => setEditingJd(true)}>{savedJd ? selectedDraft && !selectedPublished ? 'Edit draft' : 'Edit JD' : 'Create JD'}</Button>}
              {canEditLibrary && selectedPublished && !editingJd && <Button type="button" variant="secondary" onClick={() => setEmailOpen(true)}>
                <EnvelopeIcon className="mr-1.5 size-4" aria-hidden="true" /> Email JD
              </Button>}
              {canEditLibrary && savedJd && !editingJd && <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
                <TrashIcon className="mr-1.5 size-4" aria-hidden="true" /> Delete JD
              </Button>}
              {editingJd && <Button type="button" variant="secondary" onClick={() => setEditingJd(false)}>Cancel editing</Button>}
            </div>
          </div>
          <LoadState error={error} />
          {status && <p role="status" className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircleIcon className="size-4" />{status}</p>}
          {editingJd && canEditLibrary ? <JobDescriptionEditor key={`${selected.id}-${selected.revision}`} roleId={selected.id}
            fields={selectedDraft || selectedPublished?.fields} onSave={save} busy={busy} />
            : previewVersion ? <JDView version={previewVersion} title={selected.name} company={overview.data?.company} />
              : <Empty>Select <strong>{selected.name}</strong>, then choose <strong>Create JD</strong> to start its first job description.</Empty>}
          {canEditLibrary && selectedPublished && !editingJd && selected.kind !== 'LEGACY_ROLE' && (
            <div ref={assignRef} className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4">
              <div className="w-full sm:max-w-sm">
                <Combobox label={`Assign to employee in ${selected.name}`} value={assignTo} onChange={value => setAssignTo(value)} placeholder="Search an employee in this position"
                  emptyText="No matching employees" options={(overview.data?.employees || []).filter(canAssignToEmployee).map(e => ({
                    value: String(e.id), label: e.name,
                    sublabel: [e.designation, e.department].filter(Boolean).join(' · ') || 'Employee',
                    searchText: `${e.manager || ''} ${e.designation || ''} ${e.department || ''}`,
                  })).filter(option => eligibleEmployees.some(employee => String(employee.id) === option.value))} />
                <p className="mt-1 text-xs text-gray-500">Only employees whose profiles have this job position are listed.</p>
              </div>
              <Button type="button" variant="secondary" disabled={!assignTo || busy} onClick={assign}>Assign as draft</Button>
            </div>
          )}
          {selectedPublished && !editingJd && selected.kind !== 'LEGACY_ROLE' && <div className="border-t border-gray-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Employees in this position</h3>
            {assignedEmployees.length ? <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {assignedEmployees.map(employee => <li key={employee.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="font-medium text-gray-800">{employee.name}</span><span className="text-gray-500">{employee.department || selected.department || '—'}</span>
                <span className="text-xs text-gray-500">{employee.jdStatus === 'PUBLISHED' || employee.jdStatus === 'ACKNOWLEDGED' ? 'JD assigned' : employee.jdStatus === 'DRAFT' ? 'Draft assigned' : 'No JD assigned'}</span>
              </li>)}
            </ul> : <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">No employees currently have this job position. Assign the position on an employee profile first.</p>}
          </div>}
          {(selected.document?.versions || []).length > 0 && <details open={showHistory} onToggle={event => { if (!event.currentTarget.open) setShowHistory(false) }} className="rounded-xl bg-gray-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Published versions</summary>
            {[...selected.document.versions].reverse().map(version => <details key={version.version} className="mt-2 rounded-lg border border-gray-200 bg-white">
              <summary className="cursor-pointer p-3">Version {version.version} · {dayText(version.at)}</summary>
              <JDView version={version} title={selected.name} company={overview.data?.company} />
            </details>)}
          </details>}
        </section> : <section className={`${panel} grid min-h-48 place-items-center p-6 text-center`}>
          <div><p className="font-semibold text-gray-900">Choose a job position</p><p className="mt-1 text-sm text-gray-600">Select Create JD or Manage JD in the table above. New job descriptions are created for positions.</p></div>
        </section>}
        <section className={`${panel} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <h2 className="text-base font-semibold text-gray-900">Employee job descriptions</h2>
            <Link to={`/performance/onboarding${viewAs === 'HR' ? '' : `?viewAs=${viewAs}`}`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">New joiner onboarding</Link>
          </div>
          <div className="border-y border-gray-100 p-4"><Field label="Search employees"><input className={control} value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Search employees" /></Field></div>
          <div className="overflow-x-auto"><table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Job description</th><th className="px-4 py-3">KPIs</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{visibleEmployees.map(employee => <tr key={employee.id} className="hover:bg-gray-50">
              <td className="px-4 py-3"><span className="font-semibold text-gray-900">{employee.name}</span><p className="text-xs text-gray-600">{[employee.designation, employee.employeeCode].filter(Boolean).join(' · ')}</p></td>
              <td className="px-4 py-3 text-gray-600">{employee.department || '—'}</td>
              <td className="px-4 py-3"><Status value={employee.jdStatus} /></td>
              <td className="px-4 py-3"><Status value={employee.kpiStatus} /></td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-x-3 gap-y-1">
                <Link to={`/performance/employees/${employee.id}?tab=jd${viewAs === 'HR' ? '' : `&viewAs=${viewAs}`}`} className="font-semibold text-indigo-700 hover:underline">Open JD</Link>
                <Link to={`/performance/employees/${employee.id}?tab=kpis${viewAs === 'HR' ? '' : `&viewAs=${viewAs}`}`} className="font-semibold text-indigo-700 hover:underline">Open KPIs</Link>
                {canEditLibrary && employee.editor && (['PUBLISHED', 'ACKNOWLEDGED'].includes(employee.jdStatus) && ['NOT_ASSIGNED', 'DRAFT', 'CHANGES_REQUESTED'].includes(employee.kpiStatus)
                  ? <Link to={`/performance/employees/${employee.id}?tab=kpis&addKpi=1`} className="font-semibold text-indigo-700 hover:underline">Add KPI</Link>
                  : <span className="cursor-not-allowed text-gray-400" aria-disabled="true" title={!['PUBLISHED', 'ACKNOWLEDGED'].includes(employee.jdStatus) ? 'Publish the JD before adding KPIs.' : 'A KPI set is already submitted or approved.'}>Add KPI</span>)}
              </div></td>
            </tr>)}</tbody>
          </table></div>
          {!visibleEmployees.length && <Empty>{employees.length ? 'No employees match your search.' : 'No employee records are available in this company.'}</Empty>}
        </section>
      </div>}
      <Modal open={createJdOpen} onClose={() => setCreateJdOpen(false)} title="Create master job description"
        footer={<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setCreateJdOpen(false)}>Cancel</Button><Button type="button" disabled={!createJdPosition} onClick={startMasterJd}>Continue</Button></div>}>
        <div className="space-y-4"><p className="text-sm leading-6 text-gray-600">Choose the job position this master JD belongs to. Employees must be assigned the same position before you can assign this JD to them.</p>
          <Combobox label="Job position" value={createJdPosition} onChange={setCreateJdPosition} placeholder="Search job positions" emptyText="No job positions found" options={roles.filter(role => role.kind !== 'LEGACY_ROLE').map(role => ({ value: role.id, label: role.name, sublabel: role.department || 'Department not set' }))} />
          {!roles.some(role => role.kind !== 'LEGACY_ROLE') && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Create a job position first, then return here to create its JD.</p>}
        </div>
      </Modal>
      <Modal open={newPositionOpen} onClose={() => { if (!positionBusy) setNewPositionOpen(false) }} title="Create job position"
        footer={<div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={positionBusy} onClick={() => setNewPositionOpen(false)}>Cancel</Button>
          <Button type="submit" form="create-performance-job-position" loading={positionBusy} disabled={departmentsLoading || !departments.length}>Create position</Button>
        </div>}>
        <form id="create-performance-job-position" onSubmit={createPosition} className="space-y-4">
          <p className="text-sm leading-6 text-gray-600">Add a position for this company. You can create its JD immediately after the position is added.</p>
          <Field label="Job position name"><input className={control} required maxLength={150} autoFocus value={positionName} onChange={event => setPositionName(event.target.value)} placeholder="e.g. Sales Executive" /></Field>
          <Field label="Department"><select className={control} required value={departmentId} onChange={event => setDepartmentId(event.target.value)} disabled={departmentsLoading || !departments.length}>
            <option value="">{departmentsLoading ? 'Loading departments…' : 'Select a department'}</option>
            {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select></Field>
          {positionError && <LoadState error={positionError} />}
          {!departmentsLoading && !departments.length && !positionError && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Create a department first under Setup → Departments, then return here.</p>}
        </form>
      </Modal>
      <Modal open={emailOpen} onClose={() => { if (!busy) setEmailOpen(false) }} title={`Email ${selected?.name || 'job description'}`}
        footer={<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setEmailOpen(false)}>Cancel</Button>
          <Button type="submit" form="email-master-job-description" loading={busy}>Send JD</Button></div>}>
        <form id="email-master-job-description" onSubmit={sendMasterJdEmail} className="space-y-4">
          <p className="text-sm leading-6 text-gray-600">Send this professionally formatted role description to an employee, candidate, or external recipient.</p>
          <Field label="Recipient email"><input className={control} type="email" required maxLength={254} autoComplete="email" value={emailTo} onChange={event => setEmailTo(event.target.value)} placeholder="name@example.com" /></Field>
          <Field label="Message (optional)"><textarea className={control} rows={3} maxLength={2000} value={emailNote} onChange={event => setEmailNote(event.target.value)} placeholder="Add a short note for the recipient." /></Field>
          {error && <LoadState error={error} />}
          <p className="rounded-lg bg-indigo-50 p-3 text-xs leading-5 text-indigo-900">The email includes the role, company, version, publish date, and the complete JD sections. Company SMTP settings must be active.</p>
        </form>
      </Modal>
      <Modal open={deleteOpen} onClose={() => { if (!busy) setDeleteOpen(false) }} title={`Delete ${selected?.name || 'master JD'}?`}
        footer={<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button type="button" variant="danger" loading={busy} onClick={deleteSelected}>Delete master JD</Button></div>}>
        <p className="text-sm leading-6 text-gray-700">This permanently removes the saved master JD and its versions from the JD library. Any JD already copied or published on an employee record, including its performance history, will remain unchanged.</p>
      </Modal>
    </>
  )
}

export function PerformanceOnboarding() {
  const library = usePerformance('/library')
  const overview = usePerformance('/overview')
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const viewAs = params.get('viewAs') || 'HR'
  const employees = overview.data?.employees || []
  const missingJd = employees.filter(employee => employee.jdStatus === 'NOT_ASSIGNED')
    .filter(employee => `${employee.name} ${employee.employeeCode || ''} ${employee.designation || ''} ${employee.department || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const positions = (library.data?.roles || []).filter(role => role.kind !== 'LEGACY_ROLE')
  const roles = positions.filter(role => latest(role.document))

  async function assign(employee) {
    const roleId = selected[employee.id] || employee.roleId
    if (!roleId || busyId) return
    setBusyId(employee.id)
    setError('')
    setStatus('')
    try {
      const { data: record } = await api.get(`${base}/employees/${employee.id}`)
      await api.post(`${base}/employees/${employee.id}/jd-assign`, {
        revision: record.revision, values: { roleId },
      })
      overview.setData({
        ...overview.data,
        employees: employees.map(row => row.id === employee.id ? { ...row, jdStatus: 'DRAFT' } : row),
      })
      setSelected(current => { const next = { ...current }; delete next[employee.id]; return next })
      setStatus(`A draft JD for ${employee.name} has been assigned. HR can review and publish it from the employee record.`)
    } catch (failure) {
      setError(apiError(failure, `Could not assign a JD to ${employee.name}.`))
    } finally {
      setBusyId(null)
    }
  }

  return <>
    <PageHeader title="New joiner onboarding" subtitle="Find employees without a job description and assign a published JD for their position."
      actions={<Link to={`/performance/library${viewAs === 'HR' ? '' : `?viewAs=${viewAs}`}`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Back to JD library</Link>} />
    <PerformanceNav editor hr={overview.data?.hr} />
    {viewAs !== 'HR' && <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This onboarding page is read-only in {viewAs} preview. Switch View as to HR to assign job descriptions.</div>}
    <LoadState {...library} />
    <LoadState {...overview} />
    {overview.data?.hr && viewAs !== 'HR' && null}
    {overview.data && library.data && <section className={`${panel} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
        <div><h2 className="font-semibold text-gray-900">Employees without a JD</h2><p className="mt-1 text-sm text-gray-600">{missingJd.length} employee{missingJd.length === 1 ? '' : 's'} need a job description.</p></div>
        <div className="w-full sm:max-w-sm"><Field label="Search employees"><input className={control} value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, position, department, or ID" /></Field></div>
      </div>
      <LoadState error={error} />
      {status && <p role="status" className="border-b border-gray-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{status}</p>}
      {missingJd.length ? <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Job position</th><th className="px-4 py-3">Published position JD</th><th className="px-4 py-3">Action</th></tr></thead>
        <tbody className="divide-y divide-gray-100">{missingJd.map(employee => {
          const position = positions.find(role => role.id === employee.roleId)
          const positionJd = roles.find(role => role.id === employee.roleId)
          const value = selected[employee.id] || (positionJd ? employee.roleId : '')
          const options = roles.filter(role => role.id === employee.roleId)
          return <tr key={employee.id} className="hover:bg-gray-50">
            <td className="px-4 py-3"><p className="font-semibold text-gray-900">{employee.name}</p><p className="mt-0.5 text-xs text-gray-500">{employee.employeeCode || 'Employee'}{employee.joined ? ` · Joined ${dayText(employee.joined)}` : ''}</p></td>
            <td className="px-4 py-3 text-gray-600">{employee.department || '—'}</td>
            <td className="px-4 py-3 text-gray-700">{employee.designation || 'Position not set'}</td>
            <td className="px-4 py-3">{options.length ? <Combobox label={`Published JD for ${employee.name}`} value={value} onChange={roleId => setSelected(current => ({ ...current, [employee.id]: roleId}))}
              placeholder="Select published JD" emptyText="Publish a JD for this position first"
              options={options.map(role => ({ value: role.id, label: role.name, sublabel: role.department || 'Published job description' }))} disabled={viewAs !== 'HR' || busyId !== null} />
              : position ? <div className="space-y-1"><p className="text-sm text-gray-600">{position.document?.draft ? `A JD draft exists for ${position.name}, but it must be published before assignment.` : `No published JD for ${position.name}.`}</p>
                {viewAs === 'HR' && overview.data?.hr ? <Link to={`/performance/library/create?position=${encodeURIComponent(position.id)}&returnTo=onboarding`} className="inline-flex rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">{position.document?.draft ? 'Continue JD draft' : 'Create JD for this position'}</Link>
                  : <p className="text-xs text-gray-500">Switch View as to HR to create and publish its JD.</p>}</div>
                : <p className="text-sm text-amber-800">Assign a job position to this employee profile before selecting a JD.</p>}</td>
            <td className="px-4 py-3"><Button type="button" size="sm" disabled={viewAs !== 'HR' || !value || busyId !== null}
              title={!options.length ? 'Publish a JD for this employee’s position first.' : undefined} loading={busyId === employee.id} onClick={() => assign(employee)}>
              <UserPlusIcon className="mr-1.5 size-4" aria-hidden="true" /> Assign JD
            </Button></td>
          </tr>
      })}</tbody>
      </table></div> : <Empty>{query ? 'No unassigned employees match your search.' : employees.length ? 'All employees currently have a job description assigned.' : 'No employees are available in this company.'}</Empty>}
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600">Only published job descriptions for an employee’s assigned job position are available. Assigning creates an employee draft; HR can review and publish it from the employee record.</div>
    </section>}
  </>
}

export function PerformanceCreateJd() {
  const resource = usePerformance('/library')
  const overview = usePerformance('/overview')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [positionId, setPositionId] = useState(params.get('position') || '')
  const [managerEmployeeId, setManagerEmployeeId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const roles = (resource.data?.roles || []).filter(role => role.kind !== 'LEGACY_ROLE')
  const position = roles.find(role => role.id === positionId)
  const managerEmployee = (overview.data?.employees || []).find(employee => String(employee.id) === String(managerEmployeeId))
  const version = latest(position?.document)
  const fields = position ? {
    ...(position.document?.draft || version?.fields || {}),
    reportingTo: position.document?.draft?.reportingTo || version?.fields?.reportingTo || '',
  } : {}
  const viewAs = params.get('viewAs') || 'HR'
  const canEdit = Boolean(overview.data?.hr && viewAs === 'HR')

  async function save(fields, publish) {
    if (!position) return
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await api.put(`${base}/library/${position.id}`, { revision: position.revision, publish, fields })
      setStatus(publish ? 'The master job description was published.' : 'The job description draft was saved.')
      navigate(params.get('returnTo') === 'onboarding' ? '/performance/onboarding' : '/performance/library')
    } catch (failure) {
      setError(apiError(failure, 'Could not save the job description.'))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <PageHeader title="Create job description" subtitle="Build a reusable, role-specific JD for a job position. Review generated content before publishing."
      actions={<Link to={`/performance/library${viewAs === 'HR' ? '' : `?viewAs=${viewAs}`}`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Back to JD library</Link>} />
    <PerformanceNav editor hr={overview.data?.hr} />
    <LoadState {...resource} />
    <LoadState {...overview} />
    {overview.data?.hr && !canEdit && <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Switch View as to HR to create or publish a job description.</p>}
    {error && <div className="mb-4"><LoadState error={error} /></div>}
    {status && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p>}
    {resource.data && overview.data && <section className={`${panel} space-y-5 p-4 sm:p-6`}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
        <Field label="Job position"><Combobox label="" value={positionId} onChange={value => { setPositionId(value); setManagerEmployeeId('') }} placeholder="Search job positions" emptyText="No job positions found"
          options={roles.map(role => ({ value: role.id, label: role.name, sublabel: role.department || 'Department not set' }))} disabled={!canEdit} /></Field>
        {position && <Field label="Employee context (optional)"><Combobox label="" value={managerEmployeeId} onChange={setManagerEmployeeId} placeholder="Choose whose reporting line to use" emptyText="No employees found"
          options={(overview.data?.employees || []).map(employee => ({ value: String(employee.id), label: employee.name, sublabel: [employee.designation, employee.department].filter(Boolean).join(' · ') || 'Employee' }))} disabled={!canEdit} /></Field>}
        {position && <div className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950"><p className="font-semibold">{position.name}</p><p className="mt-1">{position.department || 'Department not set'} · {[version ? `Published v${version.version}` : null, position.document?.draft ? 'Draft exists' : null].filter(Boolean).join(' · ') || 'No JD saved yet'}</p></div>}
      </div>
      {managerEmployee && managerEmployee.roleId !== position?.id && <p className="-mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{managerEmployee.name} has a different job position. Their manager is shown for reference; changing it here will update their employee profile.</p>}
      {!roles.length && <div className="rounded-xl border border-dashed border-gray-300 p-5 text-sm text-gray-700">Create a job position first, then return here to create its JD. <Link to="/performance/library" className="font-semibold text-indigo-700 hover:underline">Open JD library</Link>.</div>}
      {position && canEdit && <>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950"><p className="font-semibold">Industry-specific drafting</p><p className="mt-1">Complete the required role details in Generate JD. If something is unknown, mark it for manager confirmation so the AI does not invent requirements.</p></div>
        <JobDescriptionEditor key={`${position.id}-${position.revision}-${managerEmployeeId}`} roleId={position.id} managerEmployeeId={managerEmployeeId || undefined}
          managerId={managerEmployee?.managerId} managerName={managerEmployee?.manager} fields={{ ...fields, reportingTo: managerEmployee ? (managerEmployee.manager || '') : fields.reportingTo }}
          onManagerAssigned={manager => overview.setData({ ...overview.data, employees: overview.data.employees.map(employee => employee.id === managerEmployee.id ? { ...employee, ...manager } : employee) })}
          busy={busy} onSave={save} />
      </>}
      {position && !canEdit && <JDView version={version || (position.document?.draft ? { version: 'Draft', fields: position.document.draft } : null)} title={position.name} company={overview.data.company} department={position.department} />}
    </section>}
  </>
}

export function PerformanceJdHistory() {
  const library = usePerformance('/library')
  const overview = usePerformance('/overview')
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const selectedPosition = params.get('position') || ''
  const rows = (library.data?.roles || []).filter(role => role.document?.versions?.length)
    .filter(role => !selectedPosition || role.id === selectedPosition)
    .filter(role => `${role.name} ${role.department || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const viewAs = params.get('viewAs') || 'HR'
  return <>
    <PageHeader title="Job description history" subtitle="Review published versions of master job descriptions by job position."
      actions={<Link to={`/performance/library${viewAs === 'HR' ? '' : `?viewAs=${viewAs}`}`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Back to JD library</Link>} />
    <PerformanceNav editor hr={overview.data?.hr} />
    <LoadState {...library} />
    <LoadState {...overview} />
    {library.data && <div className="space-y-4">
      <div className="w-full sm:max-w-md"><Field label="Search positions"><input className={control} value={query} onChange={event => setQuery(event.target.value)} placeholder="Position or department" /></Field></div>
      {rows.map(role => <section key={role.id} className={`${panel} overflow-hidden`}>
        <header className="border-b border-gray-100 p-4 sm:p-5"><h2 className="font-semibold text-gray-900">{role.name}</h2><p className="mt-1 text-sm text-gray-600">{role.department || 'Department not set'} · {role.document.versions.length} published version{role.document.versions.length === 1 ? '' : 's'}</p></header>
        <div className="space-y-4 p-4 sm:p-5">{[...role.document.versions].reverse().map(item => <JDView key={item.version} version={item} title={role.name} company={overview.data?.company} department={role.department} />)}</div>
      </section>)}
      {!rows.length && <section className={`${panel} p-6`}><Empty>{selectedPosition ? 'No published history exists for this job position.' : 'No published job description history is available yet.'}</Empty></section>}
    </div>}
  </>
}

export function PerformanceSettings() {
  const resource = usePerformance('/settings')
  const [params] = useSearchParams()
  const viewAs = params.get('viewAs') || 'HR'
  return (
    <>
      <PageHeader title="Performance settings" subtitle="Set the company’s review cycle, progress schedule and rating scale." />
      <PerformanceNav editor hr />
      {viewAs !== 'HR' && <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Previewing the {viewAs} view in read-only mode. Settings remain available only in the HR view.</div>}
      <LoadState {...resource} />
      {resource.data && viewAs === 'HR' && <SettingsForm key={resource.data.revision} data={resource.data} onSuccess={resource.setData} />}
    </>
  )
}

function SettingsForm({ data, onSuccess }) {
  const [values, setValues] = useState(data.settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const setValue = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const setFrequency = frequency => setValues(current => {
    if (!current.start) return { ...current, frequency }
    const [year, month, day] = current.start.split('-').map(Number)
    const months = { QUARTERLY: 3, HALF_YEARLY: 6, ANNUAL: 12 }[frequency]
    const lastDay = new Date(Date.UTC(year, month + months, 0)).getUTCDate()
    const end = new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay) - 1)).toISOString().slice(0, 10)
    return { ...current, frequency, end, reviewDate: end }
  })
  const setScale = (index, key, value) => setValues(current => ({
    ...current, scale: current.scale.map((entry, at) => at === index ? { ...entry, [key]: value } : entry),
  }))
  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await api.put(`${base}/settings`, { revision: data.revision, values })
      onSuccess(response.data)
    } catch (error) {
      setError(apiError(error, 'Could not save settings.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className={`${panel} max-w-4xl space-y-5 p-4 sm:p-6`}>
      <LoadState error={error} />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-semibold text-gray-900">Monitoring and formal reviews</legend>
        <Field label="Progress update frequency"><select className={control} value={values.monitoring} onChange={e => setValue('monitoring', e.target.value)}>
          <option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option>
        </select></Field>
        <Field label="Formal review frequency"><select className={control} value={values.frequency} onChange={e => setFrequency(e.target.value)}>
          <option value="QUARTERLY">Quarterly</option><option value="HALF_YEARLY">Half-yearly</option><option value="ANNUAL">Annual</option>
        </select></Field>
        {[['start', 'Cycle starts'], ['end', 'Cycle ends'], ['reviewDate', 'Formal review opens']].map(([key, label]) => (
          <Field key={key} label={label}><input type="date" required className={control} value={values[key]} onChange={e => setValue(key, e.target.value)} /></Field>
        ))}
      </fieldset>
      <fieldset className="space-y-3 border-t border-gray-100 pt-4">
        <legend className="font-semibold text-gray-900">Rating scale</legend>
        {values.scale.map((entry, index) => (
          <div key={entry.value} className="grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,2fr)]">
            <span className="mt-1 grid size-7 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-800">{entry.value}</span>
            <Field label="Label"><input required maxLength={60} className={control} value={entry.label} onChange={e => setScale(index, 'label', e.target.value)} /></Field>
            <Field label="Definition"><textarea required maxLength={700} rows={2} className={control} value={entry.definition} onChange={e => setScale(index, 'definition', e.target.value)} /></Field>
          </div>
        ))}
      </fieldset>
      <div className="flex justify-end"><Button type="submit" loading={saving}>Save settings</Button></div>
    </form>
  )
}
