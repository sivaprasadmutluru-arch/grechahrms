import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotificationChime, readSoundPreference } from '../src/utils/notificationChime.js'

test('sound requires explicit opt-in and consent is stored per user', () => {
  assert.equal(readSoundPreference({ getItem: () => null }, 210), null)
  assert.equal(readSoundPreference({ getItem: () => 'unexpected' }, 210), null)
  assert.equal(readSoundPreference({ getItem: key => key === 'grecha.notificationSound:210' ? 'on' : null }, 210), 'on')
  assert.equal(readSoundPreference({ getItem: () => 'off' }, 210), 'off')
  assert.equal(readSoundPreference({ getItem() { throw new Error('storage blocked') } }, 210), null)
})

test('requires audio unlock and plays two quiet notes once requested', async () => {
  const notes = []
  class FakeContext {
    state = 'suspended'
    currentTime = 10
    destination = {}
    async resume() { this.state = 'running' }
    createOscillator() {
      const note = { frequency: { setValueAtTime(value) { note.hz = value } }, connect() {}, disconnect() {}, start(time) { note.start = time }, stop(time) { note.stop = time } }
      notes.push(note)
      return note
    }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime(value) { assert.ok(value <= 0.1) }, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} } }
  }
  const chime = createNotificationChime(() => FakeContext)
  assert.equal(chime.play(), false)
  assert.equal(await chime.unlock(), true)
  assert.equal(notes.length, 0)
  assert.equal(chime.play(), true)
  assert.deepEqual(notes.map(note => note.hz), [660, 880])
  assert.ok(notes.every(note => note.stop > note.start && note.stop - note.start < 0.5))
})

test('unsupported and blocked browser audio fails silently', async () => {
  const unsupported = createNotificationChime(() => undefined)
  assert.equal(await unsupported.unlock(), false)
  assert.equal(unsupported.play(), false)
  const blocked = createNotificationChime(() => class { constructor() { throw new Error('blocked') } })
  assert.equal(await blocked.unlock(), false)
  assert.equal(blocked.play(), false)
})
