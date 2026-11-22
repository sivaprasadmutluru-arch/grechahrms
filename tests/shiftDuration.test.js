import assert from 'node:assert/strict'
import test from 'node:test'
import { shiftDurationHours, storedShiftHours, readShiftHours, formatShiftHours } from '../src/utils/shiftDuration.js'

test('recalculates a changed start time and end time', () => {
  assert.equal(shiftDurationHours('09:30', '18:00'), 8.5)
  assert.equal(shiftDurationHours('09:30', '17:30'), 8)
  assert.equal(shiftDurationHours('09:00:00', '13:00:00'), 4)
})

test('supports overnight and afternoon shifts', () => {
  assert.equal(shiftDurationHours('23:00', '08:00'), 9)
  assert.equal(shiftDurationHours('13:00', '23:00'), 10)
})

test('does not produce hours for empty invalid or identical times', () => {
  assert.equal(shiftDurationHours('', '18:00'), '')
  assert.equal(shiftDurationHours('25:00', '18:00'), '')
  assert.equal(shiftDurationHours('09:00', '09:00'), '')
})

test('fractional hours round-trip through the existing minutes representation', () => {
  assert.equal(storedShiftHours(8.5), 510)
  assert.equal(readShiftHours(510), 8.5)
  assert.equal(formatShiftHours(readShiftHours(510)), '8h 30m')
  assert.equal(storedShiftHours(9), 9)
  assert.equal(formatShiftHours(shiftDurationHours('09:01', '18:00')), '8h 59m')
  assert.equal(storedShiftHours(shiftDurationHours('09:01', '18:00')), 539)
})
