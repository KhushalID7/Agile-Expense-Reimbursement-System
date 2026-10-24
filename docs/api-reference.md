# Expense Reimbursement API Reference

## Overview

Base URL:

```text
/api/v1/
```

The backend is Django 5.2 with Django REST Framework. The API currently uses
Django session authentication and does not provide custom login, logout,
registration, JWT, or token endpoints.

All API endpoints require an authenticated session by default. Unauthenticated
requests are rejected with HTTP `403 Forbidden` when no authentication
challenge is provided by DRF's configured session authentication.

## Authentication and CSRF

Authentication is configured as:

- DRF `SessionAuthentication`
- Default permission: `IsAuthenticated`
- Django CSRF middleware remains enabled

For browser-based requests:

1. Authenticate through the existing Django session/admin mechanism.
2. Include the session cookie with API requests.
3. Include a valid CSRF token for unsafe methods such as `POST`.

The backend does not currently configure CORS or `CSRF_TRUSTED_ORIGINS`.
Local development origins are therefore not explicitly configured by the
backend. A separate React development server must use an appropriate proxy or
deployment configuration and must follow Django's session and CSRF rules.

## Common response conventions

### Successful responses

Successful list endpoints use DRF page-number pagination:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": []
}
```

The configured page size is `20`. `next` and `previous` contain URLs or
`null`.

Successful detail and action responses return a JSON object. Monetary values
are represented as decimal strings.

### Validation errors

DRF validation errors use an object keyed by field name:

```json
{
  "amount": [
    "Ensure this value is greater than or equal to 0.01."
  ]
}
```

Some application errors use a `detail` key:

```json
{
  "detail": "Only pending expenses can be decided."
}
```

## Roles and access rules

The business role is the `accounts.User.role` field. It is independent of
Django's `is_staff` flag.

| Role | Expense access |
|---|---|
| `EMPLOYEE` | May create expenses and list/retrieve only their own expenses. May access the employee dashboard. |
| `MANAGER` | May list/retrieve their own expenses and expenses belonging to employees whose `manager` is that manager. May access the manager dashboard and decide assigned employees' pending expenses. |
| `ADMIN` | May list/retrieve all expenses, access the manager dashboard, and make decisions under the explicit `ADMIN` business role policy. |

The API never accepts a client-supplied employee or manager identity for
authorization decisions.

## Expense endpoints

### List expenses

```http
GET /api/v1/expenses/
```

Authentication: required.

The queryset is restricted according to the authenticated user's business
role before filters are applied. Filters cannot expand a user's visibility.

Supported query parameters:

| Parameter | Format | Description |
|---|---|---|
| `status` | `PENDING`, `APPROVED`, `REJECTED` | Exact status filter. Unsupported values return HTTP `400`. |
| `category` | Positive integer | Expense category ID. Invalid or non-positive values return HTTP `400`. |
| `date_from` | `YYYY-MM-DD` | Inclusive expense date lower bound. |
| `date_to` | `YYYY-MM-DD` | Inclusive expense date upper bound. |
| `min_amount` | Decimal | Inclusive amount lower bound. Must be finite and non-negative. |
| `max_amount` | Decimal | Inclusive amount upper bound. Must be finite and non-negative. |
| `page` | Positive integer | DRF pagination page number. |

Invalid dates, invalid decimal values, reversed date ranges, and reversed
amount ranges return HTTP `400 Bad Request`.

Response: HTTP `200 OK`, paginated expense objects.

Each expense object has this structure:

```json
{
  "id": 1,
  "employee": "employee-a",
  "category": 2,
  "title": "Taxi fare",
  "amount": "125.50",
  "currency": "INR",
  "expense_date": "2026-01-15",
  "description": "Taxi from office",
  "status": "PENDING",
  "receipt": "expense_receipts/uuid.pdf",
  "decisions": [],
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

The `decisions` array is read-only and contains:

```json
{
  "id": 1,
  "manager": "manager",
  "decision": "APPROVED",
  "comment": "",
  "decided_at": "2026-01-16T10:30:00Z"
}
```

### Create an expense

```http
POST /api/v1/expenses/
```

Authentication: required. Business role: `EMPLOYEE` only.

Use JSON for expenses without a receipt, or `multipart/form-data` when
uploading a receipt.

Request fields:

| Field | Required | Description |
|---|---:|---|
| `category` | Yes | ID of an active `ExpenseCategory`. |
| `title` | Yes | Maximum 150 characters. |
| `amount` | Yes | Decimal amount strictly greater than zero; maximum 12 digits and 2 decimal places. |
| `currency` | No | Three uppercase letters; defaults to `INR`. |
| `expense_date` | Yes | Expense date in `YYYY-MM-DD` format. |
| `description` | Yes | Expense description. |
| `receipt` | No | PDF, JPEG, or PNG upload, maximum 5 MB. |

The following are server-controlled and must not be supplied by clients:

- `employee`
- `status`
- actor information
- audit information
- decision information

The employee is taken from the authenticated session. New expenses always
start with status `PENDING`. A successful creation also creates an audit event.

Response: HTTP `201 Created`, containing the created expense object.

Inactive categories return HTTP `400 Bad Request`. Employees cannot create an
expense on behalf of another user.

### Retrieve an expense

```http
GET /api/v1/expenses/<id>/
```

Authentication: required.

The caller must be allowed to view the expense under the role rules above.
An inaccessible or nonexistent expense returns HTTP `404 Not Found`.

Response: HTTP `200 OK`, containing the expense object and read-only decision
history.

There is no expense update or delete endpoint currently configured.

## Categories

### List active categories

```http
GET /api/v1/categories/
```

Authentication: required for all authenticated users.

Only categories where `is_active` is true are returned.

Response: HTTP `200 OK`, paginated:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 2,
      "name": "Travel",
      "description": "Travel-related expenses"
    }
  ]
}
```

## Approval endpoints

### List pending approvals

```http
GET /api/v1/approvals/pending/
```

Authentication: required. Business role: `MANAGER` or `ADMIN`.

For a manager, the queue contains only `PENDING` expenses belonging to
employees assigned to that manager through `employee.manager`. It does not
include the manager's own expenses or another manager's employees' expenses.
For an `ADMIN`, the existing decision visibility policy applies.

Response: HTTP `200 OK`, paginated expense objects.

Employees receive HTTP `403 Forbidden`.

### Approve an expense

```http
POST /api/v1/expenses/<id>/approve/
```

Authentication: required. Business role: `MANAGER` or `ADMIN`.

Request body: optional. An optional approval comment is accepted:

```json
{
  "comment": "Reviewed and approved."
}
```

Only a pending expense visible to the acting manager/admin can be approved.
The status changes to `APPROVED`, and one `ExpenseDecision` plus one
`AuditEvent` are created in the same transaction.

Response: HTTP `200 OK`, containing the updated expense object.

Possible errors:

- HTTP `400 Bad Request` for malformed request data.
- HTTP `403 Forbidden` for unauthenticated or unauthorized roles.
- HTTP `404 Not Found` when the expense is not visible to the caller.
- HTTP `409 Conflict` when the expense is already approved or rejected.

### Reject an expense

```http
POST /api/v1/expenses/<id>/reject/
```

Authentication: required. Business role: `MANAGER` or `ADMIN`.

Request body: required:

```json
{
  "comment": "Receipt is missing."
}
```

The comment must be non-empty after whitespace trimming. Only a pending
expense visible to the acting manager/admin can be rejected.

The status changes to `REJECTED`, and one `ExpenseDecision` plus one
`AuditEvent` are created in the same transaction.

Response: HTTP `200 OK`, containing the updated expense object.

Possible errors:

- HTTP `400 Bad Request` when the comment is missing or blank.
- HTTP `403 Forbidden` for unauthenticated or unauthorized roles.
- HTTP `404 Not Found` when the expense is not visible to the caller.
- HTTP `409 Conflict` when the expense is already approved or rejected.

Decision status updates use an authorization-aware conditional update. SQLite
does not provide PostgreSQL-style row-level locking through
`select_for_update`; the implementation rechecks authorization and pending
status as part of the transaction and prevents stale non-pending updates.

## Receipts

### Receipt upload

Receipts are uploaded as part of:

```http
POST /api/v1/expenses/
```

Use `multipart/form-data` and provide the optional `receipt` field.

Accepted formats:

- PDF
- JPEG
- PNG

The maximum size is 5 MB. Validation checks both the filename suffix and a
basic file signature. The original filename is not retained; the backend
generates a UUID-based storage filename.

The current validation is lightweight signature validation. It does not fully
parse PDF/JPEG/PNG structure, perform antivirus scanning, or verify that the
file is safe beyond the implemented size, extension, and signature checks.

### Download a receipt

```http
GET /api/v1/expenses/<id>/receipt/
```

Authentication: required.

The caller must be able to view the associated expense. Employees can access
their own receipts; managers can access receipts for assigned employees and
their own expenses; admins can access receipts under the all-expenses policy.

Responses:

- HTTP `200 OK`: streams the receipt as an attachment.
- HTTP `403 Forbidden`: unauthenticated request.
- HTTP `404 Not Found`: inaccessible expense, missing receipt, or unavailable
  stored file.

Receipt paths are not exposed in error messages. There is no unrestricted
public media download endpoint configured by the API.

## Dashboards

### Employee dashboard

```http
GET /api/v1/dashboard/employee/
```

Authentication: required. Business role: `EMPLOYEE` only.

Response: HTTP `200 OK`:

```json
{
  "total_expenses": 10,
  "pending_count": 4,
  "approved_count": 5,
  "rejected_count": 1,
  "total_amount_submitted": "12500.00",
  "total_amount_approved": "8000.00"
}
```

All values are calculated only from the authenticated employee's expenses.

Managers, admins, and unauthenticated users are rejected by the endpoint
permission.

### Manager dashboard

```http
GET /api/v1/dashboard/manager/
```

Authentication: required. Business role: `MANAGER` or `ADMIN`.

The response has the same structure as the employee dashboard. For a manager,
all counts and amounts are limited to expenses belonging to employees assigned
to that manager. Admin-role users may access this dashboard under the explicit
admin business-role policy and receive the all-expenses aggregate.

Response: HTTP `200 OK` with:

```json
{
  "total_expenses": 10,
  "pending_count": 4,
  "approved_count": 5,
  "rejected_count": 1,
  "total_amount_submitted": "12500.00",
  "total_amount_approved": "8000.00"
}
```

## Authentication and account endpoints

No authentication API endpoints are currently configured under `/api/v1/`.
There are no public registration, custom login, logout, password, or token
endpoints in the application API.

Django admin is available at:

```text
/admin/
```

The admin uses Django's normal session authentication and is separate from the
documented JSON API. User administration is handled through Django Admin.

## Audit and decision history

Successful approvals and rejections create:

- An `ExpenseDecision` containing the acting manager, decision, comment, and
  timestamp.
- An `AuditEvent` containing the actor, expense, action, structured decision
  details, and timestamp.

Decision history is included as the read-only `decisions` field in authorized
expense list/detail/action responses. Audit events do not have an ordinary API
endpoint and cannot be modified through expense API requests.

## Known limitations and incomplete endpoints

- No public authentication or registration API is implemented.
- No expense update or delete endpoints are implemented.
- No separate audit-history endpoint is implemented.
- No separate decision-history endpoint is implemented; decision history is
  nested in authorized expense responses.
- No CORS or `CSRF_TRUSTED_ORIGINS` settings are configured.
- Receipt validation is based on size, extension, and basic file signatures;
  full document parsing and malware scanning are not implemented.
- The API uses Django sessions and CSRF rather than JWT or token
  authentication.