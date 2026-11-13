import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getTeams, getAgents,
  getAttendanceCodes, getAttendanceFacts,
  upsertAttendance, deleteAttendance,
} from '../lib/api'

import Modal from '../components/Modal'
import { toMessage } from '../lib/errors'

// ── Date helpers ──────────────────────────────────────────────────────────────

function getAllDays(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number)
  const days = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isWeekend(d) { return d.getDay() === 0 || d.getDay() === 6 }

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// Groups days into Mon→Sun weeks (first/last week may be partial)
function getWeeks(days) {
  if (!days.length) return []
  const weeks = []
  let current = []
  days.forEach((d) => {
    if (d.getDay() === 1 && current.length > 0) { weeks.push(current); current = [] }
    current.push(d)
  })
  if (current.length) weeks.push(current)
  return weeks
}

// ── US Holiday calculator ─────────────────────────────────────────────────────

function nthWeekday(year, month, weekday, n) {
  const d = new Date(year, month - 1, 1)
  let count = 0
  while (d.getMonth() === month - 1) {
    if (d.getDay() === weekday && ++count === n) return new Date(d)
    d.setDate(d.getDate() + 1)
  }
  return null
}

function lastWeekday(year, month, weekday) {
  const d = new Date(year, month, 0)
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1)
  return new Date(d)
}

function getUSHolidays(year, targetMonth) {
  const candidates = [
    { name: "New Year's Day",              date: new Date(year, 0, 1) },
    { name: 'Martin Luther King Jr. Day',  date: nthWeekday(year, 1, 1, 3) },
    { name: "Presidents' Day",             date: nthWeekday(year, 2, 1, 3) },
    { name: 'Memorial Day',                date: lastWeekday(year, 5, 1) },
    { name: 'Juneteenth',                  date: new Date(year, 5, 19) },
    { name: 'Independence Day',            date: new Date(year, 6, 4) },
    { name: 'Labor Day',                   date: nthWeekday(year, 9, 1, 1) },
    { name: 'Veterans Day',                date: new Date(year, 10, 11) },
    { name: 'Thanksgiving Day',            date: nthWeekday(year, 11, 4, 4) },
    { name: 'Day after Thanksgiving',      date: (() => { const t = nthWeekday(year, 11, 4, 4); if (!t) return null; const d = new Date(t); d.setDate(d.getDate() + 1); return d })() },
    { name: 'Christmas Day',               date: new Date(year, 11, 25) },
  ]
  return candidates
    .filter((h) => h.date && h.date.getMonth() + 1 === targetMonth)
    .map((h) => ({ name: h.name, iso: toIso(h.date), date: h.date }))
    .sort((a, b) => a.date - b.date)
}

// ── Cell styling ──────────────────────────────────────────────────────────────

// Per-code colors matching the client's color key
const CODE_COLORS = {
  P:   '#b6e8a0',  // Present — green
  ILL: '#f89b94',  // Sick — red
  PTO: '#f9cf9b',  // Paid Time Off — orange
  H:   '#f9f3a6',  // Holiday — yellow
  BRV: '#b4abe4',  // Bereavement — purple
  O:   '#fbb6f0',  // Other — pink
  IT:  '#c8a4a5',  // Tech Issues — brown
  PD:  '#a6d5ec',  // Partial Day — blue
  LOA: '#9fd8cb',  // Leave of Absence — teal
}

function codeColor(code) {
  return CODE_COLORS[String(code ?? '').toUpperCase()] ?? null
}

function cellBg(day, iso, cell, holidayIsos) {
  const weekend = isWeekend(day)
  const holiday = holidayIsos.has(iso)
  if (cell) {
    const mapped = codeColor(cell.code)
    if (mapped) return mapped
    if (cell.counts_as_available) return weekend ? '#bbf7d0' : '#dcfce7'      // green — present
    if (cell.counts_as_scheduled) return '#fef9c3'                             // yellow — absent/pto
    return '#ede9fe'                                                           // lavender — off/holiday
  }
  if (holiday) return '#dbeafe'   // light blue — holiday column, no code
  if (weekend) return '#f3f4f6'   // gray — weekend
  return '#fff'
}

function colHeaderBg(day, iso, holidayIsos) {
  if (holidayIsos.has(iso)) return '#bfdbfe'
  if (isWeekend(day)) return '#e5e7eb'
  return '#f8f9fb'
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AttendanceEntry() {
  const [teams, setTeams]   = useState([])
  const [agents, setAgents] = useState([])
  const [codes, setCodes]   = useState([])

  // APT-82: Split month picker into year + month dropdowns
  const [attYear, setAttYear] = useState(() => {
    try { return localStorage.getItem('ktp_att_year') || String(new Date().getFullYear()) } catch { return String(new Date().getFullYear()) }
  })
  const [attMonth, setAttMonth] = useState(() => {
    try { return localStorage.getItem('ktp_att_month') || String(new Date().getMonth() + 1) } catch { return String(new Date().getMonth() + 1) }
  })
  const month = `${attYear}-${String(attMonth).padStart(2, '0')}`

  const attYearOptions = useMemo(() => {
    const cur = new Date().getFullYear()
    return [cur - 1, cur, cur + 1].map(String)
  }, [])
  const attMonthOptions = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ]

  const [groupId, setGroupId] = useState(() => { try { return localStorage.getItem('ktp_att_team') || '' } catch { return '' } })

  // APT-86: Show/hide inactive agents
  const [showInactiveAgents, setShowInactiveAgents] = useState(false)

  const [savedMap, setSavedMap]     = useState({})  // agentId:dateISO → db row
  const [pendingMap, setPendingMap] = useState({})  // agentId:dateISO → { codeId, notes } | null

  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  // Multi-select
  const [selectedAgentIds, setSelectedAgentIds] = useState(new Set())
  const [selectedDates, setSelectedDates]       = useState(new Set())
  const [bulkCodeId, setBulkCodeId]             = useState('')

  // Holiday panel
  const [showHolidays, setShowHolidays]       = useState(false)
  const [overwriteExisting, setOverwriteExisting] = useState(false)

  // Single-cell modal
  const [editCell, setEditCell] = useState(null)

  // ── Derived constants ───────────────────────────────────────────────────────

  const allDays    = useMemo(() => getAllDays(month), [month])
  const weeks      = useMemo(() => getWeeks(allDays), [allDays])
  const holidays   = useMemo(() => getUSHolidays(Number(attYear), Number(attMonth)), [attYear, attMonth])
  const holidayIsos = useMemo(() => new Set(holidays.map((h) => h.iso)), [holidays])

  const codesById = useMemo(() => {
    const m = {}; codes.forEach((c) => { m[c.id] = c }); return m
  }, [codes])

  const codeByCode = useMemo(() => {
    const m = {}; codes.forEach((c) => { m[c.code] = c }); return m
  }, [codes])

  // Effective map: pending overrides saved; null pending = deleted
  // Saved rows are raw fact rows — enrich them with their code's display fields
  const effectiveMap = useMemo(() => {
    const m = {}
    Object.entries(savedMap).forEach(([key, row]) => {
      const code = codesById[row.attendance_code_id]
      m[key] = code ? { ...code, ...row } : row
    })
    Object.entries(pendingMap).forEach(([key, val]) => {
      if (val === null) { delete m[key] }
      else {
        const code = codesById[val.codeId]
        if (code) m[key] = { ...code, notes: val.notes, isPending: true }
      }
    })
    return m
  }, [savedMap, pendingMap, codesById])

  const pendingCount = Object.keys(pendingMap).length

  // APT-86: Filtered agents for display
  const displayAgents = useMemo(
    () => showInactiveAgents ? agents : agents.filter((a) => a.active !== false),
    [agents, showInactiveAgents]
  )

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    getTeams().then(setTeams).catch((e) => setError(toMessage(e)))
    getAttendanceCodes().then(setCodes).catch((e) => setError(toMessage(e)))
  }, [])

  useEffect(() => {
    getAgents({ groupId: groupId || undefined, activeOnly: false })
      .then(setAgents)
      .catch((e) => setError(toMessage(e)))
  }, [groupId])

  const loadAttendance = useCallback(async () => {
    if (!month) return
    setLoading(true)
    setError('')
    try {
      const data = await getAttendanceFacts({ month })
      const map = {}
      data.forEach((row) => { map[`${row.agent_id}:${row.attendance_date}`] = row })
      setSavedMap(map)
      setPendingMap({})
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { loadAttendance() }, [loadAttendance])

  // Clear selections when month changes
  useEffect(() => {
    setSelectedAgentIds(new Set())
    setSelectedDates(new Set())
  }, [month])

  // ── Attendance % ────────────────────────────────────────────────────────────

  function calcPct(agentId) {
    let avail = 0, sched = 0
    allDays.forEach((d) => {
      const cell = effectiveMap[`${agentId}:${toIso(d)}`]
      if (!cell) return
      if (cell.counts_as_scheduled) sched++
      if (cell.counts_as_available) avail++
    })
    if (sched === 0) return null
    // Round to the nearest whole number (.5 and up rounds up)
    return String(Math.round(avail / sched * 100))
  }

  // ── Bulk actions ────────────────────────────────────────────────────────────

  function fillWeekdays() {
    const pCode = codeByCode['P']
    if (!pCode) { setError("No 'P' attendance code found — add a code with code='P' in Attendance Codes."); return }
    const next = { ...pendingMap }
    agents.forEach((agent) => {
      allDays.forEach((d) => {
        if (isWeekend(d)) return
        const iso = toIso(d)
        const key = `${agent.id}:${iso}`
        if (key in pendingMap || savedMap[key]) return  // don't overwrite
        next[key] = { codeId: pCode.id, notes: '' }
      })
    })
    setPendingMap(next)
  }

  function applyHoliday(dateISO, agentList) {
    const hCode = codeByCode['H']
    if (!hCode) { setError("No 'H' attendance code found — add a code with code='H' in Attendance Codes."); return }
    const next = { ...pendingMap }
    agentList.forEach((agent) => {
      const key = `${agent.id}:${dateISO}`
      const hasData = savedMap[key] || (key in pendingMap && pendingMap[key] !== null)
      if (!overwriteExisting && hasData) return
      next[key] = { codeId: hCode.id, notes: '' }
    })
    setPendingMap(next)
  }

  function bulkApply() {
    if (!bulkCodeId || !selectedAgentIds.size || !selectedDates.size) return
    const next = { ...pendingMap }
    selectedAgentIds.forEach((agentId) => {
      selectedDates.forEach((dateISO) => {
        next[`${agentId}:${dateISO}`] = { codeId: Number(bulkCodeId), notes: '' }
      })
    })
    setPendingMap(next)
  }

  function bulkClear() {
    if (!selectedAgentIds.size || !selectedDates.size) return
    const next = { ...pendingMap }
    selectedAgentIds.forEach((agentId) => {
      selectedDates.forEach((dateISO) => {
        const key = `${agentId}:${dateISO}`
        savedMap[key] ? (next[key] = null) : (delete next[key])
      })
    })
    setPendingMap(next)
  }

  // Single cell pending update (from modal)
  function applyCell(agentId, dateISO, codeId, notes) {
    const key = `${agentId}:${dateISO}`
    const next = { ...pendingMap }
    if (codeId === null) {
      savedMap[key] ? (next[key] = null) : (delete next[key])
    } else {
      next[key] = { codeId, notes: notes || '' }
    }
    setPendingMap(next)
    setEditCell(null)
  }

  // ── Save / Clear ────────────────────────────────────────────────────────────

  async function saveAll() {
    if (!pendingCount) return
    setSaving(true)
    setError('')
    try {
      const toUpsert = []
      const toDelete = []
      Object.entries(pendingMap).forEach(([key, val]) => {
        const [agentIdStr, dateISO] = key.split(':')
        const agentId = Number(agentIdStr)
        const agent = agents.find((a) => a.id === agentId)
        if (val === null) {
          toDelete.push({ attendanceDate: dateISO, agentId })
        } else {
          toUpsert.push({
            attendance_date: dateISO,
            agent_id: agentId,
            attendance_code_id: val.codeId,
            source: 'manual',
            notes: val.notes || null,
          })
        }
      })
      await Promise.all([
        ...toDelete.map(({ attendanceDate, agentId }) => deleteAttendance({ attendanceDate, agentId })),
        ...(toUpsert.length ? [upsertAttendance(toUpsert)] : []),
      ])
      // Verify every upserted entry actually landed in the database
      let verifyError = ''
      if (toUpsert.length) {
        const fresh = await getAttendanceFacts({ month })
        const savedKeys = new Set(fresh.map((r) => `${r.agent_id}:${r.attendance_date}`))
        const missing = toUpsert.filter((r) => !savedKeys.has(`${r.agent_id}:${r.attendance_date}`))
        if (missing.length) {
          const detail = missing
            .map((r) => `${agents.find((a) => a.id === r.agent_id)?.agent_name ?? `agent #${r.agent_id}`} on ${r.attendance_date}`)
            .join('; ')
          verifyError = `These entries did NOT save: ${detail}. Please report this exact message.`
        }
      }
      if (verifyError) {
        setError(verifyError)
      } else {
        setSaveMsg(`Saved ${pendingCount} change${pendingCount !== 1 ? 's' : ''}.`)
        setTimeout(() => setSaveMsg(''), 4000)
      }
      await loadAttendance()
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // ── Selection helpers ───────────────────────────────────────────────────────

  function toggleAgent(agentId) {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev)
      next.has(agentId) ? next.delete(agentId) : next.add(agentId)
      return next
    })
  }

  function toggleDate(iso) {
    setSelectedDates((prev) => {
      const next = new Set(prev)
      next.has(iso) ? next.delete(iso) : next.add(iso)
      return next
    })
  }

  function toggleAllAgents() {
    if (selectedAgentIds.size === displayAgents.length) {
      setSelectedAgentIds(new Set())
    } else {
      setSelectedAgentIds(new Set(displayAgents.map((a) => a.id)))
    }
  }

  function toggleWeek(weekDays) {
    const isos = weekDays.map(toIso)
    const allSelected = isos.every((iso) => selectedDates.has(iso))
    setSelectedDates((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        isos.forEach((iso) => next.delete(iso))
      } else {
        isos.forEach((iso) => next.add(iso))
      }
      return next
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const editCellCurrent = editCell
    ? effectiveMap[`${editCell.agentId}:${editCell.dateISO}`] ?? null
    : null

  const selectedAgentsArray = agents.filter((a) => selectedAgentIds.has(a.id))
  const hasSelections = selectedAgentIds.size > 0 && selectedDates.size > 0

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Attendance Entry</h1>
        <p className="page-subtitle">Monthly worksheet — fill weekdays then edit exceptions</p>
      </div>

      {error   && <div className="error-msg">{error}</div>}
      {saveMsg && <div className="success-msg">{saveMsg}</div>}

      {/* Filter bar */}
      <div className="filter-bar">
        {/* APT-82: Year + Month dropdowns */}
        <div className="filter-group">
          <label className="filter-label">Year</label>
          <select className="filter-select" style={{ minWidth: 90 }} value={attYear} onChange={(e) => { setAttYear(e.target.value); try { localStorage.setItem('ktp_att_year', e.target.value) } catch {} }}>
            {attYearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Month</label>
          <select className="filter-select" value={attMonth} onChange={(e) => { setAttMonth(e.target.value); try { localStorage.setItem('ktp_att_month', e.target.value) } catch {} }}>
            {attMonthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Team</label>
          <select className="filter-select" value={groupId} onChange={(e) => { setGroupId(e.target.value); try { localStorage.setItem('ktp_att_team', e.target.value) } catch {} }}>
            <option value="">All Teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.group_name}</option>)}
          </select>
        </div>
        {/* APT-86: Show inactive agents toggle */}
        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: '#6b7a8d', paddingTop: 18 }}>
            <input type="checkbox" checked={showInactiveAgents} onChange={(e) => setShowInactiveAgents(e.target.checked)} />
            Show inactive
          </label>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={fillWeekdays} disabled={loading || saving}>
          Fill Blank Weekdays as Present
        </button>
        <button
          className="btn btn-primary"
          onClick={saveAll}
          disabled={saving || !pendingCount}
        >
          {saving ? 'Saving…' : `Save All Changes${pendingCount ? ` (${pendingCount})` : ''}`}
        </button>
        {pendingCount > 0 && (
          <button className="btn btn-secondary" onClick={() => setPendingMap({})}>
            Clear Unsaved Changes
          </button>
        )}
        <button
          className="btn btn-secondary"
          onClick={() => setShowHolidays((v) => !v)}
          style={{ marginLeft: 'auto' }}
        >
          {showHolidays ? 'Hide Holidays' : 'US Holidays This Month'}
          {holidays.length > 0 && (
            <span style={{ marginLeft: 6, background: '#bfdbfe', color: '#1e40af', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
              {holidays.length}
            </span>
          )}
        </button>
      </div>


      {/* Holiday panel */}
      {showHolidays && (
        <HolidayPanel
          holidays={holidays}
          agents={displayAgents}
          selectedAgents={selectedAgentsArray}
          overwriteExisting={overwriteExisting}
          setOverwriteExisting={setOverwriteExisting}
          onApply={applyHoliday}
        />
      )}

      {/* Bulk apply panel — shown when agent+date selections exist */}
      {(selectedAgentIds.size > 0 || selectedDates.size > 0) && (
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8,
          padding: '10px 16px', marginBottom: 12, display: 'flex', flexWrap: 'wrap',
          gap: 10, alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: '#0369a1', fontWeight: 600 }}>
            {selectedAgentIds.size} agent{selectedAgentIds.size !== 1 ? 's' : ''} ×{' '}
            {selectedDates.size} date{selectedDates.size !== 1 ? 's' : ''} selected
          </span>
          {selectedDates.size === 0 && (
            <span style={{ fontSize: 12, color: '#0369a1', fontStyle: 'italic' }}>
              — click any cell in the grid to select dates
            </span>
          )}
          <select
            className="filter-select"
            style={{ minWidth: 200 }}
            value={bulkCodeId}
            onChange={(e) => setBulkCodeId(e.target.value)}
          >
            <option value="">Select code to apply…</option>
            {codes.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.code_name}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={bulkApply}
            disabled={!hasSelections || !bulkCodeId}
          >
            Apply to Selected Cells
          </button>
          <button
            className="btn btn-danger"
            onClick={bulkClear}
            disabled={!hasSelections}
          >
            Clear Selected Cells
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => { setSelectedAgentIds(new Set()); setSelectedDates(new Set()) }}
          >
            Clear Selection
          </button>
        </div>
      )}

      {displayAgents.length === 0 && !loading && (
        <div className="empty-state">
          <h3>No assigned agents found</h3>
          <p>Select an organization or group to see agents.</p>
        </div>
      )}

      {loading && <div className="loading">Loading…</div>}

      {!loading && displayAgents.length > 0 && (
        <div className="att-grid" style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              {/* Week number row */}
              <tr>
                <th rowSpan={2} style={{ padding: '4px 6px', textAlign: 'left', minWidth: 30, background: '#f8f9fb', position: 'sticky', left: 0, zIndex: 3 }}>
                  <input
                    type="checkbox"
                    checked={displayAgents.length > 0 && selectedAgentIds.size === displayAgents.length}
                    onChange={toggleAllAgents}
                    title="Select all agents"
                  />
                </th>
                <th rowSpan={2} style={{ padding: '4px 8px', textAlign: 'left', minWidth: 150, background: '#f8f9fb', position: 'sticky', left: 30, zIndex: 3, whiteSpace: 'nowrap' }}>
                  Agent
                </th>
                {weeks.map((weekDays, i) => {
                  const isos = weekDays.map(toIso)
                  const allSelected = isos.length > 0 && isos.every((iso) => selectedDates.has(iso))
                  return (
                    <th
                      key={`wk-${i}`}
                      colSpan={weekDays.length}
                      onClick={() => toggleWeek(weekDays)}
                      title={`Click to ${allSelected ? 'deselect' : 'select'} all days in Week ${i + 1}`}
                      style={{
                        textAlign: 'center', cursor: 'pointer', userSelect: 'none',
                        background: allSelected ? '#3b82f6' : '#dbeafe',
                        color: allSelected ? '#fff' : '#1e40af',
                        fontWeight: 700, fontSize: 10,
                        padding: '3px 0',
                        borderBottom: '1px solid #bfdbfe',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Week {i + 1}
                    </th>
                  )
                })}
                <th rowSpan={2} style={{ padding: '4px 6px', textAlign: 'center', minWidth: 58, background: '#f8f9fb', whiteSpace: 'nowrap' }}>
                  Att %
                </th>
              </tr>
              {/* Day columns row */}
              <tr>
                {allDays.map((d) => {
                  const iso = toIso(d)
                  const bg = colHeaderBg(d, iso, holidayIsos)
                  const isSelected = selectedDates.has(iso)
                  return (
                    <th
                      key={iso}
                      style={{ padding: '2px 1px', textAlign: 'center', minWidth: 34, maxWidth: 34, background: bg, cursor: 'pointer', userSelect: 'none', outline: isSelected ? '2px solid #3b82f6' : 'none' }}
                      onClick={() => toggleDate(iso)}
                      title={`${iso} — click to select column`}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}>{d.getDate()}</div>
                      <div style={{ fontSize: 9, color: '#6b7a8d', lineHeight: 1 }}>{DOW[d.getDay()]}</div>
                      {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', margin: '2px auto 0' }} />}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {displayAgents.map((agent) => {
                const pct = calcPct(agent.id)
                const rowSelected = selectedAgentIds.has(agent.id)
                return (
                  <tr key={agent.id} style={{ background: rowSelected ? '#eff6ff' : undefined }}>
                    {/* Agent checkbox */}
                    <td style={{ padding: '2px 6px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', position: 'sticky', left: 0, background: rowSelected ? '#eff6ff' : '#fff', zIndex: 1 }}>
                      <input
                        type="checkbox"
                        checked={rowSelected}
                        onChange={() => toggleAgent(agent.id)}
                      />
                    </td>
                    {/* Agent name */}
                    <td style={{ padding: '2px 8px', fontWeight: 500, whiteSpace: 'nowrap', fontSize: 12, borderBottom: '1px solid #f3f4f6', position: 'sticky', left: 30, background: rowSelected ? '#eff6ff' : '#fff', zIndex: 1 }}>
                      {agent.agent_name}
                    </td>
                    {/* Day cells */}
                    {allDays.map((d) => {
                      const iso = toIso(d)
                      const key = `${agent.id}:${iso}`
                      const cell = effectiveMap[key]
                      const isPending = key in pendingMap
                      const dateSelected = selectedDates.has(iso)
                      const bg = cellBg(d, iso, cell, holidayIsos)
                      return (
                        <td
                          key={iso}
                          style={{
                            padding: 1,
                            borderBottom: '1px solid #f3f4f6',
                            background: dateSelected ? '#dbeafe' : undefined,
                          }}
                        >
                          <button
                            onClick={() => selectedAgentIds.size > 0 ? toggleDate(iso) : setEditCell({ agentId: agent.id, dateISO: iso, date: d, agent })}
                            title={selectedAgentIds.size > 0 ? `Click to ${selectedDates.has(iso) ? 'deselect' : 'select'} ${iso} for bulk apply` : (cell ? `${cell.code} — ${cell.code_name}${isPending ? ' (unsaved)' : ''}` : iso)}
                            style={{
                              width: '100%',
                              minWidth: 30,
                              height: 26,
                              border: isPending ? '2px solid #f59e0b' : '1px solid #e2e6ea',
                              borderRadius: 3,
                              background: bg,
                              cursor: 'pointer',
                              fontSize: 10,
                              fontWeight: cell ? 700 : 400,
                              color: cell ? '#1a1a2e' : '#cbd5e1',
                              padding: 0,
                              position: 'relative',
                            }}
                          >
                            {cell ? cell.code : (isWeekend(d) ? '' : '·')}
                            {isPending && (
                              <span style={{
                                position: 'absolute', top: 1, right: 1,
                                width: 4, height: 4, borderRadius: '50%',
                                background: '#f59e0b',
                              }} />
                            )}
                          </button>
                        </td>
                      )
                    })}
                    {/* Att % */}
                    <td style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #f3f4f6', color: pct === null ? '#adb5bd' : pct >= 90 ? '#1a6e3a' : pct >= 75 ? '#854d0e' : '#842029', fontSize: 12 }}>
                      {pct !== null ? `${pct}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Color key — one entry per attendance code, plus unsaved-change marker */}
      {!loading && displayAgents.length > 0 && codes.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: '#6b7a8d', flexWrap: 'wrap' }}>
          {codes.map((c) => (
            <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 14, height: 14, background: codeColor(c.code) ?? '#e5e7eb', border: '1px solid #e2e6ea', borderRadius: 2, display: 'inline-block' }} />
              {c.code_name} — <strong>{c.code}</strong>
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 14, background: '#fff', border: '2px solid #f59e0b', borderRadius: 2, display: 'inline-block' }} /> Unsaved change
          </span>
        </div>
      )}

      {/* Single-cell modal */}
      {editCell && (
        <CellModal
          agent={editCell.agent}
          date={editCell.date}
          dateISO={editCell.dateISO}
          codes={codes}
          current={editCellCurrent}
          hasSaved={!!savedMap[`${editCell.agentId}:${editCell.dateISO}`]}
          onApply={applyCell}
          onClose={() => setEditCell(null)}
        />
      )}
    </div>
  )
}

// ── Holiday panel ─────────────────────────────────────────────────────────────

function HolidayPanel({ holidays, agents, selectedAgents, overwriteExisting, setOverwriteExisting, onApply }) {
  if (holidays.length === 0) {
    return (
      <div style={{ background: '#f8f9fb', border: '1px solid #e2e6ea', borderRadius: 8, padding: '12px 16px', marginBottom: 12, fontSize: 13, color: '#6b7a8d' }}>
        No US holidays fall in this month.
      </div>
    )
  }

  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>US Holidays This Month</span>
        <span style={{ fontSize: 11, color: '#6b7a8d' }}>Applies code: <strong>H</strong></span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={overwriteExisting} onChange={(e) => setOverwriteExisting(e.target.checked)} />
          Overwrite existing entries
        </label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {holidays.map((h) => (
          <div key={h.iso} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
            <span style={{ minWidth: 200, fontWeight: 500 }}>{h.name}</span>
            <span style={{ color: '#6b7a8d', minWidth: 90 }}>{h.iso}</span>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => onApply(h.iso, selectedAgents)}
              disabled={selectedAgents.length === 0}
              title={selectedAgents.length === 0 ? 'Check agent rows first to use this option' : ''}
            >
              Apply to {selectedAgents.length > 0 ? `${selectedAgents.length} selected` : 'selected'}
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => onApply(h.iso, agents)}
            >
              Apply to all {agents.length} agents
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Single-cell modal ─────────────────────────────────────────────────────────

function CellModal({ agent, date, dateISO, codes, current, hasSaved, onApply, onClose }) {
  // pending cells have code's own `id`; saved DB rows have `attendance_code_id`
  const initialCodeId = current
    ? (current.isPending ? String(current.id) : String(current.attendance_code_id ?? ''))
    : ''
  const [codeId, setCodeId] = useState(initialCodeId)
  const [notes, setNotes]   = useState(current?.notes ?? '')

  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <Modal
      title={`Attendance — ${agent.agent_name}`}
      onClose={onClose}
      footer={
        <>
          {(current || hasSaved) && (
            <button className="btn btn-danger" onClick={() => onApply(agent.id, dateISO, null, '')}>
              Clear Entry
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onApply(agent.id, dateISO, codeId ? Number(codeId) : null, notes)}
            disabled={!codeId}
          >
            Apply
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: '#6b7a8d', marginBottom: 16 }}>{dateLabel}</p>
      {current?.isPending && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
          Unsaved change — click Save All Changes to persist.
        </div>
      )}
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label className="form-label">Attendance Code</label>
        <select className="form-select" value={codeId} onChange={(e) => setCodeId(e.target.value)}>
          <option value="">Select a code…</option>
          {codes.map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.code_name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Notes (optional)</label>
        <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
    </Modal>
  )
}
