import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { categoriesApi, employeesApi, techniciansApi, ticketsApi } from '../api/endpoints'
import { errorMessage } from '../api/client'
import { ErrorBanner, PageState, Pagination } from '../components/UI'
import { TicketTable } from '../components/AppLayout'
import { TICKET_PRIORITIES, TICKET_STATUSES, PRIORITY_LABELS, STATUS_LABELS } from '../utils'

const initialFilters = {
  status: '',
  priority: '',
  categoryId: '',
  technicianId: '',
  employeeId: '',
}

const SORT_OPTIONS = [
  ['createdAt,desc', 'Newest first'],
  ['createdAt,asc', 'Oldest first'],
  ['updatedAt,desc', 'Recently updated'],
  ['title,asc', 'Title A–Z'],
  ['title,desc', 'Title Z–A'],
  ['priority,asc', 'Priority ascending'],
  ['priority,desc', 'Priority descending'],
  ['status,asc', 'Status A–Z'],
]

export default function TicketListPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const isEmployee = user?.role === 'EMPLOYEE'

  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [sort, setSort] = useState('createdAt,desc')
  const [filters, setFilters] = useState(initialFilters)
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lookups, setLookups] = useState({ categories: [], technicians: [], employees: [] })
  const [lookupError, setLookupError] = useState('')

  const loadLookups = useCallback(async () => {
    try {
      const requests = [categoriesApi.list()]
      if (isAdmin) {
        requests.push(techniciansApi.list(), employeesApi.list())
      }
      const results = await Promise.all(requests)
      setLookups({
        categories: results[0]?.data || [],
        technicians: results[1]?.data || [],
        employees: results[2]?.data || [],
      })
      setLookupError('')
    } catch (requestError) {
      setLookupError(errorMessage(requestError))
    }
  }, [isAdmin])

  useEffect(() => {
    loadLookups()
  }, [loadLookups])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, size, sort }
      let response
      if (keyword.trim()) {
        response = await ticketsApi.search(keyword.trim(), params)
      } else if (filters.status) {
        response = await ticketsApi.byStatus(filters.status, params)
      } else if (filters.priority) {
        response = await ticketsApi.byPriority(filters.priority, params)
      } else if (filters.categoryId) {
        response = await ticketsApi.byCategory(filters.categoryId, params)
      } else if (filters.technicianId) {
        response = await ticketsApi.byTechnician(filters.technicianId, params)
      } else if (filters.employeeId) {
        response = await ticketsApi.byEmployee(filters.employeeId, params)
      } else {
        response = await ticketsApi.list(params)
      }
      setData(response.data)
    } catch (requestError) {
      setError(errorMessage(requestError))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, size, sort, filters, keyword])

  useEffect(() => {
    load()
  }, [load])

  function chooseFilter(field, value) {
    setFilters({ ...initialFilters, [field]: value })
    setKeyword('')
    setSearchInput('')
    setPage(0)
  }

  function submitSearch(event) {
    event.preventDefault()
    setFilters(initialFilters)
    setKeyword(searchInput)
    setPage(0)
  }

  function clearAll() {
    setFilters(initialFilters)
    setKeyword('')
    setSearchInput('')
    setPage(0)
  }

  function changeSort(value) {
    setSort(value)
    setPage(0)
  }

  function changeSize(value) {
    setSize(value)
    setPage(0)
  }

  const hasFilter = Boolean(keyword.trim() || Object.values(filters).some(Boolean))
  const title = isAdmin ? 'All tickets' : isEmployee ? 'My tickets' : 'Assigned tickets'
  const subtitle = isAdmin
    ? 'Every ticket in the system, with assignment and lifecycle controls.'
    : isEmployee
      ? 'Only your own tickets are shown here.'
      : 'Only tickets assigned to you are shown here.'

  return (
    <div className="stack" data-testid="tickets-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{isAdmin ? 'Administration' : isEmployee ? 'Employee area' : 'Technician area'}</p>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
        {isEmployee && (
          <Link className="btn btn-primary" to="/employee/tickets/new">
            New ticket
          </Link>
        )}
      </div>

      <ErrorBanner message={lookupError} />

      <section className="card filter-card">
        <form className="search-bar" onSubmit={submitSearch}>
          <div className="field grow">
            <label htmlFor="ticket-search">Search by title</label>
            <input
              id="ticket-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="e.g. VPN, printer, email"
              data-testid="search-input"
            />
          </div>
          <button className="btn btn-primary" type="submit" data-testid="search-submit">
            Search
          </button>
          {hasFilter && (
            <button className="btn btn-secondary" type="button" onClick={clearAll} data-testid="clear-filters">
              Clear
            </button>
          )}
        </form>

        <div className="filter-grid">
          <div className="field">
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              value={filters.status}
              onChange={(event) => chooseFilter('status', event.target.value)}
              data-testid="filter-status"
            >
              <option value="">Any status</option>
              {TICKET_STATUSES.map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-priority">Priority</label>
            <select
              id="filter-priority"
              value={filters.priority}
              onChange={(event) => chooseFilter('priority', event.target.value)}
              data-testid="filter-priority"
            >
              <option value="">Any priority</option>
              {TICKET_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-category">Category</label>
            <select
              id="filter-category"
              value={filters.categoryId}
              onChange={(event) => chooseFilter('categoryId', event.target.value)}
              data-testid="filter-category"
            >
              <option value="">Any category</option>
              {lookups.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div className="field">
              <label htmlFor="filter-technician">Technician</label>
              <select
                id="filter-technician"
                value={filters.technicianId}
                onChange={(event) => chooseFilter('technicianId', event.target.value)}
                data-testid="filter-technician"
              >
                <option value="">Any technician</option>
                {lookups.technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.user?.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isAdmin && (
            <div className="field">
              <label htmlFor="filter-employee">Employee</label>
              <select
                id="filter-employee"
                value={filters.employeeId}
                onChange={(event) => chooseFilter('employeeId', event.target.value)}
                data-testid="filter-employee"
              >
                <option value="">Any employee</option>
                {lookups.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.user?.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="sort-select">Sort</label>
            <select
              id="sort-select"
              value={sort}
              onChange={(event) => changeSort(event.target.value)}
              data-testid="sort-select"
            >
              {SORT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="hint">
          Filters are applied one at a time by the API. Searching clears the filters.
        </p>
      </section>

      <section className="card">
        <PageState
          loading={loading}
          error={error}
          onRetry={load}
          empty={data && data.content.length === 0}
          emptyText={hasFilter ? 'No tickets match the current search or filter.' : 'No tickets yet.'}
        >
          {data && (
            <>
              <TicketTable
                tickets={data.content}
                showEmployee={!isEmployee}
                showTechnician={!isEmployee}
              />
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                totalElements={data.totalElements}
                size={size}
                onPageChange={setPage}
                onSizeChange={changeSize}
              />
            </>
          )}
        </PageState>
      </section>
    </div>
  )
}
