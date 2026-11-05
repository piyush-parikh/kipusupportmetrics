// APT-149: run with `npm test` (node --test src/lib). No test runner needed.
import test from 'node:test'
import assert from 'node:assert/strict'
import { describeError, toMessage, setSessionExpiredHandler } from './errors.js'

test('describeError recognises a permission problem by status', () => {
  assert.deepEqual(describeError({ status: 401, message: 'Unauthorized' }), {
    message: 'You do not have permission to do this.', sessionExpired: false,
  })
  assert.deepEqual(describeError({ status: 403, message: 'Forbidden' }), {
    message: 'You do not have permission to do this.', sessionExpired: false,
  })
})

test('describeError recognises a permission problem by code and by text', () => {
  const expected = 'You do not have permission to do this.'
  assert.equal(describeError({ code: '42501', message: 'nope' }).message, expected)
  assert.equal(describeError({ message: 'permission denied for table metrics_agents' }).message, expected)
  assert.equal(
    describeError({ message: 'new row violates row-level security policy' }).message,
    expected,
  )
})

test('describeError flags an expired session', () => {
  assert.deepEqual(describeError({ message: 'JWT expired' }), {
    message: 'Your sign-in has expired. Please sign in again.', sessionExpired: true,
  })
  assert.equal(describeError({ message: 'invalid JWT: unable to parse' }).sessionExpired, true)
  assert.equal(describeError({ code: 'PGRST301', message: 'x' }).sessionExpired, true)
})

test('describeError passes anything else straight through', () => {
  assert.deepEqual(describeError({ message: 'Could not find the created_by column' }), {
    message: 'Could not find the created_by column', sessionExpired: false,
  })
})

test('describeError copes with nothing useful', () => {
  assert.equal(describeError(null).message, 'Something went wrong. Please try again.')
  assert.equal(describeError({}).message, 'Something went wrong. Please try again.')
  assert.equal(describeError(null).sessionExpired, false)
})

test('toMessage returns the message and signs out only when the session lapsed', () => {
  let signedOut = 0
  setSessionExpiredHandler(() => { signedOut += 1 })

  assert.equal(toMessage({ status: 403 }), 'You do not have permission to do this.')
  assert.equal(signedOut, 0, 'a permission problem must not sign anyone out')

  assert.equal(toMessage({ message: 'JWT expired' }), 'Your sign-in has expired. Please sign in again.')
  assert.equal(signedOut, 1)

  assert.equal(toMessage({ message: 'plain failure' }), 'plain failure')
  assert.equal(signedOut, 1)

  setSessionExpiredHandler(null)
})

test('toMessage still works with no handler registered', () => {
  setSessionExpiredHandler(null)
  assert.equal(toMessage({ message: 'JWT expired' }), 'Your sign-in has expired. Please sign in again.')
})
