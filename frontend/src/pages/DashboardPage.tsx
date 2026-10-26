import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../api/client'
import { getEmployeeDashboard, getManagerDashboard } from '../api/dashboard'
import { useAuth } from '../auth/AuthContext'
import { Icon } from '../components/Icon'
import type { DashboardSummary } from '../types/dashboard'

interface Metric {
  label: string
  value: string
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

function formatCurrency(value: string): string {
  const amount = Number.parseFloat(value)
  return Number.isFinite(amount) ? currencyFormatter.format(amount) : '—'
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && [401, 403].includes(error.status)) {
    return 'Your session may have expired or may not have access to this dashboard. Please sign in again or contact an administrator.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'We could not load dashboard data. Please try again.'
}

function metricsFor(summary: DashboardSummary): Metric[] {
  return [
    { label: 'Total expenses', value: String(summary.total_expenses) },
    { label: 'Pending', value: String(summary.pending_count) },
    { label: 'Approved', value: String(summary.approved_count) },
    { label: 'Rejected', value: String(summary.rejected_count) },
    { label: 'Total submitted', value: formatCurrency(summary.total_amount_submitted) },
    { label: 'Total approved', value: formatCurrency(summary.total_amount_approved) },
  ]
}

export function DashboardPage() {
  const { user } = useAuth()
  const isEmployee = user?.role === 'EMPLOYEE'
  const dashboardTitle = isEmployee ? 'Your workspace' : 'Team dashboard'
  const dashboardDescription = isEmployee
    ? 'A clear view of your expense activity and reimbursement progress.'
    : 'Understand how your team’s expense activity is moving.'
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    const loadDashboard = isEmployee ? getEmployeeDashboard : getManagerDashboard

    loadDashboard(controller.signal)
      .then(setSummary)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setSummary(null)
        setError(getErrorMessage(reason))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [isEmployee, retryKey])

  const metrics = useMemo(() => summary ? metricsFor(summary) : [], [summary])

  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">{user?.role.toLowerCase()} workspace</p>
        <h1>{dashboardTitle}</h1>
        <p>{dashboardDescription}</p>
      </div>
      {isLoading && (
        <div className="surface dashboard-status" role="status">
          <span className="spinner" />
          <span>Loading your latest expense summary</span>
        </div>
      )}
      {!isLoading && error && (
        <section className="surface dashboard-status dashboard-status--error" role="alert">
          <div className="empty-panel__mark"><Icon name="grid" /></div>
          <div>
            <h2>Dashboard unavailable</h2>
            <p>{error}</p>
            <button className="button button--secondary" type="button" onClick={() => setRetryKey((key) => key + 1)}>
              Try again
            </button>
          </div>
        </section>
      )}
      {!isLoading && !error && summary && (
        <div className="dashboard-grid" aria-label="Expense summary">
          {metrics.map((metric) => (
            <section className="surface metric-card" key={metric.label}>
              <p className="metric-card__label">{metric.label}</p>
              <p className="metric-card__value">{metric.value}</p>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
