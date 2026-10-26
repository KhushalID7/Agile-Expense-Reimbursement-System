import { api } from './client'
import type { DashboardSummary } from '../types/dashboard'

const dashboardFields = [
  'total_expenses',
  'pending_count',
  'approved_count',
  'rejected_count',
  'total_amount_submitted',
  'total_amount_approved',
] as const

function isDashboardSummary(value: unknown): value is DashboardSummary {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return dashboardFields.every((field) => field in data)
    && dashboardFields.slice(0, 4).every((field) => Number.isInteger(data[field]))
    && dashboardFields.slice(4).every((field) => typeof data[field] === 'string')
}

async function getDashboard(path: string, signal?: AbortSignal): Promise<DashboardSummary> {
  const data: unknown = await api.get<unknown>(path, { signal })
  if (!isDashboardSummary(data)) {
    throw new Error('The server returned an invalid dashboard response.')
  }
  return data
}

export function getEmployeeDashboard(signal?: AbortSignal): Promise<DashboardSummary> {
  return getDashboard('/api/v1/dashboard/employee/', signal)
}

export function getManagerDashboard(signal?: AbortSignal): Promise<DashboardSummary> {
  return getDashboard('/api/v1/dashboard/manager/', signal)
}
