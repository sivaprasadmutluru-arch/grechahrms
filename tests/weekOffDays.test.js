import assert from 'node:assert/strict'
import test from 'node:test'
import { effectiveWeekOffDays } from '../src/utils/weekOffDays.js'

test('custom Saturday is a working day even if legacy settings include Saturday as week off', () => {
  assert.deepEqual(effectiveWeekOffDays({
    weeklyOffDays: 'SUNDAY,SATURDAY',
    weekdayTimes: { SATURDAY: { startTime: '09:00:00', endTime: '13:00:00', minimumHours: 4 } },
  }), ['SUNDAY'])
})

test('shows all other configured week-off days in weekday order', () => {
  assert.deepEqual(effectiveWeekOffDays({ weeklyOffDays: 'SUNDAY, MONDAY,SUNDAY,friday' }), ['MONDAY', 'FRIDAY', 'SUNDAY'])
})

test('invalid or missing custom times do not remove a week-off day', () => {
  assert.deepEqual(effectiveWeekOffDays({ weeklyOffDays: 'SATURDAY', weekdayTimes: { SATURDAY: {} } }), ['SATURDAY'])
  assert.deepEqual(effectiveWeekOffDays({}), [])
})
