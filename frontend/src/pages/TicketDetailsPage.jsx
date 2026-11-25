import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { categoriesApi, commentsApi, techniciansApi, ticketsApi } from '../api/endpoints'
import { errorMessage, fieldErrors as readFieldErrors } from '../api/client'
import {
  ConfirmDialog,
  ErrorBanner,
  FieldError,
  Notice,
  PageState,
  PriorityBadge,
  StatusBadge,
} from '../components/UI'
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  formatDate,
  validateComment,
  validateTicketForm,
} from '../utils'

export default function TicketDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [ticket, setTicket] = useState(null)
  const [comments, setComments] = useState([])
  const [categories, setCategories] = useState([])
  const [availableTechnicians, setAvailableTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', priority: '', categoryId: '' })
  const [formErrors, setFormErrors] = useState({})

  const [selectedTech, setSelectedTech] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingContent, setEditingContent] = useState('')
  const [confirm, setConfirm] = useState(null)

  const loadComments = useCallback(async () => {
    const { data } = await commentsApi.listForTicket(id)
    setComments(data)
  }, [id])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setNotFound(false)
    try {
      const requests = [ticketsApi.get(id), categoriesApi.list()]
      if (user?.role === 'ADMIN') requests.push(techniciansApi.available())
      const [ticketResponse, categoryResponse, technicianResponse] = await Promise.all(requests)
      const loadedTicket = ticketResponse.data
      setTicket(loadedTicket)
      setCategories(categoryResponse.data)
      setAvailableTechnicians(technicianResponse?.data || [])
      setForm({
        title: loadedTicket.title,
        description: loadedTicket.description,
        priority: loadedTicket.priority,
        categoryId: loadedTicket.category?.id || '',
      })
      setSelectedStatus(loadedTicket.status)
      const commentsResponse = await commentsApi.listForTicket(id)
      setComments(commentsResponse.data)
    } catch (requestError) {
      if (requestError?.response?.status === 404) {
        setNotFound(true)
      } else {
        setError(errorMessage(requestError))
      }
    } finally {
      setLoading(false)
    }
  }, [id, user?.role])

  useEffect(() => {
    load()
  }, [load])

  const isAdmin = user?.role === 'ADMIN'
  const isEmployee = user?.role === 'EMPLOYEE'
  const isTechnician = user?.role === 'TECHNICIAN'
  const ownsAsEmployee = isEmployee && ticket?.employee?.id === user?.employee?.id
  const assignedAsTechnician = isTechnician && ticket?.technician?.id === user?.technician?.id
  const canEditTicket = Boolean(ticket) && (isAdmin || ownsAsEmployee)
  const canUpdateStatus = Boolean(ticket) && (isAdmin || assignedAsTechnician)
  const canAssign = isAdmin && Boolean(ticket)
  const canComment = Boolean(ticket) && (ownsAsEmployee || assignedAsTechnician)

  function flash(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFormErrors((current) => ({ ...current, [field]: '' }))
    setActionError('')
  }

  async function submitEdit(event) {
    event.preventDefault()
    const nextErrors = validateTicketForm(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setBusy(true)
    setActionError('')
    try {
      const { data } = await ticketsApi.update(id, {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category: { id: form.categoryId },
      })
      setTicket(data)
      setEditOpen(false)
      flash('Ticket updated.')
    } catch (requestError) {
      const serverFields = readFieldErrors(requestError)
      if (Object.keys(serverFields).length > 0) setFormErrors(serverFields)
      setActionError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus() {
    setBusy(true)
    setActionError('')
    try {
      const { data } = await ticketsApi.updateStatus(id, selectedStatus)
      setTicket(data)
      flash('Status updated.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function assignTechnician() {
    if (!selectedTech) {
      setActionError('Choose an available technician first.')
      return
    }
    setBusy(true)
    setActionError('')
    try {
      const { data } = await ticketsApi.assign(id, selectedTech)
      setTicket(data)
      setSelectedTech('')
      flash('Technician assigned.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function unassignTechnician() {
    setBusy(true)
    setActionError('')
    try {
      const { data } = await ticketsApi.unassign(id)
      setTicket(data)
      flash('Technician unassigned.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function addComment(event) {
    event.preventDefault()
    const validation = validateComment(commentText)
    setCommentError(validation)
    if (validation) return
    setBusy(true)
    setActionError('')
    try {
      await commentsApi.create(id, commentText.trim())
      setCommentText('')
      await loadComments()
      flash('Comment added.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  function beginEditComment(comment) {
    setEditingCommentId(comment.id)
    setEditingContent(comment.content)
    setCommentError('')
    setActionError('')
  }

  async function saveComment(commentId) {
    const validation = validateComment(editingContent)
    setCommentError(validation)
    if (validation) return
    setBusy(true)
    setActionError('')
    try {
      await commentsApi.update(commentId, editingContent.trim())
      setEditingCommentId(null)
      setEditingContent('')
      await loadComments()
      flash('Comment updated.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function deleteComment(commentId) {
    setBusy(true)
    setActionError('')
    try {
      await commentsApi.remove(commentId)
      setConfirm(null)
      await loadComments()
      flash('Comment deleted.')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  async function deleteTicket() {
    setBusy(true)
    setActionError('')
    try {
      await ticketsApi.remove(id)
      navigate(isAdmin ? '/admin/tickets' : '/')
    } catch (requestError) {
      setActionError(errorMessage(requestError))
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="stack">
        <PageState loading />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="message-page" data-testid="ticket-not-found">
        <div className="message-card">
          <span className="message-code">404</span>
          <h1>Ticket not available</h1>
          <p>This ticket does not exist, or your account cannot view it.</p>
          <Link className="btn btn-primary" to={isAdmin ? '/admin/tickets' : `/${user.role.toLowerCase()}/tickets`}>
            Back to tickets
          </Link>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="stack">
        <ErrorBanner message={error || 'Ticket could not be loaded.'} />
        <Link className="btn btn-secondary" to={`/${user.role.toLowerCase()}/tickets`}>Back to tickets</Link>
      </div>
    )
  }

  return (
    <div className="stack" data-testid="ticket-details-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Ticket #{ticket.id.slice(0, 8)}</p>
          <h1 data-testid="ticket-title">{ticket.title}</h1>
          <div className="badge-row">
            <StatusBadge status={ticket.status} testId="ticket-status" />
            <PriorityBadge priority={ticket.priority} testId="ticket-priority" />
            <span className="badge badge-neutral">{ticket.category?.name || 'No category'}</span>
          </div>
        </div>
        <div className="heading-actions">
          <Link className="btn btn-secondary" to={isAdmin ? '/admin/tickets' : `/${user.role.toLowerCase()}/tickets`}>
            Back to tickets
          </Link>
          {canEditTicket && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditOpen((open) => !open)}
              data-testid="edit-ticket-button"
            >
              {editOpen ? 'Close editor' : 'Edit ticket'}
            </button>
          )}
        </div>
      </div>

      <Notice message={notice} />
      <ErrorBanner message={actionError} />

      <section className="card detail-grid">
        <div>
          <span className="subtle">Employee</span>
          <strong data-testid="ticket-employee">{ticket.employee?.user?.fullName || '—'}</strong>
          <span className="hint">{ticket.employee?.user?.email}</span>
        </div>
        <div>
          <span className="subtle">Technician</span>
          <strong data-testid="ticket-technician">
            {ticket.technician?.user?.fullName || 'Unassigned'}
          </strong>
          {ticket.technician && <span className="hint">{ticket.technician.user?.email}</span>}
        </div>
        <div>
          <span className="subtle">Created</span>
          <strong>{formatDate(ticket.createdAt)}</strong>
        </div>
        <div>
          <span className="subtle">Last updated</span>
          <strong>{formatDate(ticket.updatedAt)}</strong>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Description</h2>
        <p className="ticket-description">{ticket.description}</p>
      </section>

      {editOpen && canEditTicket && (
        <section className="card">
          <h2 className="section-title">Edit ticket</h2>
          <form className="form" onSubmit={submitEdit} noValidate>
            <div className="field">
              <label htmlFor="edit-title">Title</label>
              <input
                id="edit-title"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                data-testid="edit-ticket-title"
              />
              <FieldError message={formErrors.title} />
            </div>
            <div className="field">
              <label htmlFor="edit-description">Description</label>
              <textarea
                id="edit-description"
                rows={6}
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                data-testid="edit-ticket-description"
              />
              <FieldError message={formErrors.description} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="edit-priority">Priority</label>
                <select
                  id="edit-priority"
                  value={form.priority}
                  onChange={(event) => updateForm('priority', event.target.value)}
                  data-testid="edit-ticket-priority"
                >
                  {TICKET_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
                  ))}
                </select>
                <FieldError message={formErrors.priority} />
              </div>
              <div className="field">
                <label htmlFor="edit-category">Category</label>
                <select
                  id="edit-category"
                  value={form.categoryId}
                  onChange={(event) => updateForm('categoryId', event.target.value)}
                  data-testid="edit-ticket-category"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <FieldError message={formErrors.categoryId} />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy} data-testid="save-ticket-button">
                Save changes
              </button>
            </div>
          </form>
        </section>
      )}

      {canAssign && (
        <section className="card" data-testid="admin-controls">
          <h2 className="section-title">Administration</h2>
          <div className="control-grid">
            <div className="field">
              <label htmlFor="assign-tech">Assign an available technician</label>
              <select
                id="assign-tech"
                value={selectedTech}
                onChange={(event) => setSelectedTech(event.target.value)}
                data-testid="assign-select"
              >
                <option value="">Choose a technician</option>
                {availableTechnicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.user?.fullName} — {technician.specialization}
                  </option>
                ))}
              </select>
              <span className="hint">Unavailable technicians are not offered.</span>
              <div className="inline-actions">
                <button type="button" className="btn btn-secondary btn-small" onClick={assignTechnician} disabled={busy} data-testid="assign-button">
                  Assign
                </button>
                {ticket.technician && (
                  <button type="button" className="btn btn-secondary btn-small" onClick={unassignTechnician} disabled={busy} data-testid="unassign-button">
                    Unassign
                  </button>
                )}
              </div>
            </div>

            <div className="field">
              <label htmlFor="status-select">Status</label>
              <select
                id="status-select"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                data-testid="status-select"
              >
                {TICKET_STATUSES.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
              <div className="inline-actions">
                <button type="button" className="btn btn-secondary btn-small" onClick={changeStatus} disabled={busy} data-testid="update-status-button">
                  Update status
                </button>
              </div>
            </div>

            <div className="field">
              <span className="label-like">Danger zone</span>
              <span className="hint">Deleting a ticket also deletes all of its comments.</span>
              <button
                type="button"
                className="btn btn-danger btn-small"
                onClick={() =>
                  setConfirm({
                    title: 'Delete ticket?',
                    message: `"${ticket.title}" and all of its comments will be permanently deleted.`,
                    confirmLabel: 'Delete ticket',
                    action: deleteTicket,
                  })
                }
                data-testid="delete-ticket-button"
              >
                Delete ticket
              </button>
            </div>
          </div>
        </section>
      )}

      {!isAdmin && canUpdateStatus && (
        <section className="card" data-testid="technician-controls">
          <h2 className="section-title">Update status</h2>
          <div className="control-grid">
            <div className="field">
              <label htmlFor="tech-status-select">Status</label>
              <select
                id="tech-status-select"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                data-testid="status-select"
              >
                {TICKET_STATUSES.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
            </div>
            <div className="field align-end">
              <button type="button" className="btn btn-primary" onClick={changeStatus} disabled={busy} data-testid="update-status-button">
                Update status
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-heading">
          <h2>Comments</h2>
          <span className="subtle">{comments.length} comment{comments.length === 1 ? '' : 's'}</span>
        </div>

        {canComment ? (
          <form className="comment-form" onSubmit={addComment} noValidate>
            <div className="field">
              <label htmlFor="new-comment">Add a comment</label>
              <textarea
                id="new-comment"
                rows={3}
                value={commentText}
                onChange={(event) => {
                  setCommentText(event.target.value)
                  setCommentError('')
                }}
                placeholder="Share an update or ask a question…"
                data-testid="add-comment-input"
              />
              <FieldError message={commentError} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy} data-testid="add-comment-submit">
              Post comment
            </button>
          </form>
        ) : (
          <p className="hint" data-testid="comment-unavailable">
            {isAdmin
              ? 'Administrators can read comments but cannot post them.'
              : 'Only the owning employee or the assigned technician can comment.'}
          </p>
        )}

        <PageState
          loading={false}
          error=""
          empty={comments.length === 0}
          emptyText="No comments yet."
        >
          <div className="comment-list" data-testid="comments-list">
            {comments.map((comment) => {
              const mine = comment.author?.id === user?.id
              const editing = editingCommentId === comment.id
              return (
                <article className="comment" key={comment.id} data-testid="comment-item" data-comment-id={comment.id}>
                  <header className="comment-header">
                    <div>
                      <strong>{comment.author?.fullName || 'Unknown user'}</strong>
                      <span className="subtle">{formatDate(comment.createdAt)}</span>
                    </div>
                    {mine && !editing && (
                      <div className="inline-actions">
                        <button type="button" className="btn btn-secondary btn-small" onClick={() => beginEditComment(comment)} data-testid="edit-comment-button">
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() =>
                            setConfirm({
                              title: 'Delete comment?',
                              message: 'This comment will be permanently deleted.',
                              confirmLabel: 'Delete comment',
                              action: () => deleteComment(comment.id),
                            })
                          }
                          data-testid="delete-comment-button"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </header>
                  {editing ? (
                    <div className="comment-edit">
                      <textarea
                        rows={3}
                        value={editingContent}
                        onChange={(event) => setEditingContent(event.target.value)}
                        aria-label="Edit comment"
                        data-testid="comment-edit-input"
                      />
                      <div className="inline-actions">
                        <button type="button" className="btn btn-primary btn-small" onClick={() => saveComment(comment.id)} disabled={busy} data-testid="save-comment-button">
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => {
                            setEditingCommentId(null)
                            setEditingContent('')
                            setCommentError('')
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="comment-content" data-testid="comment-content">{comment.content}</p>
                  )}
                </article>
              )
            })}
          </div>
        </PageState>
      </section>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title || 'Please confirm'}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel || 'Confirm'}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.action()}
      />
    </div>
  )
}
