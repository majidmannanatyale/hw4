import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  addToCart,
  fetchRecommendations,
  getCart,
  type CartPayload,
  type ChatProductCard,
  type Product,
} from '../api'
import { useAuth } from '../auth/AuthContext'

interface AddedInfo {
  name: string
  recommendations: ChatProductCard[]
}

type OverlayMode = 'closed' | 'added' | 'bag'

interface CartContextValue {
  cart: CartPayload
  overlay: OverlayMode
  added: AddedInfo | null
  addItem: (product: Product, size: string, quantity: number) => Promise<void>
  openBag: () => void
  close: () => void
}

const CART_ID_KEY = 'campus-customs-cart-id'
const EMPTY: CartPayload = { items: [], count: 0, subtotal: 0 }

export function getCartId(): string {
  let id = localStorage.getItem(CART_ID_KEY)
  if (!id) {
    id = crypto.randomUUID?.() ?? `c${Date.now()}${Math.random().toString(36).slice(2)}`
    localStorage.setItem(CART_ID_KEY, id)
  }
  return id
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth()
  const [cart, setCart] = useState<CartPayload>(EMPTY)
  const [overlay, setOverlay] = useState<OverlayMode>('closed')
  const [added, setAdded] = useState<AddedInfo | null>(null)

  // Keep the cart count in sync on load and whenever the signed-in guest changes.
  useEffect(() => {
    let alive = true
    getCart(token, getCartId()).then((c) => alive && setCart(c))
    return () => {
      alive = false
    }
  }, [token, user?.id])

  const value: CartContextValue = {
    cart,
    overlay,
    added,
    addItem: async (product, size, quantity) => {
      const updated = await addToCart(product.product_id, size, quantity, token, getCartId())
      setCart(updated)
      const recommendations = await fetchRecommendations(product.product_id)
      setAdded({ name: product.name, recommendations })
      setOverlay('added')
    },
    openBag: () => {
      getCart(token, getCartId()).then(setCart)
      setOverlay('bag')
    },
    close: () => setOverlay('closed'),
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
