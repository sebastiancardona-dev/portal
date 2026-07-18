import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'
import { AccountsPage } from './pages/AccountsPage'
import { AppDetailPage } from './pages/AppDetailPage'
import { AppsPage } from './pages/AppsPage'
import { DashboardPage } from './pages/DashboardPage'
import { HostPage } from './pages/HostPage'
import { SettingsPage } from './pages/SettingsPage'
import { AppShell } from './shell/AppShell'

function RequireAuth() {
  const { authed, restoring } = useAuth()
  const location = useLocation()
  // session bootstrap in flight: paint nothing rather than flash the gate
  if (restoring) return null
  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <AppShell />
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/apps" element={<AppsPage />} />
        <Route path="/apps/:app" element={<AppDetailPage />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
