// APT-156: run with `npm test`. These pin the password rules and the wording
// people see when a change is refused.
//
// Every value below is a made-up placeholder built from repeated characters —
// deliberately nothing that resembles a password anybody would use.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MIN_PASSWORD_LENGTH, validatePasswordChange,
  describePasswordUpdateError, isMissingColumnError,
} from './passwordHelpers.js'

const CURRENT = 'xxxxxxxx11'        // stands in for "the password they have now"
const GOOD = 'yyyyyyyy22'           // 10 characters, letters and numbers
const nines = (n) => '9'.repeat(n)

test('the minimum length is ten', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 10)
})

test('a sound change passes with no errors', () => {
  const result = validatePasswordChange(
    { current: CURRENT, next: GOOD, confirm: GOOD },
    { email: 'someone@example.com' },
  )
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, {})
})

test('the current password is required', () => {
  const missing = validatePasswordChange({ current: '', next: GOOD, confirm: GOOD })
  assert.equal(missing.ok, false)
  assert.equal(missing.errors.current, 'Enter your current password.')

  const spaces = validatePasswordChange({ current: '    ', next: GOOD, confirm: GOOD })
  assert.equal(spaces.errors.current, 'Enter your current password.', 'all spaces counts as empty')

  const absent = validatePasswordChange({ next: GOOD, confirm: GOOD })
  assert.equal(absent.errors.current, 'Enter your current password.')
  assert.equal(validatePasswordChange().ok, false, 'no arguments at all')
})

test('nine characters is too short, ten is enough', () => {
  const nine = 'yyyyyyy22'
  assert.equal(nine.length, 9)
  const short = validatePasswordChange({ current: CURRENT, next: nine, confirm: nine })
  assert.equal(short.errors.next, 'Use at least 10 characters.')

  assert.equal(GOOD.length, 10)
  const ok = validatePasswordChange({ current: CURRENT, next: GOOD, confirm: GOOD })
  assert.equal(ok.errors.next, undefined)
})

test('spaces count as characters, but a value of only spaces does not', () => {
  const withSpace = 'yy yy yy 22'
  assert.equal(
    validatePasswordChange({ current: CURRENT, next: withSpace, confirm: withSpace }).ok,
    true,
    'spaces inside are kept, not trimmed away',
  )

  const onlySpaces = ' '.repeat(12)
  assert.equal(
    validatePasswordChange({ current: CURRENT, next: onlySpaces, confirm: onlySpaces }).errors.next,
    'Use at least 10 characters.',
    'twelve spaces is treated as empty',
  )
})

test('unicode letters are counted and recognised as letters', () => {
  const accented = 'ÿÿÿÿÿÿÿÿ22'
  assert.equal(
    validatePasswordChange({ current: CURRENT, next: accented, confirm: accented }).ok,
    true,
  )

  const lettersOnly = 'ÿÿÿÿÿÿÿÿÿÿ'
  assert.equal(
    validatePasswordChange({ current: CURRENT, next: lettersOnly, confirm: lettersOnly }).errors.next,
    'Mix letters and numbers.',
    'accented letters are still only letters',
  )
})

test('the new password must differ from the current one', () => {
  const same = validatePasswordChange({ current: CURRENT, next: CURRENT, confirm: CURRENT })
  assert.equal(same.errors.next, 'Choose a password that is different from the current one.')
})

test('digits only, and letters only, are both refused', () => {
  const digits = nines(12)
  assert.equal(
    validatePasswordChange({ current: CURRENT, next: digits, confirm: digits }).errors.next,
    'Mix letters and numbers.',
  )

  const letters = 'yyyyyyyyyyyy'
  assert.equal(
    validatePasswordChange({ current: CURRENT, next: letters, confirm: letters }).errors.next,
    'Mix letters and numbers.',
  )
})

test('the email name may not appear in the password, whatever the case', () => {
  const withName = 'bartholomew99'
  const hit = validatePasswordChange(
    { current: CURRENT, next: withName, confirm: withName },
    { email: 'Bartholomew@example.com' },
  )
  assert.equal(hit.errors.next, "Don't use your email name in the password.")

  const upper = 'BARTHOLOMEW99'
  assert.equal(
    validatePasswordChange(
      { current: CURRENT, next: upper, confirm: upper },
      { email: 'bartholomew@example.com' },
    ).errors.next,
    "Don't use your email name in the password.",
    'compared without regard to case',
  )
})

test('a short email name does not trigger the rule', () => {
  // 'abc' is three characters, below the four-character floor
  const value = 'abcyyyyy22'
  assert.equal(
    validatePasswordChange(
      { current: CURRENT, next: value, confirm: value },
      { email: 'abc@example.com' },
    ).ok,
    true,
  )

  // exactly four characters does trigger it
  const four = 'abcdyyyy22'
  assert.equal(
    validatePasswordChange(
      { current: CURRENT, next: four, confirm: four },
      { email: 'abcd@example.com' },
    ).errors.next,
    "Don't use your email name in the password.",
  )
})

test('no email, or a nonsense email, simply skips that rule', () => {
  assert.equal(validatePasswordChange({ current: CURRENT, next: GOOD, confirm: GOOD }).ok, true)
  assert.equal(
    validatePasswordChange({ current: CURRENT, next: GOOD, confirm: GOOD }, { email: null }).ok,
    true,
  )
  assert.equal(
    validatePasswordChange({ current: CURRENT, next: GOOD, confirm: GOOD }, { email: '' }).ok,
    true,
  )
})

test('the confirmation must match exactly', () => {
  const mismatch = validatePasswordChange({ current: CURRENT, next: GOOD, confirm: `${GOOD}3` })
  assert.equal(mismatch.ok, false)
  assert.equal(mismatch.errors.confirm, "The two new passwords don't match.")

  const trailingSpace = validatePasswordChange({ current: CURRENT, next: GOOD, confirm: `${GOOD} ` })
  assert.equal(
    trailingSpace.errors.confirm,
    "The two new passwords don't match.",
    'a trailing space is a real difference',
  )

  const empty = validatePasswordChange({ current: CURRENT, next: GOOD, confirm: '' })
  assert.equal(empty.errors.confirm, "The two new passwords don't match.")
})

test('several problems are reported together, one per field', () => {
  const result = validatePasswordChange(
    { current: '', next: nines(4), confirm: 'something else' },
    { email: 'someone@example.com' },
  )
  assert.deepEqual(Object.keys(result.errors).sort(), ['confirm', 'current', 'next'])
})

test('no message ever repeats the password back', () => {
  const secretish = 'zzzzzzzz33'
  const result = validatePasswordChange({ current: secretish, next: secretish, confirm: secretish })
  const allText = Object.values(result.errors).join(' ')
  assert.equal(allText.includes(secretish), false)
})

test('update failures are explained in plain words', () => {
  const cases = [
    [{ message: 'Password is too weak' }, 'That password is not accepted. Use a longer one with letters and numbers.'],
    [{ message: 'Password should be at least 6 characters' }, 'That password is not accepted. Use a longer one with letters and numbers.'],
    [{ message: 'password is too short' }, 'That password is not accepted. Use a longer one with letters and numbers.'],
    [{ message: 'New password should be different from the old password.' }, 'Choose a password that is different from the current one.'],
    [{ message: 'You cannot use the same password' }, 'Choose a password that is different from the current one.'],
    [{ message: 'Auth session missing!' }, 'Your sign-in has expired. Please sign in again.'],
    [{ message: 'JWT expired' }, 'Your sign-in has expired. Please sign in again.'],
    [{ message: 'Failed to fetch' }, 'Could not reach the server. Check your internet connection and try again.'],
    [{ name: 'TypeError', message: 'load failed' }, 'Could not reach the server. Check your internet connection and try again.'],
    [{ status: 429, message: 'Request rate limit reached' }, 'Too many attempts. Please wait a few minutes and try again.'],
    [{ message: 'Email rate limit exceeded' }, 'Too many attempts. Please wait a few minutes and try again.'],
    [{ message: 'Something nobody has seen before' }, 'Could not change the password. Please try again.'],
    [{}, 'Could not change the password. Please try again.'],
    [null, 'Could not change the password. Please try again.'],
  ]
  for (const [error, expected] of cases) {
    assert.equal(describePasswordUpdateError(error), expected, JSON.stringify(error))
  }
})

test('a missing column is recognised, from the code or from the message', () => {
  assert.equal(
    isMissingColumnError({ code: '42703', message: 'column "must_change_password" does not exist' }),
    true,
    'a real-looking Postgres error',
  )
  assert.equal(
    isMissingColumnError({ message: 'column app_users.must_change_password does not exist' }),
    true,
    'PostgREST-style message with no code',
  )
  assert.equal(
    isMissingColumnError({ code: '42703' }),
    true,
    'the code alone is enough',
  )
  assert.equal(
    isMissingColumnError({ message: "Could not find the 'must_change_password' column of 'app_users'" }),
    true,
  )
})

test('unrelated failures are not mistaken for a missing column', () => {
  assert.equal(isMissingColumnError(null), false)
  assert.equal(isMissingColumnError({}), false)
  assert.equal(isMissingColumnError({ message: 'Failed to fetch' }), false)
  assert.equal(isMissingColumnError({ code: '42501', message: 'permission denied for table app_users' }), false)
  assert.equal(
    isMissingColumnError({ message: 'relation "app_users" does not exist' }),
    false,
    'a missing table is a different problem',
  )
  assert.equal(
    isMissingColumnError({ message: 'must_change_password is true' }),
    false,
    'the column name alone is not a failure',
  )
})
