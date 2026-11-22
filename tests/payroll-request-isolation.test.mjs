import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
let source = await readFile(new URL('../src/features/payroll/payrollSlice.js', import.meta.url), 'utf8')
source = source.replace("'@reduxjs/toolkit'", JSON.stringify(pathToFileURL(require.resolve('@reduxjs/toolkit')).href))
source = source.replace("import api from '../../services/api'", 'const api = globalThis.payrollTestApi')
globalThis.payrollTestApi = { get: async () => ({ data: [] }) }
const { default: reducer, fetchMonthPayslips, fetchEmployeePayslips } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('company switch clears company data and ignores an earlier company response', () => {
  let state = reducer(undefined, fetchMonthPayslips.pending('old', { companyId: 64, year: 2026 }))
  state = reducer(state, fetchMonthPayslips.fulfilled([{ id: 1 }], 'old', { companyId: 64, year: 2026 }))
  state = reducer(state, fetchMonthPayslips.pending('new', { companyId: 65, year: 2026 }))
  assert.deepEqual(state.monthPayslips, [])
  assert.equal(state.monthPayslipsCompanyId, 65)
  state = reducer(state, fetchMonthPayslips.fulfilled([{ id: 999 }], 'old', { companyId: 64, year: 2026 }))
  assert.deepEqual(state.monthPayslips, [])
  state = reducer(state, fetchMonthPayslips.fulfilled([{ id: 2 }], 'new', { companyId: 65, year: 2026 }))
  assert.deepEqual(state.monthPayslips, [{ id: 2 }])
})

test('old personal response cannot replace new tenant employee data', () => {
  let state = reducer(undefined, fetchEmployeePayslips.pending('old', { employeeId: 18, companyId: 64 }))
  state = reducer(state, fetchEmployeePayslips.pending('new', { employeeId: 18, companyId: 65 }))
  state = reducer(state, fetchEmployeePayslips.fulfilled([{ id: 999 }], 'old', { employeeId: 18, companyId: 64 }))
  assert.deepEqual(state.payslips, [])
  assert.equal(state.employeePayslipsCompanyId, 65)
})

test('company payroll request carries the selected company and an abort signal', async () => {
  globalThis.payrollTestApi.get = async (url, config) => {
    assert.equal(url, '/payroll/payslips')
    assert.equal(config.headers['X-Company-Id'], '64')
    assert.equal(config.headers['X-Filter-Company-Id'], '64')
    assert.equal(config.params.year, 2026)
    assert.ok(config.signal)
    return { data: [] }
  }
  const action = await fetchMonthPayslips({ companyId: 64, year: 2026 })(() => {}, () => ({}), undefined)
  assert.equal(action.type, fetchMonthPayslips.fulfilled.type)
})

test('personal request uses the tenant-resolved employee and selected company', async () => {
  globalThis.payrollTestApi.get = async (url, config) => {
    assert.equal(url, '/payroll/employee/18/payslips')
    assert.equal(config.headers['X-Company-Id'], '64')
    return { data: [] }
  }
  const action = await fetchEmployeePayslips({ employeeId: 18, companyId: 64 })(() => {}, () => ({}), undefined)
  assert.equal(action.type, fetchEmployeePayslips.fulfilled.type)
})

test('legacy personal callers accepting a plain employee ID remain compatible', async () => {
  globalThis.payrollTestApi.get = async url => {
    assert.equal(url, '/payroll/employee/18/payslips')
    return { data: [] }
  }
  const action = await fetchEmployeePayslips(18)(() => {}, () => ({}), undefined)
  assert.equal(action.type, fetchEmployeePayslips.fulfilled.type)
})
