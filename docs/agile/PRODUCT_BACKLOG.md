# Product Backlog

This backlog describes the Agile Expense Reimbursement System as implemented
in the repository and identifies a small set of realistic future enhancements.
Priorities are relative product priorities, not delivery estimates.

## Implemented functionality

| ID | Priority | Implementation status | User story |
|---|---|---|---|
| US-01 | Must | Implemented | As a user, I want to sign in and out with a Django session, so that access to expense data is authenticated. |
| US-02 | Must | Implemented | As a user, I want session persistence, CSRF protection, and role-aware navigation, so that the workspace remains secure and relevant to my role. |
| US-03 | Must | Implemented | As an employee, I want to submit an expense with category, amount, currency, date, and description, so that a business expense can enter the review process. |
| US-04 | Should | Implemented | As an employee, I want to attach a valid receipt to an expense, so that reviewers can verify the claim. |
| US-05 | Must | Implemented | As an employee, I want to view my expense list and expense details, so that I can track each claim and its current status. |
| US-06 | Must | Implemented | As an employee or manager, I want to filter and paginate expenses, so that I can find relevant claims without loading an unbounded list. |
| US-07 | Must | Implemented | As an authorized employee or manager, I want to download an attached receipt, so that I can review the supporting document. |
| US-08 | Must | Implemented | As a manager, I want to see a paginated queue of pending expenses assigned to me, so that I can focus on claims I am authorized to review. |
| US-09 | Must | Implemented | As a manager, I want to approve a pending expense with an optional comment, so that valid claims can progress through reimbursement. |
| US-10 | Must | Implemented | As a manager, I want to reject a pending expense with a required reason, so that the employee receives an accountable explanation. |
| US-11 | Must | Implemented | As an employee, manager, or permitted administrator, I want a dashboard of status counts and monetary totals, so that I can understand expense activity at my permitted scope. |
| US-12 | Must | Implemented | As an authorized expense viewer, I want to see read-only decision history and comments, so that approval decisions remain traceable. |
| US-13 | Must | Implemented | As a developer, I want automated frontend and backend tests for high-value workflows, so that regressions in authentication, expenses, dashboards, and approvals are detected. |
| US-14 | Must | Implemented | As a maintainer, I want GitHub Actions to run backend checks and frontend lint, tests, and builds, so that changes receive repeatable CI verification. |

### Acceptance criteria

#### US-01 - Session authentication

- Valid credentials establish a Django session and expose safe current-user data.
- Invalid credentials display a useful error without exposing sensitive details.
- An unauthenticated user is shown the sign-in page rather than protected workspace content.
- Signing out invalidates the session and returns the user to the unauthenticated state.

#### US-02 - Secure, role-aware workspace access

- API requests include session cookies and obtain/send CSRF protection for unsafe requests.
- The displayed role matches the authenticated user returned by the backend.
- Employees cannot access manager approval navigation or workflow by changing the URL.
- Manager and administrator access follows the backend's documented policy; the frontend does not grant extra permissions.

#### US-03 - Expense submission

- An employee can submit the required expense fields using the active category list.
- Client validation rejects missing fields, non-positive amounts, invalid currency codes, and invalid dates before submission.
- The backend response is shown only after a successful create request.
- Newly created expenses are shown as `PENDING`, and employee or manager identity remains server-controlled.

#### US-04 - Receipt upload

- The form accepts PDF, JPEG, and PNG receipts up to 5 MB.
- Invalid file types and oversized files produce an inline validation message.
- A valid receipt is sent as multipart form data without manually overriding the browser's multipart boundary.
- A submission without a receipt remains supported.

#### US-05 - Expense tracking and detail

- An authorized user can open an expense from the list and see title, category, amount, currency, dates, description, status, and receipt availability.
- Employees see only expenses permitted by the backend.
- Loading, empty, unavailable, and session-expired states are visible and actionable.
- The UI does not fabricate expense values when the API fails.

#### US-06 - Filtering and pagination

- Status, category, date range, and amount filters are sent to the server.
- Applying filters resets the page to the first page.
- Pagination follows the backend's `count`, `next`, `previous`, and `results` response.
- Invalid or empty results produce a clear empty state rather than sample data.

#### US-07 - Receipt download

- A receipt download uses the authenticated request path and includes session authorization.
- Missing receipts, inaccessible expenses, and failed downloads show a useful error.
- Temporary browser object URLs are released after a download.

#### US-08 - Pending approvals queue

- Managers can request the pending approvals endpoint and see real pending expenses with employee, title, category, date, amount, currency, submission date, and receipt availability.
- The queue uses server-side pagination and displays the server-provided total when available.
- The backend remains authoritative for manager-to-employee visibility.
- Loading, empty, API error, retry, and session-expiration states are supported.

#### US-09 - Approve expense

- Only a pending expense presents an approval action.
- A manager may submit an optional comment and repeated submissions are disabled while saving.
- Success is shown only after the backend returns the updated expense.
- The detail view reflects the returned status and decision history rather than an optimistic local status.

#### US-10 - Reject expense

- Only a pending expense presents a rejection action.
- A blank or whitespace-only reason is rejected inline and no request is sent.
- Repeated submissions are disabled while saving.
- Server validation, authorization, not-found, conflict, and network failures are shown without technical traces.

#### US-11 - Dashboards

- Employees use the employee dashboard endpoint; managers and permitted administrators use the manager dashboard endpoint.
- The dashboard displays total expenses, pending, approved, rejected, total submitted, and total approved.
- Decimal monetary strings are formatted as INR where applicable.
- Loading, zero-data, API error, retry, and session-expiration states do not display placeholder metrics.

#### US-12 - Decision history and auditability

- An authorized expense detail response exposes read-only decisions with manager, decision, comment, and timestamp.
- Approval and rejection actions create backend-controlled decision and audit records.
- A decision conflict refreshes the expense and explains that it is no longer pending.
- Employees can see the updated status and history when they return to or refresh My Expenses.

#### US-13 - Automated tests

- Frontend tests cover login validation/failure, dashboard loading and errors, expense validation/submission, expense empty/filter behavior, and approval/rejection behavior.
- Backend tests cover authentication, role visibility, expense validation, receipts, dashboards, decisions, and decision history.
- Frontend tests mock the API boundary and do not require a running Django server.
- Test configuration runs Vitest in a non-watch mode for automation.

#### US-14 - Continuous integration

- GitHub Actions runs on pushes to `main` and pull requests targeting `main`.
- The backend job installs recorded dependencies and runs Django system, test, and migration checks.
- The frontend job uses the committed lockfile with `npm ci`, then runs lint, frontend tests, and the production build.
- A failed required check fails its job and the workflow; deployment credentials and external services are not required.

## Future enhancements

These stories are not represented as completed functionality in the current
repository. They should be refined with stakeholders before implementation.

| ID | Priority | Implementation status | User story |
|---|---|---|---|
| US-15 | Should | Planned | As an employee, I want to edit or withdraw an eligible pending expense, so that I can correct a mistake before review. |
| US-16 | Could | Planned | As an employee, I want to receive an in-app notification when my expense status changes, so that I do not have to repeatedly check the list. |
| US-17 | Could | Planned | As a manager, I want queue filters and sorting by employee, date, amount, and category, so that larger approval queues are easier to prioritize. |
| US-18 | Should | Planned | As an administrator, I want a controlled user and category management interface, so that routine setup does not require direct Django Admin access. |
| US-19 | Could | Planned | As a finance user, I want exportable approved-expense reports, so that reimbursement reconciliation can be performed outside the application. |

### Acceptance criteria

#### US-15 - Correct or withdraw a pending expense

- Only the owning employee can edit or withdraw an expense that is still pending.
- Approved or rejected expenses cannot be changed through the employee workflow.
- Validation and authorization rules match expense creation and backend policy.
- The list, detail page, and decision history remain consistent after a change or withdrawal.

#### US-16 - Status notifications

- A notification is generated for an approved or rejected expense.
- The notification identifies the expense and includes the decision comment when present.
- Notifications do not disclose another user's expense data.
- Delivery failure does not alter the authoritative expense status.

#### US-17 - Approval queue refinement

- Managers can filter or sort only within the expenses returned by their authorized queue.
- The server remains responsible for visibility and pagination.
- Active filters are visible, resettable, and preserved while moving between queue pages.

#### US-18 - Administration interface

- Only permitted administrators can create, deactivate, or update users and expense categories.
- The interface does not bypass Django permissions or expose passwords.
- Changes are validated and reflected in the existing authentication and category APIs.
- The current Django Admin workflow remains available until this enhancement is deliberately adopted.

#### US-19 - Expense reporting

- A permitted finance role can select a defined reporting period and status scope.
- Exported values match authoritative backend data and preserve currency and decision information.
- Access is restricted to the same or stricter scope as the relevant backend policy.
- Empty reports and export failures are communicated clearly.

## Status basis and scope notes

- `Implemented` means the corresponding application code, API surface, or
  repository automation is present; it does not claim that a command was run
  while preparing this document.
- User creation remains available through Django Admin only. No user-management
  screen is included in the current product scope.
- The backlog does not add estimates, sprint dates, ceremonies, user-feedback
  claims, or test-result claims.
