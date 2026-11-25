import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categoriesApi, ticketsApi } from '../api/endpoints'
import { errorMessage, fieldErrors as readFieldErrors } from '../api/client'
import { ErrorBanner, FieldError, PageState } from '../components/UI'
import {
  PRIORITY_LABELS,
  TICKET_PRIORITIES,
  validateTicketForm,
} from '../utils'

const initialForm = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  categoryId: '',
}

export default function CreateTicketPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const { data } = await categoriesApi.list()
        if (!active) return
        setCategories(data)
        setForm((current) => ({
          ...current,
          categoryId: current.categoryId || data[0]?.id || '',
        }))
      } catch (requestError) {
        if (active) setLoadError(errorMessage(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
    setGeneralError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateTicketForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setGeneralError('')
    try {
      const { data } = await ticketsApi.create({
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category: { id: form.categoryId },
      })
      navigate(`/tickets/${data.id}`)
    } catch (error) {
      const serverFields = readFieldErrors(error)
      if (Object.keys(serverFields).length > 0) setErrors(serverFields)
      setGeneralError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack narrow" data-testid="create-ticket-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Employee area</p>
          <h1>Create a ticket</h1>
          <p className="muted">
            Describe the issue clearly. Your ticket starts as Open and unassigned.
          </p>
        </div>
        <Link className="btn btn-secondary" to="/employee/tickets">Back to my tickets</Link>
      </div>

      <PageState loading={loading} error={loadError}>
        <ErrorBanner message={generalError} />
        <form className="card form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              aria-invalid={Boolean(errors.title)}
              data-testid="ticket-title-input"
            />
            <FieldError message={errors.title} />
            <span className="hint">5–100 characters.</span>
          </div>

          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={7}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              aria-invalid={Boolean(errors.description)}
              data-testid="ticket-description-input"
            />
            <FieldError message={errors.description} />
            <span className="hint">10–2000 characters. Include useful details.</span>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                value={form.priority}
                onChange={(event) => update('priority', event.target.value)}
                data-testid="ticket-priority-input"
              >
                {TICKET_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
                ))}
              </select>
              <FieldError message={errors.priority} />
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={form.categoryId}
                onChange={(event) => update('categoryId', event.target.value)}
                aria-invalid={Boolean(errors.categoryId)}
                data-testid="ticket-category-input"
              >
                <option value="">Choose a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <FieldError message={errors.categoryId} />
            </div>
          </div>

          <div className="form-actions">
            <Link className="btn btn-secondary" to="/employee/tickets">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={busy} data-testid="create-ticket-submit">
              {busy ? 'Creating…' : 'Create ticket'}
            </button>
          </div>
        </form>
      </PageState>
    </div>
  )
}
