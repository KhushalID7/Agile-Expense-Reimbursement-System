import { useAuth } from '../auth/AuthContext'
import { Icon } from '../components/Icon'
import { DashboardPage } from './DashboardPage'
import { ExpensesPage } from './ExpensesPage'
import { SubmitExpensePage } from './SubmitExpensePage'
import { ApprovalsPage } from './ApprovalsPage'

const pageCopy: Record<string, { title: string; description: string; note: string }> = {
  '/dashboard': {
    title: 'Your workspace',
    description: 'A clear view of the expense activity that matters to you.',
    note: 'Dashboard data will appear here once the workspace is connected.',
  },
  '/expenses': {
    title: 'My expenses',
    description: 'Review submissions, statuses, and reimbursement history.',
    note: 'Expense history and filtering are ready for the next product phase.',
  },
  '/expenses/new': {
    title: 'Submit an expense',
    description: 'Capture a business expense with the details your reviewers need.',
    note: 'The submission form is coming next. No expense has been created.',
  },
  '/approvals': {
    title: 'Approvals',
    description: 'Review pending claims assigned to your team.',
    note: 'Approval queue controls will be added in the next product phase.',
  },
  '/team-dashboard': {
    title: 'Team dashboard',
    description: 'Understand how your team’s expense activity is moving.',
    note: 'Team reporting will appear here when the dashboard view is connected.',
  },
}

export function PlaceholderPage({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const { user } = useAuth()
  if (path === '/dashboard' || path === '/team-dashboard') return <DashboardPage />
  if (path === '/expenses' || /^\/expenses\/\d+\/?$/.test(path)) {
    return <ExpensesPage path={path} onNavigate={onNavigate} />
  }
  if (path === '/expenses/new') return <SubmitExpensePage onNavigate={onNavigate} />
  if (path === '/approvals' || /^\/approvals\/\d+\/?$/.test(path)) {
    return <ApprovalsPage path={path} onNavigate={onNavigate} />
  }

  const content = pageCopy[path] ?? pageCopy['/dashboard']
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">{user?.role.toLowerCase()} workspace</p>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </div>
      <div className="placeholder-grid" aria-label="Dashboard preview">
        {['Submitted', 'In review', 'Approved'].map((label) => (
          <section className="surface metric-placeholder" key={label}>
            <p className="metric-placeholder__label">{label}</p>
            <p className="metric-placeholder__value">—</p>
          </section>
        ))}
      </div>
      <section className="surface empty-panel">
        <div className="empty-panel__mark"><Icon name="grid" /></div>
        <div>
          <h2>Foundation ready</h2>
          <p>{content.note} This is an intentional placeholder, not live financial data.</p>
        </div>
      </section>
    </>
  )
}
