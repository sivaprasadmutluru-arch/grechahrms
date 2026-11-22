import { useEffect, useState } from 'react'
import api from '../../services/api'

/** Relationship-scoped endpoints: never substitute the company-wide admin API. */
export default function useTeamRegularisation(companyId) {
  const [generation, refresh] = useState(0)
  const [state, setState] = useState({ companyId: null, members: [], requests: [], loading: false, error: null })
  useEffect(() => {
    if (!companyId) return
    const controller = new AbortController()
    const config = { signal: controller.signal, headers: { 'X-Company-Id': companyId, 'X-Filter-Company-Id': companyId } }
    Promise.all([api.get('/team/employees', config), api.get('/team/regularisation', config)])
      .then(([members, requests]) => {
        if (controller.signal.aborted) return
        if (!Array.isArray(members.data) || !Array.isArray(requests.data)) throw new Error('Invalid team response')
        setState({ companyId, generation, members: members.data, requests: requests.data, loading: false, error: null })
      }).catch(error => {
        if (controller.signal.aborted) return
        // Accounts without an employee profile cannot be reporting managers.
        const denied = error.response?.status === 403
        setState({ companyId, generation, members: [], requests: [], loading: false,
          error: denied ? null : 'Unable to load team approvals. Please retry.' })
      })
    return () => controller.abort()
  }, [companyId, generation])
  const current = state.companyId === companyId && state.generation === generation ? state : { members: [], requests: [], loading: true, error: null }
  return { ...current, available: current.members.length > 0,
    pending: current.requests.filter(request => request.status === 'PENDING' && request.canReview === true),
    refresh: () => refresh(value => value + 1) }
}
