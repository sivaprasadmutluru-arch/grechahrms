import { useEffect, useState, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchOrgChart } from './employeesSlice'
import { selectPlatformCompanies } from '../platform/platformSlice'
import useAuth from '../../hooks/useAuth'
import { API_BASE_URL } from '../../config/constants'

// ─── Colour palette (one per department, consistent within a session) ─────────

const PALETTE = [
  '#4f8142', '#1b5c78', '#654b78', '#a12b3c',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
  '#f97316', '#06b6d4', '#84cc16', '#a855f7',
]

const _colorCache = {}
let _colorIdx = 0

function deptColor(dept) {
  if (!dept) return '#a12b3c'
  if (!_colorCache[dept]) {
    _colorCache[dept] = PALETTE[_colorIdx % PALETTE.length]
    _colorIdx++
  }
  return _colorCache[dept]
}

function initials(name) {
  if (!name?.trim()) return '?'
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────

function countNodes(node) {
  return 1 + (node.children || []).reduce((s, c) => s + countNodes(c), 0)
}

function collectDepts(node, set = new Set()) {
  if (node.department) set.add(node.department)
  ;(node.children || []).forEach(c => collectDepts(c, set))
  return set
}

function nodeMatches(node, q) {
  return (
    (node.name || '').toLowerCase().includes(q) ||
    (node.position || '').toLowerCase().includes(q) ||
    (node.department || '').toLowerCase().includes(q)
    || (node.jobRole || '').toLowerCase().includes(q)
    || (node.accessRoles || []).some(role => role.toLowerCase().replaceAll('_', ' ').includes(q))
  )
}

function filterTree(node, q) {
  if (!q) return node
  const kids = (node.children || []).map(c => filterTree(c, q)).filter(Boolean)
  return nodeMatches(node, q) || kids.length > 0 ? { ...node, children: kids } : null
}

// A department-first view is deliberately visual only.  It keeps the org chart
// easy to read for companies that have not finished assigning every employee's
// reporting manager, without changing leave approval or reporting data.
function flattenEmployees(nodes, result = []) {
  ;(nodes || []).forEach(node => {
    if (!node.isDepartment && node.id !== 'company') result.push({ ...node, children: [] })
    flattenEmployees(node.children, result)
  })
  return result
}

function executiveRank(employee) {
  const label = `${employee.position || ''} ${employee.jobRole || ''} ${(employee.accessRoles || []).join(' ')}`.toUpperCase()
  if (label.includes('CEO')) return 0
  if (label.includes('COO')) return 1
  return 2
}

function buildDepartmentFirstChart(nodes, companyName) {
  const employees = flattenEmployees(nodes)
  const managementEmployees = employees.filter(employee => (employee.department || '').trim().toUpperCase() === 'MANAGEMENT')
    .sort((a, b) => executiveRank(a) - executiveRank(b) || (a.name || '').localeCompare(b.name || ''))
  const ceo = managementEmployees.find(employee => executiveRank(employee) === 0)
  const coo = managementEmployees.find(employee => executiveRank(employee) === 1)
  const otherManagement = managementEmployees.filter(employee => employee.id !== ceo?.id && employee.id !== coo?.id)
  const order = ['ACCOUNTS', 'ADMIN', 'BUSINESS DEVELOPMENT', 'GENERAL', 'MOTOR', 'MEDICAL', 'SALES', 'SALES ADMIN', 'LEAD GEN']
  const departmentNodes = order.map(department => ({
    id: `department-root-${department}`,
    name: department.replace(/\b\w/g, letter => letter.toUpperCase()),
    department,
    isDepartment: true,
    children: employees.filter(employee => (employee.department || '').trim().toUpperCase() === department)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
  }))
  // CEO and COO are the only executive chain.  Every department belongs on
  // the next level as a sibling, so the chart stays wide/horizontal rather
  // than nesting department blocks one below another.
  const managementDepartment = otherManagement.length ? {
    id: 'department-root-MANAGEMENT', name: 'Management', department: 'MANAGEMENT', isDepartment: true,
    children: otherManagement,
  } : null
  const departmentLevel = [
    ...(managementDepartment ? [managementDepartment] : []),
    ...departmentNodes,
  ]
  const chiefOperatingOfficer = coo
    ? { ...coo, children: departmentLevel }
    : { id: 'department-level', name: 'Departments', department: 'MANAGEMENT', isDepartment: true, children: departmentLevel }
  const chiefExecutiveOfficer = ceo
    ? { ...ceo, children: [chiefOperatingOfficer] }
    : chiefOperatingOfficer
  return {
    id: 'company', name: companyName || 'Selected company', position: 'Company reporting tree',
    children: [chiefExecutiveOfficer],
  }
}

// Department headings group siblings only; they never replace a real manager.
function groupDepartments(node) {
  const children = (node.children || []).map(groupDepartments)
  const groups = new Map()
  children.forEach(child => {
    const department = child.department || 'Department not assigned'
    if (!groups.has(department)) groups.set(department, [])
    groups.get(department).push(child)
  })
  if (node.isDepartment || groups.size < 2 && node.id !== 'company') return { ...node, children }
  return { ...node, children: [...groups].map(([department, members]) => ({
    id: `department-${node.id}-${department}`,
    name: department,
    department,
    isDepartment: true,
    children: members,
  })) }
}

// ─── Employee card ────────────────────────────────────────────────────────────

function EmployeeCard({ node, expanded, hasChildren, onToggle }) {
  const color = deptColor(node.department)
  const ini = initials(node.name)
  const directCount = node.children?.length || 0

  if (node.isDepartment) return (
    <button onClick={onToggle} aria-expanded={expanded} className="text-white font-semibold text-base px-4 py-4 rounded-lg" style={{ width: 280, backgroundColor: color }}>
      {node.name}
      <span className="block text-xs font-normal mt-1">{directCount} employee{directCount === 1 ? '' : 's'} · {expanded ? 'Collapse' : 'Expand'}</span>
    </button>
  )

  // The company root is a structural anchor, not an employee.  Giving it a
  // dedicated, centred card avoids the empty coloured employee header that
  // previously made the first box look offset from the reporting line.
  if (node.id === 'company') return (
    <div className="relative w-[280px] overflow-hidden border border-gray-200 bg-white text-center">
      <div className="h-2 bg-indigo-700" />
      <div className="px-4 py-3 font-semibold text-gray-900 truncate">{node.name || 'Selected company'}</div>
      <div className="bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">Company reporting tree</div>
      {hasChildren && (
        <button onClick={onToggle} className="w-full bg-indigo-50 py-1.5 text-xs font-medium text-indigo-700">
          {directCount} group{directCount === 1 ? '' : 's'} · {expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
    </div>
  )

  return (
    <div
      className="relative bg-white border border-gray-200"
      style={{
        width: 280,
      }}
    >
      {/* Coloured top bar */}
      <div className="h-2" style={{ backgroundColor: color }} />

      <div>
        {/* Avatar + name */}
        <div className="flex items-center gap-3 p-3" style={{ backgroundColor: color }}>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: color }}
          >
            {node.photoPath
              ? <img src={node.photoPath.startsWith('http') ? node.photoPath : `${API_BASE_URL.replace('/api', '')}/media/${node.photoPath}`} alt={node.name} className="w-full h-full object-cover" />
              : ini}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-base text-white leading-tight break-words">
              {node.name || `Employee #${node.id}`}
            </div>
          </div>
        </div>

        <div className="bg-gray-100 px-3 py-2 text-center text-sm font-semibold text-gray-900">{node.position || node.jobRole || (node.id === 'company' ? 'Company reporting tree' : 'Position not assigned')}</div>
        {/* Department badge */}
        {node.department && (
          <div
            className="flex justify-center text-xs px-2 py-1 max-w-full"
            style={{ backgroundColor: color + '18', color }}
          >
            <span className="truncate">{node.department}</span>
          </div>
        )}

        {node.hierarchyIssue && <p className="text-xs text-amber-800 px-3 py-2 bg-amber-50">{node.hierarchyIssue}</p>}
        {/* Expand/collapse toggle */}
        {hasChildren && (
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center gap-1.5 text-xs rounded-lg py-1.5 mt-1 font-medium transition-colors duration-150"
            style={{
              backgroundColor: expanded ? color + '18' : '#f3f4f6',
              color: expanded ? color : '#6b7280',
            }}
          >
            <svg
              className="w-3 h-3 transition-transform duration-200"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {directCount} report{directCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Org node (recursive) ─────────────────────────────────────────────────────

function OrgNode({ node, search, depth = 0, expandMode }) {
  const [expanded, setExpanded] = useState(true)
  useEffect(() => { if (expandMode) setExpanded(expandMode.open) }, [expandMode])
  const isExpanded = search ? true : expanded
  const kids = (node.children || [])
  const hasChildren = kids.length > 0
  const visibleKids = isExpanded ? kids : []
  // Keep team members in a column; siblings are not each other's managers.
  const stackReports = node.isDepartment || (!kids.some(child => child.isDepartment) && (depth >= 2 || kids.every(child => !child.children?.length)))

  return (
    <div role="treeitem" className="flex flex-col items-center" aria-expanded={hasChildren ? isExpanded : undefined}>
      <EmployeeCard
        node={node}
        expanded={isExpanded}
        hasChildren={hasChildren}
        onToggle={() => setExpanded(v => !v)}
      />

      {hasChildren && isExpanded && visibleKids.length > 0 && (
        stackReports ? (
          <div role="group" className="self-center" style={{ marginLeft: 24 }}>
            {visibleKids.map((child, idx) => (
              <div key={child.id} className="relative" style={{ paddingLeft: 28, paddingTop: 20 }}>
                <div aria-hidden="true" className="absolute bg-gray-400" style={{ left: 0, top: 0, width: 2, bottom: idx === visibleKids.length - 1 ? 'auto' : 0, height: idx === visibleKids.length - 1 ? 58 : undefined }} />
                <div aria-hidden="true" className="absolute bg-gray-400" style={{ left: 0, top: 58, height: 2, width: 28 }} />
                <OrgNode node={child} search={search} depth={depth + 1} expandMode={expandMode} />
              </div>
            ))}
          </div>
        ) : (
        <div className="flex flex-col items-center">
        <div aria-hidden="true" className="w-0.5 h-8 bg-gray-400" />
        <div role="group" className="flex items-start">
          {visibleKids.map((child, idx) => (
            <div key={child.id} className="relative flex flex-col items-center px-6">
              <div aria-hidden="true" className="absolute bg-gray-400" style={{ top: 0, height: 2, left: idx === 0 ? '50%' : 0, right: idx === visibleKids.length - 1 ? '50%' : 0 }} />
              <div aria-hidden="true" className="w-0.5 h-8 bg-gray-400" />
              <OrgNode node={child} search={search} depth={depth + 1} expandMode={expandMode} />
            </div>
          ))}
        </div>
        </div>
        )
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const dispatch = useDispatch()
  const { user, effectiveCompanyId } = useAuth()
  const companyId = effectiveCompanyId
  const companies = useSelector(s => s.companies.data)
  const accessibleCompanies = useSelector(selectPlatformCompanies)
  const selectedCompany = (accessibleCompanies || []).find(company => Number(company.id) === Number(companyId))
    || (companies || []).find(company => Number(company.id) === Number(companyId))
  const [search, setSearch] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [chartData, setChartData] = useState([])
  const [expandMode, setExpandMode] = useState({ open: true })
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let active = true
    setLoaded(false); setError(''); setChartData([])
    if (companyId) {
      dispatch(fetchOrgChart({ companyId })).unwrap()
        .then(data => { if (active) setChartData(data || []) })
        .catch(message => { if (active) setError(String(message || 'Unable to load chart')) })
        .finally(() => { if (active) setLoaded(true) })
    }
    return () => { active = false }
  }, [dispatch, companyId])

  const allRoots = useMemo(
    () => chartData,
    [chartData],
  )

  const totalEmployees = useMemo(
    () => allRoots.reduce((s, r) => s + countNodes(r), 0),
    [allRoots],
  )

  const allDepts = useMemo(() => {
    const s = new Set()
    allRoots.forEach(r => collectDepts(r, s))
    return s
  }, [allRoots])

  const q = search.toLowerCase().trim()
  const roots = useMemo(
    () => q ? allRoots.map(r => filterTree(r, q)).filter(Boolean) : allRoots,
    [allRoots, q],
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex flex-wrap items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900 mr-auto">Org Chart</h1>
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, position, department…"
            className="border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none"
            >
              ×
            </button>
          )}
        </div>
        <button className="text-indigo-700" onClick={() => setExpandMode({ open: true })}>Expand all</button>
        <button className="text-indigo-700" onClick={() => setExpandMode({ open: false })}>Collapse all</button>
        <div className="flex items-center gap-3 text-sm" aria-label="Tree zoom">
          <button aria-label="Zoom out" disabled={zoom <= 0.5} className="px-3 py-1 border rounded disabled:opacity-40" onClick={() => setZoom(v => Math.max(0.5, Math.round((v - 0.1) * 100) / 100))}>−</button>
          <button onClick={() => setZoom(1)} title="Reset zoom">{Math.round(zoom * 100)}%</button>
          <button aria-label="Zoom in" disabled={zoom >= 1.75} className="px-3 py-1 border rounded disabled:opacity-40" onClick={() => setZoom(v => Math.min(1.75, Math.round((v + 0.1) * 100) / 100))}>+</button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row bg-white">

      {/* Department legend */}
      {allDepts.size > 0 && (
        <aside aria-label="Department colours and chart totals" className="order-2 md:order-1 w-full md:w-44 shrink-0 p-3 border-t md:border-t-0 md:border-r border-gray-100">
          <div className="space-y-2 text-sm mb-4">
            <StatPill color="#6366f1" label="employees" value={totalEmployees} />
            <StatPill color="#8b5cf6" label="departments" value={allDepts.size} />
          </div>
          <h2 className="text-xs font-semibold text-gray-600 mb-2">Department colours</h2>
        <div className="flex flex-wrap md:flex-col gap-2">
          {[...allDepts].map(dept => (
            <span
              key={dept}
              className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded font-medium break-words"
              style={{ backgroundColor: deptColor(dept) + '18', color: deptColor(dept) }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: deptColor(dept) }}
              />
              {dept}
            </span>
          ))}
        </div>
        </aside>
      )}

      {/* Tree canvas */}
      <div className="order-1 md:order-2 flex-1 min-w-0 min-h-[65vh] overflow-auto bg-white p-4">
        {!companyId ? <p>Select a company to view its reporting tree.</p> : error ? <p role="alert" className="text-red-600">{error}</p> : !loaded ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : roots.length === 0 ? (
          <div className="text-center py-24">
            <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-400 text-sm">
              {q ? `No employees match "${search}"` : 'No org chart data available'}
            </p>
          </div>
        ) : (
          <div role="tree" aria-label="Company reporting hierarchy" className="flex min-w-full w-max justify-center pb-8" style={{ zoom }}>
            <div className="w-max">
              <OrgNode key={companyId} node={q ? groupDepartments({ id: 'company', name: selectedCompany?.name || (Number(user?.companyId) === Number(companyId) ? user.companyName : 'Selected company'), position: 'Company reporting tree', children: roots }) : buildDepartmentFirstChart(allRoots, selectedCompany?.name || (Number(user?.companyId) === Number(companyId) ? user.companyName : 'Selected company'))} search={q} depth={0} expandMode={expandMode} />
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

function StatPill({ color, value, label }) {
  return (
    <div className="flex items-center gap-2 text-gray-600">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="font-semibold text-gray-900">{value}</span>
      {label}
    </div>
  )
}
