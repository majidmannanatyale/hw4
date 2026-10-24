import { useEffect, useState } from 'react'
import { fetchProducts, type Product } from './api'

export function useProducts() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchProducts()
      .then((p) => alive && setProducts(p))
      .catch(() => alive && setError('We could not reach the collection just now. Please make sure the backend is running and try again.'))
    return () => {
      alive = false
    }
  }, [])

  return { products, error }
}
