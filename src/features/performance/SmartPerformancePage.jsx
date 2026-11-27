import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarDaysIcon, ClipboardDocumentCheckIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import PageHeader from '../../components/common/PageHeader'
import useAuth from '../../hooks/useAuth'
import { BackToPerformance, control, dayText, Download, Empty, Field, jdFields, LoadState, panel, PerformanceNav, Status, usePerformance } from './SmartPerformanceUi'
import { PerformanceCreateJd, PerformanceJdHistory, PerformanceLibrary, PerformanceOnboarding, PerformanceSettings } from './SmartPerformanceLibrary'
import PerformanceRecord from './SmartPerformanceRecord'

const filterOptions = {
  jd: [['NOT_ASSIGNED', 'Not assigned'], ['DRAFT', 'Draft'], ['PUBLISHED', 'Published'], ['ACKNOWLEDGED', 'Acknowledged']],
  kpi: [['NOT_ASSIGNED', 'Not assigned'], ['DRAFT', 'Draft'], ['SUBMITTED', 'Pending approval'], ['CHANGES_REQUESTED', 'Changes requested'], ['APPROVED', 'Approved'], ['ACKNOWLEDGED', 'Acknowledged']],
  due: [['overdue', 'Overdue updates'], ['review', 'Review due']],
  review: [['READY', 'Ready for review'], ['NOT_RELEASED', 'Not released'], ['DRAFT', 'Draft'], ['SUBMITTED', 'With HR'], ['RELEASED', 'Finalised']],
}

export default function SmartPerformancePage({ screen = 'overview' }) {
  const { effectiveCompanyId } = useAuth()
  return (
    <div className="mx-auto max-w-[1320px]" key={effectiveCompanyId ?? 'no-company'}>
      {screen === 'overview' && <Overview />}
      {screen === 'library' && <PerformanceLibrary />}
      {screen === 'library-create' && <PerformanceCreateJd />}
      {screen === 'library-history' && <PerformanceJdHistory />}
      {screen === 'onboarding' && <PerformanceOnboarding />}
      {screen === 'settings' && <PerformanceSettings />}
      {screen === 'record' && <RecordRoute />}
      {screen === 'archive' && <Archive />}
    </div>
  )
}

function RecordRoute() {
  const { employeeId } = useParams()
  return <PerformanceRecord key={employeeId} employeeId={employeeId} />
}

function Overview() {
  const resource = usePerformance('/overview')
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('')
  const [jd, setJd] = useState('')
  const [kpi, setKpi] = useState('')
  const [due, setDue] = useState('')
  const [review, setReview] = useState('')
  const [params] = useSearchParams()
  const { data } = resource
  if (!data) return <><PageHeader title="Performance" /><LoadState {...resource} /></>
  if (!data.editor && data.selfId) return <Navigate replace to={`/performance/employees/${data.selfId}`} />

  const newJoiners = params.get('newJoiners') === '1'
  const viewAs = params.get('viewAs') || 'HR'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const employees = data.employees || []
  const scopedEmployees = viewAs === 'Manager' ? employees.filter(e => e.managerEdit)
    : viewAs === 'Employee' ? employees.filter(e => e.own || String(e.id) === String(data.selfId || '')) : employees
  const registered = (newJoiners ? scopedEmployees.filter(e => e.joined && e.joined >= data.settings.start) : scopedEmployees)
  const departments = [...new Set(registered.map(e => e.department).filter(Boolean))].sort()
  const reviewState = employee => employee.reviewStatus === 'NOT_STARTED'
    ? (['APPROVED', 'ACKNOWLEDGED'].includes(employee.kpiStatus) ? 'READY' : 'NOT_RELEASED')
    : employee.reviewStatus
  const visible = registered.filter(e => {
    return (!query || `${e.name} ${e.designation} ${e.department} ${e.manager}`.toLowerCase().includes(query.trim().toLowerCase()))
      && (!department || e.department === department)
      && (!jd || e.jdStatus === jd)
      && (!kpi || e.kpiStatus === kpi)
      && (!review || reviewState(e) === review)
      && (!due || (due === 'overdue' ? e.overdue : e.reviewDue && e.reviewDue <= today && e.reviewStatus !== 'RELEASED'))
  })
  const publishedJds = registered.filter(e => ['PUBLISHED', 'ACKNOWLEDGED'].includes(e.jdStatus)).length
  const approvedKpis = registered.filter(e => ['APPROVED', 'ACKNOWLEDGED'].includes(e.kpiStatus)).length
  const counts = [
    [DocumentTextIcon, 'Published JDs', `${publishedJds} / ${registered.length}`],
    [ClipboardDocumentCheckIcon, 'Approved KPI sets', `${approvedKpis} / ${registered.length}`],
    [ClipboardDocumentCheckIcon, 'Pending KPI approvals', registered.filter(e => e.kpiStatus === 'SUBMITTED').length],
    [CalendarDaysIcon, 'Overdue updates', registered.filter(e => e.overdue).length],
  ]

  return (
    <>
      <PageHeader title={newJoiners ? 'New joiner performance setup' : 'Performance Review'}
        subtitle={`${data.company} · ${dayText(data.settings.start)} – ${dayText(data.settings.end)}`}
        actions={<><Download path="/report.csv" filename="performance-overview.csv">Export overview</Download>
          {data.hr && <Link to="/performance/archive" className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50">Previous records</Link>}</>} />
      <PerformanceNav editor={data.editor} hr={data.hr} />
      {data.hr && viewAs !== 'HR' && <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Previewing the {viewAs} view in read-only mode. Your signed-in account and permissions have not changed.
      </div>}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counts.map(([Icon, name, value]) => (
          <div key={name} className={`${panel} flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-3 sm:p-4`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Icon className="size-5" /></span>
            <div className="min-w-0"><p className="text-xl font-semibold text-gray-900">{value}</p><p className="text-xs text-gray-600">{name}</p></div>
          </div>
        ))}
      </div>
      <section aria-label="Employee performance records" className={panel}>
        <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-2 xl:grid-cols-[2fr_repeat(5,minmax(0,1fr))]">
          <Field label="Search employees"><input className={control} placeholder="Employee, role, department, or manager" value={query} onChange={e => setQuery(e.target.value)} /></Field>
          <Filter label="Department" value={department} onChange={setDepartment} options={departments.map(item => [item, item])} />
          <Filter label="JD status" value={jd} onChange={setJd} options={filterOptions.jd} />
          <Filter label="KPI status" value={kpi} onChange={setKpi} options={filterOptions.kpi} />
          <Filter label="Due dates" value={due} onChange={setDue} options={filterOptions.due} />
          <Filter label="Review status" value={review} onChange={setReview} options={filterOptions.review} />
        </div>
        {!visible.length ? <Empty>{registered.length ? 'No employees match the selected filters.' : 'No employee records are available in this view.'}</Empty> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-left text-sm">
              <thead className="hidden text-xs font-semibold text-gray-500 md:table-header-group">
                <tr>{['Employee', 'Department', 'Job description', 'KPIs', 'Next update', 'Review', ''].map((column, i) => <th key={i} className="px-4 py-3">{column}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map(row => (
                  <tr key={row.id} className="grid grid-cols-2 gap-3 p-4 md:table-row md:p-0">
                    <td className="col-span-2 min-w-0 md:table-cell md:px-4 md:py-3">
                      <Link to={`/performance/employees/${row.id}${viewAs === 'HR' ? '' : `?viewAs=${viewAs}`}`} className="font-semibold text-indigo-700 hover:underline wrap-anywhere">{row.name}</Link>
                      <p className="text-xs text-gray-600">{row.designation}</p>
                    </td>
                    <Cell label="Department"><span className="text-gray-700">{row.department || '—'}</span></Cell>
                    <Cell label="Job description"><Status value={row.jdStatus} /></Cell>
                    <Cell label="KPIs"><Status value={row.kpiStatus} /></Cell>
                    <Cell label="Next update"><span className={row.overdue ? 'font-medium text-rose-700' : 'text-gray-700'}>{dayText(row.nextUpdate)}</span></Cell>
                    <Cell label="Review"><Status value={reviewState(row)} label={{ READY: 'Ready for review', NOT_RELEASED: 'Not released', SUBMITTED: 'With HR', RELEASED: 'Finalised' }[reviewState(row)]} />{row.finalRating && <p className="mt-1 text-xs">Overall {row.finalRating}/3</p>}</Cell>
                    <td className="col-span-2 md:px-4 md:py-3"><Link to={`/performance/employees/${row.id}${viewAs === 'HR' ? '' : `?viewAs=${viewAs}`}`} className="text-sm font-medium text-indigo-700 hover:underline">Open record <span aria-hidden="true">→</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Cell({ label, children }) {
  return <td className="md:px-4 md:py-3"><p className="mb-1 text-xs text-gray-500 md:hidden">{label}</p>{children}</td>
}

function Filter({ label, value, onChange, options }) {
  return <Field label={label}><select className={control} value={value} onChange={e => onChange(e.target.value)}>
    <option value="">All</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
  </select></Field>
}

function Archive() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const employee = params.get('employee')
  const resource = usePerformance('/archive' + (id ? `?id=${encodeURIComponent(id)}` : employee ? `?employeeId=${encodeURIComponent(employee)}` : ''))
  const { data } = resource
  return (
    <>
      <BackToPerformance />
      <div className="mt-3"><PageHeader title="Previous performance records" subtitle="Read-only history from the previous module." /></div>
      <LoadState {...resource} />
      {data && <section className={`${panel} p-4 sm:p-6`}>
        {Array.isArray(data) ? (data.length ? <ul className="divide-y divide-gray-100">
          {data.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <Link to={`/performance/archive?id=${row.id}`} className="font-medium text-indigo-700 hover:underline">{row.title}</Link>
            <span className="text-sm text-gray-600">{row.employee} · {dayText(row.date)}</span>
          </li>)}
        </ul> : <Empty>No previous records are available.</Empty>) : (
          <div className="space-y-4 text-sm">
            <div><h2 className="text-lg font-semibold">{data.title}</h2><p className="text-gray-600">{data.employee} · Version {data.version}</p></div>
            <dl className="grid gap-3 sm:grid-cols-2">{jdFields.filter(([key]) => !['purpose', 'responsibilities'].includes(key)).map(([key, label]) => <div key={key}>
              <dt className="font-medium">{label}</dt><dd className="whitespace-pre-wrap wrap-anywhere">{data[key] || '—'}</dd>
            </div>)}</dl>
            {data.purpose && <div><p className="font-medium">Role purpose</p><p className="mt-1 whitespace-pre-wrap wrap-anywhere">{data.purpose}</p></div>}
            {data.responsibilities?.length > 0 && <ul className="list-disc space-y-1 pl-5">{data.responsibilities.map((line, index) => <li key={index}>{line}</li>)}</ul>}
            {data.measures?.map((row, index) => <div key={index} className="rounded-xl bg-gray-50 p-3"><p className="font-medium">{row.description}</p><p>{row.measure}</p><p>Target {row.target ?? '—'} · Actual {row.actual ?? '—'}</p></div>)}
          </div>
        )}
      </section>}
    </>
  )
}
