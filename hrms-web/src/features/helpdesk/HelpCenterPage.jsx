import { Building2, Headphones, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import PageHeader from '../../components/common/PageHeader'

export function canContactPlatform(auth) {
  return auth.isEnterpriseAdmin() || auth.isBranchAdmin() || auth.isHRManager()
}

export default function HelpCenterPage() {
  const auth = useAuth()
  const platform = auth.isPlatformAdmin()
  const cards = [
    { title: 'Organisation Helpdesk', description: 'Ask your company’s team about leave, attendance, payroll or other workplace matters.', icon: Building2, to: '/helpdesk', action: 'Open Helpdesk' },
    { title: 'Frequently asked questions', description: 'Find answers and guidance published by your organisation.', icon: BookOpen, to: '/helpdesk/faq', action: 'Browse FAQs' },
  ]
  if (platform || canContactPlatform(auth)) cards.push({
    title: platform ? 'Support Inbox' : 'Contact Support',
    description: platform ? 'Review and respond to support requests from organisations.'
      : 'Get help with your organisation’s setup, access or other Grecha platform issues.',
    icon: Headphones, to: '/help/platform', action: platform ? 'Open support inbox' : 'Contact Support',
  })
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Help" subtitle="Choose the right team for your question." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ title, description, icon: Icon, to, action }) => (
          <article key={to} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5">
            <Icon className="mb-4 h-6 w-6 text-indigo-600" aria-hidden="true" />
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="mb-5 mt-2 flex-1 text-sm text-gray-600">{description}</p>
            <Link className="font-medium text-indigo-700 hover:underline" to={to}>{action}</Link>
          </article>
        ))}
      </div>
    </div>
  )
}
