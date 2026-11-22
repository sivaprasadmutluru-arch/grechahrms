import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePayrollAccess, payslipView } from '../src/features/payroll/payrollAccess.js'

const admin = { companyId: 64, employeeId: 18, canViewOwnPayslips: true, canViewCompanyPayslips: true,
  canGeneratePayslips: true, canSubmitPayslips: true, canApprovePayslips: true, canExportPayslips: true, canImportPayslips: true }

test('mixed admin/employee account defaults to management and can open My payslips', () => {
  const access = normalizePayrollAccess(admin, 64)
  assert.equal(payslipView(access), 'company')
  assert.equal(payslipView(access, true), 'self')
  assert.equal(access.canGeneratePayslips, true)
})

test('employee-only account remains self-service even if stale global roles claim admin', () => {
  const access = normalizePayrollAccess({ ...admin, canViewCompanyPayslips: false, roles: ['COMPANY_ADMIN'] }, 64)
  assert.equal(payslipView(access), 'self')
  for (const field of ['canGeneratePayslips', 'canSubmitPayslips', 'canApprovePayslips', 'canImportPayslips']) assert.equal(access[field], false)
})

test('preparation does not imply approval and approval does not imply generation', () => {
  const preparer = normalizePayrollAccess({ ...admin, canApprovePayslips: false }, 64)
  assert.equal(preparer.canGeneratePayslips, true)
  assert.equal(preparer.canApprovePayslips, false)
  const approver = normalizePayrollAccess({ ...admin, canGeneratePayslips: false }, 64)
  assert.equal(approver.canGeneratePayslips, false)
  assert.equal(approver.canApprovePayslips, true)
})

test('read-only company payroll access cannot mutate payslips', () => {
  const access = normalizePayrollAccess({ companyId: 64, canViewCompanyPayslips: true }, 64)
  assert.equal(payslipView(access), 'company')
  assert.equal(access.canGeneratePayslips, false)
  assert.equal(access.canSubmitPayslips, false)
  assert.equal(access.canApprovePayslips, false)
})

test('missing access never falls back to an admin or employee request', () => {
  assert.equal(payslipView(null), 'loading')
  assert.throws(() => normalizePayrollAccess(null, 64))
})

test('capabilities from another company cannot be reused', () => {
  assert.throws(() => normalizePayrollAccess(admin, 65), /selected company/)
  assert.equal(normalizePayrollAccess(admin, '64').companyId, 64)
})

test('invalid employee ID cannot enable a personal request', () => {
  for (const employeeId of [null, '', 0, -1, 'invalid']) {
    const access = normalizePayrollAccess({ companyId: 64, employeeId, canViewOwnPayslips: true }, 64)
    assert.equal(payslipView(access), 'denied')
    assert.equal(access.employeeId, null)
  }
})

test('a manager with no employee profile cannot switch into personal mode', () => {
  const access = normalizePayrollAccess({ ...admin, employeeId: null }, 64)
  assert.equal(payslipView(access, true), 'company')
  assert.equal(access.canViewOwnPayslips, false)
})

test('string truthy values never grant capabilities', () => {
  const access = normalizePayrollAccess({ companyId: 64, canViewCompanyPayslips: 'true', canGeneratePayslips: 'true' }, 64)
  assert.equal(payslipView(access), 'denied')
  assert.equal(access.canGeneratePayslips, false)
})
