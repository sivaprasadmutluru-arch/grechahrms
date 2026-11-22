import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, MessageSquare, Paperclip, RefreshCw, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import useAuth from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import Badge from '../../components/common/Badge'
import Avatar from '../../components/common/Avatar'
import ConfirmModal from '../../components/common/ConfirmModal'
import { formatDateTime } from '../../utils/formatters'

const errorText = error => typeof error === 'string' ? error : error.response?.data?.message || 'Something went wrong. Please try again.'
const personName = person => person?.fullName || [person?.firstName, person?.lastName].filter(Boolean).join(' ')
const statusLabels = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' }
const priorityLabels = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' }

function safeDocumentLink(path) {
  if (typeof path !== 'string') return null
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('/media/') && !path.includes('..') && !path.includes('\\')) return path
  return null
}

export default function TicketDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const [ticket, setTicket] = useState(null)
  const [comments, setComments] = useState([])
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [conversationError, setConversationError] = useState('')
  const [attachmentError, setAttachmentError] = useState('')
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [link, setLink] = useState('')
  const [fileName, setFileName] = useState('')
  const [savingAttachment, setSavingAttachment] = useState(false)
  const [deleteDocument, setDeleteDocument] = useState(null)
  const [deletingDocument, setDeletingDocument] = useState(false)
  const endRef = useRef(null)
  const requestVersion = useRef(0)
  const endpoint = `/helpdesk/tickets/${id}`
  const canManage = auth.isManagement() || auth.isHRManager()

  useEffect(() => {
    const controller = new AbortController()
    const version = ++requestVersion.current
    setLoading(true); setLoadError(''); setConversationError(''); setAttachmentError('')
    setTicket(null); setComments([]); setAttachments([])
    async function load() {
      const [detail, replies, documents] = await Promise.allSettled([
        api.get(endpoint, { signal: controller.signal }),
        api.get(`${endpoint}/comments`, { signal: controller.signal }),
        api.get(`${endpoint}/attachments`, { signal: controller.signal }),
      ])
      if (controller.signal.aborted || requestVersion.current !== version) return
      if (detail.status === 'fulfilled') setTicket(detail.value.data)
      else setLoadError(errorText(detail.reason))
      if (replies.status === 'fulfilled') setComments(replies.value.data)
      else setConversationError(errorText(replies.reason))
      if (documents.status === 'fulfilled') setAttachments(documents.value.data)
      else setAttachmentError(errorText(documents.reason))
      setLoading(false)
    }
    load()
    return () => { controller.abort(); ++requestVersion.current }
  }, [endpoint, revision, auth.effectiveCompanyId])

  useEffect(() => { setMessage(''); setDeleteDocument(null) }, [endpoint, auth.effectiveCompanyId])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [comments.length])

  async function removeDocument() {
    if (!deleteDocument || deletingDocument) return
    setDeletingDocument(true)
    const version = requestVersion.current
    try {
      await api.delete(`/helpdesk/tickets/attachments/${deleteDocument.id}`)
      if (version === requestVersion.current) {
        setAttachments(previous => previous.filter(item => item.id !== deleteDocument.id))
        setDeleteDocument(null)
        toast.success('Document link removed')
      }
    } catch (error) { toast.error(errorText(error)) }
    finally { setDeletingDocument(false) }
  }

  async function sendMessage(event) {
    event.preventDefault()
    const text = message.trim()
    if (!text || sending || ticket?.status === 'CLOSED') return
    const version = requestVersion.current
    setSending(true)
    try {
      const { data } = await api.post(`${endpoint}/comments`, { comment: text })
      if (version === requestVersion.current) {
        setComments(previous => [...previous.filter(item => item.id !== data.id), data])
        setMessage('')
        setConversationError('')
      }
    } catch (error) { if (version === requestVersion.current) toast.error(errorText(error)) }
    finally { setSending(false) }
  }

  async function changeStatus(action) {
    if (changingStatus) return
    const version = requestVersion.current
    setChangingStatus(true)
    try {
      const { data } = await api.post(`${endpoint}/${action}`)
      if (version === requestVersion.current) { setTicket(data); toast.success('Ticket status updated') }
    } catch (error) { toast.error(errorText(error)) }
    finally { setChangingStatus(false) }
  }

  async function addDocument(event) {
    event.preventDefault()
    if (savingAttachment || !safeDocumentLink(link.trim())) return
    const version = requestVersion.current
    setSavingAttachment(true)
    try {
      const { data } = await api.post(`${endpoint}/attachments`, {
        filePath: link.trim(), fileName: fileName.trim() || 'Supporting document',
      })
      if (version === requestVersion.current) {
        setAttachments(previous => [...previous, data]); setLink(''); setFileName('')
        setAttachmentError(''); toast.success('Document link added')
      }
    } catch (error) { toast.error(errorText(error)) }
    finally { setSavingAttachment(false) }
  }

  if (loading) return <p role="status" className="py-16 text-center text-sm text-gray-500">Loading ticket…</p>
  if (loadError || !ticket) return <div className="rounded-xl border border-red-100 bg-white p-6">
    <p role="alert" className="mb-4 text-sm text-red-700">{loadError || 'Ticket not found'}</p>
    <Button variant="secondary" onClick={() => navigate('/helpdesk')}>Back to Helpdesk</Button>
    <Button className="ml-2" onClick={() => setRevision(value => value + 1)}>Retry</Button>
  </div>

  const requester = ticket.requesterName || personName(ticket.raisedBy) || 'Requester unavailable'
  const assignee = personName(ticket.assignedTo) || 'Unassigned'
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <button onClick={() => navigate('/helpdesk')} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-700">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Helpdesk
      </button>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Support ticket #{ticket.id}</p>
            <h1 className="mt-2 break-words text-2xl font-bold text-gray-900">{ticket.title || ticket.subject || 'Untitled ticket'}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge label={statusLabels[ticket.status] || ticket.status} variant={['RESOLVED', 'CLOSED'].includes(ticket.status) ? 'success' : 'info'} />
              <Badge label={`${priorityLabels[ticket.priority] || ticket.priority} priority`} variant={['HIGH', 'CRITICAL'].includes(ticket.priority) ? 'danger' : 'warning'} />
              <span className="text-xs text-gray-500">Created {formatDateTime(ticket.createdAt)}</span>
            </div>
          </div>
          {canManage && <div className="flex flex-wrap gap-2">
            {!['RESOLVED', 'CLOSED'].includes(ticket.status) && <Button size="sm" variant="success" disabled={changingStatus} onClick={() => changeStatus('resolve')}>Resolve ticket</Button>}
            {ticket.status !== 'CLOSED' && <Button size="sm" variant="secondary" disabled={changingStatus} onClick={() => changeStatus('close')}>Close ticket</Button>}
          </div>}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900">Issue description</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{ticket.description || 'No description provided.'}</p>
          </Card>
          <Card>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <MessageSquare className="h-5 w-5 text-indigo-600" aria-hidden="true" /> Conversation
                <span className="text-xs font-normal text-gray-500">({comments.length})</span>
              </h2>
              <button title="Refresh ticket and conversation" aria-label="Refresh ticket and conversation" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-indigo-700"
                onClick={() => setRevision(value => value + 1)}><RefreshCw className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[440px] space-y-4 overflow-y-auto pr-1">
              {conversationError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{conversationError}</p>}
              {!comments.length && !conversationError && <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">No replies yet. Start the conversation below.</p>}
              {comments.map(comment => {
                const author = comment.authorName || personName(comment.commentedBy) || 'Author unavailable'
                const mine = comment.commentedBy?.id != null && auth.user?.employeeId != null
                  && String(comment.commentedBy.id) === String(auth.user.employeeId)
                return <div key={comment.id} className="flex items-start gap-3">
                  <Avatar name={author} size="sm" />
                  <div className={`min-w-0 flex-1 rounded-xl p-3 ${mine ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-900">{author}{mine ? ' · You' : ''}</span>
                      <span className="text-xs text-gray-400">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{comment.comment}</p>
                  </div>
                </div>
              })}
              <div ref={endRef} />
            </div>
            <form onSubmit={sendMessage} className="mt-5 border-t border-gray-100 pt-4">
              <label htmlFor="ticket-reply" className="mb-2 block text-sm font-medium text-gray-700">Reply to this ticket</label>
              <textarea id="ticket-reply" rows={3} maxLength={10000} value={message} disabled={sending || ticket.status === 'CLOSED'}
                onChange={event => setMessage(event.target.value)} placeholder={ticket.status === 'CLOSED' ? 'This ticket is closed.' : 'Write your message…'}
                className="w-full resize-y rounded-xl border border-gray-200 p-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-400">Replies show your name. Never include passwords.</p>
                <Button type="submit" loading={sending} disabled={sending || !message.trim() || ticket.status === 'CLOSED'}><Send className="mr-2 h-4 w-4" aria-hidden="true" /> Send reply</Button>
              </div>
            </form>
          </Card>
        </div>
        <aside className="min-w-0 space-y-5">
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Created by</h2>
            <div className="flex items-center gap-3"><Avatar name={requester} size="md" /><p className="break-words text-sm font-semibold text-gray-900">{requester}</p></div>
            <dl className="mt-5 space-y-4 text-sm">
              {[['Organisation', ticket.company?.name || 'Not recorded'], ['Assigned to', assignee], ['Category', ticket.category || 'General support'],
                ['Last updated', formatDateTime(ticket.updatedAt || ticket.createdAt)]].map(([label, value]) =>
                <div key={label}><dt className="text-xs text-gray-400">{label}</dt><dd className="mt-1 break-words text-gray-700">{value}</dd></div>)}
            </dl>
          </Card>
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><Paperclip className="h-4 w-4" /> Documents ({attachments.length})</h2>
            {attachmentError && <p role="alert" className="mb-3 text-xs text-red-700">{attachmentError}</p>}
            <ul className="space-y-2">{attachments.map(document => {
              const href = safeDocumentLink(document.filePath)
              return <li key={document.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 font-medium text-indigo-700 hover:underline">
                  <span className="min-w-0 flex-1 break-words">{document.fileName || 'Supporting document'}</span><ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                </a> : <span className="break-words text-gray-700">{document.fileName || 'Supporting document'}</span>}
                {canManage && <button className="mt-2 text-xs text-red-600 hover:underline" onClick={() => setDeleteDocument(document)}>Remove link</button>}
              </li>
            })}</ul>
            {!attachments.length && <p className="text-sm text-gray-400">No documents attached.</p>}
            <details className="mt-4 border-t border-gray-100 pt-3">
              <summary className="cursor-pointer text-xs font-medium text-indigo-700">Add a document link</summary>
              <form className="mt-3 space-y-2" onSubmit={addDocument}>
                <label className="block text-xs text-gray-500">Document name<input className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" value={fileName}
                  disabled={savingAttachment} maxLength={200} onChange={event => setFileName(event.target.value)} /></label>
                <label className="block text-xs text-gray-500">Document URL<input type="url" required placeholder="https://…" className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" value={link}
                  disabled={savingAttachment} onChange={event => setLink(event.target.value)} /></label>
                <Button size="sm" type="submit" loading={savingAttachment} disabled={savingAttachment || !safeDocumentLink(link.trim())}>Add link</Button>
              </form>
            </details>
          </Card>
        </aside>
      </div>
      <ConfirmModal open={!!deleteDocument} onClose={() => { if (!deletingDocument) setDeleteDocument(null) }}
        onConfirm={removeDocument} title="Remove document link?" message="This removes the document link from the ticket, not the original file."
        confirmLabel="Remove link" loading={deletingDocument} />
    </div>
  )
}
