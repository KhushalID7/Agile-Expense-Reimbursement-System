type IconName = 'grid' | 'receipt' | 'plus' | 'check' | 'chart' | 'menu' | 'logout'

export function Icon({ name }: { name: IconName }) {
  const symbols: Record<IconName, string> = {
    grid: '▦',
    receipt: '▤',
    plus: '+',
    check: '✓',
    chart: '▥',
    menu: '☰',
    logout: '↪',
  }
  return <span aria-hidden="true">{symbols[name]}</span>
}
