import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  fetchAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  selectAnnouncements, selectAnnouncementsLoading
} from './announcementsSlice'
import { markAnnouncementViewed } from '../base/baseExtrasSlice'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import DataTable from '../../components/common/DataTable'
import Modal from '../../components/common/Modal'
import Input from '../../components/common/Input'
import ConfirmModal from '../../components/common/ConfirmModal'
import useAuth from '../../hooks/useAuth'

export default function AnnouncementsPage() {
  const dispatch = useDispatch()
  const { user, effectiveCompanyId } = useAuth()
  const announcements = useSelector(selectAnnouncements)
  const loading = useSelector(selectAnnouncementsLoading)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const submitting = useRef(false)
  const [saving, setSaving] = useState(false)
  const [confirmModal, setConfirmModal] = useState({ open: false, id: null })
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => { dispatch(fetchAnnouncements()) }, [dispatch, effectiveCompanyId])

  const openCreate = () => { setEditing(null); reset({}); setModalOpen(true) }
  const openEdit = (row) => {
    setEditing(row)
    reset({ title: row.title, description: row.description, expiresOn: row.expiresOn })
    setModalOpen(true)
  }

  const handleView = async (id) => {
    if (!user?.employeeId) return
    try { await dispatch(markAnnouncementViewed({ id, employeeId: user.employeeId })).unwrap() }
    catch { /* silent */ }
  }

  const handleDelete = (id) => setConfirmModal({ open: true, id })
  const onConfirmDelete = async () => {
    try { await dispatch(deleteAnnouncement(confirmModal.id)).unwrap(); toast.success('Deleted') }
    catch (e) { toast.error(e || 'Failed') }
    finally { setConfirmModal({ open: false, id: null }) }
  }

  const onSubmit = async (data) => {
    if (submitting.current) return
    submitting.current = true
    setSaving(true)
    try {
      if (editing) {
        await dispatch(updateAnnouncement({ id: editing.id, data })).unwrap()
        toast.success('Announcement updated')
      } else {
        if (!effectiveCompanyId) {
          toast.error('Select a company before publishing')
          return
        }
        // The API uses the active company and branch headers for the audience.
        await dispatch(createAnnouncement(data)).unwrap()
        toast.success('Announcement published')
      }
      setModalOpen(false)
      reset()
    } catch (e) { toast.error(e || 'Error') }
    finally {
      submitting.current = false
      setSaving(false)
    }
  }

  const columns = [
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'description', header: 'Description', cell: ({ getValue }) => (
      <span className="max-w-sm truncate block">{getValue() || '—'}</span>
    )},
    { accessorKey: 'expiresOn', header: 'Expires On', cell: ({ getValue }) => getValue() || '—' },
    { id: 'actions', header: '', cell: ({ row }) => (
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => handleView(row.original.id)}>Mark Viewed</Button>
        <Button size="sm" variant="secondary" onClick={() => openEdit(row.original)}>Edit</Button>
        <Button size="sm" variant="danger" onClick={() => handleDelete(row.original.id)}>Delete</Button>
      </div>
    )},
  ]

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Company announcements and updates"
        actions={<Button onClick={openCreate}>+ New Announcement</Button>} />
      <DataTable columns={columns} data={announcements} loading={loading} />
      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, id: null })}
        onConfirm={onConfirmDelete}
        title="Delete Announcement"
        message="Are you sure you want to delete this announcement? This action cannot be undone."
        confirmLabel="Delete"
        loading={loading}
      />
      <Modal open={modalOpen} onClose={() => { if (!submitting.current) setModalOpen(false) }} title={editing ? 'Edit Announcement' : 'New Announcement'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button disabled={saving} loading={saving} onClick={handleSubmit(onSubmit)}>{editing ? 'Save' : 'Publish'}</Button>
          </div>
        }>
        <div className="space-y-4">
          {!editing && <p className="text-sm text-gray-600">Publishing sends an HRMS alert and emails active employees in the selected company who have an email address.</p>}
          <Input label="Title" error={errors.title?.message} {...register('title', { required: 'Required' })} />
          <Input label="Expires On" type="date" {...register('expiresOn')} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={4} {...register('description')} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
