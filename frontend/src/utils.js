export const ROLE_HOME = {
  ADMIN: '/admin/dashboard',
  EMPLOYEE: '/employee/dashboard',
  TECHNICIAN: '/technician/dashboard',
}

export const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_RESPONSE',
  'RESOLVED',
  'CLOSED',
]

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export const STATUS_LABELS = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_RESPONSE: 'Waiting for response',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

export const PRIORITY_LABELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const ROLE_LABELS = {
  ADMIN: 'Administrator',
  EMPLOYEE: 'Employee',
  TECHNICIAN: 'Technician',
}

export function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function shortId(value) {
  return value ? value.slice(0, 8) : '—'
}

export function personName(profile) {
  return profile?.user?.fullName || '—'
}

export function ticketPageQuery(page, size, sort) {
  return { page, size, sort }
}

export function validateTicketForm(values) {
  const errors = {}
  if (!values.title || values.title.trim().length < 5 || values.title.trim().length > 100) {
    errors.title = 'Title must be between 5 and 100 characters.'
  }
  if (
    !values.description ||
    values.description.trim().length < 10 ||
    values.description.trim().length > 2000
  ) {
    errors.description = 'Description must be between 10 and 2000 characters.'
  }
  if (!values.priority) errors.priority = 'Choose a priority.'
  if (!values.categoryId) errors.categoryId = 'Choose a category.'
  return errors
}

export function validateComment(content) {
  if (!content || content.trim().length < 2 || content.trim().length > 1000) {
    return 'Comment must be between 2 and 1000 characters.'
  }
  return ''
}

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '')
}
