import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ticketsApi } from '../api/endpoints'
import { errorMessage } from '../api/client'
import { PageState } from '../components/UI'
import { TicketTable } from '../components/AppLayout'
import {
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../utils'

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const base = { page: 0, size: 1, sort: 'createdAt,desc' }
      const [total, statuses, priorities, recent] = await Promise.all([
        ticketsApi.list(base),
        Promise.all(TICKET_STATUSES.map((status) => ticketsApi.byStatus(status, base))),
        Promise.all(TICKET_PRIORITIES.map((priority) => ticketsApi.byPriority(priority, base))),
        ticketsApi.list({ page: 0, size: 5, sort: 'createdAt,desc' }),
      ])
      setData({
        total: total.data.totalElements,
        statusCounts: Object.fromEntries(
          TICKET_STATUSES.map((status, index) => [status, statuses[index].data.totalElements]),
        ),
        priorityCounts: Object.fromEntries(
          TICKET_PRIORITIES.map((priority, index) => [priority, priorities[index].data.totalElements]),
        ),
        recent: recent.data.content,
      })
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const roleText = {
    EMPLOYEE: 'Your tickets and their latest activity.',
    TECHNICIAN: 'The tickets currently assigned to you.',
    ADMIN: 'A system-wide view of every ticket.',
  }

  const ticketsPath = user ? `/${user.role.toLowerCase()}/tickets` : '/'

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{ROLE_LABELS[user?.role]} dashboard</p>
          <h1>Welcome, {user?.fullName}</h1>
          <p className="muted">{roleText[user?.role]}</p>
        </div>
        <div className="heading-actions">
          {user?.role === 'EMPLOYEE' && (
            <Link className="btn btn-primary" to="/employee/tickets/new">
              New ticket
            </Link>
          )}
          <Link className="btn btn-secondary" to={ticketsPath}>
            {user?.role === 'ADMIN' ? 'All tickets' : 'View tickets'}
          </Link>
        </div>
      </div>

      <PageState loading={loading} error={error} onRetry={load}>
        {data && (
          <>
            <section className="card profile-strip">
              <div>
                <span className="subtle">Signed in as</span>
                <strong>{user?.email}</strong>
              </div>
              {user?.employee && (
                <div>
                  <span className="subtle">Department</span>
                  <strong>{user.employee.department || '—'}</strong>
                </div>
              )}
              {user?.technician && (
                <>
                  <div>
                    <span className="subtle">Specialization</span>
                    <strong>{user.technician.specialization || '—'}</strong>
                  </div>
                  <div>
                    <span className="subtle">Availability</span>
                    <strong>{user.technician.availability ? 'Available' : 'Unavailable'}</strong>
                  </div>
                </>
              )}
              <div>
                <span className="subtle">Total tickets visible to you</span>
                <strong data-testid="count-total">{data.total}</strong>
              </div>
            </section>

            <section>
              <h2 className="section-title">Tickets by status</h2>
              <div className="stat-grid">
                {TICKET_STATUSES.map((status) => (
                  <div className="stat-card" key={status}>
                    <span className={`stat-dot status-${status.toLowerCase()}`} aria-hidden="true" />
                    <span className="stat-label">{STATUS_LABELS[status]}</span>
                    <strong data-testid={`count-status-${status}`}>{data.statusCounts[status]}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="section-title">Tickets by priority</h2>
              <div className="stat-grid stat-grid-four">
                {TICKET_PRIORITIES.map((priority) => (
                  <div className="stat-card" key={priority}>
                    <span className={`stat-dot priority-${priority.toLowerCase()}`} aria-hidden="true" />
                    <span className="stat-label">{PRIORITY_LABELS[priority]}</span>
                    <strong data-testid={`count-priority-${priority}`}>{data.priorityCounts[priority]}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-heading">
                <h2>Recent tickets</h2>
                <Link to={ticketsPath} className="text-link">View all</Link>
              </div>
              <PageState
                loading={false}
                error=""
                empty={data.recent.length === 0}
                emptyText="No tickets yet."
              >
                <TicketTable
                  tickets={data.recent}
                  showEmployee={user?.role === 'ADMIN'}
                  showTechnician={user?.role !== 'EMPLOYEE'}
                />
              </PageState>
            </section>
          </>
        )}
      </PageState>
    </div>
  )
}
