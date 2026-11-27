import { ArrowLeft, FileText, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import brandLogo from '../../assets/the-greater-change-logo.png'

const terms = [
  {
    title: 'Using GrechaHR',
    paragraphs: [
      'These Terms and Conditions apply to the GrechaHR mobile app and the Grecha.ai HRMS web portal. GrechaHR helps employees and authorized staff manage work records such as attendance, leave, payslips, and employee documents. Your organization decides which features you can use and who can approve or view records.',
    ],
  },
  {
    title: 'Accounts and access',
    paragraphs: [
      'Use the account assigned to you and keep your sign-in details private. If you think someone has accessed your account, tell your organization’s administrator promptly. Your organization may change or remove your access when your role or employment changes.',
    ],
  },
  {
    title: 'Acceptable use',
    paragraphs: ['Use GrechaHR for authorized workplace purposes. When you use the service:'],
    items: [
      'Submit accurate attendance, leave, and profile information. Report mistakes to your organization so it can review and correct them.',
      'Access, upload, and share only records you have permission to handle. Keep employee records and payslips confidential.',
      'Use your own account when recording attendance. Follow your organization’s rules for check-ins, approved work locations, and requests for corrections.',
      'Respect access controls. Do not impersonate another person, interfere with the service, or upload harmful software.',
    ],
  },
  {
    title: 'Attendance and workplace records',
    paragraphs: [
      'Some organizations enable location checks when employees clock in or out. If a check-in fails, a record looks incorrect, or you cannot access a payslip, contact your organization’s HR or payroll team. Your organization reviews records and makes decisions about attendance, pay, benefits, and leave under its policies and applicable law.',
    ],
  },
  {
    title: 'Privacy',
    paragraphs: [
      'The Privacy Policy explains how Grecha.ai HRMS handles personal information, including information used for location-based attendance. Your organization may also have its own policies for workplace records and access to employee data.',
    ],
    privacyLink: true,
  },
  {
    title: 'Availability and changes',
    paragraphs: [
      'Access may be interrupted during maintenance, updates, or outages. If an interruption affects a time-sensitive workplace record, follow your organization’s reporting procedure. We may update these terms as the service changes and will provide notice of material changes when required.',
    ],
  },
  {
    title: 'Organization agreements and your rights',
    paragraphs: [
      'Any separate service agreement between Grecha and your organization governs that business relationship. These terms do not alter employment terms or limit rights that applicable law gives you.',
    ],
  },
]

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <title>Terms and Conditions | GrechaHR</title>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3 sm:px-10">
          <img src={brandLogo} alt="Grecha.ai HRMS" className="h-10 w-auto object-contain sm:h-12" />
          <Link to="/login" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#0B3D91] transition hover:bg-blue-50">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to login
          </Link>
        </div>
      </header>

      <main>
        <section aria-labelledby="terms-title" className="bg-gradient-to-r from-[#062B74] via-[#0B3D91] to-[#1769D1] text-white">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-8 px-6 py-9 sm:px-10 sm:py-12">
            <div>
              <h1 id="terms-title" className="text-3xl font-black tracking-tight sm:text-4xl">Terms and Conditions</h1>
              <p className="mt-3 text-sm font-medium text-blue-100 sm:text-base">GrechaHR mobile app and Grecha.ai HRMS web portal</p>
            </div>
            <FileText className="hidden h-20 w-20 shrink-0 text-blue-200 md:block" aria-hidden="true" />
          </div>
        </section>

        <article className="mx-auto max-w-5xl divide-y divide-slate-200 bg-white px-6 py-2 sm:px-10">
          {terms.map(({ title, paragraphs, items, privacyLink }) => (
            <section key={title} className="py-6">
              <h2 className="text-xl font-bold tracking-tight text-[#062B74]">{title}</h2>
              {paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">{paragraph}</p>
              ))}
              {items && (
                <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-sm leading-7 text-slate-700 sm:text-base">
                  {items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
              {privacyLink && (
                <Link to="/privacy-policy" className="mt-3 inline-block text-sm font-semibold text-[#0B3D91] underline underline-offset-4">Read the Privacy Policy</Link>
              )}
            </section>
          ))}
        </article>
      </main>

      <footer className="bg-[#062B74] text-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-10">
          <h2 className="text-xl font-bold">Contact us</h2>
          <p className="mt-2 text-sm text-blue-100">For questions about these terms or technical support, contact Grecha.</p>
          <a href="mailto:info@thegreaterchange.com" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4 hover:text-blue-200">
            <Mail className="h-4 w-4" aria-hidden="true" />info@thegreaterchange.com
          </a>
        </div>
      </footer>
    </div>
  )
}
