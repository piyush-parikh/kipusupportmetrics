import { useState, useEffect } from 'react'
import { getAllTeams, upsertTeam, copyGoalsToTeam } from '../../lib/api'
import Modal from '../../components/Modal'
import { useAuth } from '../../lib/useAuth'
import { toMessage } from '../../lib/errors'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AdminTeams() {
  const { isAdmin } = useAuth()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [copyFrom, setCopyFrom] = useState('')

  // APT-145: has_goals is optional. Until a Supabase admin adds the column the
  // checkbox is hidden and every active team appears on the Goals page.
  const hasGoalsSupported = rows.some((r) => 'has_goals' in r)

  const load = () => {
    setLoading(true)
    getAllTeams()
      .then(setRows)
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...editing }
      if (!hasGoalsSupported) delete payload.has_goals
      const isNew = !payload.id
      const team = await upsertTeam(payload)

      // Copying is offered only for a brand-new team, so nothing existing is
      // ever overwritten by it
      if (isNew && copyFrom) {
        const copied = await copyGoalsToTeam({ fromTeamId: copyFrom, toTeamId: team.id, startDate: todayISO() })
        const source = rows.find((r) => String(r.id) === String(copyFrom))
        try {
          localStorage.setItem(
            'ktp_goals_notice',
            copied
              ? `${team.group_name} goals were copied from ${source?.group_name ?? 'the selected team'}. Edit or end any that don't apply.`
              : `${source?.group_name ?? 'That team'} has no goals running today, so ${team.group_name} starts with none.`,
          )
        } catch { /* storage unavailable — the copy still happened */ }
      }

      setEditing(null)
      setCopyFrom('')
      load()
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Teams</h1>
        <p className="page-subtitle">Manage support teams (metrics_groups)</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {!isAdmin && <div className="view-only-note">View only. Ask an administrator to make changes.</div>}
      {isAdmin && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-primary" onClick={() => { setCopyFrom(''); setEditing({
            group_key: '', group_name: '', active: true, display_order: 0, has_goals: true,
          }) }}>+ Add Team</button>
        </div>
      )}

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team Name</th>
                <th>Key</th>
                <th>Display Order</th>
                <th>Active</th>
                {hasGoalsSupported && <th>Has Goals</th>}
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.group_name}</td>
                  <td style={{ fontSize: 12, color: '#6b7a8d', fontFamily: 'monospace' }}>{r.group_key}</td>
                  <td>{r.display_order}</td>
                  <td><span style={{ color: r.active ? '#1a6e3a' : '#842029', fontWeight: 600, fontSize: 12 }}>{r.active ? 'Yes' : 'No'}</span></td>
                  {hasGoalsSupported && (
                    <td><span style={{ color: r.has_goals === false ? '#6b7a8d' : '#1a6e3a', fontWeight: 600, fontSize: 12 }}>{r.has_goals === false ? 'No' : 'Yes'}</span></td>
                  )}
                  {isAdmin && <td><button className="btn btn-sm btn-secondary" onClick={() => { setCopyFrom(''); setEditing({ ...r }) }}>Edit</button></td>}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={(hasGoalsSupported ? 5 : 4) + (isAdmin ? 1 : 0)} style={{ textAlign: 'center', padding: 32, color: '#6b7a8d' }}>No teams found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && isAdmin && (
        <Modal
          title={editing.id ? `Edit Team: ${editing.group_name}` : 'Add Team'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Team Name</label>
            <input className="form-input" value={editing.group_name ?? ''} onChange={(e) => setEditing({ ...editing, group_name: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Key</label>
              <input className="form-input" value={editing.group_key ?? ''} onChange={(e) => setEditing({ ...editing, group_key: e.target.value })} placeholder="snake_case_key" />
            </div>
            <div className="form-group">
              <label className="form-label">Display Order</label>
              <input className="form-input" type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
            Active
          </label>
          {hasGoalsSupported && (
            <label style={{ display: 'flex', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 8, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={editing.has_goals !== false} onChange={(e) => setEditing({ ...editing, has_goals: e.target.checked })} style={{ marginTop: 3 }} />
              <span>
                Has goals
                <div style={{ fontSize: 12, color: '#6b7a8d' }}>Shows this team on the Goals page. Uncheck for teams like Leadership.</div>
              </span>
            </label>
          )}

          {!editing.id && (
            <div style={{ marginTop: 16, borderTop: '1px solid #e2e6ea', paddingTop: 14 }}>
              <div className="form-group" style={{ marginBottom: 4 }}>
                <label className="form-label">Copy goals from <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
                <select className="form-select" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                  <option value="">None (start with no goals)</option>
                  {rows.filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.group_name}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: '#6b7a8d' }}>
                Copies every goal that team is running today. Edit or end any that don&apos;t apply on the Goals page.
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
