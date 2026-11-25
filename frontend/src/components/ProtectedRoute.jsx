import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './UI'
import ForbiddenPage from '../pages/ForbiddenPage'
import { ROLE_HOME } from '../utils'

export default function ProtectedRoute() {
  const { token, user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="centered-page">
        <Spinner label="Restoring your session…" />
      </div>
    )
  }
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function PublicOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="centered-page">
        <Spinner label="Checking your session…" />
      </div>
    )
  }
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />
  return children
}

export function RoleGate({ roles, children }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) return <ForbiddenPage />
  return children
}

export function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="centered-page">
        <Spinner label="Loading…" />
      </div>
    )
  }
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />
}
