import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../api/client'
import { getCategories, getExpense, getExpenseReceipt, getExpenses } from '../api/expenses'
import { Icon } from '../components/Icon'
import type {
  Expense,
  ExpenseCategory,
  ExpenseFilters,
  ExpenseStatus,
  PaginatedResponse,
} from '../types/expenses'

const emptyFilters: ExpenseFilters = {
  status: '',
  category: '',
  date_from: '',
  date_to: '',
  min_amount: '',
  max_amount: '',
}

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

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && [401, 403].includes(error.status)) {
    return 'Your session may have expired or you may not have permission to view these expenses.'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  return <span className={`status-badge status-badge--${status.toLowerCase()}`}>{status}</span>
}

function ReceiptButton({ expenseId }: { expenseId: number }) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const downloadReceipt = async () => {
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
      <button className="text-button" type="button" onClick={() => void downloadReceipt()} disabled={isDownloading}>
        {isDownloading ? 'Downloading…' : 'Download receipt'}
      </button>
      {error && <span className="receipt-action__error" role="alert">{error}</span>}
    </span>
  )
}

function ExpenseDetail({ expenseId, onBack }: { expenseId: number; onBack: () => void }) {
  const [expense, setExpense] = useState<Expense | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    getExpense(expenseId, controller.signal)
      .then(setExpense)
      .catch((reason: unknown) => {
        if (isAbort(reason)) return
        setExpense(null)
        setError(errorMessage(reason, 'The expense details could not be loaded.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [expenseId, retryKey])

  if (isLoading) {
    return <div className="surface dashboard-status" role="status"><span className="spinner" /><span>Loading expense details</span></div>
  }
  if (error) {
    return (
      <section className="surface dashboard-status dashboard-status--error" role="alert">
        <div className="empty-panel__mark"><Icon name="receipt" /></div>
        <div><h2>Expense unavailable</h2><p>{error}</p><button className="button button--secondary" type="button" onClick={() => setRetryKey((key) => key + 1)}>Try again</button><button className="button button--secondary" type="button" onClick={onBack}>Back to expenses</button></div>
      </section>
    )
  }
  if (!expense) return null

  return (
    <>
      <button className="back-button" type="button" onClick={onBack}>← Back to expenses</button>
      <div className="page-heading expense-detail-heading">
        <p className="eyebrow">Expense detail</p>
        <h1>{expense.title}</h1>
        <p>{formatAmount(expense.amount, expense.currency)} · <StatusBadge status={expense.status} /></p>
      </div>
      <div className="expense-detail-grid">
        <section className="surface detail-section">
          <h2>Expense information</h2>
          <dl className="detail-list">
            <div><dt>Category</dt><dd>Category #{expense.category}</dd></div>
            <div><dt>Expense date</dt><dd>{formatDate(expense.expense_date)}</dd></div>
            <div><dt>Submitted</dt><dd>{formatDateTime(expense.created_at)}</dd></div>
            <div><dt>Last updated</dt><dd>{formatDateTime(expense.updated_at)}</dd></div>
            <div><dt>Amount</dt><dd>{formatAmount(expense.amount, expense.currency)}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={expense.status} /></dd></div>
          </dl>
          <h3>Description</h3>
          <p className="detail-description">{expense.description || 'No description provided.'}</p>
          <h3>Receipt</h3>
          {expense.receipt ? <ReceiptButton expenseId={expense.id} /> : <p className="muted-copy">No receipt attached.</p>}
        </section>
        <section className="surface detail-section">
          <h2>Decision history</h2>
          {expense.decisions.length === 0 ? (
            <p className="muted-copy">No decisions have been recorded.</p>
          ) : (
            <div className="decision-list">
              {expense.decisions.map((decision) => (
                <article className="decision-item" key={decision.id}>
                  <div><StatusBadge status={decision.decision} /><span>{decision.manager}</span></div>
                  <time dateTime={decision.decided_at}>{formatDateTime(decision.decided_at)}</time>
                  {decision.comment && <p>{decision.comment}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

interface ExpenseListProps {
  onSelect: (id: number) => void
}

function ExpenseList({ onSelect }: ExpenseListProps) {
  const [draftFilters, setDraftFilters] = useState<ExpenseFilters>(emptyFilters)
  const [filters, setFilters] = useState<ExpenseFilters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedResponse<Expense> | null>(null)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getCategories(controller.signal)
      .then((response) => setCategories(response.results))
      .catch((reason: unknown) => {
        if (!isAbort(reason)) setCategoryError(errorMessage(reason, 'Category filters are unavailable.'))
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    getExpenses(filters, page, controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (isAbort(reason)) return
        setData(null)
        setError(errorMessage(reason, 'Expenses are temporarily unavailable.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [filters, page])

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )
  const hasFilters = Object.values(filters).some(Boolean)
  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setFilters({ ...draftFilters })
  }
  const clearFilters = () => {
    setDraftFilters(emptyFilters)
    setFilters(emptyFilters)
    setPage(1)
  }

  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Expense history</p>
        <h1>My expenses</h1>
        <p>Review your submissions, statuses, and reimbursement history.</p>
      </div>
      <section className="surface filters-panel">
        <form className="filters-form" onSubmit={submitFilters}>
          <div className="filter-field"><label htmlFor="expense-status">Status</label><select id="expense-status" value={draftFilters.status} onChange={(event) => setDraftFilters({ ...draftFilters, status: event.target.value as ExpenseFilters['status'] })}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></div>
          <div className="filter-field"><label htmlFor="expense-category">Category</label><select id="expense-category" value={draftFilters.category} onChange={(event) => setDraftFilters({ ...draftFilters, category: event.target.value })}><option value="">All categories</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div>
          <div className="filter-field"><label htmlFor="date-from">Date from</label><input id="date-from" type="date" value={draftFilters.date_from} onChange={(event) => setDraftFilters({ ...draftFilters, date_from: event.target.value })} /></div>
          <div className="filter-field"><label htmlFor="date-to">Date to</label><input id="date-to" type="date" value={draftFilters.date_to} onChange={(event) => setDraftFilters({ ...draftFilters, date_to: event.target.value })} /></div>
          <div className="filter-field"><label htmlFor="min-amount">Minimum amount</label><input id="min-amount" inputMode="decimal" type="number" min="0" step="0.01" value={draftFilters.min_amount} onChange={(event) => setDraftFilters({ ...draftFilters, min_amount: event.target.value })} /></div>
          <div className="filter-field"><label htmlFor="max-amount">Maximum amount</label><input id="max-amount" inputMode="decimal" type="number" min="0" step="0.01" value={draftFilters.max_amount} onChange={(event) => setDraftFilters({ ...draftFilters, max_amount: event.target.value })} /></div>
          <div className="filter-actions"><button className="button button--primary filter-submit" type="submit">Apply filters</button><button className="button button--secondary" type="button" onClick={clearFilters} disabled={!hasFilters && !Object.values(draftFilters).some(Boolean)}>Clear</button></div>
        </form>
        {categoryError && <p className="filter-note" role="status">{categoryError}</p>}
      </section>
      {error && <section className="surface list-message list-message--error" role="alert"><strong>Could not load expenses</strong><span>{error}</span><button className="button button--secondary" type="button" onClick={() => setFilters({ ...filters })}>Try again</button></section>}
      {isLoading && <div className="surface dashboard-status" role="status"><span className="spinner" /><span>Loading expenses</span></div>}
      {!isLoading && !error && data && data.results.length === 0 && (
        <section className="surface list-message"><div className="empty-panel__mark"><Icon name="receipt" /></div><div><h2>{hasFilters ? 'No matching expenses' : 'No expenses yet'}</h2><p>{hasFilters ? 'Try adjusting or clearing your filters.' : 'Your submitted expenses will appear here.'}</p></div></section>
      )}
      {!isLoading && !error && data && data.results.length > 0 && (
        <section className="surface expense-table-panel">
          <div className="table-header"><div><h2>Expenses</h2><p>{data.count} result{data.count === 1 ? '' : 's'}</p></div><span className="page-count">Page {page}</span></div>
          <div className="table-scroll">
            <table className="expense-table">
              <thead><tr><th scope="col">Expense</th><th scope="col">Date</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Submitted</th><th scope="col">Receipt</th></tr></thead>
              <tbody>{data.results.map((expense) => <tr key={expense.id}><th scope="row"><button className="expense-title" type="button" onClick={() => onSelect(expense.id)}>{expense.title}</button><span className="expense-category">{categoryNames.get(expense.category) ?? `Category #${expense.category}`}</span></th><td>{formatDate(expense.expense_date)}</td><td className="amount-cell">{formatAmount(expense.amount, expense.currency)}</td><td><StatusBadge status={expense.status} /></td><td>{formatDateTime(expense.created_at)}</td><td>{expense.receipt ? <span className="receipt-present" aria-label="Receipt available">Available</span> : <span className="muted-copy">None</span>}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="pagination"><span>Showing {data.results.length} of {data.count}</span><div><button className="button button--secondary" type="button" disabled={!data.previous} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><button className="button button--secondary" type="button" disabled={!data.next} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
        </section>
      )}
    </>
  )
}

export function ExpensesPage({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const detailMatch = path.match(/^\/expenses\/(\d+)\/?$/)
  if (detailMatch) return <ExpenseDetail expenseId={Number(detailMatch[1])} onBack={() => onNavigate('/expenses')} />
  return <ExpenseList onSelect={(id) => onNavigate(`/expenses/${id}`)} />
}
