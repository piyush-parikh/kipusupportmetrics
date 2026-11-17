// APT-155: run with `npm test`. These pin the rules that decide whether a
// metric is shown for a team, because getting them wrong changes people's
// ratings for every month.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExclusionIndex, isMetricApplicable, filterMetricsForTeams,
  excludedTeamIdsForMetric, diffExclusions, EMPTY_EXCLUSIONS,
} from './metricApplicability.js'

const metrics = [
  { id: 1, metric_key: 'csat', metric_name: 'CSAT %' },
  { id: 2, metric_key: 'sla', metric_name: 'Overall SLA %' },
  { id: 3, metric_key: 'articles', metric_name: 'Articles Created' },
]

test('no exclusions at all — every metric applies to every team', () => {
  const index = buildExclusionIndex([])
  assert.equal(isMetricApplicable(1, [10], index), true)
  assert.equal(isMetricApplicable(1, [10, 11], index), true)
  assert.deepEqual(filterMetricsForTeams(metrics, [10], index), metrics)
  assert.deepEqual(filterMetricsForTeams(metrics, [10], EMPTY_EXCLUSIONS), metrics)
})

test('one team excluded — hidden for that team, kept for the others', () => {
  const index = buildExclusionIndex([{ group_id: 10, metric_id: 2 }])
  assert.equal(isMetricApplicable(2, [10], index), false)
  assert.equal(isMetricApplicable(2, [11], index), true)
  assert.equal(isMetricApplicable(1, [10], index), true)
  assert.deepEqual(
    filterMetricsForTeams(metrics, [10], index).map((m) => m.metric_key),
    ['csat', 'articles'],
  )
})

test('an agent on two teams keeps a metric only one of them has turned off', () => {
  const index = buildExclusionIndex([{ group_id: 10, metric_id: 2 }])
  assert.equal(isMetricApplicable(2, [10, 11], index), true)
  assert.equal(isMetricApplicable(2, [11, 10], index), true, 'order makes no difference')
})

test('an agent on two teams that both turned it off loses the metric', () => {
  const index = buildExclusionIndex([
    { group_id: 10, metric_id: 2 },
    { group_id: 11, metric_id: 2 },
  ])
  assert.equal(isMetricApplicable(2, [10, 11], index), false)
  assert.deepEqual(
    filterMetricsForTeams(metrics, [10, 11], index).map((m) => m.id),
    [1, 3],
  )
})

test('no team known — nothing is hidden', () => {
  const index = buildExclusionIndex([
    { group_id: 10, metric_id: 2 },
    { group_id: 11, metric_id: 2 },
  ])
  assert.equal(isMetricApplicable(2, [], index), true)
  assert.equal(isMetricApplicable(2, null, index), true)
  assert.equal(isMetricApplicable(2, undefined, index), true)
  assert.deepEqual(filterMetricsForTeams(metrics, [], index), metrics)
})

test('ids match whether they arrive as numbers or as text', () => {
  const index = buildExclusionIndex([{ group_id: '10', metric_id: '2' }])
  assert.equal(isMetricApplicable(2, [10], index), false, 'number ids against stored text')
  assert.equal(isMetricApplicable('2', ['10'], index), false, 'text against text')
  assert.equal(isMetricApplicable(2, ['10'], index), false)
  assert.equal(isMetricApplicable('2', [10], index), false)

  const numeric = buildExclusionIndex([{ group_id: 10, metric_id: 2 }])
  assert.equal(isMetricApplicable('2', ['10'], numeric), false, 'text against stored numbers')
})

test('a metric nobody has turned off, and a metric with no id', () => {
  const index = buildExclusionIndex([{ group_id: 10, metric_id: 2 }])
  assert.equal(isMetricApplicable(99, [10], index), true, 'unknown metric applies')
  assert.equal(isMetricApplicable(null, [10], index), true, 'no id — keep it')
  assert.equal(isMetricApplicable(undefined, [10], index), true)
  assert.deepEqual(
    filterMetricsForTeams([{ metric_key: 'from_a_row' }], [10], index).map((m) => m.metric_key),
    ['from_a_row'],
    'a metric built from a scorecard row is always kept',
  )
})

test('rubbish rows and empty input are ignored, not crashed on', () => {
  const index = buildExclusionIndex([
    null,
    undefined,
    { group_id: null, metric_id: 2 },
    { group_id: 10, metric_id: null },
    { group_id: '', metric_id: '' },
    { group_id: 10, metric_id: 2 },
  ])
  assert.equal(isMetricApplicable(2, [10], index), false)
  assert.deepEqual(excludedTeamIdsForMetric(2, index), ['10'])
  assert.deepEqual(buildExclusionIndex(null).byMetric.size, 0)
  assert.equal(isMetricApplicable(2, [10], null), true, 'no index at all — nothing hidden')
  assert.deepEqual(filterMetricsForTeams(null, [10], index), [])
  assert.deepEqual(filterMetricsForTeams([null, undefined], [10], index), [])
})

test('the teams a metric has been turned off for', () => {
  const index = buildExclusionIndex([
    { group_id: 10, metric_id: 2 },
    { group_id: 11, metric_id: 2 },
    { group_id: 12, metric_id: 3 },
  ])
  assert.deepEqual(excludedTeamIdsForMetric(2, index).sort(), ['10', '11'])
  assert.deepEqual(excludedTeamIdsForMetric(3, index), ['12'])
  assert.deepEqual(excludedTeamIdsForMetric(1, index), [], 'never turned off anywhere')
  assert.deepEqual(excludedTeamIdsForMetric(null, index), [])
  assert.deepEqual(excludedTeamIdsForMetric(2, EMPTY_EXCLUSIONS), [])
})

test('the same pair stored twice counts once', () => {
  const index = buildExclusionIndex([
    { group_id: 10, metric_id: 2 },
    { group_id: '10', metric_id: '2' },
  ])
  assert.deepEqual(excludedTeamIdsForMetric(2, index), ['10'])
})

test('saving works out what to add', () => {
  assert.deepEqual(diffExclusions([], [10, 11]), { toInsert: ['10', '11'], toDelete: [] })
  assert.deepEqual(diffExclusions(['10'], [10, 11]), { toInsert: ['11'], toDelete: [] })
})

test('saving works out what to remove', () => {
  assert.deepEqual(diffExclusions([10, 11], [10]), { toInsert: [], toDelete: ['11'] })
  assert.deepEqual(diffExclusions([10, 11], []), { toInsert: [], toDelete: ['10', '11'] })
})

test('saving an unchanged selection changes nothing', () => {
  assert.deepEqual(diffExclusions([10, 11], [11, 10]), { toInsert: [], toDelete: [] })
  assert.deepEqual(diffExclusions(['10'], [10]), { toInsert: [], toDelete: [] }, 'text vs numbers')
})

test('saving swaps one team for another', () => {
  assert.deepEqual(diffExclusions([10], [11]), { toInsert: ['11'], toDelete: ['10'] })
})

test('saving copes with nothing on either side', () => {
  assert.deepEqual(diffExclusions([], []), { toInsert: [], toDelete: [] })
  assert.deepEqual(diffExclusions(null, null), { toInsert: [], toDelete: [] })
  assert.deepEqual(diffExclusions(undefined, [null, '', 10]), { toInsert: ['10'], toDelete: [] })
})
