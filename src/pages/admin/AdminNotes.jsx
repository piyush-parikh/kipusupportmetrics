import { useState, useEffect, useMemo } from 'react'
import {
  getAllNotesVisible, getAllAdjustments, getAppUsers,
  updateNoteById, insertNoteForAuthor,
  getAllAgents, getAllMetricDefinitions,
} from '../../lib/api'
import Modal from '../../components/Modal'
import { recentMonths } from '../../lib/format'
import { describeAdjustmentRow } from '../../lib/adjustmentRows'
import { toMonthKey } from '../../lib/dates'
import { useAuth } from '../../lib/useAuth'
import { toMessage } from '../../lib/errors'

// APT-151: notes belong to whoever wrote them. The database returns a User
// only their own rows and an Admin all of them, so this page shows whatever
// comes back rather than filtering by author itself. Adjustments are shared,
// so everyone with a role sees the whole table.

// Notes copied from the old table have no account behind them until an Admin
// links one, so say so plainly rather than leaving the column blank.
function authorLabel(note, usersById) {
  if (note?.author_name) return note.author_name
  const email = usersById[note?.author_user]
  if (email) return email
  return '(not linked to an account)'
}

function formatWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminNotes() {
  const { user, email: myEmail, isAdmin } = useAuth()
  const myUserId = user?.id ?? null

  const months = recentMonths(18)
  const [notes, setNotes]     = useState([])
  const [adjRows, setAdjRows] = useState([])
  const [users, setUsers]     = useState([])
  const [agents, setAgents]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(null)   // an existing note being edited
  const [adding, setAdding]   = useState(null)   // a new note being written
  const [saving, setSaving]   = useState(false)

  const [agentFilter, setAgentFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')

  const [metricNames, setMetricNames] = useState({})

  useEffect(() => {
    getAllMetricDefinitions().then((defs) => {
      const m = {}
      defs.forEach((d) => { m[d.metric_key] = d.metric_name })
      setMetricNames(m)
    }).catch(() => {})
  }, [])

  const load = () => {
    setLoading(true)
    Promise.all([
      getAllNotesVisible(),
      getAllAdjustments({ agentId: agentFilter || undefined, month: monthFilter || undefined }),
      getAppUsers(),
      getAllAgents(),
    ])
      .then(([n, adj, u, a]) => { setNotes(n ?? []); setAdjRows(adj ?? []); setUsers(u ?? []); setAgents(a ?? []) })
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [agentFilter, monthFilter])

  const usersById = useMemo(() => {
    const m = {}
    users.forEach((u) => { if (u.user_id) m[u.user_id] = u.email })
    return m
  }, [users])

  // The notes query cannot take filters (the database decides the rows), so
  // the page's own Agent and Month filters are applied here.
  const visibleNotes = useMemo(() => notes.filter((n) => {
    if (agentFilter && String(n.agent_id) !== String(agentFilter)) return false
    if (monthFilter && toMonthKey(n.metric_month) !== monthFilter) return false
    return true
  }), [notes, agentFilter, monthFilter])

  const saveEdit = async () => {
    setSaving(true)
    try {
      await updateNoteById(editing.id, editing.note_text ?? '')
      setEditing(null)
      load()
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const saveNew = async () => {
    if (!adding.agent_id || !adding.metric_month) return
    setSaving(true)
    setError('')
    try {
      // An Admin may write on someone else's behalf; everyone else writes as
      // themselves, which is also what the database insists on.
      const authorUserId = isAdmin ? (adding.author_user || null) : myUserId
      const authorName = isAdmin
        ? (adding.author_user ? (usersById[adding.author_user] ?? null) : null)
        : (myEmail || null)
      await insertNoteForAuthor({
        agentId: Number(adding.agent_id),
        month: adding.metric_month,
        text: adding.note_text ?? '',
        authorUserId,
        authorName,
      })
      setAdding(null)
      load()
    } catch (e) {
      // The one-note-per-author-per-month rule is a unique constraint, so a
      // repeat shows as a duplicate-key failure. Say what to do instead.
      const msg = String(e?.message ?? '')
      if (e?.code === '23505' || msg.toLowerCase().includes('duplicate key')) {
        setError('You already have a note for this agent and month. Edit it instead.')
      } else {
        setError(toMessage(e))
      }
    } finally {
      setSaving(false)
    }
  }

  const adjustmentRows = useMemo(() => adjRows.map((r) => ({
    key: r.id,
    agent: r.metrics_agents?.agent_name ?? r.agent_id,
    month: toMonthKey(r.metric_month),
    metric: metricNames[r.metric_key] ?? r.metric_key,
    change: describeAdjustmentRow(r),
    reason: r.reason || '—',
    by: r.adjusted_by || '—',
  })), [adjRows, metricNames])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Notes</h1>
        <p className="page-subtitle">
          {isAdmin
            ? 'Every note, and the metric adjustments behind the ratings'
            : 'Your notes. Notes written by others are private.'}
        </p>
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
          <label className="filter-label">Month</label>
          <select className="filter-select" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">All Months</option>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={() => setAdding({
            agent_id: agentFilter || '',
            metric_month: monthFilter ? `${monthFilter}-01` : '',
            note_text: '',
            author_user: isAdmin ? '' : myUserId,
          })}>+ Add Note</button>
        </div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <>
          <div className="section-title">Notes</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Month</th>
                  <th>Note</th>
                  <th>Author</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleNotes.map((n) => (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 500 }}>{n.metrics_agents?.agent_name ?? n.agent_id}</td>
                    <td style={{ fontSize: 12 }}>{toMonthKey(n.metric_month)}</td>
                    <td style={{ fontSize: 12, maxWidth: 400, whiteSpace: 'pre-wrap' }}>{n.note_text}</td>
                    <td style={{ fontSize: 12, color: '#6b7a8d' }}>{authorLabel(n, usersById)}</td>
                    <td style={{ fontSize: 12, color: '#6b7a8d' }}>{formatWhen(n.updated_at ?? n.created_at)}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditing({ id: n.id, note_text: n.note_text ?? '' })}>Edit</button>
                    </td>
                  </tr>
                ))}
                {visibleNotes.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#6b7a8d' }}>No notes found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* APT-151: adjustments are shared — everyone with a role sees them,
              because they change the rating everyone reads */}
          <div className="section-title">Metric Adjustments</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Month</th>
                  <th>Metric</th>
                  <th>What changed</th>
                  <th>Reason</th>
                  <th>Adjusted By</th>
                </tr>
              </thead>
              <tbody>
                {adjustmentRows.map((a) => (
                  <tr key={a.key}>
                    <td style={{ fontWeight: 500 }}>{a.agent}</td>
                    <td style={{ fontSize: 12 }}>{a.month}</td>
                    <td style={{ fontSize: 12 }}>{a.metric}</td>
                    <td style={{ fontSize: 12, fontWeight: 600, color: a.change.startsWith('Excluded') ? '#842029' : '#7c3aed' }}>{a.change}</td>
                    <td style={{ fontSize: 12, maxWidth: 300 }}>{a.reason}</td>
                    <td style={{ fontSize: 12, color: '#6b7a8d' }}>{a.by}</td>
                  </tr>
                ))}
                {adjustmentRows.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#6b7a8d' }}>No metric adjustments recorded. They are made from the Agent Performance page via the Adjust button.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <Modal
          title="Edit Note"
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Note</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={editing.note_text ?? ''}
              onChange={(e) => setEditing({ ...editing, note_text: e.target.value })}
              placeholder="Note for this agent and month…"
            />
          </div>
        </Modal>
      )}

      {adding && (
        <Modal
          title="Add Note"
          onClose={() => setAdding(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setAdding(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveNew} disabled={saving || !adding.agent_id || !adding.metric_month}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Agent</label>
              <select className="form-select" value={adding.agent_id ?? ''} onChange={(e) => setAdding({ ...adding, agent_id: e.target.value })}>
                <option value="">— Select Agent —</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.agent_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Month</label>
              <select className="form-select" value={adding.metric_month?.slice(0, 7) ?? ''} onChange={(e) => setAdding({ ...adding, metric_month: e.target.value ? `${e.target.value}-01` : '' })}>
                <option value="">— Select Month —</option>
                {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Note</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={adding.note_text ?? ''}
              onChange={(e) => setAdding({ ...adding, note_text: e.target.value })}
              placeholder="Note for this agent and month…"
            />
          </div>
          {isAdmin ? (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Author</label>
              <select className="form-select" value={adding.author_user ?? ''} onChange={(e) => setAdding({ ...adding, author_user: e.target.value })}>
                <option value="">(no account)</option>
                {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.email}</option>)}
              </select>
              <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                Leave as (no account) to record a note that belongs to nobody in particular.
              </span>
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Author</label>
              <div style={{ fontSize: 13, color: '#4a5568' }}>{myEmail || '—'}</div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
