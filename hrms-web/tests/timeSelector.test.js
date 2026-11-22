import assert from 'node:assert/strict'
import test from 'node:test'
import { splitTimeValue, updateTimeValue } from '../src/utils/timeSelector.js'

test('converts midnight and noon correctly', () => {
  assert.deepEqual(splitTimeValue('00:00'), { hour: '12', minute: '00', period: 'AM' })
  assert.deepEqual(splitTimeValue('12:00'), { hour: '12', minute: '00', period: 'PM' })
  assert.equal(updateTimeValue('00:00', 'period', 'PM'), '12:00')
  assert.equal(updateTimeValue('12:00', 'period', 'AM'), '00:00')
})

test('allows every exact minute and keeps the selected period', () => {
  assert.equal(updateTimeValue('18:00', 'minute', '37'), '18:37')
  assert.equal(updateTimeValue('18:37', 'hour', '09'), '21:37')
  assert.deepEqual(splitTimeValue('23:45:00'), { hour: '11', minute: '45', period: 'PM' })
})

test('an empty field stays empty until the user chooses a time', () => {
  assert.deepEqual(splitTimeValue(''), { hour: '', minute: '', period: 'AM' })
  assert.equal(updateTimeValue('', 'hour', '09'), '09:00')
  assert.equal(updateTimeValue('', 'minute', '30'), '00:30')
})
