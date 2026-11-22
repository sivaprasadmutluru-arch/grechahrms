import { useEffect, useState } from 'react'
import api from '../../services/api'
import { normalizePayrollAccess } from './payrollAccess'

export default function usePayrollAccess(companyId) {
  const [result, setResult] = useState({ companyId: null, access: null, error: '' })
  useEffect(() => {
    if (!companyId) return
    const controller = new AbortController()
    let active = true
    api.get('/payroll/access', {
      headers: { 'X-Company-Id': String(companyId), 'X-Filter-Company-Id': String(companyId) },
      signal: controller.signal,
    }).then(({ data }) => {
      const access = normalizePayrollAccess(data, companyId)
      if (active) setResult({ companyId, access, error: '' })
    }).catch(error => {
      if (active) setResult({ companyId, access: null, error: error.response?.data?.message || error.message || 'Unable to verify payroll access' })
    })
    return () => { active = false; controller.abort() }
  }, [companyId])
  return String(result.companyId) === String(companyId) ? result : { access: null, error: '' }
}
