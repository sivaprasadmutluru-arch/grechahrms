import axios from 'axios'
import { API_BASE_URL } from '../config/constants'
import { trackMutation } from './mutationLoading'

const api = axios.create({ baseURL: API_BASE_URL })
const defaultAdapter = api.defaults.adapter
api.defaults.adapter = config => trackMutation(config, request => axios.getAdapter(defaultAdapter, request)(request))

// The company picker is the active tenant context for platform and
// multi-company users.  Individual screens historically included the profile
// company in a request body or query parameter, which can be stale after the
// user changes company in the header.  Normalize only the common root-level
// company fields here so every scoped screen follows the active context.
//
// This deliberately does not rewrite arrays/nested data: screens that perform
// explicit cross-company administration (for example, multi-company role
// assignment) retain the company IDs selected in their own form.
const applyActiveCompanyContext = (config, companyId) => {
  if (!companyId) return

  const selectedId = Number(companyId)
  if (!Number.isFinite(selectedId)) return

  if (config.params && typeof config.params === 'object' && 'companyId' in config.params) {
    config.params = { ...config.params, companyId: selectedId }
  }

  const body = config.data
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof FormData !== 'undefined' && body instanceof FormData) return

  const nextBody = { ...body }
  let changed = false
  if (nextBody.company && typeof nextBody.company === 'object' && !Array.isArray(nextBody.company) && 'id' in nextBody.company) {
    nextBody.company = { ...nextBody.company, id: selectedId }
    changed = true
  }
  if ('companyId' in nextBody) {
    nextBody.companyId = selectedId
    changed = true
  }
  if ('company_id' in nextBody) {
    nextBody.company_id = selectedId
    changed = true
  }
  if (changed) config.data = nextBody
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  const enterpriseBranchFilter = localStorage.getItem('enterpriseBranchFilter')
  if (enterpriseBranchFilter) {
    config.headers['X-Filter-Company-Id'] = enterpriseBranchFilter
  }

  if (!config.headers['X-Company-Id']) {
    const selectedCompanyId = localStorage.getItem('selectedCompanyId')
    if (selectedCompanyId) {
      config.headers['X-Company-Id'] = selectedCompanyId
    } else {
      // Platform admins and multi-company Super Admin / Account Manager users with
      // no selection are in "All Companies" mode. The backend still restricts
      // non-platform users to the companies in their active assignments.
      const storedRoles = localStorage.getItem('roles')
      const hasMultiCompanyRole = storedRoles
        ? (() => {
            try {
              const roles = JSON.parse(storedRoles)
              return roles.some(role => ['PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN', 'ACCOUNT_MANAGER'].includes(role))
            } catch (_) { return false }
          })()
        : false
      if (!hasMultiCompanyRole) {
        const stored = localStorage.getItem('user')
        if (stored) {
          try {
            const user = JSON.parse(stored)
            if (user?.companyId) config.headers['X-Company-Id'] = user.companyId
          } catch (_) {}
        }
      }
    }
  }

  // Keep payloads and explicit query filters in lockstep with the tenant
  // header. This prevents a company switch from displaying one tenant while a
  // create/update is saved against the logged-in user's original company.
  applyActiveCompanyContext(config, config.headers['X-Company-Id'])
  return config
})

api.interceptors.response.use(
  (response) => {
    // Spring Boot 3.3+ VIA_DTO mode nests pagination metadata under a `page` key.
    // Flatten it to top-level so all slices can read totalElements/number/size as before.
    const d = response.data
    if (d && d.page && Array.isArray(d.content)) {
      response.data = {
        ...d,
        totalElements: d.page.totalElements,
        totalPages: d.page.totalPages,
        number: d.page.number,
        size: d.page.size,
      }
    }
    return response
  },
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.message === 'ORGANIZATION_SUSPENDED') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('roles')
      localStorage.removeItem('selectedCompanyId')
      window.location.href = '/suspended'
      return Promise.reject(error)
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
