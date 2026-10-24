import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL, cleanName, formatPrice, type ChatProductCard } from '../api'
import Ribbon from '../components/Ribbon'
import { useCart } from './CartContext'

function RecoCard({ p, onGo }: { p: ChatProductCard; onGo: (id: string) => void }) {
  return (
    <button className="reco" onClick={() => onGo(p.product_id)}>
      <div className="reco__image">
        <img src={`${API_URL}${p.image_url}`} alt={cleanName(p.name)} loading="lazy" />
        <Ribbon badge={p.badge} />
      </div>
      <span className="reco__name">{cleanName(p.name)}</span>
      <span className="reco__price">{formatPrice(p.price)}</span>
    </button>
  )
}

export default function CartOverlay() {
  const { overlay, added, cart, close } = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    if (overlay !== 'closed') window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay, close])

  if (overlay === 'closed') return null

  const go = (id: string) => {
    close()
    navigate(`/products/${id}`)
  }

  const recos = added?.recommendations ?? []

  return (
    <div className="overlay" onClick={close}>
      <div className="overlay__panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="overlay__close" onClick={close} aria-label="Close">×</button>

        {overlay === 'added' ? (
          <>
            <p className="overlay__eyebrow">Added to your bag</p>
            <h2 className="overlay__title">{added ? cleanName(added.name) : 'Your piece'}</h2>
            <p className="overlay__sub">
              Your bag now holds {cart.count} {cart.count === 1 ? 'piece' : 'pieces'} · {formatPrice(cart.subtotal)}
            </p>
          </>
        ) : (
          <>
            <p className="overlay__eyebrow">Your Bag</p>
            <h2 className="overlay__title">{cart.count} {cart.count === 1 ? 'piece' : 'pieces'}</h2>
            <div className="bag__lines">
              {cart.items.length === 0 && <p className="overlay__sub">Your bag is empty.</p>}
              {cart.items.map((l) => (
                <div key={`${l.product_id}-${l.size}`} className="bag__line">
                  <img src={`${API_URL}${l.image_url}`} alt={cleanName(l.name)} />
                  <div className="bag__line-info">
                    <span>{cleanName(l.name)}</span>
                    <span className="bag__line-meta">Size {l.size} · Qty {l.quantity}</span>
                  </div>
                  <span className="bag__line-price">{formatPrice(l.price * l.quantity)}</span>
                </div>
              ))}
            </div>
            {cart.items.length > 0 && (
              <p className="bag__subtotal">
                Subtotal <strong>{formatPrice(cart.subtotal)}</strong>
              </p>
            )}
            <p className="bag__note">Checkout is coming soon — your bag is saved for now.</p>
          </>
        )}

        {recos.length > 0 && (
          <div className="overlay__recos">
            <p className="overlay__eyebrow">Pairs well with</p>
            <p className="overlay__recos-hint">Pieces our guests are reaching for — before they're gone.</p>
            <div className="reco__row">
              {recos.map((p) => (
                <RecoCard key={p.product_id} p={p} onGo={go} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
