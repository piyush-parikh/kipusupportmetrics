// APT-153: run with `npm test`. These guard the conversion that saving an
// adjustment got wrong on staging — a 'YYYY-MM' string reaching a date column.
import test from 'node:test'
import assert from 'node:assert/strict'
import { monthToDate, toMonthKey } from './dates.js'
import { adjustmentToRow } from './adjustmentRows.js'

test('monthToDate turns a month into the first of that month', () => {
  assert.equal(monthToDate('2026-11'), '2026-11-01')
  assert.equal(monthToDate('2026-01'), '2026-01-01')
  assert.equal(monthToDate('2026-12'), '2026-12-01')
})

test('monthToDate accepts a full date and moves it to the first', () => {
  assert.equal(monthToDate('2026-11-15'), '2026-11-01')
  assert.equal(monthToDate('2026-11-01'), '2026-11-01')
  assert.equal(monthToDate('2026-02-29'), '2026-02-01')
})

test('monthToDate ignores surrounding whitespace', () => {
  assert.equal(monthToDate('  2026-11  '), '2026-11-01')
})

test('monthToDate rejects anything that is not a month', () => {
  for (const bad of [null, undefined, '', '   ', 'abc', '2026', '202611', 42, {}, []]) {
    assert.throws(() => monthToDate(bad), /Expected a month/, `should reject ${JSON.stringify(bad)}`)
  }
})

test('monthToDate rejects a month outside 01-12', () => {
  assert.throws(() => monthToDate('2026-13'), /between 01 and 12/)
  assert.throws(() => monthToDate('2026-00'), /between 01 and 12/)
  assert.throws(() => monthToDate('2026-99'), /between 01 and 12/)
})

test('monthToDate rejects a month that is not zero-padded', () => {
  assert.throws(() => monthToDate('2026-1'), /Expected a month/)
  assert.throws(() => monthToDate('26-11'), /Expected a month/)
})

test('toMonthKey reduces either form to YYYY-MM without throwing', () => {
  assert.equal(toMonthKey('2026-11-01'), '2026-11')
  assert.equal(toMonthKey('2026-11'), '2026-11')
  assert.equal(toMonthKey(null), '')
  assert.equal(toMonthKey(undefined), '')
  assert.equal(toMonthKey(''), '')
})

// The staging bug, pinned: the page hands adjustmentToRow a 'YYYY-MM' month
// and the row that comes back must carry a real date.
test('regression: adjustmentToRow converts a YYYY-MM month to the first of the month', () => {
  const out = adjustmentToRow(
    { metric_key: 'csat_pct', goal: 80, reason: 'ramp' },
    { agentId: 7, month: '2026-11', userId: 'uuid-1', byName: 'a@example.com' },
  )
  assert.equal(out.metric_month, '2026-11-01')
})

test('regression: adjustmentToRow leaves an already-correct date alone', () => {
  const out = adjustmentToRow(
    { metric_key: 'csat_pct', exclude: true, reason: 'x' },
    { agentId: 7, month: '2026-11-01', userId: 'uuid-1', byName: 'a@example.com' },
  )
  assert.equal(out.metric_month, '2026-11-01')
})

test('regression: adjustmentToRow refuses a month it cannot convert', () => {
  assert.throws(
    () => adjustmentToRow({ metric_key: 'k' }, { agentId: 7, month: '2026-13', userId: 'u' }),
    /between 01 and 12/,
  )
})
