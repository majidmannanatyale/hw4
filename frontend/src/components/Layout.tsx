import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCart } from '../cart/CartContext'
import CartOverlay from '../cart/CartOverlay'
import ChatPill from '../chat/ChatPill'
import { about, footerTagline } from '../content'

export function Crest({ size = 40 }: { size?: number }) {
  return (
    <svg className="crest" width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path d="M24 3 L42 9 V23 C42 34 34 41 24 45 C14 41 6 34 6 23 V9 Z" fill="currentColor" />
      <path d="M24 6.5 L39 11.5 V23 C39 32.4 32.3 38.3 24 41.8 C15.7 38.3 9 32.4 9 23 V11.5 Z" fill="none" stroke="var(--gold)" strokeWidth="1" />
      <text x="24" y="29" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="15" fontWeight="600" fill="#fff" letterSpacing="0.5">CC</text>
    </svg>
  )
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Campus Customs home">
      <Crest />
      <span className="logo__text">
        <span className="logo__name">Campus Customs</span>
        <span className="logo__est">Est. 2008 · New Haven</span>
      </span>
    </Link>
  )
}

function Header() {
  const navClass = ({ isActive }: { isActive: boolean }) => `nav__link ${isActive ? 'nav__link--active' : ''}`
  const { user, logout } = useAuth()
  const { cart, openBag } = useCart()
  const navigate = useNavigate()
  return (
    <>
      <div className="announce">Complimentary shipping on orders over $150 · Monogramming at our New Haven house</div>
      <header className="header">
        <div className="container header__inner">
          <Logo />
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end className={navClass}>Home</NavLink>
            <NavLink to="/products" className={navClass}>Products</NavLink>
            <NavLink to="/about" className={navClass}>About Us</NavLink>
          </nav>
          <div className="header__account">
            {user ? (
              <>
                <span className="header__member" aria-label="Member">✦ Member</span>
                <span className="header__greeting">Good day, {user.first_name}</span>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    logout()
                    navigate('/')
                  }}
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>Log In</NavLink>
                <Link to="/create-account" className="btn btn--outline btn--sm">Create Account</Link>
              </>
            )}
            <button className="bag-btn" onClick={openBag} aria-label={`Bag, ${cart.count} items`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 8h12l-1 12H7L6 8z" strokeLinejoin="round" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>
              {cart.count > 0 && <span className="bag-btn__count">{cart.count}</span>}
            </button>
          </div>
        </div>
      </header>
    </>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <Logo />
          <p className="footer__tagline">{footerTagline}</p>
        </div>
        <div>
          <h4>The House</h4>
          <Link to="/products">Products</Link>
          <Link to="/about">About Us</Link>
          <Link to="/create-account">Membership</Link>
        </div>
        <div>
          <h4>Visit</h4>
          {about.locations.map((l) => (
            <span key={l.name}>{l.name}</span>
          ))}
        </div>
        <div>
          <h4>Concierge</h4>
          <a href={`mailto:${about.contact.email}`}>{about.contact.email}</a>
          <span>{about.contact.phone}</span>
        </div>
      </div>
      <div className="container footer__base">
        <span>© {new Date().getFullYear()} Campus Customs. Officially licensed collegiate apparel.</span>
        <span>New Haven · Cambridge · New York</span>
      </div>
    </footer>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // Members get extra gold accents site-wide; the class is removed on logout.
  useEffect(() => {
    document.body.classList.toggle('is-member', !!user)
    return () => document.body.classList.remove('is-member')
  }, [user])

  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <ChatPill />
      <CartOverlay />
    </>
  )
}
