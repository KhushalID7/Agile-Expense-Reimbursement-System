import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubmitExpensePage } from '../pages/SubmitExpensePage'
import { category, expense } from './fixtures'

const { getCategories, createExpense } = vi.hoisted(() => ({
  getCategories: vi.fn(),
  createExpense: vi.fn(),
}))

vi.mock('../api/expenses', () => ({ getCategories, createExpense }))

describe('SubmitExpensePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks invalid submissions and displays field errors', async () => {
    getCategories.mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [category] })
    render(<SubmitExpensePage onNavigate={vi.fn()} />)
    await screen.findByRole('option', { name: 'Travel' })
    fireEvent.click(screen.getByRole('button', { name: 'Submit expense' }))
    expect(await screen.findByText('Enter a title.')).toBeInTheDocument()
    expect(createExpense).not.toHaveBeenCalled()
  })

  it('submits the backend response and shows confirmed success', async () => {
    getCategories.mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [category] })
    createExpense.mockResolvedValueOnce(expense)
    render(<SubmitExpensePage onNavigate={vi.fn()} />)
    await screen.findByRole('option', { name: 'Travel' })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Taxi fare' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: String(category.id) } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '125.50' } })
    fireEvent.change(screen.getByLabelText('Expense date'), { target: { value: '2026-10-20' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Client visit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit expense' }))
    expect(await screen.findByText('Expense submitted for review')).toBeInTheDocument()
    expect(createExpense).toHaveBeenCalled()
  })
})
