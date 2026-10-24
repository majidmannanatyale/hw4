import type { Badge } from '../api'

/** Inventory-driven ribbon shown on any product image that qualifies. */
export default function Ribbon({ badge }: { badge: Badge }) {
  if (!badge) return null
  const label = badge === 'almost_gone' ? 'Almost Gone' : 'Hot'
  return <span className={`ribbon ribbon--${badge}`}>{label}</span>
}
