import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  fetchFAQCategories, createFAQCategory, fetchFAQs, createFAQ, deleteFAQ,
  selectFAQCategories, selectFAQs, selectLoading
} from './helpdeskSlice'
import api from '../../services/api'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import DataTable from '../../components/common/DataTable'
import Modal from '../../components/common/Modal'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import ConfirmModal from '../../components/common/ConfirmModal'
import useAuth from '../../hooks/useAuth'

export default function FAQPage() {
  const dispatch = useDispatch()
  const { effectiveCompanyId, user } = useAuth()
  const faqCategories = useSelector(selectFAQCategories)
  const faqs = useSelector(selectFAQs)
  const loading = useSelector(selectLoading)
  const [tab, setTab] = useState('FAQs')
  const [faqModalOpen, setFaqModalOpen] = useState(false)
  const [editFaqTarget, setEditFaqTarget] = useState(null)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState({ open: false, id: null })
  const [canManage, setCanManage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const faqForm = useForm()
  const catForm = useForm()

  useEffect(() => {
    setCanManage(false)
    setFaqModalOpen(false)
    setCatModalOpen(false)
    setConfirmModal({ open: false, id: null })
    const controller = new AbortController()
    api.get('/helpdesk/faq-access', { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setCanManage(data.canManage === true) })
      .catch(() => { if (!controller.signal.aborted) setCanManage(false) })
    dispatch(fetchFAQCategories())
    dispatch(fetchFAQs())
    return () => controller.abort()
  }, [dispatch, effectiveCompanyId, user?.userId, user?.id])

  const openEditFaq = (faq) => {
    setEditFaqTarget(faq)
    faqForm.reset({
      question: faq.question,
      answer: faq.answer,
      categoryId: faq.category?.id,
    })
    setFaqModalOpen(true)
  }

  const onSubmitFaq = async (data) => {
    if (!canManage || saving) return
    const payload = {
      question: data.question,
      answer: data.answer,
      category: data.categoryId ? { id: Number(data.categoryId) } : null,
    }
    setSaving(true)
    try {
      if (editFaqTarget) {
        await api.put(`/helpdesk/faqs/${editFaqTarget.id}`, payload)
        toast.success('FAQ updated')
        setEditFaqTarget(null)
        dispatch(fetchFAQs())
      } else {
        await dispatch(createFAQ(payload)).unwrap()
        toast.success('FAQ created')
      }
      setFaqModalOpen(false)
      faqForm.reset()
    } catch (e) { toast.error(typeof e === 'string' ? e : e.response?.data?.message || 'Could not save FAQ') }
    finally { setSaving(false) }
  }

  const onSubmitCat = async (data) => {
    if (!canManage || saving) return
    setSaving(true)
    try {
      await dispatch(createFAQCategory(data)).unwrap()
      toast.success('Category created')
      setCatModalOpen(false)
      catForm.reset()
    } catch (e) { toast.error(typeof e === 'string' ? e : 'Could not save category') }
    finally { setSaving(false) }
  }

  const handleDeleteFaq = (id) => setConfirmModal({ open: true, id })
  const onConfirmDelete = async () => {
    if (!canManage || saving) return
    setSaving(true)
    try { await dispatch(deleteFAQ(confirmModal.id)).unwrap(); toast.success('Deleted') }
    catch (e) { toast.error(e || 'Failed') }
    finally { setConfirmModal({ open: false, id: null }); setSaving(false) }
  }

  const faqColumns = [
    { accessorKey: 'question', header: 'Question' },
    { accessorKey: 'answer', header: 'Answer', cell: ({ getValue }) => <span className="block max-w-2xl whitespace-pre-wrap break-words">{getValue() || '—'}</span> },
    { id: 'category', header: 'Category', cell: ({ row }) => row.original.category?.title || '—' },
    ...(canManage ? [{ id: 'actions', header: '', cell: ({ row }) => (
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => openEditFaq(row.original)}>Edit</Button>
        <Button size="sm" variant="danger" onClick={() => handleDeleteFaq(row.original.id)}>Delete</Button>
      </div>
    )}] : []),
  ]

  const catColumns = [
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'description', header: 'Description', cell: ({ getValue }) => getValue() || '—' },
  ]

  return (
    <div>
      <PageHeader title="FAQs & guidance" subtitle="Answers to common questions about using Grecha. Your organisation’s policies still apply."
        actions={canManage &&
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { catForm.reset(); setCatModalOpen(true) }}>+ Category</Button>
            <Button onClick={() => { setEditFaqTarget(null); faqForm.reset(); setFaqModalOpen(true) }}>+ FAQ</Button>
          </div>
        } />
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {['FAQs', 'Categories'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'FAQs' && <>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input id="faq-search" aria-label="Search questions and answers" placeholder="Search questions and answers…"
            value={search} onChange={event => setSearch(event.target.value)} />
          <select aria-label="Filter FAQ category" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
            <option value="">All categories</option>
            {faqCategories.map(category => <option key={category.id} value={String(category.id)}>{category.title}</option>)}
          </select>
        </div>
        <DataTable columns={faqColumns} data={faqs.filter(faq =>
          (!categoryFilter || String(faq.category?.id) === categoryFilter)
          && (!search.trim() || `${faq.question} ${faq.answer}`.toLowerCase().includes(search.trim().toLowerCase()))
        )} loading={loading} />
      </>}
      {tab === 'Categories' && <DataTable columns={catColumns} data={faqCategories} loading={loading} />}
      <ConfirmModal
        open={canManage && confirmModal.open}
        onClose={() => setConfirmModal({ open: false, id: null })}
        onConfirm={onConfirmDelete}
        title="Delete FAQ"
        message="Are you sure you want to delete this FAQ? This action cannot be undone."
        confirmLabel="Delete"
        loading={saving}
      />
      <Modal open={canManage && faqModalOpen} onClose={() => { if (!saving) { setFaqModalOpen(false); setEditFaqTarget(null) } }} title={editFaqTarget ? 'Edit FAQ' : 'Add FAQ'}
        pendingMessage={saving ? 'Saving FAQ…' : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setFaqModalOpen(false); setEditFaqTarget(null) }}>Cancel</Button>
            <Button onClick={faqForm.handleSubmit(onSubmitFaq)}>{editFaqTarget ? 'Update' : 'Create'}</Button>
          </div>
        }>
        <div className="space-y-4">
          <Input label="Question" maxLength={255} error={faqForm.formState.errors.question?.message}
            {...faqForm.register('question', { required: 'Required' })} />
          <Select label="Category" placeholder="Select a category" options={faqCategories.map(c => ({ value: c.id, label: c.title }))}
            {...faqForm.register('categoryId')} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
            <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={4} maxLength={10000} {...faqForm.register('answer', { required: 'Answer is required' })} />
            {faqForm.formState.errors.answer && <p className="mt-1 text-xs text-red-600">{faqForm.formState.errors.answer.message}</p>}
          </div>
        </div>
      </Modal>

      <Modal open={canManage && catModalOpen} onClose={() => { if (!saving) setCatModalOpen(false) }} title="Add FAQ Category"
        pendingMessage={saving ? 'Saving category…' : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCatModalOpen(false)}>Cancel</Button>
            <Button onClick={catForm.handleSubmit(onSubmitCat)}>Create</Button>
          </div>
        }>
        <div className="space-y-4">
          <Input label="Title" error={catForm.formState.errors.title?.message}
            {...catForm.register('title', { required: 'Required' })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2} {...catForm.register('description')} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
