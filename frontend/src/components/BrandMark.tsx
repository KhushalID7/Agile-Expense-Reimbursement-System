export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-mark" aria-label="Expense Reimbursement">
      <span className="brand-mark__symbol" aria-hidden="true">ER</span>
      {!compact && <span>Expense Reimbursement</span>}
    </div>
  )
}
