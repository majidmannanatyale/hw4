export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface StockLevel {
  size: string
  quantity: number
}

export type Badge = 'hot' | 'almost_gone' | null

export interface Product {
  product_id: string
  name: string
  garment_type: string
  description: string
  colors: string[]
  search_tags: string[]
  image_url: string
  price: number
  inventory: StockLevel[]
  total_stock: number
  badge: Badge
}

export const imageSrc = (p: Product) => `${API_URL}${p.image_url}`

// ------------------------------------------------------------------------ accounts
export interface AccountUser {
  id: number
  first_name: string
  last_name: string
  email: string
}

export interface AuthResult {
  user: AccountUser
  token: string
  greeting: string
}

export interface RegisterInput {
  first_name: string
  last_name: string
  email: string
  password: string
}

/** Pull the first, most helpful message out of a FastAPI error body. */
async function authError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      return String(body.detail[0].msg).replace(/^Value error,\s*/, '')
    }
  } catch {
    /* fall through */
  }
  return 'Something went amiss in our halls. Please try again shortly.'
}

async function postAuth(path: string, payload: unknown): Promise<AuthResult> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('We could not reach the house just now. Please make sure the service is running.')
  }
  if (!res.ok) throw new Error(await authError(res))
  return res.json() as Promise<AuthResult>
}

export const registerAccount = (input: RegisterInput) => postAuth('/api/auth/register', input)
export const loginAccount = (email: string, password: string) => postAuth('/api/auth/login', { email, password })

// --------------------------------------------------------------------------- chatbot
export interface SizeStock {
  size: string
  quantity: number
  in_stock: boolean
}

export interface ChatProductCard {
  product_id: string
  name: string
  price: number
  image_url: string
  colors: string[]
  in_stock: boolean
  sizes: SizeStock[]
  badge: Badge
}

export interface ChatReplyPayload {
  reply: string
  products: ChatProductCard[]
  follow_ups: string[]
}

export interface ChatTurnInput {
  role: 'user' | 'assistant'
  content: string
}

export interface PageContext {
  path: string
  product_id: string | null
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
  products: ChatProductCard[]
}

export async function sendChat(
  message: string,
  history: ChatTurnInput[],
  token?: string | null,
  page?: PageContext | null,
): Promise<ChatReplyPayload> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, history, page: page ?? null }),
    })
  } catch {
    throw new Error('We could not reach the concierge just now. Please make sure the service is running.')
  }
  if (!res.ok) {
    let detail = 'Our concierge is momentarily indisposed. Please try again shortly.'
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      /* keep default */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<ChatReplyPayload>
}

/** A signed-in guest's saved conversation (empty list if none or on error). */
export async function fetchChatHistory(token: string): Promise<HistoryMessage[]> {
  try {
    const res = await fetch(`${API_URL}/api/chat/history`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return []
    const body = (await res.json()) as { messages: HistoryMessage[] }
    return body.messages ?? []
  } catch {
    return []
  }
}

// ----------------------------------------------------------------------- cart & pickup
export interface CartLine {
  product_id: string
  name: string
  price: number
  image_url: string
  size: string
  quantity: number
}

export interface CartPayload {
  items: CartLine[]
  count: number
  subtotal: number
}

function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function addToCart(
  product_id: string,
  size: string,
  quantity: number,
  token: string | null,
  cart_id: string,
): Promise<CartPayload> {
  const res = await fetch(`${API_URL}/api/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ product_id, size, quantity, cart_id }),
  })
  if (!res.ok) throw new Error('We could not add that to your bag just now.')
  return res.json() as Promise<CartPayload>
}

export async function getCart(token: string | null, cart_id: string): Promise<CartPayload> {
  try {
    const res = await fetch(`${API_URL}/api/cart?cart_id=${encodeURIComponent(cart_id)}`, {
      headers: authHeaders(token),
    })
    if (!res.ok) return { items: [], count: 0, subtotal: 0 }
    return res.json() as Promise<CartPayload>
  } catch {
    return { items: [], count: 0, subtotal: 0 }
  }
}

export async function fetchRecommendations(product_id: string): Promise<ChatProductCard[]> {
  try {
    const res = await fetch(`${API_URL}/api/products/${encodeURIComponent(product_id)}/recommendations`)
    return res.ok ? ((await res.json()) as ChatProductCard[]) : []
  } catch {
    return []
  }
}

export interface PickupInput {
  product_id: string
  size: string | null
  pickup_date: string
  someone_else: boolean
  alternate_name: string | null
  cart_id: string
}

export async function requestPickup(input: PickupInput, token: string | null): Promise<string> {
  const res = await fetch(`${API_URL}/api/pickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('We could not record your pickup request just now.')
  const body = (await res.json()) as { message?: string }
  return body.message ?? 'Your pickup request has been noted.'
}

export async function clearChatHistory(token: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/chat/history`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    /* best effort */
  }
}

export async function fetchMe(token: string): Promise<AccountUser | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    return res.ok ? ((await res.json()) as AccountUser) : null
  } catch {
    return null
  }
}

// Catalogue names were generated from URL slugs ("Benjamin Franklin 1 4 Zip"); tidy them for display only.
const NAME_FIXES: [RegExp, string][] = [
  [/\b1 4 Zip\b/g, '¼ Zip'],
  [/\bT Shirt\b/g, 'T-Shirt'],
  [/\bFull Zip\b/g, 'Full-Zip'],
  [/\bTri Blend\b/g, 'Tri-Blend'],
  [/\bTrack (And )?Field\b/g, 'Track & Field'],
  [/\bL S 2 0\b/g, 'L/S 2.0'],
  [/\bCreqneck\b/g, 'Crewneck'],
  [/\bMens\b/g, "Men's"],
  [/\bUa\b/g, 'UA'],
  [/\bVit\b/g, 'VIT'],
  [/\bVs\b/g, 'vs.'],
  [/ Of /g, ' of '],
  [/ And /g, ' and '],
  [/ Hoodie 1$/g, ' Hoodie'],
]

export const cleanName = (name: string) => NAME_FIXES.reduce((n, [re, rep]) => n.replace(re, rep), name)
export const displayName = (p: Product) => cleanName(p.name)

export const formatPrice = (price: number) =>
  price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(res.status === 404 ? 'not-found' : `Request failed (${res.status})`)
  return res.json() as Promise<T>
}

let productsCache: Promise<Product[]> | null = null

/** All products; fetched once and shared across pages. */
export function fetchProducts(): Promise<Product[]> {
  productsCache ??= getJson<Product[]>('/api/products').catch((err) => {
    productsCache = null
    throw err
  })
  return productsCache
}

export const fetchProduct = (id: string) => getJson<Product>(`/api/products/${encodeURIComponent(id)}`)

/** The catalogue's garment_type is free text (22 variants); collapse it into shop categories. */
export interface Category {
  slug: string
  title: string
  blurb: string
}

export const CATEGORIES: Category[] = [
  { slug: 'quarter-zips', title: 'The Quarter-Zip', blurb: 'Over an oxford on Monday, over a polo on Saturday.' },
  { slug: 'crewnecks', title: 'Crewnecks', blurb: 'The collegiate classic, cut for unhurried weekends.' },
  { slug: 'hoodies', title: 'Hoodies', blurb: 'Substantial fleece for library nights and early crew.' },
  { slug: 'outerwear', title: 'Outerwear & Full-Zips', blurb: 'For the boathouse, the sideline, and the walk home.' },
  { slug: 'tees', title: 'Tees & Performance', blurb: 'Light layers with quiet Bulldog character.' },
]

export function categoryOf(p: Product): string {
  const t = p.garment_type.toLowerCase()
  if (t.includes('quarter-zip')) return 'quarter-zips'
  if (t.includes('jacket') || t.includes('full-zip')) return 'outerwear'
  if (t.includes('hood')) return 'hoodies'
  if (t.includes('crewneck') || t.includes('mockneck')) return 'crewnecks'
  return 'tees'
}

export const categoryTitle = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.title ?? 'Collection'

const SWATCHES: [string, string][] = [
  ['royal blue', '#2347a8'],
  ['light blue', '#9ec2e6'],
  ['navy', '#1b2a4a'],
  ['blue', '#2f5bb7'],
  ['charcoal', '#3d4044'],
  ['dark heather', '#5d6066'],
  ['light gray', '#d4d6d9'],
  ['gray', '#a7aaae'],
  ['black', '#141414'],
  ['white', '#ffffff'],
  ['ivory', '#f8f3e6'],
  ['cream', '#efe6d0'],
  ['red', '#a8242c'],
  ['coral', '#e08a7a'],
  ['yellow', '#e8c547'],
  ['gold', '#c4a35a'],
  ['green', '#2e5e3e'],
]

export function swatchColor(name: string): string {
  const n = name.toLowerCase()
  if (n === 'multicolor') return 'conic-gradient(#a8242c, #e8c547, #2e5e3e, #2347a8, #a8242c)'
  return SWATCHES.find(([key]) => n.includes(key))?.[1] ?? '#cccccc'
}

export const LOW_STOCK = 5
