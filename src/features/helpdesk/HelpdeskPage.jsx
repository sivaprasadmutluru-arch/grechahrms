import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { fetchAll, create, selectAll, selectLoading, selectPagination } from './helpdeskSlice'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Pagination from '../../components/common/Pagination'
import SearchInput from '../../components/common/SearchInput'
import { formatDate } from '../../utils/formatters'
import { STATUS_COLORS } from '../../config/constants'
import useAuth from '../../hooks/useAuth'
import Avatar from '../../components/common/Avatar'

const TICKET_PRIORITIES = [
  { value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' }, { value: 'CRITICAL', label: 'Critical' },
]

export default function HelpdeskPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { effectiveCompanyId } = useAuth()
  const data = useSelector(selectAll)
  const loading = useSelector(selectLoading)
  const pagination = useSelector(selectPagination)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => { dispatch(fetchAll({ page: 0, size: 20 })) }, [dispatch, effectiveCompanyId])

  const onSubmit = async (formData) => {
    if (saving) return
    setSaving(true)
    try {
      await dispatch(create(formData)).unwrap()
      toast.success('Ticket created')
      setModalOpen(false)
      dispatch(fetchAll({ page: 0, size: 20 }))
    } catch (e) { toast.error(e || 'Error') }
    finally { setSaving(false) }
  }

  const columns = [
    { accessorKey: 'id', header: '#', cell: ({ getValue }) => <span className="font-mono text-xs text-gray-500">#{getValue()}</span> },
    { accessorKey: 'title', header: 'Subject', cell: ({ row }) =>
      <button className="text-left font-semibold text-indigo-700 hover:underline" onClick={() => navigate(`/helpdesk/${row.original.id}`)}>
        {row.original.title || row.original.subject || 'Untitled ticket'}
      </button> },
    { accessorKey: 'requesterName', header: 'Created by', cell: ({ row }) => {
      const name = row.original.requesterName || row.original.raisedBy?.fullName
        || [row.original.raisedBy?.firstName, row.original.raisedBy?.lastName].filter(Boolean).join(' ') || 'Requester unavailable'
      return <div className="flex items-center gap-2"><Avatar name={name} size="sm" />
        <div><p className="font-medium text-gray-900">{name}</p>
          <p className="text-xs text-gray-500">{row.original.company?.name}</p></div></div>
    } },
    { accessorKey: 'priority', header: 'Priority', cell: ({ getValue }) => <Badge label={getValue() || 'MEDIUM'} variant={getValue() === 'HIGH' || getValue() === 'CRITICAL' ? 'danger' : 'warning'} /> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge label={getValue() || 'Open'} variant={STATUS_COLORS[getValue()?.toLowerCase()] || 'warning'} /> },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ getValue }) => formatDate(getValue()) },
    { id: 'actions', header: '', cell: ({ row }) => <Button size="sm" variant="secondary" onClick={() => navigate(`/helpdesk/${row.original.id}`)}>View</Button> },
  ]

  return (
    <div>
      <PageHeader title="Organisation Helpdesk" subtitle="Send internal requests to your company’s support team"
        actions={<><SearchInput className="w-64" placeholder="Search subject or requester…" onSearch={setSearch} /><Button onClick={() => { reset({ priority: 'MEDIUM' }); setModalOpen(true) }}>+ New Ticket</Button></>} />
      <DataTable columns={columns} data={data.filter(ticket => !search.trim()
        || `${ticket.id} ${ticket.title || ticket.subject || ''} ${ticket.requesterName || ''} ${ticket.raisedBy?.firstName || ''} ${ticket.raisedBy?.lastName || ''}`
          .toLowerCase().includes(search.trim().toLowerCase()))} loading={loading} />
      <Pagination page={pagination.page} totalPages={Math.ceil(pagination.total / pagination.size)} onPageChange={p => dispatch(fetchAll({ page: p, size: 20 }))} />
      <Modal open={modalOpen} onClose={() => { if (!saving) setModalOpen(false) }} title="New Support Ticket" size="lg"
        pendingMessage={saving ? 'Creating support ticket…' : undefined}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSubmit(onSubmit)}>Submit</Button></div>}>
        <div className="space-y-4">
          <Input label="Subject" maxLength={255} error={errors.subject?.message} {...register('subject', { required: 'Required' })} />
          <Select label="Priority" options={TICKET_PRIORITIES} {...register('priority')} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe what happened. Include the screen, date and error message, but not passwords."
              rows={4} maxLength={10000} {...register('description')} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
