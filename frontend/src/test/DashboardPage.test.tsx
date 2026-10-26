import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '../pages/DashboardPage'
import { dashboardSummary } from './fixtures'

const { getEmployeeDashboard, getManagerDashboard } = vi.hoisted(() => ({
  getEmployeeDashboard: vi.fn(),
  getManagerDashboard: vi.fn(),
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { role: 'EMPLOYEE', username: 'employee-a' } }),
}))
vi.mock('../api/dashboard', () => ({ getEmployeeDashboard, getManagerDashboard }))

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders live summary data after loading', async () => {
    getEmployeeDashboard.mockResolvedValueOnce(dashboardSummary)
    render(<DashboardPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(await screen.findByText('₹1,500.00')).toBeInTheDocument()
    expect(screen.getByText('Total expenses')).toBeInTheDocument()
    expect(getManagerDashboard).not.toHaveBeenCalled()
  })

  it('shows an actionable error instead of placeholder metrics', async () => {
    getEmployeeDashboard.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<DashboardPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    await waitFor(() => expect(screen.queryByText('Total expenses')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
