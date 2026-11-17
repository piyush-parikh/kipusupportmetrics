// APT-154: the Team Dashboard's "Supervisor / Team Lead" filter.
//
// Who an agent reports to is a numeric supervisor_id on the agent record,
// pointing at another agent. These three functions turn that into a dropdown
// and apply the choice. Kept free of React and database code so the rules can
// be tested on their own.
//
// Option values are strings, because that is what a <select> hands back:
//   ''      → All
//   'none'  → agents with no supervisor recorded
//   '<id>'  → that supervisor's agents

export const ALL = ''
export const NO_SUPERVISOR = 'none'

function hasSupervisor(agent) {
  const id = agent?.supervisor_id
  return id !== null && id !== undefined && id !== ''
}

/**
 * Builds the dropdown options from the agents currently in view.
 *
 * Only people who actually supervise someone in this list are offered, so the
 * dropdown never contains a choice that would return nothing.
 *
 * @param agents    the agents in view
 * @param directory every agent, used to resolve a supervisor id to a name and
 *                  role — a supervisor is not necessarily on the same team
 * @returns [{ value, label }] — All first, names in between, No supervisor last
 */
export function buildSupervisorOptions(agents, directory = []) {
  const byId = {}
  for (const person of directory ?? []) {
    if (person?.id !== null && person?.id !== undefined) byId[String(person.id)] = person
  }

  const ids = new Set()
  let anyWithout = false
  for (const agent of agents ?? []) {
    if (!agent) continue
    if (hasSupervisor(agent)) ids.add(String(agent.supervisor_id))
    else anyWithout = true
  }

  const people = [...ids].map((id) => {
    const person = byId[id]
    return {
      value: id,
      name: person?.agent_name ?? `Supervisor #${id}`,
      role: person?.role ?? '',
    }
  })

  // The role is only worth showing when the list mixes Supervisors and Team
  // Leads — otherwise it is the same word after every name.
  const roles = new Set(people.map((p) => p.role).filter(Boolean))
  const showRole = roles.size > 1

  people.sort((a, b) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value))

  const options = [{ value: ALL, label: 'All' }]
  for (const p of people) {
    options.push({ value: p.value, label: showRole && p.role ? `${p.name} (${p.role})` : p.name })
  }
  if (anyWithout) options.push({ value: NO_SUPERVISOR, label: '(No supervisor)' })
  return options
}

/** Keeps only the agents the chosen supervisor is responsible for. */
export function applySupervisorFilter(agents, value) {
  const list = agents ?? []
  if (!value || value === ALL) return list
  if (value === NO_SUPERVISOR) return list.filter((a) => a && !hasSupervisor(a))
  return list.filter((a) => a && hasSupervisor(a) && String(a.supervisor_id) === String(value))
}

/**
 * A saved or current choice is only kept while it is still on offer — changing
 * team or month can retire a supervisor, and the filter falls back to All
 * rather than silently showing nothing.
 */
export function resolveSupervisorChoice(saved, options) {
  const available = new Set((options ?? []).map((o) => o.value))
  return available.has(saved) ? saved : ALL
}
