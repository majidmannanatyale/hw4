import { useState, type FormEvent } from 'react'
import { requestPickup, type Product } from '../api'
import { useAuth } from '../auth/AuthContext'
import { getCartId } from '../cart/CartContext'

interface Props {
  product: Product
  size: string | null
  onClose: () => void
}

// Minimum pickup date = today (local), for the date input's `min`.
const today = new Date().toISOString().slice(0, 10)

export default function PickupModal({ product, size, onClose }: Props) {
  const { token } = useAuth()
  const [someoneElse, setSomeoneElse] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const pickup_date = String(data.get('pickup_date') ?? '')
    const alternate_name = String(data.get('alternate_name') ?? '').trim()
    if (!pickup_date) {
      setError('Please choose a pickup date, Your Grace.')
      return
    }
    if (someoneElse && !alternate_name) {
      setError('Kindly tell us who will be collecting on your behalf.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const message = await requestPickup(
        {
          product_id: product.product_id,
          size,
          pickup_date,
          someone_else: someoneElse,
          alternate_name: someoneElse ? alternate_name : null,
          cart_id: getCartId(),
        },
        token,
      )
      setDone(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not record your request.')
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay__panel overlay__panel--narrow" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="overlay__close" onClick={onClose} aria-label="Close">×</button>
        <p className="overlay__eyebrow">In-store pickup</p>
        <h2 className="overlay__title">Collect at the house</h2>

        {done ? (
          <>
            <p className="overlay__sub">{done}</p>
            <button className="btn btn--primary btn--block" onClick={onClose}>Very good</button>
          </>
        ) : (
          <form className="form" onSubmit={onSubmit}>
            <p className="overlay__sub">
              {product.name}
              {size ? ` · Size ${size}` : ''} — ready for you at 57 Broadway, New Haven.
            </p>
            <label>
              Pickup date
              <input type="date" name="pickup_date" min={today} required />
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={someoneElse} onChange={(e) => setSomeoneElse(e.target.checked)} />
              Someone else will pick it up
            </label>
            {someoneElse && (
              <label>
                Who is collecting?
                <input name="alternate_name" placeholder="Their full name" autoComplete="name" />
              </label>
            )}
            {error && <p className="form__error">{error}</p>}
            <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
              {busy ? 'Reserving…' : 'Request Pickup'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
