import { useCallback, useEffect, useState } from 'react'
import { categoriesApi } from '../api/endpoints'
import { errorMessage, fieldErrors as readFieldErrors } from '../api/client'
import {
  ConfirmDialog,
  ErrorBanner,
  FieldError,
  Modal,
  Notice,
  PageState,
} from '../components/UI'

const emptyForm = { name: '', description: '' }

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([])
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

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data } = await categoriesApi.list()
      setCategories(data)
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

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFieldErrors({})
    setActionError('')
    setFormOpen(true)
  }

  function openEdit(category) {
    setEditing(category)
    setForm({ name: category.name, description: category.description || '' })
    setFieldErrors({})
    setActionError('')
    setFormOpen(true)
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: '' }))
    setActionError('')
  }

  async function save(event) {
    event.preventDefault()
    const nextErrors = {}
    if (form.name.trim().length < 3 || form.name.trim().length > 60) {
      nextErrors.name = 'Name must be between 3 and 60 characters.'
    }
    if (form.description.length > 255) {
      nextErrors.description = 'Description must be 255 characters or fewer.'
    }
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setActionError('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
      }
      if (editing) {
        await categoriesApi.update(editing.id, payload)
        flash('Category updated.')
      } else {
        await categoriesApi.create(payload)
        flash('Category created.')
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

  async function remove(category) {
    setBusy(true)
    setActionError('')
    try {
      await categoriesApi.remove(category.id)
      setConfirm(null)
      await load()
      flash('Category deleted.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" data-testid="admin-categories-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Categories</h1>
          <p className="muted">
            Categories organise tickets. A category that is still used by tickets cannot be deleted.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate} data-testid="create-category-button">
          Create category
        </button>
      </div>

      <Notice message={notice} />
      <ErrorBanner message={actionError} />

      <section className="card">
        <PageState
          loading={loading}
          error={loadError}
          onRetry={load}
          empty={categories.length === 0}
          emptyText="No categories yet."
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} data-testid="category-row">
                    <td data-testid="category-name">{category.name}</td>
                    <td>{category.description || '—'}</td>
                    <td className="table-actions">
                      <button type="button" className="btn btn-secondary btn-small" onClick={() => openEdit(category)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() =>
                          setConfirm({
                            title: 'Delete category?',
                            message: `"${category.name}" will be deleted. This is blocked while tickets still use it.`,
                            confirmLabel: 'Delete category',
                            action: () => remove(category),
                          })
                        }
                        data-testid="delete-category"
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
        title={editing ? 'Edit category' : 'Create category'}
        onClose={() => setFormOpen(false)}
      >
        <ErrorBanner message={actionError} />
        <form className="form" onSubmit={save} noValidate data-testid="category-form">
          <div className="field">
            <label htmlFor="cat-name">Name</label>
            <input id="cat-name" value={form.name} onChange={(event) => update('name', event.target.value)} data-testid="category-name-input" />
            <FieldError message={fieldErrors.name} />
            <span className="hint">3–60 characters.</span>
          </div>
          <div className="field">
            <label htmlFor="cat-desc">Description <span className="optional">(optional)</span></label>
            <textarea id="cat-desc" rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} data-testid="category-description-input" />
            <FieldError message={fieldErrors.description} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy} data-testid="save-category-button">
              {editing ? 'Save changes' : 'Create category'}
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
