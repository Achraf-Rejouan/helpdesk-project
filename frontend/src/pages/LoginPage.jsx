import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../api/client'
import { ErrorBanner, FieldError } from '../components/UI'
import { ROLE_HOME, validateEmail } from '../utils'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [busy, setBusy] = useState(false)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
    setGeneralError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!validateEmail(form.email)) nextErrors.email = 'Enter a valid email address.'
    if (!form.password) nextErrors.password = 'Enter your password.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setGeneralError('')
    try {
      const user = await login(form.email.trim(), form.password)
      const from = location.state?.from
      navigate(from && from !== '/login' ? from : ROLE_HOME[user.role], { replace: true })
    } catch (error) {
      setGeneralError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">HD</span>
          <div>
            <h1>HelpDesk</h1>
            <p>IT support ticket system</p>
          </div>
        </div>
        <h2>Sign in</h2>
        <p className="muted">Use the account provided by your administrator.</p>

        <ErrorBanner message={generalError} />

        <form onSubmit={handleSubmit} className="form" noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              aria-invalid={Boolean(errors.email)}
              data-testid="login-email"
            />
            <FieldError message={errors.email} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              aria-invalid={Boolean(errors.password)}
              data-testid="login-password"
            />
            <FieldError message={errors.password} />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy} data-testid="login-submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          New employee? <Link to="/register">Create an account</Link>
        </p>
      </div>
      <aside className="auth-side">
        <h2>Support that stays organised.</h2>
        <p>
          Report an IT issue, follow its progress, and keep every conversation in one
          place. Technicians see their assigned queue; administrators see the whole
          picture.
        </p>
        <ul>
          <li>Role-aware dashboards</li>
          <li>Ticket assignment and status tracking</li>
          <li>Comments and full history</li>
        </ul>
      </aside>
    </div>
  )
}
