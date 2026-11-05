import { useState, useEffect, useMemo } from 'react'
import { getAllTeamAssignments, upsertTeamAssignment, getAllAgents, getAllTeams } from '../../lib/api'
import Modal from '../../components/Modal'
import DateInput from '../../components/DateInput'
import { formatDateUS } from '../../lib/format'
import { useAuth } from '../../lib/useAuth'

// APT-147: who an agent reports to lives on the agent record (supervisor_id),
// not on the assignment, so it is looked up per row. 'none' keeps agents with
// no supervisor set groupable rather than silently dropped.
function supervisorKeyOf(row, agentsById) {
  const sid = agentsById[row.agent_id]?.supervisor_id
  return sid ? String(sid) : 'none'
}

export default function AdminTeamAssignments() {
  const { isAdmin } = useAuth()
  const [rows, setRows]       = useState([])
  const [agents, setAgents]   = useState([])
  const [teams, setTeams]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)

  const [agentFilter, setAgentFilter] = useState('')
  const [teamFilter, setTeamFilter]   = useState('')
  const [supervisorFilter, setSupervisorFilter] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([getAllTeamAssignments(), getAllAgents(), getAllTeams()])
      .then(([r, a, t]) => { setRows(r); setAgents(a); setTeams(t) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...editing }
      payload.agent_id = Number(payload.agent_id)
      payload.group_id = Number(payload.group_id)
      if (payload.effective_start_month === '') payload.effective_start_month = null
      if (payload.effective_end_month === '')   payload.effective_end_month = null
      await upsertTeamAssignment(payload)
      setEditing(null)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const agentsById = useMemo(() => {
    const m = {}
    agents.forEach((a) => { m[a.id] = a })
    return m
  }, [agents])

  // The supervisor list follows the chosen team, so picking EMR offers only the
  // supervisors who actually have someone on EMR.
  const supervisorOptions = useMemo(() => {
    const ids = new Set()
    let anyUnset = false
    rows
      .filter((r) => !teamFilter || String(r.group_id) === teamFilter)
      .forEach((r) => {
        const key = supervisorKeyOf(r, agentsById)
        if (key === 'none') anyUnset = true
        else ids.add(key)
      })
    const list = [...ids]
      .map((id) => agentsById[id])
      .filter(Boolean)
      .sort((a, b) => a.agent_name.localeCompare(b.agent_name))
    return { list, anyUnset }
  }, [rows, teamFilter, agentsById])

  // Changing team can leave a supervisor selected who has nobody on that team
  const changeTeam = (next) => {
    setTeamFilter(next)
    if (!supervisorFilter) return
    const stillThere = rows.some(
      (r) => (!next || String(r.group_id) === next) && supervisorKeyOf(r, agentsById) === supervisorFilter,
    )
    if (!stillThere) setSupervisorFilter('')
  }

  const displayRows = rows.filter((r) => {
    if (agentFilter && String(r.agent_id) !== agentFilter) return false
    if (teamFilter  && String(r.group_id) !== teamFilter)  return false
    if (supervisorFilter && supervisorKeyOf(r, agentsById) !== supervisorFilter) return false
    return true
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Team Assignments</h1>
        <p className="page-subtitle">Assign agents to teams with effective date ranges</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <div className="filter-group">
          <label className="filter-label">Agent</label>
          <select className="filter-select" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
            <option value="">All Agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.agent_name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Team</label>
          <select className="filter-select" value={teamFilter} onChange={(e) => changeTeam(e.target.value)}>
            <option value="">All Teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.group_name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Reporting Supervisor/Team Lead</label>
          <select
            className="filter-select"
            style={{ minWidth: 200 }}
            value={supervisorFilter}
            onChange={(e) => setSupervisorFilter(e.target.value)}
          >
            <option value="">All Supervisors/Team Leads</option>
            {supervisorOptions.list.map((s) => (
              <option key={s.id} value={s.id}>{s.agent_name}{s.role ? ` (${s.role})` : ''}</option>
            ))}
            {supervisorOptions.anyUnset && <option value="none">— Not set —</option>}
          </select>
        </div>
        {isAdmin && (
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-primary" onClick={() => setEditing({
              agent_id: '', group_id: '', effective_start_month: '', effective_end_month: '', active: true,
            })}>+ Add Assignment</button>
          </div>
        )}
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Reporting Supervisor/Team Lead</th>
                <th>Team</th>
                <th>Start Date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(MM/DD/YYYY)</span></th>
                <th>End Date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(MM/DD/YYYY)</span></th>
                <th>Active</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.metrics_agents?.agent_name ?? r.agent_id}</td>
                  <td style={{ fontSize: 12, color: '#6b7a8d' }}>
                    {agentsById[agentsById[r.agent_id]?.supervisor_id]?.agent_name ?? '—'}
                  </td>
                  <td>{r.metrics_groups?.group_name ?? r.group_id}</td>
                  <td style={{ fontSize: 12 }}>{formatDateUS(r.effective_start_month)}</td>
                  <td style={{ fontSize: 12 }}>{formatDateUS(r.effective_end_month)}</td>
                  <td><span style={{ color: r.active ? '#1a6e3a' : '#842029', fontWeight: 600, fontSize: 12 }}>{r.active ? 'Yes' : 'No'}</span></td>
                  {isAdmin && <td><button className="btn btn-sm btn-secondary" onClick={() => setEditing({ ...r, metrics_agents: undefined, metrics_groups: undefined })}>Edit</button></td>}
                </tr>
              ))}
              {displayRows.length === 0 && (
                <tr><td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: 32, color: '#6b7a8d' }}>No assignments found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && isAdmin && (
        <Modal
          title={editing.id ? 'Edit Assignment' : 'Add Assignment'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Agent</label>
              <select className="form-select" value={editing.agent_id ?? ''} onChange={(e) => setEditing({ ...editing, agent_id: e.target.value })}>
                <option value="">— Select Agent —</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.agent_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Team</label>
              <select className="form-select" value={editing.group_id ?? ''} onChange={(e) => setEditing({ ...editing, group_id: e.target.value })}>
                <option value="">— Select Team —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.group_name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(MM/DD/YYYY)</span></label>
              <DateInput
                value={editing.effective_start_month}
                onChange={(v) => setEditing({ ...editing, effective_start_month: v })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date <span style={{ fontWeight: 400, color: '#6b7a8d' }}>(MM/DD/YYYY — leave blank if current)</span></label>
              <DateInput
                value={editing.effective_end_month}
                onChange={(v) => setEditing({ ...editing, effective_end_month: v })}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
            <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
            Active
          </label>
        </Modal>
      )}
    </div>
  )
}
