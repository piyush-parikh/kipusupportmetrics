import { useState, useEffect, useMemo } from 'react'
import { getAllNotes, upsertAgentMonthNote, getAllAgents, getAllMetricDefinitions } from '../../lib/api'
import Modal from '../../components/Modal'
import { recentMonths } from '../../lib/format'
import { parseNoteAdjustments, serializeNoteWithAdjustments, describeAdjustment } from '../../lib/adjustments'
import { toMessage } from '../../lib/errors'

export default function AdminNotes() {
  const months = recentMonths(18)
  const [rows, setRows]       = useState([])
  const [agents, setAgents]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)

  const [supervisors, setSupervisors] = useState([])
  const [agentFilter, setAgentFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')

  const [metricNames, setMetricNames] = useState({})

  useEffect(() => {
    getAllAgents().then((all) => setSupervisors(all.filter((a) => a.role === 'Supervisor' && a.active))).catch(() => {})
    getAllMetricDefinitions().then((defs) => {
      const m = {}
      defs.forEach((d) => { m[d.metric_key] = d.metric_name })
      setMetricNames(m)
    }).catch(() => {})
  }, [])

  const load = () => {
    setLoading(true)
    Promise.all([
      getAllNotes({ agentId: agentFilter || undefined, month: monthFilter || undefined }),
      getAllAgents(),
    ])
      .then(([n, a]) => { setRows(n); setAgents(a) })
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [agentFilter, monthFilter])

  const save = async () => {
    setSaving(true)
    try {
      await upsertAgentMonthNote({
        agentId: Number(editing.agent_id),
        noteMonth: editing.metric_month,
        // Editing here only touches the note text — any metric adjustments
        // recorded on this note are preserved as-is
        noteText: serializeNoteWithAdjustments(editing.note_text, editing._adjustments),
        createdBy: editing.created_by || 'admin',
      })
      setEditing(null)
      load()
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // Split every note into its written part and its metric adjustments
  const parsedRows = useMemo(() => rows.map((r) => {
    const { cleanNote, adjustments } = parseNoteAdjustments(r.note_text)
    return { ...r, cleanNote, adjustmentList: Object.values(adjustments), _adjustments: adjustments }
  }), [rows])

  const adjustmentRows = useMemo(() => parsedRows.flatMap((r) =>
    r.adjustmentList.map((adj) => ({
      key: `${r.id}:${adj.metric_key}`,
      agent: r.metrics_agents?.agent_name ?? r.agent_id,
      month: r.metric_month?.slice(0, 7) ?? '—',
      metric: metricNames[adj.metric_key] ?? adj.metric_key,
      change: describeAdjustment(adj),
      reason: adj.reason ?? '—',
      by: adj.by ?? '—',
    }))
  ), [parsedRows, metricNames])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Supervisor Notes</h1>
        <p className="page-subtitle">Monthly notes by agent</p>
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
          <button className="btn btn-primary" onClick={() => setEditing({
            agent_id: agentFilter || '',
            metric_month: monthFilter ? `${monthFilter}-01` : '',
            note_text: '',
            created_by: 'admin',
          })}>+ Add Note</button>
        </div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <>
          <div className="section-title">Supervisor Notes</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Month</th>
                  <th>Note</th>
                  <th>Created By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.metrics_agents?.agent_name ?? r.agent_id}</td>
                    <td style={{ fontSize: 12 }}>{r.metric_month?.slice(0, 7) ?? '—'}</td>
                    <td style={{ fontSize: 12, maxWidth: 400 }}>
                      {r.cleanNote || <span style={{ color: '#adb5bd', fontStyle: 'italic' }}>{r.adjustmentList.length ? '(no written note — has metric adjustments)' : ''}</span>}
                    </td>
                    <td style={{ fontSize: 12, color: '#6b7a8d' }}>{r.created_by ?? '—'}</td>
                    <td><button className="btn btn-sm btn-secondary" onClick={() => setEditing({ ...r, metrics_agents: undefined, note_text: r.cleanNote })}>Edit</button></td>
                  </tr>
                ))}
                {parsedRows.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#6b7a8d' }}>No notes found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* APT-88: adjustments recorded from the Agent Performance page, tracked separately */}
          <div className="section-title">Metric Adjustments</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Month</th>
                  <th>Metric</th>
                  <th>Adjustment</th>
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
          title={editing.id ? 'Edit Note' : 'Add Note'}
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
              <label className="form-label">Month</label>
              <select className="form-select" value={editing.metric_month?.slice(0, 7) ?? ''} onChange={(e) => setEditing({ ...editing, metric_month: e.target.value ? `${e.target.value}-01` : '' })}>
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
              value={editing.note_text ?? ''}
              onChange={(e) => setEditing({ ...editing, note_text: e.target.value })}
              placeholder="Supervisor note for this agent and month…"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Created By</label>
            <select className="form-select" value={editing.created_by ?? ''} onChange={(e) => setEditing({ ...editing, created_by: e.target.value })}>
              <option value="">— Select supervisor —</option>
              {supervisors.map((s) => <option key={s.id} value={s.agent_name}>{s.agent_name}</option>)}
            </select>
          </div>
        </Modal>
      )}
    </div>
  )
}
