import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { fetchAll, create, update, uploadLogo, remove, selectAll, selectLoading, selectPagination } from './organizationsSlice'
import { setSelectedCompany } from '../auth/authSlice'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Pagination from '../../components/common/Pagination'
import ConfirmModal from '../../components/common/ConfirmModal'
import { STATUS_COLORS, API_BASE_URL } from '../../config/constants'
import { BuildingOffice2Icon, CameraIcon } from '@heroicons/react/24/outline'
import api from '../../services/api'
import { beginMutation } from '../../services/mutationLoading'

function getLogoUrl(logoPath) {
  if (!logoPath) return null
  if (logoPath.startsWith('http')) return logoPath
  return `${API_BASE_URL}/files/${logoPath}`
}

const organizationFormId = 'organization-details-form'
const requiredText = (message) => ({ required: message, validate: value => !!value.trim() || message })
const emailFormat = { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' }

export default function OrganizationsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const data = useSelector(selectAll)
  const loading = useSelector(selectLoading)
  const pagination = useSelector(selectPagination)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmModal, setConfirmModal] = useState({ open: false, org: null })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const submissionInFlight = useRef(false)
  const logoInputRef = useRef(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => { dispatch(fetchAll({ page: 0, size: 20 })) }, [dispatch])

  const openCreate = () => {
    setEditing(null)
    reset({ subscriptionPlan: 'STANDARD' })
    setLogoFile(null)
    setLogoPreview(null)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    reset(row)
    setLogoFile(null)
    setLogoPreview(getLogoUrl(row.logoPath))
    setModalOpen(true)
  }

  const onLogoFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const [migrationCompanyId, setMigrationCompanyId] = useState(null)

  const onSubmit = async (formData) => {
    if (submissionInFlight.current) return
    submissionInFlight.current = true
    const finish = beginMutation(editing ? 'Updating organization…' : 'Creating organization…')
    setSaving(true)
    try {
      let savedOrg
      if (editing) {
        savedOrg = await dispatch(update({ id: editing.id, data: formData })).unwrap()
        toast.success('Organization updated')
      } else {
        setMigrationCompanyId(null)
        // Creation returns before workspace DDL completes.  Do not select a company
        // whose tenant schema is still being provisioned: that would send subsequent
        // requests to a workspace that is deliberately not ready yet.
        const result = await dispatch(create(formData)).unwrap()
        savedOrg = result.organization
        if (result.headOfficeCompanyId && result.headOfficeSchemaReady) {
          dispatch(setSelectedCompany(result.headOfficeCompanyId))
          setMigrationCompanyId(result.headOfficeCompanyId)
          toast.success('Organization created — switched to it')
        } else {
          toast.success('Organization created — preparing its workspace. Refresh in a few moments to open it.')
        }
      }
      if (logoFile && savedOrg?.id) {
        try {
          await dispatch(uploadLogo({ id: savedOrg.id, file: logoFile })).unwrap()
        } catch {
          toast.error('Saved, but logo upload failed')
        }
      }
      setModalOpen(false)
      dispatch(fetchAll({ page: 0, size: 20 }))
    } catch (e) {
      toast.error(e || 'Error')
    } finally {
      finish()
      submissionInFlight.current = false
      setSaving(false)
    }
  }

  const toggleStatus = async (org) => {
    try {
      const action = org.status === 'ACTIVE' ? 'suspend' : 'activate'
      await api.post(`/organizations/${org.id}/${action}`)
      toast.success(`Organization ${action}d`)
      dispatch(fetchAll({ page: 0, size: 20 }))
    } catch { toast.error('Action failed') }
  }

  const deleteOrg = (org) => setConfirmModal({ open: true, org })
  const onConfirmDelete = async () => {
    const orgId = confirmModal.org.id
    console.log('[Delete Org] Starting delete for org:', orgId)
    try {
      const result = await dispatch(remove(orgId)).unwrap()
      console.log('[Delete Org] Success:', result)
      toast.success('Organization deleted')
    } catch (e) {
      console.error('[Delete Org] Error:', e)
      toast.error(e || 'Delete failed')
    } finally {
      console.log('[Delete Org] Finally — closing modal')
      setConfirmModal({ open: false, org: null })
    }
  }

  const columns = [
    {
      id: 'logo',
      header: 'Logo',
      cell: ({ row }) => {
        const url = getLogoUrl(row.original.logoPath)
        return url
          ? <img src={url} alt="logo" className="h-8 w-8 rounded-lg object-cover border border-gray-100" />
          : <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <BuildingOffice2Icon className="h-4 w-4 text-indigo-300" />
            </div>
      },
    },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'contactEmail', header: 'Email' },
    { accessorKey: 'contactPhone', header: 'Phone' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge label={getValue() || 'Active'} variant={STATUS_COLORS[getValue()?.toLowerCase()] || 'success'} />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(row.original)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/organizations/${row.original.id}/subscription`)}>Subscription</Button>
          <Button size="sm" variant={row.original.status === 'ACTIVE' ? 'danger' : 'success'} onClick={() => toggleStatus(row.original)}>
            {row.original.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => deleteOrg(row.original)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Organizations"
        subtitle="Manage all platform organizations"
        actions={<Button onClick={openCreate}>+ New Organization</Button>}
      />
      {migrationCompanyId && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <p className="text-sm text-indigo-950">Bringing this organization over from Odoo? Import employees, leave, and attendance next.</p>
        <Button size="sm" onClick={() => {
          dispatch(setSelectedCompany(migrationCompanyId))
          navigate('/employees/odoo-migration')
        }}>Open Odoo Migration</Button>
      </div>}
      <DataTable columns={columns} data={data} loading={loading} />
      <Pagination
        page={pagination.page}
        totalPages={Math.ceil(pagination.total / pagination.size)}
        onPageChange={p => dispatch(fetchAll({ page: p, size: 20 }))}
      />

      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, org: null })}
        onConfirm={onConfirmDelete}
        title="Delete Organization"
        message={`Delete "${confirmModal.org?.name}"? This will permanently delete all companies, employees, and associated data under this organization. This cannot be undone.`}
        confirmLabel="Delete"
        loading={loading}
      />
      <Modal
        open={modalOpen}
        onClose={() => { if (!submissionInFlight.current) setModalOpen(false) }}
        title={editing ? 'Edit Organization' : 'New Organization'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={saving} onClick={() => { if (!submissionInFlight.current) setModalOpen(false) }}>Cancel</Button>
            <Button type="submit" form={organizationFormId} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create organization'}
            </Button>
          </div>
        }
      >
        <form id={organizationFormId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {!editing && <p className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">
            New organizations start with a one-hour attendance grace period for late check-ins and early checkouts.
            A company can set its own override in Attendance Settings.
          </p>}
          {/* Logo upload */}
          <div className="flex flex-col items-center gap-2 pb-2">
            <div
              className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors group overflow-hidden bg-gray-50"
              onClick={() => logoInputRef.current?.click()}
            >
              {logoPreview
                ? <img src={logoPreview} alt="logo preview" className="w-full h-full object-cover" />
                : <BuildingOffice2Icon className="h-8 w-8 text-gray-300 group-hover:text-indigo-400 transition-colors" />
              }
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <CameraIcon className="h-5 w-5 text-white" />
              </div>
            </div>
            <p className="text-xs text-gray-400">Click to upload logo</p>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoFileChange} />
          </div>

          {/* Organization Details */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Organization Details</p>
          <p className="text-xs text-gray-600">Fields marked * are required.</p>
          <Input id="org-name" label="Organization Name *" required error={errors.name?.message}
            {...register('name', requiredText('Enter the organization name'))} />
          <Input id="org-contact-email" label="Organization Contact Email" type="email" error={errors.contactEmail?.message}
            helperText="For business communications. This does not create a login."
            {...register('contactEmail', { pattern: emailFormat })} />
          <Input id="org-contact-phone" label="Organization Contact Phone" type="tel" {...register('contactPhone')} />
          <Select label="Subscription Plan" options={['BASIC', 'STANDARD', 'ENTERPRISE']} {...register('subscriptionPlan')} />

          {/* Head Office Details — only for creation */}
          {!editing && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Head Office Details</p>
              <Input label="Head Office Name" placeholder="Defaults to organization name if blank" {...register('headOfficeName')} />
              <Input label="Head Office Address" {...register('address')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" {...register('city')} />
                <Input label="State / Province" {...register('state')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Country" {...register('country')} />
                <Input label="Postal Code" {...register('zip')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input id="head-office-phone" label="Head Office Phone" type="tel" {...register('phone')} />
                <Input id="head-office-email" label="Head Office Email" type="email" error={errors.email?.message}
                  {...register('email', { pattern: emailFormat })} />
              </div>
              <Input label="Head Office Website" {...register('website')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Tax ID" {...register('taxId')} />
                <Input label="Registration Number" {...register('registrationNumber')} />
              </div>

              {/* Enterprise Admin Credentials */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">First Enterprise Administrator</p>
              <p className="text-sm text-gray-600">Create a new login for the person who will manage this organization. You don’t need to select an employee from another organization.</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Admin First Name" {...register('adminFirstName')} />
                <Input label="Admin Last Name" {...register('adminLastName')} />
              </div>
              <Input id="first-admin-username" label="Admin Login Username *" required autoComplete="off"
                helperText="Use a username that isn’t already registered in Grecha." error={errors.adminUsername?.message}
                {...register('adminUsername', requiredText('Enter a login username for the administrator'))} />
              <Input id="first-admin-email" label="Admin Work Email *" type="email" required autoComplete="off"
                helperText="Use the new administrator’s own work email." error={errors.adminEmail?.message}
                {...register('adminEmail', { ...requiredText('Enter the administrator’s work email'), pattern: emailFormat })} />
              <Input id="first-admin-password" label="Initial Admin Password *" type="password" required autoComplete="new-password"
                error={errors.adminPassword?.message}
                {...register('adminPassword', requiredText('Enter an initial password for the administrator'))} />
            </>
          )}
        </form>
      </Modal>
    </div>
  )
}
