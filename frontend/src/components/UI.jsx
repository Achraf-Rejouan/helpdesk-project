import { useEffect } from 'react'
import { PRIORITY_LABELS, ROLE_LABELS, STATUS_LABELS } from '../utils'

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function PageState({ loading, error, empty, emptyText, onRetry, children }) {
  if (loading) return <Spinner />
  if (error) {
    return (
      <div className="error-banner" role="alert" data-testid="error-banner">
        <strong>Could not load data.</strong>
        <p>{error}</p>
        {onRetry && (
          <button type="button" className="btn btn-secondary btn-small" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="empty-state" data-testid="empty-state">
        <p>{emptyText || 'Nothing here yet.'}</p>
      </div>
    )
  }
  return children
}

export function ErrorBanner({ message, children }) {
  if (!message && !children) return null
  return (
    <div className="error-banner" role="alert" data-testid="error-banner">
      {message && <p>{message}</p>}
      {children}
    </div>
  )
}

export function Notice({ message, type = 'success' }) {
  if (!message) return null
  return (
    <div className={`notice notice-${type}`} role="status" data-testid="notice">
      {message}
    </div>
  )
}

export function FieldError({ message }) {
  if (!message) return null
  return (
    <span className="field-error" role="alert">
      {message}
    </span>
  )
}

export function StatusBadge({ status, testId }) {
  return (
    <span className={`badge status-${String(status).toLowerCase()}`} data-testid={testId}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function PriorityBadge({ priority, testId }) {
  return (
    <span className={`badge priority-${String(priority).toLowerCase()}`} data-testid={testId}>
      {PRIORITY_LABELS[priority] || priority}
    </span>
  )
}

export function RoleBadge({ role }) {
  return <span className={`badge role-${String(role).toLowerCase()}`}>{ROLE_LABELS[role] || role}</span>
}

export function Pagination({ page, totalPages, totalElements, size, onPageChange, onSizeChange }) {
  const safeTotalPages = Math.max(totalPages || 0, 1)
  return (
    <div className="pagination" data-testid="pagination">
      <span>
        Page {page + 1} of {safeTotalPages} · {totalElements} result{totalElements === 1 ? '' : 's'}
      </span>
      <div className="pagination-controls">
        <label className="inline-label">
          Page size
          <select
            value={size}
            onChange={(event) => onSizeChange(Number(event.target.value))}
            data-testid="page-size"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </label>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          data-testid="page-prev"
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          disabled={page + 1 >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
          data-testid="page-next"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export function Modal({ open, title, onClose, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title = 'Please confirm',
  message,
  confirmLabel = 'Confirm',
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={onConfirm}
          disabled={busy}
          data-testid="confirm-action"
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
