import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, formatDate } from '../utils'
import { PriorityBadge, RoleBadge, StatusBadge } from './UI'

const NAV_ITEMS = {
  EMPLOYEE: [
    { to: '/employee/dashboard', label: 'Dashboard' },
    { to: '/employee/tickets', label: 'My Tickets' },
    { to: '/employee/tickets/new', label: 'New Ticket' },
  ],
  TECHNICIAN: [
    { to: '/technician/dashboard', label: 'Dashboard' },
    { to: '/technician/tickets', label: 'Assigned Tickets' },
  ],
  ADMIN: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/tickets', label: 'All Tickets' },
    { to: '/admin/employees', label: 'Employees' },
    { to: '/admin/technicians', label: 'Technicians' },
    { to: '/admin/categories', label: 'Categories' },
  ],
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to={user ? `/${user.role.toLowerCase()}/dashboard` : '/login'} className="brand">
          <span className="brand-mark">HD</span>
          <span>HelpDesk</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          {(NAV_ITEMS[user?.role] || []).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.endsWith('/tickets')}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-area">
          <div className="user-meta" data-testid="current-user">
            <span className="user-name">{user?.fullName}</span>
            <RoleBadge role={user?.role} />
          </div>
          <button type="button" className="btn btn-secondary btn-small" onClick={handleLogout} data-testid="logout-button">
            Log out
          </button>
        </div>
      </header>
      <main className="page-container">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>HelpDesk · IT support ticket system</span>
        <span>{ROLE_LABELS[user?.role] || 'Signed in'}</span>
      </footer>
    </div>
  )
}

export function TicketTable({ tickets, showEmployee = true, showTechnician = true }) {
  return (
    <div className="table-wrap">
      <table className="data-table" data-testid="ticket-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Category</th>
            {showEmployee && <th>Employee</th>}
            {showTechnician && <th>Technician</th>}
            <th>Created</th>
            <th><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} data-testid="ticket-row" data-ticket-id={ticket.id}>
              <td>
                <span className="ticket-title" data-testid="ticket-title">
                  {ticket.title}
                </span>
                <span className="subtle mono">#{ticket.id.slice(0, 8)}</span>
              </td>
              <td><StatusBadge status={ticket.status} /></td>
              <td><PriorityBadge priority={ticket.priority} /></td>
              <td>{ticket.category?.name || '—'}</td>
              {showEmployee && <td>{ticket.employee?.user?.fullName || '—'}</td>}
              {showTechnician && <td>{ticket.technician?.user?.fullName || 'Unassigned'}</td>}
              <td>{formatDate(ticket.createdAt)}</td>
              <td className="table-actions">
                <Link className="btn btn-secondary btn-small" to={`/tickets/${ticket.id}`}>
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { StatusBadge, PriorityBadge }
