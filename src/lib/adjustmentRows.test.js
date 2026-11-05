// APT-151: run with `npm test` (node --test "src/lib/*.test.js").
// These two functions decide what a supervisor's adjustment means and what gets
// stored, so every shape the database can hand back is pinned down here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { rowsToAdjustments, adjustmentToRow, describeAdjustmentRow } from './adjustmentRows.js'

const row = (o) => ({
  agent_id: 7, metric_month: '2026-09-01', metric_key: 'csat_pct',
  exclude: false, goal: null, tolerance: null, reason: null, adjusted_by: null,
  ...o,
})

test('rowsToAdjustments keys by metric_key', () => {
  const out = rowsToAdjustments([row({ metric_key: 'a', goal: 5 }), row({ metric_key: 'b', goal: 6 })])
  assert.deepEqual(Object.keys(out), ['a', 'b'])
  assert.equal(out.a.metric_key, 'a')
})

test('rowsToAdjustments: exclude true keeps only the flag', () => {
  const out = rowsToAdjustments([row({ exclude: true, reason: 'not their fault', adjusted_by: 'Alex King' })])
  assert.deepEqual(out.csat_pct, {
    metric_key: 'csat_pct', exclude: true, reason: 'not their fault', by: 'Alex King',
  })
})

test('rowsToAdjustments: exclude false omits the property entirely', () => {
  const out = rowsToAdjustments([row({ exclude: false, goal: 80 })])
  assert.equal('exclude' in out.csat_pct, false)
  assert.deepEqual(out.csat_pct, { metric_key: 'csat_pct', goal: 80 })
})

test('rowsToAdjustments keeps goal 0 and tolerance 0', () => {
  const out = rowsToAdjustments([row({ goal: 0, tolerance: 0 })])
  assert.equal(out.csat_pct.goal, 0)
  assert.equal(out.csat_pct.tolerance, 0)
})

test('rowsToAdjustments omits a missing goal rather than defaulting it', () => {
  const out = rowsToAdjustments([row({ goal: null, tolerance: null })])
  assert.deepEqual(out.csat_pct, { metric_key: 'csat_pct' })
})

test('rowsToAdjustments converts the numeric strings Postgres returns', () => {
  const out = rowsToAdjustments([row({ goal: '90.0', tolerance: '2.5' })])
  assert.equal(out.csat_pct.goal, 90)
  assert.equal(out.csat_pct.tolerance, 2.5)
  assert.equal(typeof out.csat_pct.goal, 'number')
})

test('rowsToAdjustments drops an empty or whitespace reason', () => {
  assert.equal('reason' in rowsToAdjustments([row({ reason: '' })]).csat_pct, false)
  assert.equal('reason' in rowsToAdjustments([row({ reason: '   ' })]).csat_pct, false)
  assert.equal('reason' in rowsToAdjustments([row({ reason: null })]).csat_pct, false)
})

test('rowsToAdjustments: a legacy row with no adjusted_by has no by key', () => {
  const out = rowsToAdjustments([row({ adjusted_by: null, goal: 80, reason: 'copied over' })])
  assert.equal('by' in out.csat_pct, false)
  assert.deepEqual(out.csat_pct, { metric_key: 'csat_pct', goal: 80, reason: 'copied over' })
})

test('rowsToAdjustments ignores unknown extra columns', () => {
  const out = rowsToAdjustments([row({ goal: 80, source: 'legacy_copy', copied_at: 'x', id: 99, updated_at: 'y' })])
  assert.deepEqual(out.csat_pct, { metric_key: 'csat_pct', goal: 80 })
})

test('rowsToAdjustments copes with no rows, null, and a row with no metric_key', () => {
  assert.deepEqual(rowsToAdjustments([]), {})
  assert.deepEqual(rowsToAdjustments(null), {})
  assert.deepEqual(rowsToAdjustments(undefined), {})
  assert.deepEqual(rowsToAdjustments([null, { metric_key: '' }]), {})
})

const ctx = { agentId: 7, month: '2026-09-01', userId: 'uuid-1', byName: 'a@example.com' }

test('adjustmentToRow builds a full row', () => {
  assert.deepEqual(adjustmentToRow({ metric_key: 'csat_pct', goal: 80, tolerance: 2, reason: 'ramp' }, ctx), {
    agent_id: 7, metric_month: '2026-09-01', metric_key: 'csat_pct',
    exclude: false, goal: 80, tolerance: 2, reason: 'ramp',
    adjusted_by: 'a@example.com', adjusted_by_user: 'uuid-1',
  })
})

test('adjustmentToRow: exclude clears goal and tolerance', () => {
  const out = adjustmentToRow({ metric_key: 'csat_pct', exclude: true, goal: 80, tolerance: 2, reason: 'why' }, ctx)
  assert.equal(out.exclude, true)
  assert.equal(out.goal, null)
  assert.equal(out.tolerance, null)
})

test('adjustmentToRow keeps goal 0 and tolerance 0', () => {
  const out = adjustmentToRow({ metric_key: 'csat_pct', goal: 0, tolerance: 0 }, ctx)
  assert.equal(out.goal, 0)
  assert.equal(out.tolerance, 0)
})

test('adjustmentToRow nulls a missing goal or tolerance', () => {
  const out = adjustmentToRow({ metric_key: 'csat_pct', reason: 'x' }, ctx)
  assert.equal(out.goal, null)
  assert.equal(out.tolerance, null)
})

test('adjustmentToRow trims the reason and nulls an empty one', () => {
  assert.equal(adjustmentToRow({ metric_key: 'k', reason: '  ramp  ' }, ctx).reason, 'ramp')
  assert.equal(adjustmentToRow({ metric_key: 'k', reason: '   ' }, ctx).reason, null)
  assert.equal(adjustmentToRow({ metric_key: 'k' }, ctx).reason, null)
})

test('adjustmentToRow nulls a missing author name but keeps the user id', () => {
  const out = adjustmentToRow({ metric_key: 'k' }, { agentId: 7, month: '2026-09-01', userId: 'uuid-1' })
  assert.equal(out.adjusted_by, null)
  assert.equal(out.adjusted_by_user, 'uuid-1')
})

test('round trip: page shape to row and back is unchanged', () => {
  for (const adj of [
    { metric_key: 'a', goal: 80, tolerance: 2, reason: 'ramp', by: 'a@example.com' },
    { metric_key: 'b', exclude: true, reason: 'not their fault', by: 'a@example.com' },
    { metric_key: 'c', goal: 0, reason: 'zero goal', by: 'a@example.com' },
  ]) {
    const back = rowsToAdjustments([adjustmentToRow(adj, { ...ctx, byName: adj.by })])
    assert.deepEqual(back[adj.metric_key], adj, `round trip failed for ${adj.metric_key}`)
  }
})

test('describeAdjustmentRow matches the old wording', () => {
  assert.equal(describeAdjustmentRow({ exclude: true }), 'Excluded from score')
  assert.equal(describeAdjustmentRow({ exclude: false, goal: 80 }), 'Custom goal: 80')
  assert.equal(describeAdjustmentRow({ exclude: false, goal: '80.0', tolerance: '5' }), 'Custom goal: 80 (±5)')
  assert.equal(describeAdjustmentRow({ exclude: false, goal: 0 }), 'Custom goal: 0')
  assert.equal(describeAdjustmentRow({ exclude: false, goal: null }), 'Custom goal: —')
})
