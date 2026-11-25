import { Link } from 'react-router-dom'

export default function ForbiddenPage() {
  return (
    <div className="message-page" data-testid="forbidden-page">
      <div className="message-card">
        <span className="message-code">403</span>
        <h1>Not allowed</h1>
        <p>Your role does not have access to this page.</p>
        <Link className="btn btn-primary" to="/">
          Go to my dashboard
        </Link>
      </div>
    </div>
  )
}
