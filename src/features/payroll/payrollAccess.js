// Server capabilities describe the current company; global role names must not
// override them. Missing/failed capabilities never fall back to an admin view.
export function normalizePayrollAccess(data, companyId) {
  if (!data || String(data.companyId) !== String(companyId)) throw new Error('Payroll access does not match the selected company')
  const company = data.canViewCompanyPayslips === true
  const employeeId = Number(data.employeeId)
  const own = data.canViewOwnPayslips === true && Number.isSafeInteger(employeeId) && employeeId > 0
  return {
    companyId: data.companyId,
    employeeId: own ? employeeId : null,
    canViewOwnPayslips: own,
    canViewCompanyPayslips: company,
    canGeneratePayslips: company && data.canGeneratePayslips === true,
    canSubmitPayslips: company && data.canSubmitPayslips === true,
    canApprovePayslips: company && data.canApprovePayslips === true,
    canExportPayslips: company && data.canExportPayslips === true,
    canImportPayslips: company && data.canImportPayslips === true,
  }
}

export function payslipView(access, personal = false) {
  if (!access) return 'loading'
  if (personal && access.canViewOwnPayslips) return 'self'
  if (access.canViewCompanyPayslips) return 'company'
  return access.canViewOwnPayslips ? 'self' : 'denied'
}
