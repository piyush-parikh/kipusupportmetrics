// APT-149: run with `npm test` (node --test src/lib). No test runner needed.
import test from 'node:test'
import assert from 'node:assert/strict'
import { safeRedirectPath, describeAuthError } from './authHelpers.js'

test('safeRedirectPath keeps ordinary in-app paths', () => {
  assert.equal(safeRedirectPath('/admin/goals'), '/admin/goals')
  assert.equal(safeRedirectPath('/'), '/')
  assert.equal(safeRedirectPath('/attendance/entry?month=3'), '/attendance/entry?month=3')
})

test('safeRedirectPath refuses anything that could leave the site', () => {
  assert.equal(safeRedirectPath('//evil.com'), '/')
  assert.equal(safeRedirectPath('https://evil.com'), '/')
  assert.equal(safeRedirectPath('http://evil.com'), '/')
  assert.equal(safeRedirectPath('/\\evil.com'), '/')
  assert.equal(safeRedirectPath('\\\\evil.com'), '/')
  assert.equal(safeRedirectPath('javascript:alert(1)'), '/')
})

test('safeRedirectPath refuses the login page itself', () => {
  assert.equal(safeRedirectPath('/login'), '/')
  assert.equal(safeRedirectPath('/login?next=/x'), '/')
})

test('safeRedirectPath refuses empty and non-string input', () => {
  assert.equal(safeRedirectPath(''), '/')
  assert.equal(safeRedirectPath(null), '/')
  assert.equal(safeRedirectPath(undefined), '/')
  assert.equal(safeRedirectPath(42), '/')
  assert.equal(safeRedirectPath({}), '/')
})

test('describeAuthError maps wrong credentials', () => {
  assert.equal(
    describeAuthError({ message: 'Invalid login credentials' }),
    'Email or password is incorrect.',
  )
})

test('describeAuthError maps an unconfirmed account', () => {
  assert.equal(
    describeAuthError({ message: 'Email not confirmed' }),
    'Your account is not activated yet. Please contact an administrator.',
  )
})

test('describeAuthError maps rate limiting, by status and by text', () => {
  const expected = 'Too many attempts. Please wait a few minutes and try again.'
  assert.equal(describeAuthError({ status: 429, message: 'whatever' }), expected)
  assert.equal(describeAuthError({ message: 'Email rate limit exceeded' }), expected)
})

test('describeAuthError maps network failure', () => {
  const expected = 'Could not reach the server. Check your internet connection and try again.'
  assert.equal(describeAuthError({ message: 'Failed to fetch' }), expected)
  assert.equal(describeAuthError({ name: 'TypeError', message: 'NetworkError when attempting to fetch' }), expected)
})

test('describeAuthError falls back without leaking detail', () => {
  assert.equal(describeAuthError({ message: 'some internal detail' }), 'Sign in failed. Please try again.')
  assert.equal(describeAuthError(null), 'Sign in failed. Please try again.')
})
