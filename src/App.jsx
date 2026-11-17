import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth, { CHANGE_PASSWORD_PATH } from './components/RequireAuth'
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
import ChangePassword from './pages/ChangePassword'
import { useAuth } from './lib/useAuth'

// APT-149: every page sits inside this guarded layout. RequireAuth wraps
// Layout rather than the other way round, so the login, No-access and retry
// screens render on their own without the sidebar.
// APT-156: someone who still has the starting password gets the page on its
// own, with no menu around it — the guard has already sent them to the
// change-password page, and the only ways on are changing it or signing out.
function ProtectedLayout() {
  const { status, role, mustChangePassword } = useAuth()
  const forced = status === 'ready' && !!role && mustChangePassword
  return (
    <RequireAuth>
      {forced ? <Outlet /> : <Layout><Outlet /></Layout>}
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
              <Route path={CHANGE_PASSWORD_PATH} element={<ChangePassword />} />
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
