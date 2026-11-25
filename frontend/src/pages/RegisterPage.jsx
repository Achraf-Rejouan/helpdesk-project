import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { errorMessage, fieldErrors as readFieldErrors } from '../api/client'
import { ErrorBanner, FieldError } from '../components/UI'
import { ROLE_HOME, validateEmail } from '../utils'

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  department: '',
  phone: '',
}

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [busy, setBusy] = useState(false)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
    setGeneralError('')
  }

  function validate() {
    const next = {}
    if (form.fullName.trim().length < 3 || form.fullName.trim().length > 100) {
      next.fullName = 'Full name must be between 3 and 100 characters.'
    }
    if (!validateEmail(form.email)) next.email = 'Enter a valid email address.'
    if (form.password.length < 8 || form.password.length > 72) {
      next.password = 'Password must be between 8 and 72 characters.'
    }
    if (form.department.trim().length < 2 || form.department.trim().length > 100) {
      next.department = 'Department must be between 2 and 100 characters.'
    }
    if (form.phone.length > 30) next.phone = 'Phone must be 30 characters or fewer.'
    return next
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setGeneralError('')
    try {
      const user = await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        department: form.department.trim(),
        phone: form.phone.trim() || null,
      })
      navigate(ROLE_HOME[user.role], { replace: true })
    } catch (error) {
      const serverFields = readFieldErrors(error)
      if (Object.keys(serverFields).length > 0) {
        setErrors(serverFields)
      }
      if (error?.response?.status === 409) {
        setErrors((current) => ({ ...current, email: error.response.data.message }))
      } else {
        setGeneralError(errorMessage(error))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <span className="brand-mark">HD</span>
          <div>
            <h1>Create your account</h1>
            <p>Employee registration</p>
          </div>
        </div>
        <p className="muted">
          Public registration always creates an Employee account. Technician and
          administrator accounts are managed by an administrator.
        </p>

        <ErrorBanner message={generalError} />

        <form onSubmit={handleSubmit} className="form" noValidate>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                value={form.fullName}
                onChange={(event) => update('fullName', event.target.value)}
                aria-invalid={Boolean(errors.fullName)}
                data-testid="register-fullname"
              />
              <FieldError message={errors.fullName} />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                aria-invalid={Boolean(errors.email)}
                data-testid="register-email"
              />
              <FieldError message={errors.email} />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                aria-invalid={Boolean(errors.password)}
                data-testid="register-password"
              />
              <FieldError message={errors.password} />
              <span className="hint">8–72 characters.</span>
            </div>
            <div className="field">
              <label htmlFor="department">Department</label>
              <input
                id="department"
                value={form.department}
                onChange={(event) => update('department', event.target.value)}
                aria-invalid={Boolean(errors.department)}
                data-testid="register-department"
              />
              <FieldError message={errors.department} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone <span className="optional">(optional)</span></label>
              <input
                id="phone"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                aria-invalid={Boolean(errors.phone)}
                data-testid="register-phone"
              />
              <FieldError message={errors.phone} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy} data-testid="register-submit">
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
