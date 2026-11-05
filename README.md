# Kipu Automated Performance Tracker

A production React app for tracking support agent performance against AB's spreadsheet-style metrics system.

---

## What It Does

| Page | Description |
|------|-------------|
| **Agent Performance** | Monthly scorecard per agent — metric rows, on/off track status, strengths, improvement areas, supervisor notes |
| **Leader Dashboard** | Team-wide rating distribution, top performers, agents needing attention |
| **Attendance Summary** | Monthly attendance % by agent and group |
| **Attendance Entry** | Weekday grid for entering daily attendance codes per agent |
| **Admin Settings** | Full CRUD for organizations, groups, agents, metrics, targets, tolerances, and attendance codes |

Ratings and on-track status used to be calculated in Supabase views, but since APT-136/137/138 the app works them out itself from the rounded figures it displays (`computeRating` in `src/lib/format.js`, `deriveStatus` in `AgentPerformance.jsx` and `LeaderDashboard.jsx`). The views still compute their own versions, which the app overrides — worth knowing when numbers disagree.

---

## Tech Stack

- **React + Vite** — frontend
- **Supabase JS client** — data layer
- **Vercel** — hosting, auto-deploys from GitHub
- **GitHub** — source control

---

## Environment Variables

Create a `.env` file (never commit it):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Set the same variables in Vercel → Project Settings → Environment Variables.

---

## Supabase Objects

**Read-only views:**
- `metrics_vw_monthly_scorecard`
- `metrics_vw_agent_month_detail`
- `metrics_vw_monthly_scored`
- `metrics_vw_attendance_daily`
- `metrics_vw_attendance_monthly`

**Editable tables:**
- `metrics_cfg_organizations`
- `metrics_cfg_external_groups`
- `metrics_cfg_agents`
- `metrics_cfg_metrics`
- `metrics_cfg_group_metric_targets`
- `metrics_cfg_group_metric_tolerances`
- `metrics_cfg_attendance_codes`
- `metrics_fact_attendance_daily`
- `metrics_agent_month_notes`

---

## MVP Status

**Working:**
- Agent Performance page with metric detail and supervisor notes
- Leader Dashboard with rating distribution and agent table
- Attendance Summary and Entry (weekday grid, code selection)
- All Admin Settings pages with inline edit modals

**Known next improvement:**
- `% Tickets Solved` should recalculate based on an agent's *current* `external_group_id` rather than the group at ticket time. Requires a Supabase view update.

---

## Deploy

```bash
# Local dev
npm install
npm run dev

# Deploy
git push origin <branch>
# Vercel picks up the push and deploys automatically
```
