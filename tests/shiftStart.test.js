import assert from 'node:assert/strict'
import test from 'node:test'
import { shiftStartRemaining, formatShiftCountdown } from '../src/utils/shiftStart.js'

test('uses the server shift start instant, not browser-local hours', () => {
  const start = '2026-11-18T05:00:00Z'
  assert.equal(shiftStartRemaining(start, Date.parse('2026-11-18T04:30:00Z')), 1800)
  assert.equal(shiftStartRemaining(start, Date.parse(start)), 0)
  assert.equal(shiftStartRemaining(start, Date.parse('2026-11-18T06:00:00Z')), 0)
  assert.equal(shiftStartRemaining(null), 0)
})

test('countdown includes hours minutes and seconds', () => {
  assert.equal(formatShiftCountdown(3661), '1h 1m 1s')
  assert.equal(formatShiftCountdown(59), '0m 59s')
})
