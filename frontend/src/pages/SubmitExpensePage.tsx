import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { ApiError } from '../api/client'
import { createExpense, getCategories } from '../api/expenses'
import type { Expense, ExpenseCategory } from '../types/expenses'

interface FormValues {
  title: string
  category: string
  amount: string
  currency: string
  expense_date: string
  description: string
}

type FieldName = keyof FormValues | 'receipt'
type FieldErrors = Partial<Record<FieldName, string>>

const initialValues: FormValues = {
  title: '',
  category: '',
  amount: '',
  currency: 'INR',
  expense_date: '',
  description: '',
}

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024
const acceptedExtensions = ['pdf', 'jpg', 'jpeg', 'png']
const acceptedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png']

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function validate(values: FormValues, receipt: File | null): FieldErrors {
  const errors: FieldErrors = {}
  if (!values.title.trim()) errors.title = 'Enter a title.'
  else if (values.title.length > 150) errors.title = 'Title must be 150 characters or fewer.'
  if (!values.category) errors.category = 'Select a category.'
  if (!values.amount) errors.amount = 'Enter an amount.'
  else if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(values.amount) || Number(values.amount) <= 0) {
    errors.amount = 'Enter an amount greater than zero with up to two decimal places.'
  }
  if (!/^[A-Z]{3}$/.test(values.currency)) errors.currency = 'Use a three-letter uppercase currency code.'
  if (!values.expense_date) errors.expense_date = 'Select the expense date.'
  if (!values.description.trim()) errors.description = 'Enter a description.'
  if (receipt) {
    const extension = getFileExtension(receipt.name)
    if (!acceptedExtensions.includes(extension) || (receipt.type && !acceptedMimeTypes.includes(receipt.type))) {
      errors.receipt = 'Receipt must be a PDF, JPEG, or PNG file.'
    } else if (receipt.size > MAX_RECEIPT_SIZE) {
      errors.receipt = 'Receipt must be 5 MB or smaller.'
    }
  }
  return errors
}

function serverErrors(reason: unknown): FieldErrors {
  if (!(reason instanceof ApiError) || !reason.details || typeof reason.details !== 'object') return {}
  const errors: FieldErrors = {}
  const details = reason.details as Record<string, unknown>
  Object.keys(initialValues).forEach((field) => {
    const value = details[field]
    if (Array.isArray(value) && typeof value[0] === 'string') errors[field as keyof FormValues] = value[0]
    else if (typeof value === 'string') errors[field as keyof FormValues] = value
  })
  const receipt = details.receipt
  if (Array.isArray(receipt) && typeof receipt[0] === 'string') errors.receipt = receipt[0]
  else if (typeof receipt === 'string') errors.receipt = receipt
  return errors
}

function errorMessage(reason: unknown): string {
  if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
    return 'Your session may have expired or you may not have permission to submit expenses.'
  }
  if (reason instanceof Error && reason.message) return reason.message
  return 'The expense could not be submitted. Please try again.'
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p className="field-error" id={`${id}-error`} role="alert">{message}</p> : null
}

function SuccessState({ expense, onNavigate }: { expense: Expense; onNavigate: (path: string) => void }) {
  return (
    <section className="surface submit-success" role="status">
      <div className="submit-success__mark" aria-hidden="true">✓</div>
      <p className="eyebrow">Submission received</p>
      <h1>Expense submitted for review</h1>
      <p><strong>{expense.title}</strong> was submitted successfully and is now <span className="status-badge status-badge--pending">PENDING</span>.</p>
      <div className="submit-success__actions">
        <button className="button button--primary" type="button" onClick={() => onNavigate(`/expenses/${expense.id}`)}>View expense</button>
        <button className="button button--secondary" type="button" onClick={() => onNavigate('/expenses')}>Return to My expenses</button>
      </div>
    </section>
  )
}

export function SubmitExpensePage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [values, setValues] = useState<FormValues>(initialValues)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [categoryLoading, setCategoryLoading] = useState(true)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdExpense, setCreatedExpense] = useState<Expense | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    getCategories(controller.signal)
      .then((response) => setCategories(response.results))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setCategoryError('Categories could not be loaded. Please try again later.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoryLoading(false)
      })
    return () => controller.abort()
  }, [])

  const updateValue = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const chooseReceipt = (event: ChangeEvent<HTMLInputElement>) => {
    const nextReceipt = event.target.files?.[0] ?? null
    setReceipt(nextReceipt)
    setErrors((current) => ({ ...current, receipt: validate(values, nextReceipt).receipt }))
  }

  const removeReceipt = () => {
    setReceipt(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setErrors((current) => ({ ...current, receipt: undefined }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values, receipt)
    setErrors(validationErrors)
    setFormError(null)
    if (Object.keys(validationErrors).length > 0) return

    setIsSubmitting(true)
    try {
      const expense = await createExpense({
        ...values,
        category: Number(values.category),
        title: values.title.trim(),
        description: values.description.trim(),
        receipt: receipt ?? undefined,
      })
      setCreatedExpense(expense)
    } catch (reason: unknown) {
      setErrors(serverErrors(reason))
      setFormError(errorMessage(reason))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (createdExpense) return <SuccessState expense={createdExpense} onNavigate={onNavigate} />

  return (
    <>
      <div className="page-heading submit-heading">
        <p className="eyebrow">Expense operations</p>
        <h1>Submit an expense</h1>
        <p>Capture a business expense with the details your reviewers need.</p>
      </div>
      {categoryError && <section className="surface submit-message submit-message--error" role="alert"><strong>Categories unavailable</strong><span>{categoryError}</span></section>}
      {!categoryLoading && !categoryError && categories.length === 0 && (
        <section className="surface submit-message" role="status"><strong>No active categories</strong><span>An administrator must configure an active expense category before you can submit an expense.</span></section>
      )}
      <form className="surface expense-form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="form-section">
          <div className="form-section__heading"><h2>Expense details</h2><p>All fields are required unless marked optional.</p></div>
          {formError && <div className="alert" role="alert">{formError}</div>}
          <div className="form-grid">
            <div className="field"><label htmlFor="expense-title">Title</label><input id="expense-title" type="text" maxLength={150} value={values.title} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'expense-title-error' : undefined} onChange={(event) => updateValue('title', event.target.value)} placeholder="e.g. Client meeting travel" /> <FieldError id="expense-title" message={errors.title} /></div>
            <div className="field"><label htmlFor="expense-category">Category</label><select id="expense-category" value={values.category} disabled={categoryLoading || categories.length === 0} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? 'expense-category-error' : undefined} onChange={(event) => updateValue('category', event.target.value)}><option value="">{categoryLoading ? 'Loading categories…' : 'Select a category'}</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><FieldError id="expense-category" message={errors.category} /></div>
            <div className="field"><label htmlFor="expense-amount">Amount</label><input id="expense-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={values.amount} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? 'expense-amount-error' : undefined} onChange={(event) => updateValue('amount', event.target.value)} placeholder="0.00" /><FieldError id="expense-amount" message={errors.amount} /></div>
            <div className="field"><label htmlFor="expense-currency">Currency</label><input id="expense-currency" type="text" maxLength={3} value={values.currency} aria-invalid={Boolean(errors.currency)} aria-describedby={errors.currency ? 'expense-currency-error' : undefined} onChange={(event) => updateValue('currency', event.target.value.toUpperCase())} /><FieldError id="expense-currency" message={errors.currency} /></div>
            <div className="field"><label htmlFor="expense-date">Expense date</label><input id="expense-date" type="date" value={values.expense_date} aria-invalid={Boolean(errors.expense_date)} aria-describedby={errors.expense_date ? 'expense-date-error' : undefined} onChange={(event) => updateValue('expense_date', event.target.value)} /><FieldError id="expense-date" message={errors.expense_date} /></div>
            <div className="field field--full"><label htmlFor="expense-description">Description</label><textarea id="expense-description" rows={5} value={values.description} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'expense-description-error' : undefined} onChange={(event) => updateValue('description', event.target.value)} placeholder="Explain the business purpose of this expense." /><FieldError id="expense-description" message={errors.description} /></div>
          </div>
        </div>
        <div className="form-section form-section--bordered">
          <div className="form-section__heading"><h2>Receipt <span>(optional)</span></h2><p>PDF, JPEG, or PNG up to 5 MB.</p></div>
          <input ref={fileInputRef} id="expense-receipt" className="file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={chooseReceipt} />
          <label className="file-dropzone" htmlFor="expense-receipt"><span className="file-dropzone__icon">＋</span><span>{receipt ? 'Choose a different receipt' : 'Choose a receipt file'}</span><small>Accepted: PDF, JPEG, PNG · Maximum 5 MB</small></label>
          {receipt && <div className="selected-file"><span>{receipt.name}</span><button className="text-button" type="button" onClick={removeReceipt}>Remove</button></div>}
          <FieldError id="expense-receipt" message={errors.receipt} />
        </div>
        <div className="form-actions"><button className="button button--primary submit-button" type="submit" disabled={isSubmitting || categoryLoading || categories.length === 0}>{isSubmitting ? 'Submitting…' : 'Submit expense'}</button></div>
      </form>
    </>
  )
}
