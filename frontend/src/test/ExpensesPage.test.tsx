import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExpensesPage } from '../pages/ExpensesPage'
import { category } from './fixtures'

const { getCategories, getExpenses } = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getExpenses: vi.fn(),
}))

vi.mock('../api/expenses', () => ({ getCategories, getExpenses, getExpense: vi.fn(), getExpenseReceipt: vi.fn() }))

describe('ExpensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the empty state and sends applied pagination filters', async () => {
    getCategories.mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [category] })
    getExpenses
      .mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] })
      .mockResolvedValueOnce({ count: 21, next: '?page=2', previous: null, results: [] })
    render(<ExpensesPage path="/expenses" onNavigate={vi.fn()} />)
    expect(await screen.findByText('No expenses yet')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'PENDING' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await screen.findByText('No matching expenses')
    expect(getExpenses).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'PENDING' }),
      1,
      expect.any(AbortSignal),
    )
  })
})
