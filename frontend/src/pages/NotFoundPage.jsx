import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="message-page" data-testid="not-found-page">
      <div className="message-card">
        <span className="message-code">404</span>
        <h1>Page not found</h1>
        <p>The page you asked for does not exist.</p>
        <Link className="btn btn-primary" to="/">
          Go to my dashboard
        </Link>
      </div>
    </div>
  )
}
