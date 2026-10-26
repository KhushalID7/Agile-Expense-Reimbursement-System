import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from '../pages/LoginPage'

const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ signIn, error: null }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates required credentials and submits trimmed username', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter your username and password to continue.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: ' employee-a ' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(signIn).toHaveBeenCalledWith('employee-a', 'secret')
  })

  it('shows sign-in failures without exposing a success state', async () => {
    signIn.mockRejectedValueOnce(new Error('Invalid credentials'))
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'employee-a' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Unable to sign in. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
