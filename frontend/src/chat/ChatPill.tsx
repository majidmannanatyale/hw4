import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { API_URL, cleanName, formatPrice, type ChatProductCard } from '../api'
import Ribbon from '../components/Ribbon'
import { useChat, type ChatMessage } from './ChatContext'

function ProductCards({ products }: { products: ChatProductCard[] }) {
  return (
    <div className="chat__cards">
      {products.map((p) => (
        <Link key={p.product_id} to={`/products/${p.product_id}`} className={`chat__card ${p.in_stock ? '' : 'is-oos'}`}>
          <div className="chat__card-image">
            <img src={`${API_URL}${p.image_url}`} alt={cleanName(p.name)} loading="lazy" />
            {p.in_stock ? <Ribbon badge={p.badge} /> : <span className="chat__card-oos">Out of stock</span>}
          </div>
          <div className="chat__card-body">
            <span className="chat__card-name">{cleanName(p.name)}</span>
            <span className="chat__card-price">{formatPrice(p.price)}</span>
            {p.in_stock && p.sizes.length > 0 && (
              <span className="chat__card-sizes" aria-label="Sizes (sold-out struck through)">
                {p.sizes.map((s) => (
                  <span key={s.size} className={s.in_stock ? '' : 'is-out'}>{s.size}</span>
                ))}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

function Message({ m, onFollowUp }: { m: ChatMessage; onFollowUp: (text: string) => void }) {
  return (
    <div className={`chat__msg chat__msg--${m.role}`}>
      <p className={`chat__bubble chat__bubble--${m.role}`}>{m.content}</p>
      {m.products && m.products.length > 0 && <ProductCards products={m.products} />}
      {m.followUps && m.followUps.length > 0 && (
        <div className="chat__followups">
          {m.followUps.map((f) => (
            <button key={f} className="chat__chip" onClick={() => onFollowUp(f)}>
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChatPill() {
  const { open, draft, messages, typing, setOpen, setDraft, send, reset } = useChat()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing, open])

  return (
    <div className={`chat ${open ? 'chat--open' : ''}`}>
      {open && (
        <section className="chat__panel" aria-label="Campus Customs concierge chat">
          <header className="chat__header">
            <div className="chat__avatar" aria-hidden>CC</div>
            <div>
              <p className="chat__title">The Concierge</p>
              <p className="chat__status"><span className="chat__dot" /> At your service</p>
            </div>
            <button className="chat__icon-btn" onClick={reset} title="Start a new conversation" aria-label="Start a new conversation">↺</button>
            <button className="chat__icon-btn" onClick={() => setOpen(false)} aria-label="Minimise chat">—</button>
          </header>

          <div className="chat__messages" ref={listRef}>
            {messages.map((m, i) => (
              <Message key={i} m={m} onFollowUp={(t) => send(t)} />
            ))}
            {typing && (
              <div className="chat__msg chat__msg--assistant">
                <p className="chat__bubble chat__bubble--assistant chat__typing" aria-label="The concierge is typing">
                  <span /><span /><span />
                </p>
              </div>
            )}
          </div>

          <form
            className="chat__form"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about sizes, gifts, or a piece…"
              aria-label="Message the concierge"
              disabled={typing}
            />
            <button type="submit" disabled={typing || !draft.trim()} aria-label="Send">➤</button>
          </form>
        </section>
      )}

      <button className="chat__pill" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="chat__pill-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 5h16v11H9l-5 4V5z" strokeLinejoin="round" />
            <circle cx="9" cy="10.5" r="0.9" fill="currentColor" />
            <circle cx="12" cy="10.5" r="0.9" fill="currentColor" />
            <circle cx="15" cy="10.5" r="0.9" fill="currentColor" />
          </svg>
        </span>
        <span className="chat__pill-text">
          <span className="chat__pill-label">{open ? 'Close concierge' : 'Ask the Concierge'}</span>
          <span className="chat__pill-hint">We're happy to help</span>
        </span>
      </button>
    </div>
  )
}
