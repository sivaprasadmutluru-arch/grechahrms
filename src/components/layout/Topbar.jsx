import { Bars3Icon, BellIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import Avatar from '../common/Avatar'
import useAuth from '../../hooks/useAuth'
import CompanySwitcher from './CompanySwitcher'
import BranchSwitcher from './BranchSwitcher'
import { API_BASE_URL } from '../../config/constants'
import { getProfileDisplayName } from '../../utils/profileDisplayName'

function useBreadcrumb() {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)
  return parts.map((p, i) => ({ label: p.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), path: '/' + parts.slice(0, i + 1).join('/') }))
}

export default function Topbar({ onOpenNavigation, navigationOpen }) {
  const auth = useAuth()
  const { user } = auth
  const displayName = getProfileDisplayName(user)
  const navigate = useNavigate()
  const unreadCount = useSelector(s => s.notifications?.unreadCount || 0)
  const breadcrumbs = useBreadcrumb()
  const profilePath = (
    auth.isPlatformAdmin?.() || auth.isEnterpriseAdmin?.() || auth.isBranchAdmin?.()
    || auth.isHRManager?.() || auth.isAccountant?.() || auth.isDeptManager?.() || auth.isTeamLead?.()
  ) ? '/admin/profile' : '/employees/me'

  const avatarSrc = user?.photoPath
    ? (user.photoPath.startsWith('http')
        ? user.photoPath
        : `${API_BASE_URL.replace('/api', '')}/media/${user.photoPath.replace(/^\//, '')}`)
    : null

  return (
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-gray-100 bg-white px-2 sm:px-4 xl:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {onOpenNavigation && (
          <button type="button" onClick={onOpenNavigation} aria-label="Open navigation" aria-expanded={navigationOpen} aria-haspopup="dialog" className="grid size-10 shrink-0 place-items-center rounded-lg text-gray-600 hover:bg-gray-100">
            <Bars3Icon className="size-6" />
          </button>
        )}
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 overflow-hidden text-sm text-gray-500">
          {breadcrumbs.map((b, i) => (
            <span key={b.path} className={`min-w-0 items-center gap-1 ${i === breadcrumbs.length - 1 ? 'flex' : 'hidden md:flex'}`}>
              {i > 0 && <span className="hidden shrink-0 text-gray-300 md:block">/</span>}
              <button title={b.label} onClick={() => navigate(b.path)} className={`min-w-0 truncate hover:text-gray-700 transition-colors ${i === breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : ''}`}>
                {b.label}
              </button>
            </span>
          ))}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
        {(auth.isPlatformAdmin?.() || auth.isSuperAdmin?.() || auth.isAccountManager?.()) && <CompanySwitcher />}
        {!auth.isPlatformAdmin?.() && !auth.isSuperAdmin?.() && !auth.isAccountManager?.() && auth.isEnterpriseAdmin?.() && <BranchSwitcher />}
        <button onClick={() => navigate('/help')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Help" aria-label="Open Help">
          <QuestionMarkCircleIcon className="h-5 w-5 text-gray-500" />
        </button>
        <button onClick={() => navigate('/notifications')} aria-label="Notifications" className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <BellIcon className="h-5 w-5 text-gray-500" />
          {unreadCount > 0 && <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">{unreadCount}</span>}
        </button>
        <button type="button" className="flex min-h-10 items-center gap-2 rounded-lg px-1 hover:bg-gray-100" onClick={() => navigate(profilePath)} aria-label="My Profile">
          <Avatar name={displayName} src={avatarSrc} size="sm" className="shrink-0" />
          <span className="hidden max-w-36 truncate text-sm font-medium text-gray-700 lg:block">{displayName}</span>
        </button>
      </div>
    </header>
  )
}
