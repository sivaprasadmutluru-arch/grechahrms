import { useEffect, useState } from 'react'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { DraftTools } from './SmartPerformanceLibrary'
import { control, dayText, Empty, ExpandableTextarea, Field, latest, panel, Status } from './SmartPerformanceUi'

const progressChoices = [['ON_TRACK', 'On track'], ['AT_RISK', 'At risk'], ['OFF_TRACK', 'Off track']]
const blank = () => ({ key: crypto.randomUUID(), description: '', target: '', weight: '', confirmationRequired: false })
const displayScore = value => value == null ? '—' : Number(value).toFixed(2)

export default function PerformanceKpis({ data, act, busy, initialEditing = false }) {
  const cycle = data.cycle || {}
  const approved = latest(cycle.approved)
  const review = cycle.review
  const [mode, setMode] = useState('progress')
  const [editing, setEditing] = useState(false)
  const [changeDialog, setChangeDialog] = useState(false)
  const [comment, setComment] = useState('')
  const [history, setHistory] = useState(null)
  const [ackOpen, setAckOpen] = useState(false)
  const [ack, setAck] = useState('')
  const submitted = cycle.status === 'SUBMITTED'
  const current = data.currentCycle
  const canEditKpis = current && data.editor && latest(data.jd) && !approved && !submitted
  const canAmend = current && data.managerEdit && approved
  const showReview = Boolean(review || (data.managerEdit && data.reviewOpen))
  const inReview = mode === 'review' && showReview

  useEffect(() => { if (initialEditing && canEditKpis) setEditing(true) }, [initialEditing, canEditKpis])

  return (
    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
        <div>
          <h3 className="font-semibold text-gray-900">KPIs & performance</h3>
          <p className="mt-1 text-xs text-gray-500">
            Formal review opens {dayText(data.settings.reviewDate)}{approved ? ` · KPI version ${approved.version}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Status value={approved?.acknowledgement ? 'ACKNOWLEDGED' : cycle.status} />
          {!editing && canEditKpis && <Button type="button" variant="secondary" onClick={() => setEditing(true)}>{cycle.draft ? 'Review KPI draft' : 'Create KPIs'}</Button>}
          {!editing && canAmend && !inReview && <Button type="button" variant="secondary" onClick={() => setEditing(true)}>Amend KPIs</Button>}
          {data.own && approved && !approved.acknowledgement && <Button type="button" disabled={busy}
            onClick={() => act('kpi-acknowledge', { version: approved.version }, 'KPI set acknowledged.')}>Acknowledge KPIs</Button>}
        </div>
      </div>

      {data.editor && latest(data.jd) && !data.manager && (
        <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          Reporting manager is unassigned. You can review and save KPI drafts, but assign a reporting manager on the employee profile before submitting a KPI set for approval.
        </div>
      )}
      {data.editor && cycle.changeComment && !approved && (
        <div className="m-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>Changes requested</strong><p className="mt-1 whitespace-pre-wrap wrap-anywhere">{cycle.changeComment}</p></div>
      )}

      {editing && (canEditKpis || canAmend) ? (
        <KpiEditor initial={approved || cycle.draft} employeeId={data.id} amending={Boolean(approved)} busy={busy} canSubmit={Boolean(data.manager)}
          cancel={() => setEditing(false)}
          save={async (values, submit) => {
            const action = approved ? 'kpi-amend' : submit ? 'kpi-submit' : 'kpi-save'
            if (await act(action, values, approved ? 'KPI amendments published.' : submit ? 'KPI set submitted for approval.' : 'KPI draft saved.')) setEditing(false)
          }} />
      ) : !approved ? (
        <>
          {cycle.draft && data.editor ? (
            <KpiTable items={cycle.draft.items} custom={cycle.draft.custom} columns={[]} />
          ) : <Empty>{data.editor ? 'Publish a job description to generate a KPI draft for this cycle.' : 'Approved KPIs will appear here.'}</Empty>}
          {data.canDecide && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 p-4">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => { setComment(''); setChangeDialog(true) }}>Request changes</Button>
            <Button type="button" disabled={busy} onClick={() => act('kpi-approve', {}, 'KPI set approved.')}>Approve KPIs</Button>
          </div>}
        </>
      ) : (
        <>
          {showReview && <div className="flex flex-wrap gap-1 border-b border-gray-100 px-4 pt-3">
            {[['progress', 'Progress'], ['review', 'Formal review']].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}
                className={`rounded-t-lg px-3 py-2 text-sm font-medium ${mode === id ? 'bg-indigo-50 text-indigo-800' : 'text-gray-600 hover:text-indigo-700'}`}>{label}</button>
            ))}
          </div>}
          {inReview ? (
            <ReviewTable key={data.revision} data={data} approved={approved} act={act} busy={busy}
              onAcknowledge={() => { setAck(''); setAckOpen(true) }} />
          ) : (
            <KpiTable items={approved.items} custom={approved.custom} columns={['Progress','Evidence / Comments']}
              rows={item => {
                const logs = (cycle.progress || []).filter(entry => entry.id === item.id)
                const currentLog = logs.filter(entry => entry.version === approved.version).at(-1)
                return <ProgressCells key={item.id} item={item} latest={currentLog} editable={data.managerEdit && current && review?.status !== 'RELEASED'}
                  onSave={values => act('progress', { id: item.id, ...values }, 'Progress updated.')}
                  histories={logs} openHistory={() => setHistory({ item, logs })} busy={busy} />
              }} />
          )}
          {cycle.approved?.versions?.length > 1 && <details className="border-t border-gray-100 p-4 text-sm sm:px-5">
            <summary className="cursor-pointer font-medium">KPI version history</summary>
            {[...cycle.approved.versions].slice(0, -1).reverse().map(old => (
              <details key={old.version} className="mt-2 overflow-hidden rounded-xl border border-gray-200">
                <summary className="cursor-pointer p-3">Version {old.version} · {dayText(old.at)}</summary>
                <KpiTable items={old.items} custom={old.custom} columns={['Progress history']} rows={item => {
                  const logs = (cycle.progress || []).filter(entry => entry.id === item.id && entry.version === old.version)
                  return <KpiCell label="Progress history">{logs.length ? (
                    <button type="button" className="text-sm font-medium text-indigo-700 hover:underline"
                      onClick={() => setHistory({ item, logs })}>View updates</button>
                  ) : '—'}</KpiCell>
                }} />
              </details>
            ))}
          </details>}
        </>
      )}

      <Modal open={changeDialog} onClose={() => setChangeDialog(false)} title="Request KPI changes"
        footer={<div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setChangeDialog(false)}>Cancel</Button>
          <Button type="button" disabled={busy || !comment.trim()} onClick={async () => {
            if (await act('kpi-request-changes', { comment }, 'Changes requested.')) setChangeDialog(false)
          }}>Send back to draft</Button>
        </div>}>
        <ExpandableTextarea label="What needs to change?" value={comment} maxLength={3000} rows={5} onChange={setComment}
          hint="Explain what needs to change so the employee or manager can update the KPI draft." />
      </Modal>

      <Modal open={Boolean(history)} onClose={() => setHistory(null)} title="Progress history">
        <h4 className="mb-3 font-semibold text-gray-900">{history?.item.description}</h4>
        <ol className="space-y-2">
          {[...(history?.logs || [])].reverse().map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><Status value={entry.status} /><span className="text-xs text-gray-600">{dayText(entry.at)} · KPI version {entry.version}</span></div>
              {entry.comment && <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-gray-700">{entry.comment}</p>}
            </li>
          ))}
        </ol>
      </Modal>

      <Modal open={ackOpen} onClose={() => setAckOpen(false)} title="Acknowledge review discussion"
        footer={<div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setAckOpen(false)}>Cancel</Button>
          <Button type="button" disabled={busy} onClick={async () => {
            if (await act('review-acknowledge', { comment: ack }, 'Review discussion acknowledged.')) setAckOpen(false)
          }}>Acknowledge discussion</Button>
        </div>}>
        <p className="mb-3 text-sm text-gray-600">This records that the discussion took place. It does not indicate agreement with the rating.</p>
        <ExpandableTextarea label="Comment (optional)" value={ack} maxLength={3000} rows={4} onChange={setAck} />
      </Modal>
    </section>
  )
}

function KpiEditor({ initial, employeeId, busy, amending, canSubmit, cancel, save }) {
  const [custom, setCustom] = useState(Boolean(initial?.custom))
  const [items, setItems] = useState(() => initial?.items?.length
    ? initial.items.map(item => ({ ...blank(), ...item, key: item.id }))
    : [blank()])
  const complete = items.length > 0 && items.every(item => item.description.trim() && item.target.trim() && !item.confirmationRequired)
  const positive = !custom || items.every(item => Number(item.weight) > 0)
  const total = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0)
  const valid = complete && positive && (!custom || Math.abs(total - 100) < 1e-9)
  function setItem(key, property, value) {
    setItems(current => current.map(item => item.key === key ? { ...item, [property]: value } : item))
  }
  function send(submit) {
    return save({ custom, items: items.map(({ key, weight, ...item }) =>
      ({ ...item, ...(custom ? { weight: Number(weight) } : {}) })) }, submit)
  }
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <h4 className="font-semibold text-indigo-950">Build a clear KPI plan</h4>
        <p className="mt-1 text-sm leading-6 text-indigo-900">Add one measurable result at a time. Describe the outcome, define how success will be measured, and add more rows as needed. The employee’s reporting manager reviews the submitted plan.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="size-4 accent-indigo-600" checked={custom} onChange={e => {
            const useCustom = e.target.checked
            setCustom(useCustom)
            if (useCustom && items.every(item => !item.weight)) {
              const cents = Math.floor(10000 / items.length)
              setItems(current => current.map((item, index) => ({ ...item, weight: (cents + (index < (10000 % current.length) ? 1 : 0)) / 100 })))
            }
          }} /> Custom weights {custom && <span className={Math.abs(total - 100) < 1e-9 ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-800'}>{total.toFixed(2)}%</span>}
        </label>
        <DraftTools employeeId={employeeId} type="kpi" onGenerate={data => {
          setCustom(false)
          setItems(data.items.map(item => ({ ...blank(), ...item })))
        }} />
      </div>
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
        {items.map((item, index) => (
          <div key={item.key} className={`grid gap-3 p-3 ${custom ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_6rem_auto]' : 'md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]'}`}>
            <Field label={`KPI ${index + 1} description`}><input className={control} maxLength={280} placeholder="Example: Improve first-response time" value={item.description} onChange={e => setItem(item.key, 'description', e.target.value)} /></Field>
            <ExpandableTextarea label="Agreed target / measure" maxLength={3000} rows={4}
              placeholder="Define the target, measurement method, and review period."
              hint="Make the target measurable and clear to the employee and manager."
              value={item.target} onChange={value => setItem(item.key, 'target', value)} />
            {custom && <Field label="Weight %"><input className={control} type="number" min="0.01" max="100" step="0.01" value={item.weight} onChange={e => setItem(item.key, 'weight', e.target.value)} /></Field>}
            <Button type="button" variant="ghost" size="sm" className="self-end" aria-label={`Remove KPI ${index + 1}`} onClick={() => setItems(current => current.filter(row => row.key !== item.key))}>Remove</Button>
            {item.confirmationRequired && <label className="col-span-full flex gap-2 text-sm text-amber-900">
              <input type="checkbox" className="mt-1" checked={false} onChange={() => setItem(item.key, 'confirmationRequired', false)} />
              I’ve confirmed the suggested measure, target, period and available evidence.
            </label>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={items.length >= 30} onClick={() => setItems(current => [...current, blank()])}>Add KPI</Button>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={cancel}>Cancel</Button>
          {!amending && <Button type="button" variant="secondary" disabled={busy || !positive} onClick={() => send(false)}>Save draft</Button>}
          <Button type="button" disabled={busy || !valid || !canSubmit} onClick={() => send(true)}>{amending ? 'Publish changes' : 'Submit for approval'}</Button>
        </div>
      </div>
    </div>
  )
}

function KpiTable({ items = [], custom, columns, rows }) {
  return (
    <table className="w-full table-fixed text-left text-sm">
      <thead className="hidden border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-600 md:table-header-group">
        <tr><th className="w-[25%] p-4">KPI description</th><th className="p-4">Agreed target / measure</th>
          {custom && <th className="w-24 p-4">Weightage</th>}
          {columns.map(label => <th key={label} className={`p-4 ${label === 'Evidence / Comments' ? 'w-[26%]' : 'w-[21%]'}`}>{label}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map(item => (
          <tr key={item.id} className="grid gap-3 p-4 md:table-row md:p-0">
            <KpiCell label="KPI description"><p className="font-semibold text-gray-900">{item.description}</p></KpiCell>
            <KpiCell label="Agreed target / measure"><p className="whitespace-pre-wrap leading-5 text-gray-700">{item.target}</p></KpiCell>
            {custom && <KpiCell label="Weightage">{item.weight}%</KpiCell>}
            {rows?.(item)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function KpiCell({ label, children }) {
  return <td className="min-w-0 align-top wrap-anywhere md:p-4"><p className="mb-1 text-xs font-medium text-gray-500 md:hidden">{label}</p>{children}</td>
}

function ProgressCells({ item, latest, editable, onSave, histories, openHistory, busy }) {
  const [status, setStatus] = useState(null)
  const [note, setNote] = useState(null)
  return <>
    <KpiCell label="Progress">
      {editable ? <select aria-label={`Progress for ${item.description}`} className={control} value={status ?? latest?.status ?? ''} onChange={event => setStatus(event.target.value)}>
        <option value="" disabled>Not updated</option>
        {progressChoices.map(([code, label]) => <option value={code} key={code}>{label}</option>)}
      </select> : <Status value={latest?.status || 'NOT_UPDATED'} />}
      {latest && <p className="mt-2 text-xs text-gray-500">{dayText(latest.at)}</p>}
    </KpiCell>
    <KpiCell label="Evidence / comments">
      {editable ? (
        <div className="space-y-2">
          <textarea aria-label={`Evidence for ${item.description}`} className={control} placeholder="Optional note" rows={2} maxLength={3000}
            value={note ?? latest?.comment ?? ''} onChange={event => setNote(event.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={busy || !(status || latest?.status)} onClick={async () => {
              if (await onSave({ status: status || latest.status, comment: note ?? latest?.comment ?? '' })) { setStatus(null); setNote(null) }
            }}>Save update</Button>
            {histories.length > 0 && <button type="button" className="text-xs font-medium text-indigo-700 hover:underline" onClick={openHistory}>History</button>}
          </div>
        </div>
      ) : <>
        <p className="whitespace-pre-wrap text-gray-600">{latest?.comment || '—'}</p>
        {histories.length > 0 && <button type="button" className="mt-2 text-xs font-medium text-indigo-700 hover:underline" onClick={openHistory}>History</button>}
      </>}
    </KpiCell>
  </>
}

function ReviewTable({ data, approved, act, busy, onAcknowledge }) {
  const review = data.cycle.review || {}
  const snapshot = review.snapshot || approved
  const editable = data.managerEdit && data.reviewOpen
  const scale = review.scale || data.settings.scale
  const [ratings, setRatings] = useState(review.ratings || {})
  const [recommendation, setRecommendation] = useState(review.recommendation || '')
  const [finalRating, setFinalRating] = useState(review.recommendation || '')
  const [reason, setReason] = useState('')
  const entries = (snapshot.items || []).filter(item => ratings[item.id]?.rating)
  const sum = entries.reduce((total, item) => total + ratings[item.id].rating * (snapshot.custom ? item.weight : 1), 0)
  const weight = entries.reduce((total, item) => total + (snapshot.custom ? Number(item.weight) : 1), 0)
  const preview = editable && weight ? sum / weight : review.score
  const complete = entries.length === snapshot.items.length
  const optionLabel = value => scale.find(item => item.value === value)?.label
  const released = review.status === 'RELEASED'
  function update(id, field, value) {
    setRatings(current => ({ ...current, [id]: { ...current[id], [field]: value } }))
  }
  function save(submit) {
    return act(submit ? 'review-submit' : 'review-save', {
      ratings,
      recommendation: recommendation ? Number(recommendation) : null,
    }, submit ? 'Review submitted to HR.' : 'Review draft saved.')
  }

  return (
    <>
      <div className="m-4 flex flex-wrap items-start justify-between gap-3 rounded-xl bg-indigo-50 p-4">
        <div>
          <p className="text-xs font-semibold text-indigo-800">{editable && !complete ? 'Provisional manager score' : 'Computed manager score'}</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{displayScore(preview)}</p>
        </div>
        {released && <div>
          <p className="text-xs font-semibold text-indigo-800">Final overall rating</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{review.finalRating} · {optionLabel(review.finalRating)}</p>
        </div>}
        {review.status && <Status value={review.status} />}
      </div>
      <KpiTable items={snapshot.items} custom={snapshot.custom} columns={['Manager rating (1–3)', 'Evidence / Comments']}
        rows={item => <>
          <KpiCell label="Manager rating (1–3)">
            {editable ? <select aria-label={`Rating for ${item.description}`} className={control} value={ratings[item.id]?.rating || ''}
              onChange={e => update(item.id, 'rating', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Select rating</option>
              {scale.map(rating => <option key={rating.value} value={rating.value}>{rating.value} · {rating.label}</option>)}
            </select> : <span>{ratings[item.id]?.rating ? `${ratings[item.id].rating} · ${optionLabel(ratings[item.id].rating)}` : '—'}</span>}
          </KpiCell>
          <KpiCell label="Evidence / comments">
            {editable ? <ExpandableTextarea label="Review comment" className="text-left" rows={4} maxLength={3000} placeholder="Optional note"
              value={ratings[item.id]?.comment || ''} onChange={value => update(item.id, 'comment', value)} />
              : <p className="whitespace-pre-wrap text-gray-600">{ratings[item.id]?.comment || '—'}</p>}
          </KpiCell>
        </>} />
      <div className="space-y-4 border-t border-gray-100 p-4 sm:p-5">
        <details className="w-full rounded-lg bg-gray-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Rating definitions</summary>
          <dl className="mt-2 space-y-2">
            {scale.map(r => <div key={r.value}><dt className="font-medium">{r.value} · {r.label}</dt><dd className="text-gray-600">{r.definition}</dd></div>)}
          </dl>
        </details>
        {editable && <>
          <Field label="Manager’s recommended overall rating (optional)" className="max-w-xs">
            <select className={control} value={recommendation} onChange={e => setRecommendation(e.target.value)}>
              <option value="">No recommendation</option>
              {scale.map(r => <option key={r.value} value={r.value}>{r.value} · {r.label}</option>)}
            </select>
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => save(false)}>Save review draft</Button>
            <Button type="button" disabled={busy || !complete} onClick={() => save(true)}>Submit review to HR</Button>
          </div>
        </>}
        {data.canRelease && <>
          <Field label="Final overall rating" className="max-w-xs">
            <select className={control} value={finalRating} onChange={e => setFinalRating(e.target.value)}>
              <option value="">Select final rating</option>
              {scale.map(r => <option key={r.value} value={r.value}>{r.value} · {r.label}</option>)}
            </select>
          </Field>
          <ExpandableTextarea label={review.recommendation && Number(finalRating) !== review.recommendation ? 'Calibration reason (required)' : 'Calibration reason (optional)'}
            rows={4} maxLength={3000} value={reason} onChange={setReason} />
          <div className="flex justify-end">
            <Button type="button" disabled={busy || !finalRating || (review.recommendation && Number(finalRating) !== review.recommendation && !reason.trim())}
              onClick={() => act('review-release', { finalRating: Number(finalRating), reason }, 'Final review released to the employee.')}>Release final review</Button>
          </div>
        </>}
        {released && review.calibrationReason && <p className="whitespace-pre-wrap text-sm text-gray-700">{review.calibrationReason}</p>}
        {released && review.acknowledgement && <div className="text-sm text-gray-700">
          <p>Acknowledged {dayText(review.acknowledgement.at)}.</p>
          {review.acknowledgement.comment && <p className="mt-1 whitespace-pre-wrap">{review.acknowledgement.comment}</p>}
        </div>}
        {released && data.own && !review.acknowledgement && <Button type="button" disabled={busy} onClick={onAcknowledge}>Acknowledge discussion</Button>}
      </div>
    </>
  )
}
