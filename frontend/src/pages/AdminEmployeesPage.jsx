import { useCallback, useEffect, useState } from 'react'
import { employeesApi } from '../api/endpoints'
import { errorMessage, fieldErrors as readFieldErrors } from '../api/client'
import {
  ConfirmDialog,
  ErrorBanner,
  FieldError,
  Modal,
  Notice,
  PageState,
} from '../components/UI'
import { formatDate } from '../utils'

const emptyForm = {
  fullName: '',
  email: '',
  department: '',
  phone: '',
  enabled: true,
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data } = await employeesApi.list()
      setEmployees(data)
    } catch (requestError) {
      setLoadError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function flash(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  function openEdit(employee) {
    setEditing(employee)
    setForm({
      fullName: employee.user?.fullName || '',
      email: employee.user?.email || '',
      department: employee.department || '',
      phone: employee.phone || '',
      enabled: Boolean(employee.user?.enabled),
    })
    setFieldErrors({})
    setActionError('')
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: '' }))
  }

  async function save(event) {
    event.preventDefault()
    const nextErrors = {}
    if (form.fullName.trim().length < 3 || form.fullName.trim().length > 100) {
      nextErrors.fullName = 'Full name must be between 3 and 100 characters.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Enter a valid email.'
    if (form.department.trim().length < 2 || form.department.trim().length > 100) {
      nextErrors.department = 'Department must be between 2 and 100 characters.'
    }
    if (form.phone.length > 30) nextErrors.phone = 'Phone must be 30 characters or fewer.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setActionError('')
    try {
      await employeesApi.update(editing.id, {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        department: form.department.trim(),
        phone: form.phone.trim(),
        enabled: form.enabled,
      })
      setEditing(null)
      await load()
      flash('Employee updated.')
    } catch (requestError) {
      const serverFields = readFieldErrors(requestError)
      if (Object.keys(serverFields).length > 0) setFieldErrors(serverFields)
      setActionError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function toggleEnabled(employee) {
    setBusy(true)
    setActionError('')
    try {
      await employeesApi.update(employee.id, { enabled: !employee.user?.enabled })
      setConfirm(null)
      await load()
      flash(employee.user?.enabled ? 'Employee disabled.' : 'Employee enabled.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  async function remove(employee) {
    setBusy(true)
    setActionError('')
    try {
      await employeesApi.remove(employee.id)
      setConfirm(null)
      await load()
      flash('Employee deleted.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" data-testid="admin-employees-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Employees</h1>
          <p className="muted">
            Edit profiles, disable accounts, or delete employees that have no tickets or comments.
          </p>
        </div>
      </div>

      <Notice message={notice} />
      <ErrorBanner message={actionError} />

      <section className="card">
        <PageState
          loading={loading}
          error={loadError}
          onRetry={load}
          empty={employees.length === 0}
          emptyText="No employees registered yet."
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} data-testid="employee-row" data-employee-id={employee.id}>
                    <td>{employee.user?.fullName}</td>
                    <td data-testid="employee-email">{employee.user?.email}</td>
                    <td>{employee.department || '—'}</td>
                    <td>{employee.phone || '—'}</td>
                    <td>
                      <span className={`badge ${employee.user?.enabled ? 'badge-success' : 'badge-muted'}`}>
                        {employee.user?.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>{formatDate(employee.user?.createdAt)}</td>
                    <td className="table-actions">
                      <button type="button" className="btn btn-secondary btn-small" onClick={() => openEdit(employee)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() =>
                          setConfirm({
                            title: employee.user?.enabled ? 'Disable employee?' : 'Enable employee?',
                            message: employee.user?.enabled
                              ? `${employee.user?.fullName} will no longer be able to sign in.`
                              : `${employee.user?.fullName} will be able to sign in again.`,
                            confirmLabel: employee.user?.enabled ? 'Disable' : 'Enable',
                            action: () => toggleEnabled(employee),
                          })
                        }
                        data-testid="toggle-employee"
                      >
                        {employee.user?.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() =>
                          setConfirm({
                            title: 'Delete employee?',
                            message: `${employee.user?.fullName} will be permanently deleted. This is blocked if tickets or comments still reference the account.`,
                            confirmLabel: 'Delete employee',
                            action: () => remove(employee),
                          })
                        }
                        data-testid="delete-employee"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageState>
      </section>

      <Modal open={Boolean(editing)} title="Edit employee" onClose={() => setEditing(null)}>
        <ErrorBanner message={actionError} />
        <form className="form" onSubmit={save} noValidate data-testid="employee-edit-form">
          <div className="field">
            <label htmlFor="emp-name">Full name</label>
            <input id="emp-name" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} data-testid="employee-name-input" />
            <FieldError message={fieldErrors.fullName} />
          </div>
          <div className="field">
            <label htmlFor="emp-email">Email</label>
            <input id="emp-email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} data-testid="employee-email-input" />
            <FieldError message={fieldErrors.email} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="emp-dept">Department</label>
              <input id="emp-dept" value={form.department} onChange={(event) => update('department', event.target.value)} data-testid="employee-department-input" />
              <FieldError message={fieldErrors.department} />
            </div>
            <div className="field">
              <label htmlFor="emp-phone">Phone</label>
              <input id="emp-phone" value={form.phone} onChange={(event) => update('phone', event.target.value)} data-testid="employee-phone-input" />
              <FieldError message={fieldErrors.phone} />
            </div>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
            />
            Account enabled
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} data-testid="save-employee-button">
              Save changes
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.action()}
      />
    </div>
  )
}
