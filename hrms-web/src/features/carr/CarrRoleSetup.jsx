import { useId } from 'react'
import { Users, Briefcase } from 'lucide-react'
import Combobox from '../../components/common/Combobox'
import { employeeLabel, newCarrDraft, seedResponsibilities, withEmployee, INDUSTRY_OPTIONS } from './carr-creation'

export default function CarrRoleSetup({draft,setDraft,employees,departments,jobTitles,disabled=false}) {
  const titleList=useId(),industryList=useId()
  const isRole=draft.creationMode==='ROLE'
  const selected=employees.find(employee=>String(employee.id)===String(draft.employeeId))
  const suggestions=jobTitles.filter(row=>!draft.departmentId||!row.departmentId||String(row.departmentId)===String(draft.departmentId))
  const names=[...new Set(suggestions.map(row=>row.name))]
  function selectTitle(title) {
    const entry=suggestions.find(row=>row.name===title)
    setDraft(previous=>({...previous,title,...(entry&&!previous.purpose?{purpose:entry.purpose}:{}),
      ...(entry&&!previous.responsibilities.some(row=>row.statement?.trim())?{responsibilities:seedResponsibilities(entry.responsibilities)}:{}),
      ...(entry?.departmentId&&isRole&&!previous.departmentId?{departmentId:entry.departmentId}:{})}))
  }
  return <section className="section space-y-6">
    <div className="grid gap-4 sm:grid-cols-2" aria-label="CAR creation type">
      {[
        ['EMPLOYEE','Existing employee','Assign a CAR to an active employee in this company.'],
        ['ROLE','Role / future hire','Prepare a reusable CAR before the employee joins.']
      ].map(([value,title,description]) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          aria-pressed={draft.creationMode===value}
          className={`relative rounded-xl border p-4 text-left transition ${
            draft.creationMode===value
              ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
          }`}
          onClick={() => {
            if(draft.creationMode!==value) {
              setDraft({...newCarrDraft(value),title:draft.title,industry:draft.industry})
            }
          }}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              draft.creationMode===value ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
            }`}>
              {value === 'EMPLOYEE' ? <Users size={16} /> : <Briefcase size={16} />}
            </div>
            <div>
              <strong className="block text-sm font-bold text-slate-900">{title}</strong>
              <span className="mt-0.5 block text-xs text-slate-500 leading-relaxed">{description}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
    <p className="text-xs text-slate-500 leading-relaxed">
      Job titles describe work, not access permissions. Suggestions do not add or change HR designations or security roles.
    </p>

    {!isRole && (
      <div className="field">
        <label className="field-label">Employee *</label>
        <Combobox
          placeholder="Search employee name, ID or designation"
          value={draft.employeeId}
          disabled={disabled}
          options={employees
            .filter(employee => !draft.departmentId || String(employee.departmentId) === String(draft.departmentId))
            .map(employee => ({
              value: employee.id,
              label: employeeLabel(employee),
              sublabel: [employee.badgeId, employee.jobPositionName, employee.departmentName].filter(Boolean).join(' · ')
            }))}
          onChange={id => setDraft(previous => withEmployee(previous, employees.find(employee => String(employee.id) === String(id))))}
          emptyText="No active employees match. Clear the department filter or check Employee setup."
        />
        {selected && (
          <p className="mt-1.5 text-xs text-slate-500">
            HR designation: <span className="font-semibold text-slate-700">{selected.jobPositionName || 'Not set in HR'}</span>. The CAR job title below is editable and does not change the HR profile.
          </p>
        )}
      </div>
    )}

    <div className="grid three">
      <div className="field">
        <label className="field-label">Job title / designation *</label>
        <input
          aria-label="Job title / designation"
          list={titleList}
          value={draft.title}
          maxLength={180}
          placeholder="Search suggestions or type a custom job title"
          onChange={event => selectTitle(event.target.value)}
          disabled={disabled}
        />
        <datalist id={titleList}>
          {names.map(name => <option key={name} value={name} />)}
        </datalist>
      </div>

      <div className="field">
        <label className="field-label">Department / function</label>
        <Combobox
          options={departments.map(row => ({ value: row.id, label: row.name }))}
          value={draft.departmentId}
          disabled={disabled || !!selected}
          placeholder="Select department (optional)"
          onChange={value => setDraft(previous => ({ ...previous, departmentId: value }))}
        />
        {draft.departmentId && !selected && (
          <button
            type="button"
            className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
            onClick={() => setDraft(previous => ({ ...previous, departmentId: '' }))}
          >
            Clear department filter
          </button>
        )}
      </div>

      <div className="field">
        <label className="field-label">Industry</label>
        <input
          list={industryList}
          value={draft.industry}
          maxLength={180}
          onChange={event => setDraft(previous => ({ ...previous, industry: event.target.value }))}
          placeholder="Select or type industry (e.g. Insurance, Clinics, Software Development, Trading)"
        />
        <datalist id={industryList}>
          {INDUSTRY_OPTIONS.map(value => (
            <option value={value} key={value} />
          ))}
        </datalist>
      </div>

      <div className="field">
        <label className="field-label">Role level</label>
        <select
          value={draft.roleLevel}
          onChange={event => setDraft(previous => ({ ...previous, roleLevel: event.target.value }))}
        >
          <option value="">Select level (optional)</option>
          {['Executive leadership', 'Head of department', 'Senior Manager', 'Manager', 'Team Lead', 'Senior Individual Contributor', 'Individual Contributor', 'Entry Level'].map(level => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
      </div>

      {!isRole ? (
        <div className="field">
          <label className="field-label">Reporting manager</label>
          <Combobox
            placeholder="Search manager (optional)"
            options={employees
              .filter(row => String(row.id) !== String(draft.employeeId))
              .map(row => ({
                value: row.id,
                label: employeeLabel(row),
                sublabel: row.jobPositionName
              }))}
            value={draft.managerId}
            onChange={value => {
              const manager = employees.find(row => String(row.id) === String(value))
              setDraft(previous => ({
                ...previous,
                managerId: value,
                reportsToTitle: manager ? employeeLabel(manager) : ''
              }))
            }}
          />
        </div>
      ) : (
        <div className="field">
          <label className="field-label">Reports to role</label>
          <input
            value={draft.reportsToTitle}
            maxLength={180}
            placeholder="For example, Operations Manager"
            onChange={event => setDraft(previous => ({ ...previous, reportsToTitle: event.target.value }))}
          />
        </div>
      )}

      <div className="field">
        <label className="field-label">Responsible for</label>
        <input
          value={draft.responsibleFor}
          placeholder="Team, function or outcomes"
          onChange={event => setDraft(previous => ({ ...previous, responsibleFor: event.target.value }))}
        />
      </div>
    </div>
    {isRole && <p className="notice">This saves an unassigned role CAR. No employee is created, and no approval or acknowledgement is recorded until you assign it to a real employee.</p>}
    {!employees.length && !isRole && <p className="notice warning">There are no active employees available in this company. Choose “Role / future hire” to prepare a CAR now.</p>}
  </section>
}
