import test from 'node:test'
import assert from 'node:assert/strict'
import { beginMutation, getMutationLoading, mutationMessage, subscribeToMutations, trackMutation } from '../src/services/mutationLoading.js'

test('shows loading for create, update, patch and delete', () => {
  for (const method of ['post', 'put', 'patch', 'delete']) {
    assert.ok(mutationMessage({ method, url: '/employees' }))
  }
})

test('excludes reads, background updates and read-only POST endpoints', () => {
  assert.equal(mutationMessage({ method: 'get', url: '/employees' }), null)
  for (const url of ['/auth/login', '/notifications/2/read', '/notifications/mark-all-read', '/carr/kpis/suggestions?x=y', '/chatbot/ask']) {
    assert.equal(mutationMessage({ method: 'post', url }), null)
  }
  assert.equal(mutationMessage({ method: 'post', url: '/employees', mutationLoading: false }), null)
})

test('keeps the custom message through a multi-request operation', async () => {
  const observed = []
  const unsubscribe = subscribeToMutations(() => observed.push(getMutationLoading()))
  const finish = beginMutation('Creating organization…')
  try {
    await trackMutation({ method: 'post' }, () => {
      assert.equal(getMutationLoading(), 'Creating organization…')
      return 'saved'
    })
    assert.equal(getMutationLoading(), 'Creating organization…')
  } finally {
    finish()
    unsubscribe()
  }
  assert.deepEqual(observed, ['Creating organization…', null])
})

test('unlocks after HTTP rejection, cancellation or synchronous adapter failure', async () => {
  for (const send of [
    () => Promise.reject(new Error('HTTP failure')),
    () => Promise.reject(Object.assign(new Error('Canceled'), { code: 'ERR_CANCELED' })),
    () => { throw new Error('Adapter failure') },
  ]) {
    await assert.rejects(trackMutation({ method: 'delete' }, send))
    assert.equal(getMutationLoading(), null)
  }
})

test('does not unlock while another mutation is in flight', async () => {
  let complete
  const first = trackMutation({ method: 'put' }, () => new Promise(resolve => { complete = resolve }))
  await trackMutation({ method: 'delete' }, () => Promise.resolve())
  assert.equal(getMutationLoading(), 'Updating…')
  complete()
  await first
  assert.equal(getMutationLoading(), null)
})
