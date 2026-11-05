import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAllAgents, upsertAgent, autoDeactivateExpiredAgents, getAgentTeamAssignments, deleteTeamAssignment, getTeams, upsertTeamAssignment } from '../../lib/api'
import Modal from '../../components/Modal'
import DateInput from '../../components/DateInput'
import { formatDateUS } from '../../lib/format'
import { useAuth } from '../../lib/useAuth'
import { toMessage } from '../../lib/errors'

export default function AdminAgents() {
  const { isAdmin } = useAuth()
  const [allRows, setAllRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)

  const [search, setSearch]           = useState('')
  const [activeFilter, setActiveFilter] = useState('active')
  const [searchParams]                  = useSearchParams()

  const [agentAssignments, setAgentAssignments] = useState([])
  const [teams, setTeams] = useState([])
  const [newAssignTeamId, setNewAssignTeamId] = useState('')
  const [newAssignMonth, setNewAssignMonth] = useState('')

  const load = async () => {
    setLoading(true)
    // APT-149: this is an UPDATE on metrics_agents, so only an admin runs it
    if (isAdmin) {
      try {
        await autoDeactivateExpiredAgents()
      } catch (_) {
        // Column may not exist yet — silently skip
      }
    }
    try {
      const rows = await getAllAgents()
      setAllRows(rows)
      const deepId = searchParams.get('agent')
      if (deepId) {
        const target = rows.find((r) => String(r.id) === deepId)
        if (target) setEditing({ ...target })
      }
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Load teams once on mount
  useEffect(() => {
    getTeams().then(setTeams).catch(() => {})
  }, [])

  // Load agent team assignments when editing changes
  useEffect(() => {
    if (editing?.id) {
      getAgentTeamAssignments(editing.id).then(setAgentAssignments).catch(() => {})
    } else {
      setAgentAssignments([])
    }
  }, [editing?.id])

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...editing }
      if (payload.hire_date === '') payload.hire_date = null
      if (payload.go_live_date === '') payload.go_live_date = null
      if (payload.employment_end_date === '') payload.employment_end_date = null
      if (payload.employment_end_date) {
        const today = new Date().toISOString().slice(0, 10)
        if (payload.employment_end_date <= today) payload.active = false
      }
      await upsertAgent(payload)
      setEditing(null)
      load()
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // APT-148: team leads also have people reporting to them, so they appear in
  // the Reporting Supervisor/Team Lead list alongside supervisors. Supervisors
  // are listed first so the common choice stays at the top.
  const SUPERVISING_ROLES = ['Supervisor', 'Team Lead']
  const supervisors = allRows
    .filter((r) => SUPERVISING_ROLES.includes(r.role) && r.active)
    .sort((a, b) =>
      SUPERVISING_ROLES.indexOf(a.role) - SUPERVISING_ROLES.indexOf(b.role) ||
      (a.agent_name ?? '').localeCompare(b.agent_name ?? ''))

  const displayRows = allRows.filter((r) => {
    if (activeFilter === 'active' && !r.active) return false
    if (activeFilter === 'inactive' && r.active) return false
    if (search && !r.agent_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const activeCount   = allRows.filter((r) => r.active).length
  const inactiveCount = allRows.length - activeCount

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Agents</h1>
        <p className="page-subtitle">
          {allRows.length} total · {activeCount} active · {inactiveCount} inactive
        </p>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {!isAdmin && <div className="view-only-note">View only. Ask an administrator to make changes.</div>}

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <div className="filter-group">
          <label className="filter-label">Search</label>
          <input
            className="filter-select"
            style={{ minWidth: 200 }}
            placeholder="Agent name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">Status</label>
          <select className="filter-select" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        {isAdmin && (
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-primary" onClick={() => setEditing({
              agent_name: '', role: '', supervisor_id: null, hire_date: '', go_live_date: '', employment_end_date: '', notes: '', active: true,
            })}>+ Add Agent</button>
          </div>
        )}
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent Name</th>
                <th>Role</th>
                <th>Hire Date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(MM/DD/YYYY)</span></th>
                <th>Go-Live Date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(MM/DD/YYYY)</span></th>
                <th>End Date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(MM/DD/YYYY)</span></th>
                <th>Active</th>
                <th>Notes</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.agent_name}</td>
                  <td style={{ fontSize: 12, color: '#6b7a8d' }}>{r.role ?? '—'}</td>
                  <td style={{ fontSize: 12 }}>{formatDateUS(r.hire_date)}</td>
                  <td style={{ fontSize: 12 }}>{formatDateUS(r.go_live_date)}</td>
                  <td style={{ fontSize: 12, color: r.employment_end_date ? '#842029' : '#9ca3af' }}>{formatDateUS(r.employment_end_date)}</td>
                  <td><span style={{ color: r.active ? '#1a6e3a' : '#842029', fontWeight: 600, fontSize: 12 }}>{r.active ? 'Yes' : 'No'}</span></td>
                  <td style={{ fontSize: 12, color: '#6b7a8d', maxWidth: 200 }}>{r.notes ?? '—'}</td>
                  {isAdmin && <td><button className="btn btn-sm btn-secondary" onClick={() => setEditing({ ...r })}>Edit</button></td>}
                </tr>
              ))}
              {displayRows.length === 0 && (
                <tr><td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: 32, color: '#6b7a8d' }}>No agents match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && isAdmin && (
        <Modal
          title={editing.id ? `Edit Agent: ${editing.agent_name}` : 'Add Agent'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Agent Name</label>
            <input
              className="form-input"
              value={editing.agent_name ?? ''}
              onChange={(e) => setEditing({ ...editing, agent_name: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Role</label>
            <select
              className="form-select"
              value={editing.role ?? ''}
              onChange={(e) => setEditing({ ...editing, role: e.target.value })}
            >
              <option value="">— Select role —</option>
              <option value="Support Specialist">Support Specialist</option>
              <option value="PSA">PSA</option>
              <option value="Client Advocate Tier I">Client Advocate Tier I</option>
              <option value="Client Advocate Tier II">Client Advocate Tier II</option>
              <option value="Team Lead">Team Lead</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Manager">Manager</option>
              <option value="Trainer">Trainer</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Reporting Supervisor/Team Lead</label>
            <select
              className="form-select"
              value={editing.supervisor_id ?? ''}
              onChange={(e) => setEditing({ ...editing, supervisor_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">— Select supervisor or team lead —</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>{s.agent_name} ({s.role})</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Hire Date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(MM/DD/YYYY)</span></label>
              <DateInput
                value={editing.hire_date}
                onChange={(v) => setEditing({ ...editing, hire_date: v })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Go-Live Date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(MM/DD/YYYY)</span></label>
              <DateInput
                value={editing.go_live_date}
                onChange={(v) => setEditing({ ...editing, go_live_date: v })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Employment End Date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(MM/DD/YYYY)</span></label>
              <DateInput
                value={editing.employment_end_date}
                onChange={(v) => setEditing({ ...editing, employment_end_date: v })}
              />
              <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Auto-sets inactive when date passes</span>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={editing.notes ?? ''}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
            Active
          </label>

          {/* APT-75: Team assignments section */}
          {editing?.id && (
            <div style={{ marginTop: 16, borderTop: '1px solid #e2e6ea', paddingTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Team Assignments</div>
              {agentAssignments.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>No team assignments.</div>
              ) : (
                <table style={{ width: '100%', fontSize: 12, marginBottom: 10, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '3px 6px', color: '#6b7a8d', fontWeight: 600 }}>Team</th>
                      <th style={{ textAlign: 'left', padding: '3px 6px', color: '#6b7a8d', fontWeight: 600 }}>From (MM/DD/YYYY)</th>
                      <th style={{ padding: '3px 6px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentAssignments.map((a) => (
                      <tr key={a.id}>
                        <td style={{ padding: '3px 6px' }}>{a.metrics_groups?.group_name ?? '—'}</td>
                        <td style={{ padding: '3px 6px', color: '#6b7a8d' }}>{formatDateUS(a.effective_start_month)}</td>
                        <td style={{ padding: '3px 6px' }}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={async () => {
                              await deleteTeamAssignment(a.id)
                              setAgentAssignments((prev) => prev.filter((x) => x.id !== a.id))
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                  <label className="form-label">Add Team</label>
                  <select className="form-select" value={newAssignTeamId} onChange={(e) => setNewAssignTeamId(e.target.value)}>
                    <option value="">— Select —</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.group_name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
                  <label className="form-label">Effective From <span style={{ fontWeight: 400, color: '#9ca3af' }}>(MM/DD/YYYY)</span></label>
                  <DateInput
                    value={newAssignMonth}
                    onChange={(v) => setNewAssignMonth(v ?? '')}
                  />
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={!newAssignTeamId}
                  onClick={async () => {
                    try {
                      const row = await upsertTeamAssignment({
                        agent_id: editing.id,
                        group_id: Number(newAssignTeamId),
                        effective_start_month: newAssignMonth || null,
                      })
                      const team = teams.find((t) => String(t.id) === newAssignTeamId)
                      setAgentAssignments((prev) => [...prev, { ...row, metrics_groups: { group_name: team?.group_name } }])
                      setNewAssignTeamId('')
                      setNewAssignMonth('')
                    } catch (e) {
                      setError(toMessage(e))
                    }
                  }}
                  style={{ alignSelf: 'flex-end' }}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
