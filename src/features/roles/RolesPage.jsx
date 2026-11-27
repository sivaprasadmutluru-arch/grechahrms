import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  fetchUserRoles, fetchUsers, registerUser, assignRole, assignRolesToCompanies, revokeRole,
  fetchCrossAccess, grantAccess, revokeAccess, selectUsers, selectUserRoles
} from './rolesSlice'
import { forgotPassword } from '../auth/authSlice'
import { fetchAll as fetchCompanies, fetchMyCompany, fetchBranches, selectAll as selectAllCompanies, selectBranches } from '../companies/companiesSlice'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Combobox from '../../components/common/Combobox'
import { ROLES } from '../../config/constants'
import { formatDate } from '../../utils/formatters'
import useAuth from '../../hooks/useAuth'

const ACCESS_SCOPES = [
  { value: 'SELF', label: 'Self' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'BRANCH', label: 'Branch' },
  { value: 'HEAD_OFFICE', label: 'Head Office' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
]

const ASSIGNABLE_ROLES = {
  PLATFORM_SUPER_ADMIN: [ROLES.SUPER_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.COMPANY_ADMIN, ROLES.CEO, ROLES.COMPANY_MANAGER, ROLES.DEPARTMENT_MANAGER, ROLES.HR_MANAGER, ROLES.ACCOUNTS_MANAGER, ROLES.EMPLOYEE],
  ENTERPRISE_ADMIN: [ROLES.COMPANY_ADMIN, ROLES.COMPANY_MANAGER, ROLES.HR_MANAGER, ROLES.ACCOUNTS_MANAGER, ROLES.DEPARTMENT_MANAGER, ROLES.EMPLOYEE],
  BRANCH_ADMIN: [ROLES.DEPARTMENT_MANAGER, ROLES.EMPLOYEE],
}

export default function RolesPage() {
  const { isPlatformAdmin, isEnterpriseAdmin, isBranchAdmin, user } = useAuth()
  const dispatch = useDispatch()
  const userRoles = useSelector(selectUserRoles)
  const users = useSelector(selectUsers)
  const companies = useSelector(selectAllCompanies)
  const allBranches = useSelector(selectBranches)
  const crossAccess = useSelector(s => s.roles.crossAccess)
  const loading = useSelector(s => s.roles.loading)
  const [tab, setTab] = useState('Users & Assignments')
  const [assignModal, setAssignModal] = useState(false)
  const [accessModal, setAccessModal] = useState(false)
  const [resetModal, setResetModal] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [showInactiveEmployment, setShowInactiveEmployment] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [selectedCompanyIds, setSelectedCompanyIds] = useState([])

  const canManageCrossAccess = isPlatformAdmin() || isEnterpriseAdmin()
  const TABS = [
    'Users & Assignments',
    'Role Templates & Permissions',
    ...(canManageCrossAccess ? ['Company & Branch Access'] : []),
    'Approval Workflows',
    'Delegation & Temporary Access',
    'Access History',
  ]

  const assignableRoles = isPlatformAdmin()
    ? ASSIGNABLE_ROLES.PLATFORM_SUPER_ADMIN
    : isEnterpriseAdmin()
      ? ASSIGNABLE_ROLES.ENTERPRISE_ADMIN
      : ASSIGNABLE_ROLES.BRANCH_ADMIN

  const {
    register: regAssign,
    handleSubmit: handleAssignSubmit,
    reset: resetAssign,
    watch: watchAssign,
    setValue: setAssignValue,
    formState: { errors: assignErrors },
  } = useForm()
  const { register: regAccess, handleSubmit: handleAccessSubmit, reset: resetAccess } = useForm()
  const { register: regUser, handleSubmit: handleUserSubmit, reset: resetUser, formState: { errors: userErrors } } = useForm()

  const userId = user?.userId || user?.id
  const userCompanyId = user?.companyId
  const selectedAssignmentRole = watchAssign('roleName')
  const selectedAssignmentUserId = watchAssign('userId')
  const selectedAssignmentScope = watchAssign('accessScope')
  const multiCompanyRole = [ROLES.SUPER_ADMIN, ROLES.ACCOUNT_MANAGER].includes(selectedAssignmentRole)
  const fixedScopeRole = [ROLES.SUPER_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.COMPANY_ADMIN, ROLES.CEO, ROLES.COMPANY_MANAGER, ROLES.DEPARTMENT_MANAGER, ROLES.EMPLOYEE].includes(selectedAssignmentRole)

  useEffect(() => {
    const companyWideRoles = [ROLES.SUPER_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.COMPANY_ADMIN, ROLES.CEO, ROLES.COMPANY_MANAGER]
    if (companyWideRoles.includes(selectedAssignmentRole)) {
      setAssignValue('accessScope', 'ENTERPRISE')
      setAssignValue('departmentId', '')
    } else if (selectedAssignmentRole === ROLES.DEPARTMENT_MANAGER) {
      setAssignValue('accessScope', 'DEPARTMENT')
    } else if (selectedAssignmentRole === ROLES.EMPLOYEE) {
      setAssignValue('accessScope', 'SELF')
      setAssignValue('departmentId', '')
    }
  }, [selectedAssignmentRole, setAssignValue])

  useEffect(() => {
    if (!selectedAssignmentUserId || multiCompanyRole) return
    const selectedUser = users.find(u => String(u.id) === String(selectedAssignmentUserId))
    setAssignValue('companyId', selectedUser?.companyId ? String(selectedUser.companyId) : '')
  }, [selectedAssignmentUserId, multiCompanyRole, users, setAssignValue])

  useEffect(() => {
    dispatch(fetchUserRoles())
    if (userId) dispatch(fetchCrossAccess(userId))
    dispatch(fetchUsers())
    if (isPlatformAdmin()) {
      dispatch(fetchCompanies({ page: 0, size: 100 }))
    } else if (isEnterpriseAdmin() && userCompanyId) {
      dispatch(fetchMyCompany(userCompanyId)).then(() => {
        dispatch(fetchBranches(userCompanyId))
      })
    } else if (isBranchAdmin() && userCompanyId) {
      dispatch(fetchMyCompany(userCompanyId))
    }
  }, [dispatch, userId, userCompanyId])

  useEffect(() => {
    if (!isPlatformAdmin()) return
    companies
      .filter(c => (c.companyType || c.type) !== 'BRANCH')
      .forEach(c => {
        if (!Object.prototype.hasOwnProperty.call(allBranches, c.id)) {
          dispatch(fetchBranches(c.id))
        }
      })
  }, [dispatch, companies, allBranches, isPlatformAdmin])

  const onAssignRole = async (formData) => {
    try {
      const payload = {
        userId: Number(formData.userId),
        roleName: formData.roleName,
        accessScope: formData.accessScope,
        accessLevel: formData.roleName === ROLES.ACCOUNT_MANAGER ? formData.accessLevel : 'FULL',
        departmentId: formData.departmentId ? Number(formData.departmentId) : null,
        effectiveFrom: formData.effectiveFrom || null,
        expiresOn: formData.expiresOn || null,
        reason: formData.reason?.trim(),
      }
      if (multiCompanyRole) {
        if (!selectedCompanyIds.length) throw new Error('Select at least one company')
        await dispatch(assignRolesToCompanies({ ...payload, companyIds: selectedCompanyIds })).unwrap()
      } else {
        await dispatch(assignRole({ ...payload, companyId: Number(formData.companyId) })).unwrap()
      }
      toast.success(multiCompanyRole ? 'Companies assigned' : 'Role assigned')
      setAssignModal(false)
      setSelectedCompanyIds([])
      dispatch(fetchUserRoles())
    } catch (e) { toast.error(typeof e === 'string' ? e : e?.message || 'Error') }
  }

  const onRevokeRole = async (ur) => {
    try {
      await dispatch(revokeRole({ userId: ur.userId, roleId: ur.roleId, companyId: ur.companyId })).unwrap()
      toast.success('Role revoked')
    } catch { toast.error('Failed') }
  }

  const onGrantAccess = async (formData) => {
    try {
      await dispatch(grantAccess(formData)).unwrap()
      toast.success('Access granted')
      setAccessModal(false)
      if (userId) dispatch(fetchCrossAccess(userId))
    } catch (e) { toast.error(e || 'Error') }
  }

  const onRevokeAccess = async (row) => {
    try {
      await dispatch(revokeAccess({ userId: row.userId, targetCompanyId: row.targetCompany?.id })).unwrap()
      toast.success('Access revoked')
    } catch { toast.error('Failed') }
  }

  const onCreateUser = async (formData) => {
    try {
      await dispatch(registerUser(formData)).unwrap()
      toast.success(`User "${formData.username}" created successfully`)
      resetUser()
      dispatch(fetchUsers())
    } catch (e) { toast.error(e || 'Failed to create user') }
  }

  const openResetModal = (u) => {
    setResetTarget(u)
    setResetModal(true)
  }

  const closeResetModal = () => {
    setResetModal(false)
    setResetTarget(null)
  }

  const onSendResetLink = async () => {
    setResetLoading(true)
    try {
      await dispatch(forgotPassword({ email: resetTarget.email })).unwrap()
      toast.success(`Secure reset link sent to ${resetTarget.email}`)
      closeResetModal()
    } catch (e) {
      toast.error(e || 'Failed to reset password')
    } finally {
      setResetLoading(false)
    }
  }

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase()
    return !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const roleColumns = [
    { accessorKey: 'username', header: 'Username' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'roleName', header: 'Role', cell: ({ getValue }) => <Badge label={getValue()?.replace(/_/g, ' ')} variant="primary" /> },
    { accessorKey: 'companyName', header: 'Company' },
    { accessorKey: 'accessScope', header: 'Scope', cell: ({ getValue }) => <Badge label={getValue()} variant="secondary" /> },
    { accessorKey: 'assignmentStatus', header: 'Status', cell: ({ getValue, row }) => (
      <div className="flex flex-wrap gap-1">
        <Badge label={getValue() || 'ACTIVE'} variant={getValue() === 'REVOKED' ? 'danger' : 'success'} />
        {row.original.inactiveEmployment && <Badge label="Inactive employee" variant="secondary" />}
      </div>
    ) },
    { accessorKey: 'expiresOn', header: 'Expires', cell: ({ getValue }) => getValue() ? formatDate(getValue()) : 'No expiry' },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="danger" onClick={() => onRevokeRole(row.original)}>Revoke</Button>
      )
    },
  ]

  const accessColumns = [
    { accessorKey: 'userId', header: 'User ID' },
    { id: 'grantedByCompany', header: 'Source', cell: ({ row }) => row.original.grantedByCompany?.name || '—' },
    { id: 'targetCompany', header: 'Target', cell: ({ row }) => row.original.targetCompany?.name || '—' },
    { accessorKey: 'reason', header: 'Reason', cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'createdAt', header: 'Granted', cell: ({ getValue }) => formatDate(getValue()) },
    { id: 'actions', header: '', cell: ({ row }) => <Button size="sm" variant="danger" onClick={() => onRevokeAccess(row.original)}>Revoke</Button> },
  ]

  const userOptions = users.map(u => {
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
    return {
      value: u.id,
      label: fullName || u.username || u.email,
      sublabel: `${u.email || u.username}${u.companyId ? ` · Company ID ${u.companyId}` : ''}`,
      searchText: `${u.username || ''} ${u.email || ''} ${fullName} ${u.companyId || ''}`,
    }
  })

  const filteredUserRoles = userRoles.filter(assignment => {
    if (assignment.inactiveEmployment && !showInactiveEmployment) return false
    const query = assignmentSearch.trim().toLowerCase()
    if (!query) return true
    return [
      assignment.username,
      assignment.email,
      assignment.roleName?.replace(/_/g, ' '),
      assignment.companyName,
      assignment.accessScope?.replace(/_/g, ' '),
      assignment.assignmentStatus || 'ACTIVE',
      assignment.inactiveEmployment ? 'Inactive employee' : '',
    ].some(value => String(value || '').toLowerCase().includes(query))
  })

  const branchesForEntAdmin = isEnterpriseAdmin() && user?.companyId
    ? (allBranches[user.companyId] || [])
    : []

  const platformCompanyOptions = companies
    .filter(c => (c.companyType || c.type) !== 'BRANCH')
    .flatMap(c => [
      { value: c.id, label: `${c.name} [Head Office]`, type: 'HEAD_OFFICE' },
      ...(allBranches[c.id] || []).map(b => ({
        value: b.id,
        label: `  ↳ ${b.name} [Branch]`,
        type: 'BRANCH',
        parentId: c.id,
      })),
    ])

  const companyOptions = isEnterpriseAdmin()
    ? [
        ...companies.map(c => ({ value: c.id, label: `${c.name} [Head Office]` })),
        ...branchesForEntAdmin.map(b => ({ value: b.id, label: `${b.name} [Branch]` })),
      ]
    : isPlatformAdmin()
      ? platformCompanyOptions
      : companies.map(c => ({ value: c.id, label: `${c.name} [${c.companyType || c.type || 'Company'}]` }))

  const roleOptions = assignableRoles.map(r => ({ value: r, label: r.replace(/_/g, ' ') }))

  return (
    <div>
      <PageHeader
        title="Roles & Access"
        subtitle={
          isPlatformAdmin() ? 'Platform-wide user roles and cross-organization access' :
          isEnterpriseAdmin() ? 'Manage roles across all branches and cross-branch access' :
          'Manage branch user roles and assignments'
        }
      />
      <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Users & Assignments' && (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <input
                type="search"
                aria-label="Search role assignments"
                placeholder="Search user, role, company, scope or status..."
                value={assignmentSearch}
                onChange={event => setAssignmentSearch(event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-10 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              <svg className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              {assignmentSearch && (
                <button type="button" aria-label="Clear role assignment search" onClick={() => setAssignmentSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700">
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={showInactiveEmployment} onChange={event => setShowInactiveEmployment(event.target.checked)} />
                Show inactive employees
              </label>
              <Button onClick={() => { resetAssign({ accessLevel: 'FULL' }); setSelectedCompanyIds([]); setAssignModal(true) }}>+ Assign Role</Button>
            </div>
          </div>
          <DataTable columns={roleColumns} data={filteredUserRoles} loading={loading} />
        </>
      )}

      {tab === 'Users & Assignments' && false && (
        <div className="max-w-md bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Create New User</h2>
          <form onSubmit={handleUserSubmit(onCreateUser)} className="space-y-4">
            <Input label="Username" {...regUser('username', { required: 'Required' })} error={userErrors.username?.message} />
            <Input label="Email" type="email" {...regUser('email', { required: 'Required' })} error={userErrors.email?.message} />
            <Input label="Password" type="password" {...regUser('password', { required: 'Required', minLength: { value: 6, message: 'Min 6 chars' } })} error={userErrors.password?.message} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" {...regUser('firstName')} />
              <Input label="Last Name" {...regUser('lastName')} />
            </div>
            {!isPlatformAdmin() && (
              <Select
                label="Company"
                options={companyOptions}
                {...regUser('companyId', { required: 'Required' })}
                error={userErrors.companyId?.message}
              />
            )}
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={loading}>Create User</Button>
            </div>
          </form>
        </div>
      )}

      {tab === 'Users & Assignments' && (
        <div className="max-w-2xl">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-800">
            Passwords are never displayed or set by administrators. Send a time-limited reset link to the user's registered email.
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="Search by username or email..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            />
            <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            {userSearch && (
              <button onClick={() => setUserSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Count */}
          <p className="text-xs text-gray-400 mb-2">
            {filteredUsers.length} of {users.length} users
          </p>

          {/* User list */}
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
            {filteredUsers.length === 0 ? (
              <div className="px-4 py-8 text-sm text-center text-gray-400">No users match your search.</div>
            ) : (
              filteredUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-gray-900">{u.username}</span>
                    <span className="text-gray-400 ml-2 text-xs">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-300">ID: {u.id}</span>
                    <Button size="sm" variant="secondary" onClick={() => openResetModal(u)}>
                      Send reset link
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {['Role Templates & Permissions', 'Approval Workflows', 'Delegation & Temporary Access', 'Access History'].includes(tab) && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">{tab}</h2>
          <p className="mt-2 text-sm text-gray-600">
            {tab === 'Role Templates & Permissions' && 'Canonical role templates are enforced by the server. Permission changes remain restricted to authorized administrators.'}
            {tab === 'Approval Workflows' && 'Configure approval routing in the existing workflow screens. Approvers are revalidated when each action is taken.'}
            {tab === 'Delegation & Temporary Access' && 'Temporary access uses effective and expiry dates and requires a recorded reason.'}
            {tab === 'Access History' && 'Assignment and revocation events are available in Audit Logs with actor and scope details.'}
          </p>
        </div>
      )}

      {tab === 'Company & Branch Access' && (
        <>
          <div className="flex justify-end mb-4">
            <Button onClick={() => { resetAccess({}); setAccessModal(true) }}>+ Grant Access</Button>
          </div>
          <DataTable columns={accessColumns} data={crossAccess} loading={loading} />
        </>
      )}

      {/* Assign Role Modal */}
      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Assign Role"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignModal(false)}>Cancel</Button>
            <Button onClick={handleAssignSubmit(onAssignRole)}>Assign</Button>
          </div>
        }>
        <div className="space-y-4">
          <input type="hidden" {...regAssign('userId', { required: true })} />
          <Combobox
            label="User"
            options={userOptions}
            value={selectedAssignmentUserId}
            onChange={(value) => setAssignValue('userId', value, { shouldValidate: true })}
            placeholder="Search by employee name, username or email..."
            emptyText="No matching employee or user"
          />
          <Select label="Role" options={roleOptions} {...regAssign('roleName', { required: true })} />
          {multiCompanyRole ? (
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-gray-700">Companies</legend>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-gray-300 bg-white p-2">
                {companyOptions.map(option => (
                  <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50 ${option.type === 'BRANCH' ? 'ml-5 border-l border-gray-200' : 'font-medium'}`}>
                    <input type="checkbox" checked={selectedCompanyIds.includes(Number(option.value))}
                      onChange={() => setSelectedCompanyIds(ids => ids.includes(Number(option.value))
                        ? ids.filter(id => id !== Number(option.value)) : [...ids, Number(option.value)])} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">{selectedCompanyIds.length} selected · Head Office includes all branches; selecting a branch grants only that branch.</p>
            </fieldset>
          ) : (
            <div>
              <Select label="Employment Company" options={companyOptions} disabled {...regAssign('companyId', { required: true })} />
              <p className="mt-1 text-xs text-gray-500">Selected automatically from the employee record.</p>
            </div>
          )}
          {selectedAssignmentRole === ROLES.ACCOUNT_MANAGER && (
            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-gray-700">Company Access</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="cursor-pointer rounded-lg border border-gray-200 p-3 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <input type="radio" value="FULL" {...regAssign('accessLevel', { required: true })} />
                    Full access
                  </span>
                  <span className="mt-1 block pl-5 text-xs text-gray-500">Includes payroll and all company modules.</span>
                </label>
                <label className="cursor-pointer rounded-lg border border-gray-200 p-3 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <input type="radio" value="PARTIAL" {...regAssign('accessLevel', { required: true })} />
                    Partial access
                  </span>
                  <span className="mt-1 block pl-5 text-xs text-gray-500">Company modules excluding Payroll.</span>
                </label>
              </div>
            </fieldset>
          )}
          {fixedScopeRole ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Access Scope</label>
              <input type="hidden" {...regAssign('accessScope', { required: true })} />
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {(selectedAssignmentScope || '').replace(/_/g, ' ')} — assigned automatically for this role
              </div>
            </div>
          ) : (
            <Select label="Access Scope" options={ACCESS_SCOPES} {...regAssign('accessScope', { required: true })} />
          )}
          {selectedAssignmentRole === ROLES.DEPARTMENT_MANAGER && (
            <Input label="Department ID" type="number" {...regAssign('departmentId', { required: true })} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Effective date" type="date" {...regAssign('effectiveFrom')} />
            <Input label="Expiry date (optional)" type="date" {...regAssign('expiresOn')} />
          </div>
          <Input
            label="Reason *"
            placeholder="e.g. Promoted to HR Manager"
            error={assignErrors.reason?.message}
            {...regAssign('reason', {
              required: 'Assignment reason is required',
              validate: value => value?.trim().length >= 3 || 'Enter a meaningful reason',
            })}
          />
          <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            {multiCompanyRole
              ? selectedAssignmentRole === ROLES.ACCOUNT_MANAGER
                ? 'Access applies to each selected company and its current and future branches. Partial access is enforced by the server and excludes Payroll.'
                : 'Super Admin receives full administrative access only within the selected companies or branches.'
              : `Permissions are evaluated together with this assignment's ${selectedAssignmentScope || 'selected'} scope.`}
          </div>
        </div>
      </Modal>

      {/* Admin Reset Password Modal */}
      <Modal
        open={resetModal}
        onClose={closeResetModal}
        title="Send Password Reset Link"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeResetModal}>Cancel</Button>
            <Button loading={resetLoading} onClick={onSendResetLink}>Send secure link</Button>
          </div>
        }>
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {resetTarget?.username?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{resetTarget?.username}</p>
              <p className="text-xs text-gray-400 truncate">{resetTarget?.email}</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Grant Cross-Branch Access Modal */}
      <Modal open={accessModal} onClose={() => setAccessModal(false)} title="Grant Cross-Branch Access"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAccessModal(false)}>Cancel</Button>
            <Button onClick={handleAccessSubmit(onGrantAccess)}>Grant</Button>
          </div>
        }>
        <div className="space-y-4">
          <Select label="User" options={userOptions} {...regAccess('userId', { required: true })} />
          <Select label="Granted By (Source Company)" options={companyOptions} {...regAccess('grantedByCompanyId', { required: true })} />
          <Select label="Target Branch" options={companyOptions} {...regAccess('targetCompanyId', { required: true })} />
          <Input label="Reason (optional)" {...regAccess('reason')} />
        </div>
      </Modal>
    </div>
  )
}
