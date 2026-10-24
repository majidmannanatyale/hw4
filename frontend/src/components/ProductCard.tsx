import { Link } from 'react-router-dom'
import { displayName, formatPrice, imageSrc, type Product } from '../api'
import Ribbon from './Ribbon'

interface Props {
  product: Product
  onFocus?: (p: Product) => void
}

export default function ProductCard({ product, onFocus }: Props) {
  return (
    <Link
      to={`/products/${product.product_id}`}
      className="card"
      onMouseEnter={() => onFocus?.(product)}
      onFocus={() => onFocus?.(product)}
    >
      <div className="card__image">
        <img src={imageSrc(product)} alt={displayName(product)} loading="lazy" />
        <Ribbon badge={product.badge} />
      </div>
      <div className="card__body">
        <div className="card__row">
          <h3 className="card__name">{displayName(product)}</h3>
          <span className="card__price">{formatPrice(product.price)}</span>
        </div>
        <p className="card__desc">{product.description}</p>
        <p className="card__sizes">
          {product.inventory.map((s) => (
            <span key={s.size} className={s.quantity === 0 ? 'is-out' : ''}>{s.size}</span>
          ))}
        </p>
      </div>
    </Link>
  )
}
