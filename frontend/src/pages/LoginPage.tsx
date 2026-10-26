import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { BrandMark } from '../components/BrandMark'

export function LoginPage() {
  const { signIn, error: sessionError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter your username and password to continue.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await signIn(username.trim(), password)
    } catch (reason: unknown) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to sign in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <BrandMark />
        <div className="login-brand__copy">
          <p className="eyebrow eyebrow--light">Finance operations</p>
          <h1>Make every claim count.</h1>
          <p>One clear place to submit, review, and keep track of business expenses.</p>
        </div>
        <p className="login-brand__footer">Private workspace · Session protected</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to your workspace</h2>
          <p className="login-card__intro">Use your organization account to continue.</p>
          {(error || sessionError) && <Alert>{error ?? sessionError}</Alert>}
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <button className="button button--primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
