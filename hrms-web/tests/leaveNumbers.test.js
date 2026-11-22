import assert from 'node:assert/strict'
import test from 'node:test'
import { formatLeaveDays } from '../src/utils/leaveNumbers.js'

test('always shows two decimals and hides floating-point artefacts', () => {
  assert.equal(formatLeaveDays(20.240000000000002), '20.24')
  assert.equal(formatLeaveDays(12.5), '12.50')
  assert.equal(formatLeaveDays(3), '3.00')
  assert.equal(formatLeaveDays(0), '0.00')
  assert.equal(formatLeaveDays('1.84'), '1.84')
})

test('handles missing invalid and negative balances without displaying NaN or negative zero', () => {
  for (const value of [null, undefined, '', ' ', 'invalid', Infinity]) assert.equal(formatLeaveDays(value), '—')
  assert.equal(formatLeaveDays(-1.845), '-1.85')
  assert.equal(formatLeaveDays(-0.0000001), '0.00')
})
