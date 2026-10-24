import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import VanillaTilt from 'vanilla-tilt'
import {
  categoryOf,
  categoryTitle,
  displayName,
  fetchProduct,
  formatPrice,
  imageSrc,
  LOW_STOCK,
  swatchColor,
  type Product,
} from '../api'
import { useCart } from '../cart/CartContext'
import Carousel from '../components/Carousel'
import PickupModal from '../components/PickupModal'
import ProductCard from '../components/ProductCard'
import Ribbon from '../components/Ribbon'
import { useProducts } from '../useProducts'

function stockMessage(qty: number) {
  if (qty === 0) return { text: 'Sold out in this size', tone: 'out' }
  if (qty <= LOW_STOCK) return { text: `Only ${qty} left in this size`, tone: 'low' }
  return { text: `In stock · ${qty} available`, tone: 'ok' }
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="accordion" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="accordion__body">{children}</div>
    </details>
  )
}

export default function ProductDetail() {
  const { id = '' } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [size, setSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [showPickup, setShowPickup] = useState(false)
  const { products } = useProducts()
  const { addItem } = useCart()
  const mediaRef = useRef<HTMLDivElement & { vanillaTilt?: { destroy: () => void } }>(null)

  // Dimensional tilt on the large product image (skipped for reduced-motion users).
  useEffect(() => {
    const el = mediaRef.current
    if (!el || !product || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.vanillaTilt?.destroy()
    el.querySelectorAll('.js-tilt-glare').forEach((g) => g.remove())
    VanillaTilt.init(el, { max: 6, speed: 500, scale: 1.02, glare: true, 'max-glare': 0.2, perspective: 1200 })
    return () => el.vanillaTilt?.destroy()
  }, [product])

  useEffect(() => {
    let alive = true
    setProduct(null)
    setError(null)
    setSize(null)
    setQty(1)
    setShowPickup(false)
    fetchProduct(id)
      .then((p) => alive && setProduct(p))
      .catch((e: Error) =>
        alive && setError(e.message === 'not-found' ? 'We could not find that piece.' : 'We could not reach the collection just now.'),
      )
    return () => {
      alive = false
    }
  }, [id])

  if (error)
    return (
      <div className="container pdp-empty">
        <p className="notice">{error}</p>
        <Link to="/products" className="btn btn--primary">Return to the Collection</Link>
      </div>
    )
  if (!product) return <p className="loading container pdp-empty">Bringing the piece out…</p>

  const category = categoryOf(product)
  const selected = product.inventory.find((s) => s.size === size)
  const status = selected ? stockMessage(selected.quantity) : null
  const sizesAvailable = product.inventory.filter((s) => s.quantity > 0).length
  const related = (products ?? []).filter((p) => categoryOf(p) === category && p.product_id !== product.product_id).slice(0, 12)

  return (
    <>
      <article className="pdp">
        <div className="pdp__info">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/products">Collection</Link>
            <span>/</span>
            <Link to={`/products?c=${category}`}>{categoryTitle(category)}</Link>
          </nav>

          <p className="eyebrow">{product.garment_type}</p>
          <h1 className="pdp__name">{displayName(product)}</h1>
          <p className="pdp__price">{formatPrice(product.price)}</p>
          <p className="pdp__availability">
            <span className={`pdp__dot ${sizesAvailable === product.inventory.length ? 'is-ok' : 'is-low'}`} />
            {sizesAvailable === product.inventory.length
              ? 'Available in every size'
              : `Available in ${sizesAvailable} of ${product.inventory.length} sizes`}
            {' · '}
            {product.total_stock} pieces in the house
          </p>

          <div className="pdp__rule" />

          <p className="pdp__desc">{product.description}</p>

          {product.colors.length > 0 && (
            <div className="pdp__block">
              <p className="pdp__label">Colorway</p>
              <div className="swatches">
                {product.colors.map((c) => (
                  <span key={c} className="swatch" title={c}>
                    <span className="swatch__chip" style={{ background: swatchColor(c) }} />
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pdp__block">
            <div className="pdp__label-row">
              <p className="pdp__label">Select a size</p>
              <span className="pdp__guide">Size guide</span>
            </div>
            <div className="sizes" role="radiogroup" aria-label="Size">
              {product.inventory.map((s) => (
                <button
                  key={s.size}
                  role="radio"
                  aria-checked={size === s.size}
                  disabled={s.quantity === 0}
                  className={`size ${size === s.size ? 'is-selected' : ''} ${s.quantity > 0 && s.quantity <= LOW_STOCK ? 'is-low' : ''}`}
                  onClick={() => {
                    setSize(s.size)
                    setQty(1)
                  }}
                >
                  {s.size}
                  {s.quantity > 0 && s.quantity <= LOW_STOCK && <span className="size__flag" />}
                </button>
              ))}
            </div>
            <p className={`pdp__stock pdp__stock--${status?.tone ?? 'idle'}`}>
              {status ? status.text : 'Sizes marked with a gold dot are nearly gone.'}
            </p>
          </div>

          <div className="pdp__purchase">
            <div className="stepper" aria-label="Quantity">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">−</button>
              <span>{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(selected?.quantity ?? 1, q + 1))}
                disabled={!selected || qty >= selected.quantity}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button
              className="btn btn--primary btn--block btn--glimmer"
              disabled={!selected || selected.quantity === 0}
              onClick={() => size && addItem(product, size, qty)}
            >
              {selected ? `Add to Bag · ${formatPrice(product.price * qty)}` : 'Select a Size'}
            </button>
          </div>
          <button className="btn btn--outline btn--block pdp__pickup-btn" onClick={() => setShowPickup(true)}>
            Request In-Store Pickup
          </button>

          <ul className="pdp__perks">
            <li>Complimentary shipping over $150</li>
            <li>Returns accepted within 30 days</li>
            <li>Monogramming at our New Haven house</li>
          </ul>

          <Accordion title="Details" defaultOpen>
            <ul className="tags">
              {product.search_tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Accordion>
          <Accordion title="Fit & Care">
            <p>A classic collegiate fit with room to layer. Wash cold, inside out, and lay flat to dry so the mark stays crisp for years.</p>
          </Accordion>
          <Accordion title="Shipping & Returns">
            <p>Orders leave New Haven within two business days. Unworn pieces may be returned within 30 days, in store or by post.</p>
          </Accordion>
        </div>

        <div className="pdp__media" ref={mediaRef}>
          <Ribbon badge={product.badge} />
          <img src={imageSrc(product)} alt={displayName(product)} />
          <span className="pdp__media-tag">Campus Customs · {categoryTitle(category)}</span>
        </div>
      </article>

      {showPickup && <PickupModal product={product} size={size} onClose={() => setShowPickup(false)} />}

      {related.length > 0 && (
        <div className="container section">
          <Carousel title="You May Also Consider" subtitle={`More from ${categoryTitle(category)}.`}>
            {related.map((p) => (
              <ProductCard key={p.product_id} product={p} />
            ))}
          </Carousel>
        </div>
      )}
    </>
  )
}
