import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserGroupIcon, CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/outline'
import useAuth from '../../hooks/useAuth'
import OdooImportModal from './OdooImportModal'

const steps = [
  { id: 'EMPLOYEES', title: 'Employees', hint: 'Import employee profiles first', icon: UserGroupIcon },
  { id: 'LEAVE', title: 'Leave history', hint: 'Import approved time off', icon: CalendarDaysIcon },
  { id: 'ATTENDANCE', title: 'Attendance history', hint: 'Import completed punches', icon: ClockIcon },
]

export default function OdooMigrationPage() {
  const { effectiveCompanyId } = useAuth()
  const [step, setStep] = useState(0)
  const [revision, setRevision] = useState(0)
  const selected = steps[step]
  return <main className="mx-auto max-w-6xl space-y-5">
    <Link to="/employees" className="text-sm font-medium text-indigo-700 hover:underline">← Employees</Link>
    <header className="rounded-2xl bg-indigo-950 px-5 py-6 text-white">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Organization setup</p>
      <h1 className="mt-2 text-2xl font-bold">Migrate from Odoo</h1>
      <p className="mt-1 text-sm text-indigo-100">Create the organization, select it in the company switcher, then preview and import each dataset.</p>
    </header>
    {!effectiveCompanyId ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Select the destination company in the top company switcher to begin.</p> : <>
      <nav aria-label="Migration steps" className="grid gap-3 sm:grid-cols-3">
        {steps.map(({ id, title, hint, icon: Icon }, i) => <button key={id} type="button"
          aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}
          className={`rounded-xl border p-4 text-left ${i === step ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300'}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Icon className="size-5 text-indigo-600" aria-hidden="true" />{i + 1}. {title}</div>
          <div className="mt-1 text-xs text-gray-600">{hint}</div>
        </button>)}
      </nav>
      <OdooImportModal key={`${effectiveCompanyId}-${selected.id}-${revision}`} companyId={effectiveCompanyId}
        kind={selected.id} inline onImported={() => {}} onClose={() => {
          if (step < steps.length - 1) setStep(step + 1)
          else setRevision(value => value + 1)
        }} />
    </>}
  </main>
}
