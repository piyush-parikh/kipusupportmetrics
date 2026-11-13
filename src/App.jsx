import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './lib/AuthContext'
import Login from './pages/Login'
import AgentPerformance from './pages/AgentPerformance'
import TeamDashboard from './pages/LeaderDashboard'
import AttendanceSummary from './pages/AttendanceSummary'
import AttendanceEntry from './pages/AttendanceEntry'
import AdminAgents from './pages/admin/AdminAgents'
import AdminTeams from './pages/admin/AdminTeams'
import AdminTeamAssignments from './pages/admin/AdminTeamAssignments'
import AdminMetrics from './pages/admin/AdminMetrics'
import AdminGoals from './pages/admin/AdminGoals'
import AdminNotes from './pages/admin/AdminNotes'
import AdminAttendanceCodes from './pages/admin/AdminAttendanceCodes'
import Help from './pages/Help'

// APT-149: every page sits inside this guarded layout. RequireAuth wraps
// Layout rather than the other way round, so the login, No-access and retry
// screens render on their own without the sidebar.
function ProtectedLayout() {
  return (
    <RequireAuth>
      <Layout>
        <Outlet />
      </Layout>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<AgentPerformance />} />
              <Route path="/team-dashboard" element={<TeamDashboard />} />
              <Route path="/attendance" element={<AttendanceSummary />} />
              <Route path="/attendance/entry" element={<AttendanceEntry />} />
              <Route path="/admin/agents" element={<AdminAgents />} />
              <Route path="/admin/teams" element={<AdminTeams />} />
              <Route path="/admin/team-assignments" element={<AdminTeamAssignments />} />
              <Route path="/admin/metrics" element={<AdminMetrics />} />
              <Route path="/admin/goals" element={<AdminGoals />} />
              <Route path="/admin/notes" element={<AdminNotes />} />
              <Route path="/admin/attendance-codes" element={<AdminAttendanceCodes />} />
              <Route path="/help" element={<Help />} />
              <Route path="/help/:articleId" element={<Help />} />
            </Route>
            {/* Anything else goes home; signed out, the guard then sends them to /login */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}
