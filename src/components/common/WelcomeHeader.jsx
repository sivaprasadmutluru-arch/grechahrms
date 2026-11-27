import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchMyWorkInfo, selectEssWorkInfo } from '../../features/ess/essSlice'
import Avatar from './Avatar'
import useAuth from '../../hooks/useAuth'
import { API_BASE_URL } from '../../config/constants'

export default function WelcomeHeader() {
  const dispatch = useDispatch()
  const { user } = useAuth()
  const workInfo = useSelector(selectEssWorkInfo)

  useEffect(() => {
    if (!workInfo) dispatch(fetchMyWorkInfo())
  }, [dispatch, workInfo])

  const firstName = user?.firstName || user?.username || 'there'
  const companyName = user?.companyName
  const companyLogoUrl = user?.companyLogoUrl
  const [logoLoadError, setLogoLoadError] = useState(false)

  useEffect(() => { setLogoLoadError(false) }, [companyLogoUrl])

  // Compute profile photo URL from user.photoPath
  const photoUrl = user?.photoPath
    ? (user.photoPath.startsWith('http')
        ? user.photoPath
        : `${API_BASE_URL.replace('/api', '')}/media/${user.photoPath.replace(/^\//, '')}`)
    : null
  const jobPosition = workInfo?.jobPositionName
  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date())

  return (
    <div className="@container w-full min-w-0 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
      <div className="grid items-center gap-3 @min-[28rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @min-[28rem]:gap-4">
        {/* Avatar + name */}
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={firstName} src={photoUrl} size="lg" className="shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Welcome back</p>
            <h2 className="text-base font-bold text-gray-900 wrap-anywhere">{firstName}</h2>
            {jobPosition && (
              <p className="text-xs font-medium text-indigo-600 mt-0.5 wrap-anywhere">{jobPosition}</p>
            )}
          </div>
        </div>

        {/* Date + company */}
        <div className="min-w-0 border-t border-gray-100 pt-3 @min-[28rem]:border-t-0 @min-[28rem]:border-l @min-[28rem]:pt-0 @min-[28rem]:pl-4 @min-[28rem]:text-right">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Today</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5 wrap-anywhere">{dateStr}</p>
          {companyName && (
            <div className="flex items-center gap-1.5 mt-1 @min-[28rem]:justify-end">
              {companyLogoUrl && !logoLoadError && (
                <img
                  src={companyLogoUrl}
                  alt=""
                  className="h-3.5 w-3.5 shrink-0 rounded object-contain"
                  onError={() => setLogoLoadError(true)}
                />
              )}
              <p className="min-w-0 wrap-anywhere text-xs text-gray-400">{companyName}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
