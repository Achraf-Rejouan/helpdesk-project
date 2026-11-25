import { useCallback, useEffect, useState } from 'react'
import { techniciansApi } from '../api/endpoints'
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
  password: '',
  specialization: '',
  availability: true,
  enabled: true,
}

export default function AdminTechniciansPage() {
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data } = keyword.trim()
        ? await techniciansApi.bySpecialization(keyword.trim())
        : await techniciansApi.list()
      setTechnicians(data)
    } catch (requestError) {
      setLoadError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [keyword])

  useEffect(() => {
    load()
  }, [load])

  function flash(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFieldErrors({})
    setActionError('')
    setFormOpen(true)
  }

  function openEdit(technician) {
    setEditing(technician)
    setForm({
      fullName: technician.user?.fullName || '',
      email: technician.user?.email || '',
      password: '',
      specialization: technician.specialization || '',
      availability: Boolean(technician.availability),
      enabled: Boolean(technician.user?.enabled),
    })
    setFieldErrors({})
    setActionError('')
    setFormOpen(true)
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
    if (!editing && (form.password.length < 8 || form.password.length > 72)) {
      nextErrors.password = 'Password must be between 8 and 72 characters.'
    }
    if (form.specialization.trim().length < 2 || form.specialization.trim().length > 100) {
      nextErrors.specialization = 'Specialization must be between 2 and 100 characters.'
    }
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setActionError('')
    try {
      if (editing) {
        await techniciansApi.update(editing.id, {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          specialization: form.specialization.trim(),
          availability: form.availability,
          enabled: form.enabled,
        })
        flash('Technician updated.')
      } else {
        await techniciansApi.create({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          specialization: form.specialization.trim(),
          availability: form.availability,
        })
        flash('Technician account created.')
      }
      setFormOpen(false)
      await load()
    } catch (requestError) {
      const serverFields = readFieldErrors(requestError)
      if (Object.keys(serverFields).length > 0) setFieldErrors(serverFields)
      setActionError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function toggleAvailability(technician) {
    setBusy(true)
    setActionError('')
    try {
      await techniciansApi.update(technician.id, { availability: !technician.availability })
      await load()
      flash(technician.availability ? 'Technician marked unavailable.' : 'Technician marked available.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function toggleEnabled(technician) {
    setBusy(true)
    setActionError('')
    try {
      await techniciansApi.update(technician.id, { enabled: !technician.user?.enabled })
      setConfirm(null)
      await load()
      flash(technician.user?.enabled ? 'Technician disabled.' : 'Technician enabled.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  async function remove(technician) {
    setBusy(true)
    setActionError('')
    try {
      await techniciansApi.remove(technician.id)
      setConfirm(null)
      await load()
      flash('Technician deleted.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" data-testid="admin-technicians-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Technicians</h1>
          <p className="muted">
            Create accounts, manage availability, enable or disable access, and remove unused profiles.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate} data-testid="create-technician-button">
          Create technician
        </button>
      </div>

      <Notice message={notice} />
      <ErrorBanner message={actionError} />

      <form
        className="card search-bar"
        onSubmit={(event) => {
          event.preventDefault()
          setKeyword(searchInput)
        }}
      >
        <div className="field grow">
          <label htmlFor="spec-search">Search by specialization</label>
          <input
            id="spec-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="e.g. Network"
            data-testid="specialization-search"
          />
        </div>
        <button type="submit" className="btn btn-primary">Search</button>
        {keyword && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setSearchInput('')
              setKeyword('')
            }}
          >
            Clear
          </button>
        )}
      </form>

      <section className="card">
        <PageState
          loading={loading}
          error={loadError}
          onRetry={load}
          empty={technicians.length === 0}
          emptyText={keyword ? 'No technicians match that specialization.' : 'No technicians yet.'}
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Specialization</th>
                  <th>Availability</th>
                  <th>Account</th>
                  <th>Created</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {technicians.map((technician) => (
                  <tr key={technician.id} data-testid="technician-row" data-technician-id={technician.id}>
                    <td>{technician.user?.fullName}</td>
                    <td data-testid="technician-email">{technician.user?.email}</td>
                    <td>{technician.specialization}</td>
                    <td>
                      <span className={`badge ${technician.availability ? 'badge-success' : 'badge-muted'}`}>
                        {technician.availability ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${technician.user?.enabled ? 'badge-success' : 'badge-muted'}`}>
                        {technician.user?.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>{formatDate(technician.user?.createdAt)}</td>
                    <td className="table-actions">
                      <button type="button" className="btn btn-secondary btn-small" onClick={() => openEdit(technician)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => toggleAvailability(technician)}
                        disabled={busy}
                        data-testid="toggle-availability"
                      >
                        {technician.availability ? 'Make unavailable' : 'Make available'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() =>
                          setConfirm({
                            title: technician.user?.enabled ? 'Disable technician?' : 'Enable technician?',
                            message: technician.user?.enabled
                              ? `${technician.user?.fullName} will no longer be able to sign in.`
                              : `${technician.user?.fullName} will be able to sign in again.`,
                            confirmLabel: technician.user?.enabled ? 'Disable' : 'Enable',
                            action: () => toggleEnabled(technician),
                          })
                        }
                        disabled={busy}
                        data-testid="toggle-technician"
                      >
                        {technician.user?.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() =>
                          setConfirm({
                            title: 'Delete technician?',
                            message: `${technician.user?.fullName} will be permanently deleted. This is blocked if tickets are assigned or comments were authored.`,
                            confirmLabel: 'Delete technician',
                            action: () => remove(technician),
                          })
                        }
                        data-testid="delete-technician"
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

      <Modal
        open={formOpen}
        title={editing ? 'Edit technician' : 'Create technician'}
        onClose={() => setFormOpen(false)}
        wide
      >
        <ErrorBanner message={actionError} />
        <form className="form" onSubmit={save} noValidate data-testid="technician-form">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="tech-name">Full name</label>
              <input id="tech-name" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} data-testid="technician-name-input" />
              <FieldError message={fieldErrors.fullName} />
            </div>
            <div className="field">
              <label htmlFor="tech-email">Email</label>
              <input id="tech-email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} data-testid="technician-email-input" />
              <FieldError message={fieldErrors.email} />
            </div>
            {!editing && (
              <div className="field">
                <label htmlFor="tech-password">Temporary password</label>
                <input id="tech-password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => update('password', event.target.value)} data-testid="technician-password-input" />
                <FieldError message={fieldErrors.password} />
                <span className="hint">8–72 characters.</span>
              </div>
            )}
            <div className="field">
              <label htmlFor="tech-spec">Specialization</label>
              <input id="tech-spec" value={form.specialization} onChange={(event) => update('specialization', event.target.value)} data-testid="technician-specialization-input" />
              <FieldError message={fieldErrors.specialization} />
            </div>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.availability} onChange={(event) => update('availability', event.target.checked)} data-testid="technician-availability-input" />
            Available for assignment
          </label>
          {editing && (
            <label className="checkbox-row">
              <input type="checkbox" checked={form.enabled} onChange={(event) => update('enabled', event.target.checked)} />
              Account enabled
            </label>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} data-testid="save-technician-button">
              {editing ? 'Save changes' : 'Create technician'}
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
