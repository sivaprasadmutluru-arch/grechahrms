import { useEffect, useState, useSyncExternalStore, Suspense } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { PageSkeleton } from '../common/Skeleton'
import { selectIsAuthenticated, selectRoles, selectUser, fetchMe } from '../../features/auth/authSlice'
import { fetchMyCompany, fetchMyCompanyInfo } from '../../features/companies/companiesSlice'
import { fetchUnreadCount } from '../../features/notifications/notificationsSlice'
import UnresolvedRegularisationReminder from '../../features/attendance/UnresolvedRegularisationReminder'
import LatePunchReasonDialog from '../../features/attendance/LatePunchReasonDialog'
import ChatbotWidget from './ChatbotWidget'
import QuickStartTour from './QuickStartTour'
import AnnouncementAlert from '../../features/announcements/AnnouncementAlert'
import CheckoutReminder from '../../features/attendance/CheckoutReminder'

const wideNavigation = window.matchMedia('(min-width: 64rem)')

function subscribeToNavigationWidth(callback) {
  wideNavigation.addEventListener('change', callback)
  return () => wideNavigation.removeEventListener('change', callback)
}

export default function AppLayout() {
  const location = useLocation()
  const showDesktopSidebar = useSyncExternalStore(subscribeToNavigationWidth, () => wideNavigation.matches)
  const [navigationLocation, setNavigationLocation] = useState(null)
  const navigationOpen = !showDesktopSidebar && navigationLocation === location
  useEffect(() => {
    if (showDesktopSidebar) setNavigationLocation(null)
  }, [showDesktopSidebar])

  const dispatch = useDispatch()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const roles = useSelector(selectRoles)
  const user = useSelector(selectUser)
  const selectedCompanyId = useSelector(s => s.auth.selectedCompanyId)
  const branchFilter = useSelector(s => s.auth.enterpriseBranchFilter)
  const hasPunchReasonPrompt = useSelector(s => Boolean(s.ess.punchReasonPrompt))
  const userId = user?.id ?? user?.userId

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchMe())
    }
  }, [isAuthenticated])

  // Poll unread notification count every 30 seconds so the bell badge stays current.
  useEffect(() => {
    if (!isAuthenticated) return
    dispatch(fetchUnreadCount())
    const interval = setInterval(() => dispatch(fetchUnreadCount()), 120000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Bootstrap current user's company so useCurrency works on any page after refresh.
  // Skip for platform admins — they use fetchAll() to load all companies.
  // Employees/HR managers use /companies/mine (no role restriction).
  // Enterprise/Branch admins use /companies/{id} (requires admin role).
  useEffect(() => {
    const isPlatformAdmin = roles.includes('PLATFORM_SUPER_ADMIN')
    const isAdminRole = roles.some(r => ['SUPER_ADMIN', 'ACCOUNT_MANAGER', 'COMPANY_ADMIN', 'ENTERPRISE_ADMIN', 'BRANCH_ADMIN'].includes(r))
    if (!isAuthenticated || isPlatformAdmin) return
    const companyId = selectedCompanyId || user?.companyId
    if (isAdminRole && companyId) {
      dispatch(fetchMyCompany(companyId))
    } else if (user?.companyId) {
      dispatch(fetchMyCompanyInfo())
    }
  }, [isAuthenticated, user?.companyId, selectedCompanyId, roles])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.mustChangePassword) return <Navigate to="/change-password-required" replace />
  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50">
      {showDesktopSidebar && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onOpenNavigation={showDesktopSidebar ? undefined : () => setNavigationLocation(location)}
          navigationOpen={navigationOpen}
        />
        <main className="flex-1 min-w-0 overflow-auto p-3 sm:p-4 xl:p-6">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Dialog open={navigationOpen} onClose={() => setNavigationLocation(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex">
          <DialogPanel className="h-full max-w-full">
            <DialogTitle className="sr-only">Main navigation</DialogTitle>
            <Sidebar onClose={() => setNavigationLocation(null)} />
          </DialogPanel>
        </div>
      </Dialog>
      {roles.includes('EMPLOYEE') && <UnresolvedRegularisationReminder suspended={hasPunchReasonPrompt} />}
      <LatePunchReasonDialog />
      {userId != null && <CheckoutReminder userId={userId} key={`checkout:${userId}:${selectedCompanyId || user.companyId || ''}:${branchFilter || ''}`} />}
      {userId != null && <AnnouncementAlert key={`${userId}:${selectedCompanyId || user.companyId || ''}:${branchFilter || ''}`} />}
      <ChatbotWidget />
      <QuickStartTour user={user} roles={roles} />
    </div>
  )
}
