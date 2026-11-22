import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import api from '../../services/api'

const EMPLOYEE_STEPS = [
  { title: 'Welcome to GRECHA.AI', text: 'This Quick Start Tour shows the essentials. You can close it at any time and reopen it from the help button.', path: '/dashboard' },
  { title: 'Clock in and out', text: 'Use the attendance area each workday to clock in, clock out, and review your daily punch history.', path: '/attendance' },
  { title: 'Apply for leave', text: 'Open Leave to check your balance, submit leave requests, and follow their approval status.', path: '/leave' },
  { title: 'Stay informed', text: 'Use Notifications for approvals and HR updates. Your profile is where you keep your details current.', path: '/notifications' },
]

const MANAGER_STEPS = [
  { title: 'Welcome to GRECHA.AI', text: 'This Quick Start Tour covers the common tasks for managers and HR users.', path: '/dashboard' },
  { title: 'Manage employees', text: 'Open Employees to search people, review profiles, and maintain employment information.', path: '/employees' },
  { title: 'Review approvals', text: 'Leave and attendance pages place pending requests first, so approval work is easy to find.', path: '/leave' },
  { title: 'Keep staff updated', text: 'Use Announcements for company communications. Employees receive an HRMS notification and email.', path: '/announcements' },
]

const ADMIN_STEPS = [
  { title: 'Welcome to GRECHA.AI', text: 'This Quick Start Tour covers the main setup and administration areas.', path: '/dashboard' },
  { title: 'Set up your workforce', text: 'Use Company and Setup to maintain departments, job roles, shifts, and employee types.', path: '/companies' },
  { title: 'Create employees safely', text: 'Choose the company first, then create employees. Their role, access, and login are managed together.', path: '/employees' },
  { title: 'Control leave and attendance', text: 'Configure leave types, allocations, approval flows, shifts, and attendance rules before employees use them.', path: '/leave' },
]

function tourFor(roles = []) {
  if (roles.some(role => ['PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN', 'ENTERPRISE_ADMIN', 'BRANCH_ADMIN'].includes(role))) return ADMIN_STEPS
  if (roles.some(role => ['HR_MANAGER', 'DEPARTMENT_MANAGER', 'TEAM_LEAD', 'ACCOUNTANT'].includes(role))) return MANAGER_STEPS
  return EMPLOYEE_STEPS
}

export default function QuickStartTour({ user, roles = [] }) {
  const navigate = useNavigate()
  const steps = useMemo(() => tourFor(roles), [roles])
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (user && user.quickStartTourCompleted === false) setOpen(true)
  }, [user])

  useEffect(() => {
    const openTour = () => { setStep(0); setOpen(true) }
    window.addEventListener('grecha:open-quick-start-tour', openTour)
    return () => window.removeEventListener('grecha:open-quick-start-tour', openTour)
  }, [])

  if (!open) return null
  const current = steps[step]
  const finish = async () => {
    setOpen(false)
    try { await api.post('/auth/quick-start-tour/complete') } catch { /* Tour remains optional; never trap a user in it. */ }
  }
  const go = (next) => {
    navigate(steps[next].path)
    setStep(next)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="Quick Start Tour">
      <section className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="h-1.5 bg-slate-100"><div className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <div className="p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Quick Start Tour · {step + 1} of {steps.length}</p><h2 className="mt-2 text-2xl font-bold text-slate-900">{current.title}</h2></div>
            <button onClick={finish} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Skip tour" aria-label="Skip tour"><XMarkIcon className="h-5 w-5" /></button>
          </div>
          <p className="min-h-16 text-base leading-7 text-slate-600">{current.text}</p>
          <div className="mt-8 flex items-center justify-between gap-3">
            <button onClick={finish} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Skip tour</button>
            <div className="flex gap-2">
              {step > 0 && <button onClick={() => go(step - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ArrowLeftIcon className="h-4 w-4" /> Back</button>}
              {step < steps.length - 1 ? <button onClick={() => go(step + 1)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Next <ArrowRightIcon className="h-4 w-4" /></button> : <button onClick={finish} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><CheckIcon className="h-4 w-4" /> Finish</button>}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
