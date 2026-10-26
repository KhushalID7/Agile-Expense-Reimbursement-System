import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../api/client'
import {
  approveExpense,
  getCategories,
  getExpense,
  getExpenseReceipt,
  getPendingApprovals,
  rejectExpense,
} from '../api/expenses'
import { useAuth } from '../auth/useAuth'
import { Icon } from '../components/Icon'
import type {
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  PaginatedResponse,
} from '../types/expenses'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

function formatAmount(amount: string, currency: string): string {
  const value = Number.parseFloat(amount)
  if (!Number.isFinite(value)) return `${amount} ${currency}`
  return currency === 'INR'
    ? currencyFormatter.format(value)
    : `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)} ${currency}`
}

function formatDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && [401, 403].includes(error.status)) {
    return 'Your session may have expired or you may not have permission to manage approvals.'
  }
  if (error instanceof ApiError && error.status === 404) return 'This expense is no longer available to review.'
  if (error instanceof ApiError && error.status === 409) return 'This expense is no longer pending. The queue has been refreshed.'
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  return <span className={`status-badge status-badge--${status.toLowerCase()}`}>{status}</span>
}

function ReceiptButton({ expenseId }: { expenseId: number }) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = async () => {
    setIsDownloading(true)
    setError(null)
    try {
      const blob = await getExpenseReceipt(expenseId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'receipt'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (reason: unknown) {
      setError(errorMessage(reason, 'The receipt could not be downloaded.'))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <span className="receipt-action">
      <button className="text-button" type="button" disabled={isDownloading} onClick={() => void download()}>
        {isDownloading ? 'Downloading…' : 'Download receipt'}
      </button>
      {error && <span className="receipt-action__error" role="alert">{error}</span>}
    </span>
  )
}

interface DecisionPanelProps {
  expense: Expense
  onComplete: (expense: Expense) => void
  onRefresh: () => void
}

function DecisionPanel({ expense, onComplete, onRefresh }: DecisionPanelProps) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setMode(null)
    setComment('')
    setError(null)
    setSuccess(null)
  }, [expense.id])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedComment = comment.trim()
    if (mode === 'reject' && !trimmedComment) {
      setError('Enter a rejection reason before continuing.')
      setSuccess(null)
      return
    }
    if (!mode) return
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = mode === 'approve'
        ? await approveExpense(expense.id, trimmedComment)
        : await rejectExpense(expense.id, trimmedComment)
      onComplete(updated)
      setMode(null)
      setComment('')
      setSuccess(
        updated.status === 'APPROVED'
          ? 'Expense approved successfully.'
          : 'Expense rejected successfully.',
      )
    } catch (reason: unknown) {
      setError(errorMessage(reason, 'The decision could not be saved. Please try again.'))
      if (reason instanceof ApiError && reason.status === 409) onRefresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (expense.status !== 'PENDING') {
    return (
      <>
        {success && <p className="decision-success" role="status">{success}</p>}
        <p className="muted-copy">This expense has already been decided. No further action is available.</p>
      </>
    )
  }

  if (!mode) {
    return (
      <>
        {success && <p className="decision-success" role="status">{success}</p>}
        <div className="decision-actions">
          <button className="button button--primary" type="button" onClick={() => { setSuccess(null); setMode('approve') }}>Approve expense</button>
          <button className="button button--danger" type="button" onClick={() => { setSuccess(null); setMode('reject') }}>Reject expense</button>
        </div>
      </>
    )
  }

  return (
    <form className="decision-panel" onSubmit={(event) => void submit(event)}>
      <h3>{mode === 'approve' ? 'Approve this expense?' : 'Reject this expense?'}</h3>
      <p>{mode === 'approve' ? 'You may add an optional comment for the employee.' : 'A rejection reason is required and will be visible in the decision history.'}</p>
      <label htmlFor="decision-comment">{mode === 'approve' ? 'Comment (optional)' : 'Rejection reason'}</label>
      <textarea id="decision-comment" rows={4} value={comment} aria-invalid={Boolean(error)} onChange={(event) => setComment(event.target.value)} autoFocus />
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="decision-actions">
        <button className={`button ${mode === 'approve' ? 'button--primary' : 'button--danger'}`} type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : mode === 'approve' ? 'Confirm approval' : 'Confirm rejection'}</button>
        <button className="button button--secondary" type="button" disabled={isSubmitting} onClick={() => { setMode(null); setError(null); setSuccess(null) }}>Cancel</button>
      </div>
    </form>
  )
}

function ReviewExpense({ expenseId, onBack, onQueueRefresh }: { expenseId: number; onBack: () => void; onQueueRefresh: () => void }) {
  const [expense, setExpense] = useState<Expense | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [retryKey, setRetryKey] = useState(0)

  const loadExpense = useCallback(() => {
    const controller = new AbortController()
    // This state represents the lifecycle of the cancellable request started below.
    // oxlint-disable-next-line react/set-state-in-effect
    setIsLoading(true)
    setError(null)
    getExpense(expenseId, controller.signal)
      .then(setExpense)
      .catch((reason: unknown) => {
        if (!isAbort(reason)) {
          setExpense(null)
          setError(errorMessage(reason, 'The expense could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [expenseId, retryKey])

  useEffect(() => loadExpense(), [loadExpense])

  if (isLoading) return <div className="surface dashboard-status" role="status"><span className="spinner" /><span>Loading expense review</span></div>
  if (error) {
    return <section className="surface dashboard-status dashboard-status--error" role="alert"><div className="empty-panel__mark"><Icon name="receipt" /></div><div><h2>Review unavailable</h2><p>{error}</p><button className="button button--secondary" type="button" onClick={() => setRetryKey((key) => key + 1)}>Try again</button><button className="button button--secondary" type="button" onClick={onBack}>Back to approvals</button></div></section>
  }
  if (!expense) return null

  const complete = (updated: Expense) => {
    setExpense(updated)
    onQueueRefresh()
  }

  return (
    <>
      <button className="back-button" type="button" onClick={onBack}>← Back to approvals</button>
      <div className="page-heading expense-detail-heading">
        <p className="eyebrow">Approval review · {expense.employee}</p>
        <h1>{expense.title}</h1>
        <p>{formatAmount(expense.amount, expense.currency)} · <StatusBadge status={expense.status} /></p>
      </div>
      <div className="expense-detail-grid">
        <section className="surface detail-section">
          <h2>Expense information</h2>
          <dl className="detail-list">
            <div><dt>Employee</dt><dd>{expense.employee}</dd></div>
            <div><dt>Category</dt><dd>Category #{expense.category}</dd></div>
            <div><dt>Expense date</dt><dd>{formatDate(expense.expense_date)}</dd></div>
            <div><dt>Submitted</dt><dd>{formatDateTime(expense.created_at)}</dd></div>
            <div><dt>Amount</dt><dd>{formatAmount(expense.amount, expense.currency)}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={expense.status} /></dd></div>
          </dl>
          <h3>Description</h3>
          <p className="detail-description">{expense.description || 'No description provided.'}</p>
          <h3>Receipt</h3>
          {expense.receipt ? <ReceiptButton expenseId={expense.id} /> : <p className="muted-copy">No receipt attached.</p>}
        </section>
        <section className="surface detail-section">
          <h2>Decision</h2>
          <DecisionPanel expense={expense} onComplete={complete} onRefresh={() => setRetryKey((key) => key + 1)} />
          <h2 className="decision-history-heading">Decision history</h2>
          {expense.decisions.length === 0 ? <p className="muted-copy">No decisions have been recorded.</p> : <div className="decision-list">{expense.decisions.map((decision) => <article className="decision-item" key={decision.id}><div><StatusBadge status={decision.decision} /><span>{decision.manager}</span></div><time dateTime={decision.decided_at}>{formatDateTime(decision.decided_at)}</time>{decision.comment && <p>{decision.comment}</p>}</article>)}</div>}
        </section>
      </div>
    </>
  )
}

function ApprovalQueue({ onSelect }: { onSelect: (id: number) => void }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedResponse<Expense> | null>(null)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getCategories(controller.signal)
      .then((response) => setCategories(response.results))
      .catch((reason: unknown) => {
        if (!isAbort(reason)) setCategoryError('Category names are temporarily unavailable.')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    // This state represents the lifecycle of the cancellable request started below.
    // oxlint-disable-next-line react/set-state-in-effect
    setIsLoading(true)
    setError(null)
    getPendingApprovals(page, controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (!isAbort(reason)) {
          setData(null)
          setError(errorMessage(reason, 'The approval queue is temporarily unavailable.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [page, retryKey])

  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])

  return (
    <>
      <div className="page-heading"><p className="eyebrow">Manager workspace</p><h1>Approvals</h1><p>Review pending expenses assigned to your team.</p></div>
      {categoryError && <p className="filter-note" role="status">{categoryError}</p>}
      {error && <section className="surface list-message list-message--error" role="alert"><strong>Could not load approvals</strong><span>{error}</span><button className="button button--secondary" type="button" onClick={() => setRetryKey((key) => key + 1)}>Try again</button></section>}
      {isLoading && <div className="surface dashboard-status" role="status"><span className="spinner" /><span>Loading pending approvals</span></div>}
      {!isLoading && !error && data && data.results.length === 0 && <section className="surface list-message"><div className="empty-panel__mark"><Icon name="check" /></div><div><h2>Approval queue is clear</h2><p>There are no pending expenses assigned to you right now.</p></div></section>}
      {!isLoading && !error && data && data.results.length > 0 && <section className="surface expense-table-panel"><div className="table-header"><div><h2>Pending expenses</h2><p>{data.count} awaiting review</p></div><span className="page-count">Page {page}</span></div><div className="table-scroll"><table className="expense-table approvals-table"><thead><tr><th scope="col">Employee</th><th scope="col">Expense</th><th scope="col">Date</th><th scope="col">Amount</th><th scope="col">Submitted</th><th scope="col">Receipt</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody>{data.results.map((expense) => <tr key={expense.id}><th scope="row">{expense.employee}</th><td><button className="expense-title" type="button" onClick={() => onSelect(expense.id)}>{expense.title}</button><span className="expense-category">{categoryNames.get(expense.category) ?? `Category #${expense.category}`}</span></td><td>{formatDate(expense.expense_date)}</td><td className="amount-cell">{formatAmount(expense.amount, expense.currency)}</td><td>{formatDateTime(expense.created_at)}</td><td>{expense.receipt ? <span className="receipt-present">Available</span> : <span className="muted-copy">None</span>}</td><td><button className="text-button" type="button" onClick={() => onSelect(expense.id)}>Review</button></td></tr>)}</tbody></table></div><div className="pagination"><span>Showing {data.results.length} of {data.count}</span><div><button className="button button--secondary" type="button" disabled={!data.previous} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><button className="button button--secondary" type="button" disabled={!data.next} onClick={() => setPage((current) => current + 1)}>Next</button></div></div></section>}
    </>
  )
}

export function ApprovalsPage({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const { user } = useAuth()
  const detailMatch = path.match(/^\/approvals\/(\d+)\/?$/)
  if (!user || !['MANAGER', 'ADMIN'].includes(user.role)) {
    return <section className="surface dashboard-status dashboard-status--error" role="alert"><div><h2>Approval access unavailable</h2><p>This workspace is limited to managers and administrators.</p></div></section>
  }
  if (detailMatch) return <ReviewExpense expenseId={Number(detailMatch[1])} onBack={() => onNavigate('/approvals')} onQueueRefresh={() => undefined} />
  return <ApprovalQueue onSelect={(id) => onNavigate(`/approvals/${id}`)} />
}
