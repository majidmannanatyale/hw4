import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CATEGORIES, categoryOf, categoryTitle, displayName, formatPrice, imageSrc, type Product } from '../api'
import Carousel from '../components/Carousel'
import ProductCard from '../components/ProductCard'
import { useProducts } from '../useProducts'

function matches(p: Product, query: string) {
  const q = query.toLowerCase()
  return [p.name, p.description, p.garment_type, ...p.colors, ...p.search_tags].some((t) => t.toLowerCase().includes(q))
}

export default function Products() {
  const { products, error } = useProducts()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [spotlight, setSpotlight] = useState<Product | null>(null)

  const rows = useMemo(() => {
    const visible = (products ?? []).filter((p) => !query || matches(p, query))
    return CATEGORIES.map((c) => ({ ...c, items: visible.filter((p) => categoryOf(p) === c.slug) })).filter((r) => r.items.length)
  }, [products, query])

  const featured = spotlight ?? rows[0]?.items[0] ?? null
  const jumpTo = params.get('c')

  useEffect(() => {
    if (jumpTo && products) document.getElementById(`row-${jumpTo}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [jumpTo, products])

  return (
    <div className="products">
      <section className="products__intro container">
        <div>
          <p className="eyebrow">The Collection</p>
          <h1 className="section__title section__title--lg">Browse the House</h1>
          <p className="products__lede">
            {products ? `${products.length} pieces` : 'Every piece'}, from weekend crewnecks to office-ready quarter-zips. Hover to preview, select to see sizes and stock.
          </p>
        </div>
        <div className="products__tools">
          <input
            className="search"
            type="search"
            placeholder="Search by name, color, or occasion…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search products"
          />
          <nav className="chips" aria-label="Jump to category">
            {CATEGORIES.map((c) => (
              <a key={c.slug} href={`#row-${c.slug}`} onClick={(e) => {
                e.preventDefault()
                document.getElementById(`row-${c.slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}>
                {c.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {error && <p className="notice container">{error}</p>}
      {!products && !error && <p className="loading container">Preparing the collection…</p>}

      {featured && (
        <section className="spotlight container" aria-live="polite">
          <div className="spotlight__image">
            <img key={featured.product_id} src={imageSrc(featured)} alt={displayName(featured)} />
          </div>
          <div className="spotlight__info">
            <p className="eyebrow">Now Viewing · {categoryTitle(categoryOf(featured))}</p>
            <h2>{displayName(featured)}</h2>
            <p className="spotlight__price">{formatPrice(featured.price)}</p>
            <p className="spotlight__desc">{featured.description}</p>
            <div className="spotlight__meta">
              <span>{featured.inventory.filter((s) => s.quantity > 0).length} of {featured.inventory.length} sizes available</span>
              {featured.colors.length > 0 && <span className="spotlight__colors">{featured.colors.join(' · ')}</span>}
            </div>
            <Link to={`/products/${featured.product_id}`} className="btn btn--primary">View the Piece</Link>
          </div>
        </section>
      )}

      <div className="container">
        {products && rows.length === 0 && <p className="notice">Nothing matches “{query}”. Try “navy”, “hoodie”, or “Harvard”.</p>}
        {rows.map((r) => (
          <Carousel key={r.slug} id={`row-${r.slug}`} title={r.title} subtitle={r.blurb} count={r.items.length}>
            {r.items.map((p) => (
              <ProductCard key={p.product_id} product={p} onFocus={setSpotlight} />
            ))}
          </Carousel>
        ))}
      </div>
    </div>
  )
}
