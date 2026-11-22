import assert from 'node:assert/strict'
import test from 'node:test'
import { getProfileDisplayName } from '../src/utils/profileDisplayName.js'

test('uses the employee full name instead of the phone login', () => {
  assert.equal(getProfileDisplayName({ firstName: ' Arun ', lastName: 'Kumar', username: '971555010000' }), 'Arun Kumar')
})

test('supports a single name and names in other scripts', () => {
  assert.equal(getProfileDisplayName({ firstName: 'آرون', lastName: ' ' }), 'آرون')
})

test('does not expose phone numbers, email, or username when no name is available', () => {
  assert.equal(getProfileDisplayName({ username: '971555010000', name: '+971 (55) 501-0000' }), 'User')
  assert.equal(getProfileDisplayName({ name: 'user@example.com' }, 'Admin'), 'Admin')
})
