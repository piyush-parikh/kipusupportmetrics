// APT-154: run with `npm test`. These pin the Team Dashboard's
// Supervisor / Team Lead filter: what the dropdown offers, what it keeps, and
// what happens when a saved choice is no longer on offer.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSupervisorOptions, applySupervisorFilter, resolveSupervisorChoice,
  ALL, NO_SUPERVISOR,
} from './supervisorFilter.js'

const directory = [
  { id: 10, agent_name: 'Alex King', role: 'Supervisor' },
  { id: 11, agent_name: 'Beth Shaw', role: 'Team Lead' },
  { id: 12, agent_name: 'Carla Diaz', role: 'Supervisor' },
]
const agents = [
  { id: 1, agent_name: 'Tracy', supervisor_id: 10 },
  { id: 2, agent_name: 'Mindy', supervisor_id: 10 },
  { id: 3, agent_name: 'Jovana', supervisor_id: 11 },
  { id: 4, agent_name: 'Hector', supervisor_id: null },
]

test('All is always first and keeps every agent', () => {
  const options = buildSupervisorOptions(agents, directory)
  assert.equal(options[0].value, ALL)
  assert.equal(options[0].label, 'All')
  assert.deepEqual(applySupervisorFilter(agents, ALL), agents)
  assert.deepEqual(applySupervisorFilter(agents, ''), agents)
})

test('one supervisor keeps only their agents', () => {
  const kept = applySupervisorFilter(agents, '10')
  assert.deepEqual(kept.map((a) => a.agent_name), ['Tracy', 'Mindy'])
})

test('a numeric id and its string form both match', () => {
  assert.equal(applySupervisorFilter([{ id: 1, supervisor_id: 10 }], '10').length, 1)
  assert.equal(applySupervisorFilter([{ id: 1, supervisor_id: '10' }], '10').length, 1)
})

test('(No supervisor) is offered only when such an agent exists, and keeps just those', () => {
  const withNone = buildSupervisorOptions(agents, directory)
  assert.equal(withNone.at(-1).value, NO_SUPERVISOR)
  assert.equal(withNone.at(-1).label, '(No supervisor)')
  assert.deepEqual(applySupervisorFilter(agents, NO_SUPERVISOR).map((a) => a.agent_name), ['Hector'])

  const allSupervised = agents.filter((a) => a.supervisor_id !== null)
  const without = buildSupervisorOptions(allSupervised, directory)
  assert.equal(without.some((o) => o.value === NO_SUPERVISOR), false)
})

test('agents with no supervisor_id field at all count as (No supervisor)', () => {
  const odd = [{ id: 1, agent_name: 'NoField' }, { id: 2, agent_name: 'Empty', supervisor_id: '' }]
  const options = buildSupervisorOptions(odd, directory)
  assert.deepEqual(options.map((o) => o.value), [ALL, NO_SUPERVISOR])
  assert.deepEqual(applySupervisorFilter(odd, NO_SUPERVISOR).map((a) => a.agent_name), ['NoField', 'Empty'])
})

test('the role is shown in brackets only when the list mixes both roles', () => {
  // Alex (Supervisor) and Beth (Team Lead) both appear → roles disambiguate
  const mixed = buildSupervisorOptions(agents, directory).map((o) => o.label)
  assert.deepEqual(mixed, ['All', 'Alex King (Supervisor)', 'Beth Shaw (Team Lead)', '(No supervisor)'])

  // Only Supervisors in view → the word adds nothing, so it is left off
  const supervisorsOnly = [
    { id: 1, supervisor_id: 10 },
    { id: 2, supervisor_id: 12 },
  ]
  assert.deepEqual(
    buildSupervisorOptions(supervisorsOnly, directory).map((o) => o.label),
    ['All', 'Alex King', 'Carla Diaz'],
  )
})

test('options are sorted by name regardless of input order', () => {
  const shuffled = [
    { id: 3, supervisor_id: 12 },
    { id: 1, supervisor_id: 11 },
    { id: 2, supervisor_id: 10 },
  ]
  assert.deepEqual(
    buildSupervisorOptions(shuffled, directory).map((o) => o.label),
    ['All', 'Alex King (Supervisor)', 'Beth Shaw (Team Lead)', 'Carla Diaz (Supervisor)'],
  )
})

test('a supervisor missing from the directory still gets a usable label', () => {
  const orphan = [{ id: 1, supervisor_id: 99 }]
  assert.deepEqual(buildSupervisorOptions(orphan, directory).map((o) => o.label), ['All', 'Supervisor #99'])
})

test('an empty agent list offers only All', () => {
  assert.deepEqual(buildSupervisorOptions([], directory), [{ value: ALL, label: 'All' }])
  assert.deepEqual(buildSupervisorOptions(null, null), [{ value: ALL, label: 'All' }])
  assert.deepEqual(applySupervisorFilter([], '10'), [])
  assert.deepEqual(applySupervisorFilter(null, '10'), [])
})

test('a choice that is no longer on offer falls back to All', () => {
  const options = buildSupervisorOptions(agents, directory)
  assert.equal(resolveSupervisorChoice('10', options), '10', 'still offered → kept')
  assert.equal(resolveSupervisorChoice(NO_SUPERVISOR, options), NO_SUPERVISOR)
  assert.equal(resolveSupervisorChoice('99', options), ALL, 'not offered → All')
  assert.equal(resolveSupervisorChoice('', options), ALL)
  assert.equal(resolveSupervisorChoice(null, options), ALL)
  assert.equal(resolveSupervisorChoice('10', []), ALL, 'no options at all → All')
})

test('(No supervisor) resets once every agent has one', () => {
  const supervised = agents.filter((a) => a.supervisor_id !== null)
  const options = buildSupervisorOptions(supervised, directory)
  assert.equal(resolveSupervisorChoice(NO_SUPERVISOR, options), ALL)
})

test('null and undefined agents in the list are ignored, not crashed on', () => {
  const messy = [null, { id: 1, supervisor_id: 10 }, undefined]
  assert.deepEqual(buildSupervisorOptions(messy, directory).map((o) => o.value), [ALL, '10'])
  assert.deepEqual(applySupervisorFilter(messy, '10').map((a) => a.id), [1])
})
