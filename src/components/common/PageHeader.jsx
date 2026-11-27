export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-4 flex flex-col items-start gap-3 sm:mb-6 lg:flex-row lg:flex-wrap lg:justify-between">
      <div className="min-w-0 max-w-full wrap-anywhere">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
    </div>
  )
}
