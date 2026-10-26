const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
).replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(status: number, details: unknown) {
    super(getErrorMessage(details, status))
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function getErrorMessage(details: unknown, status: number): string {
  if (typeof details === 'string' && details) return details
  if (details && typeof details === 'object') {
    const values = Object.values(details as Record<string, unknown>).flat()
    const message = values.find((value): value is string => typeof value === 'string')
    if (message) return message
  }
  return status === 403
    ? 'Your session does not have permission to complete this action.'
    : 'Something went wrong. Please try again.'
}

function readCookie(name: string): string | null {
  const encodedName = `${encodeURIComponent(name)}=`
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(encodedName))
  return cookie ? decodeURIComponent(cookie.slice(encodedName.length)) : null
}

export async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/csrf/`, {
    credentials: 'include',
  })
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, body)
  const token = body && typeof body === 'object'
    ? (body as { csrfToken?: unknown }).csrfToken
    : null
  if (typeof token !== 'string' || !token) {
    throw new Error('The server did not return a CSRF token.')
  }
  return token
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = readCookie('csrftoken') ?? await getCsrfToken()
    headers.set('X-CSRFToken', token)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
  const contentType = response.headers.get('content-type') ?? ''
  const body: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '')
  if (!response.ok) throw new ApiError(response.status, body)
  return body as T
}

async function requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
  })
  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const body: unknown = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => '')
    throw new ApiError(response.status, body)
  }
  return response.blob()
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
  getBlob: (path: string, init?: RequestInit) => requestBlob(path, init),
  post: <T>(path: string, body?: unknown) => request<T>(path, {
    method: 'POST',
    body: body === undefined
      ? undefined
      : body instanceof FormData
        ? body
        : JSON.stringify(body),
  }),
}
