import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Crest } from '../components/Layout'

// Names: letters (incl. accents), spaces, apostrophes, hyphens, periods — mirrors the backend.
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .-]*$/
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Funny-but-elegant, and always treating the guest as royalty.
const MISMATCH_LINES = [
  'The two passwords are not in agreement, Your Grace. Even royalty must repeat themselves precisely.',
  'Alas, those passwords differ. A monarch’s word is their bond — let the second match the first.',
  'The passwords have quarrelled. Kindly reconcile them before we proceed.',
]

function AuthShell({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <section className="auth">
      <div className="auth__card">
        <Crest size={52} />
        <h1>{title}</h1>
        <p className="auth__lede">{lede}</p>
        {children}
      </div>
    </section>
  )
}

function Welcome({ greeting }: { greeting: string }) {
  return (
    <AuthShell title="Entrée Accordée" lede={greeting}>
      <p className="form__note">Escorting you to the collection…</p>
    </AuthShell>
  )
}

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [greeting, setGreeting] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    if (!EMAIL_RE.test(email)) {
      setError('That does not appear to be a proper email address, Your Grace.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await login(email, password)
      setGreeting(res.greeting)
      setTimeout(() => navigate('/'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not sign you in.')
      setBusy(false)
    }
  }

  if (greeting) return <Welcome greeting={greeting} />

  return (
    <AuthShell title="Welcome Back" lede="Sign in to your Campus Customs account.">
      <form className="form" onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        {error && <p className="form__error">{error}</p>}
        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? 'Announcing you…' : 'Sign In'}
        </button>
      </form>
      <p className="auth__switch">
        New to the house? <Link to="/create-account">Create an account</Link>
      </p>
    </AuthShell>
  )
}

export function CreateAccount() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [greeting, setGreeting] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const first = String(data.get('first_name') ?? '').trim()
    const last = String(data.get('last_name') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const confirm = String(data.get('confirm') ?? '')

    if (!NAME_RE.test(first) || !NAME_RE.test(last)) {
      setError('A name is no place for numerals or symbols, Your Grace — letters, spaces, hyphens and apostrophes only.')
      return
    }
    if (!EMAIL_RE.test(email)) {
      setError('That does not appear to be a proper email address, Your Grace.')
      return
    }
    if (password.length < 8) {
      setError('A password fit for royalty is at least eight characters long.')
      return
    }
    if (password !== confirm) {
      setError(MISMATCH_LINES[Math.floor(Math.random() * MISMATCH_LINES.length)])
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await register({ first_name: first, last_name: last, email, password })
      setGreeting(res.greeting)
      setTimeout(() => navigate('/'), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not create your account.')
      setBusy(false)
    }
  }

  if (greeting) return <Welcome greeting={greeting} />

  return (
    <AuthShell title="Become a Member" lede="Save favorites, track orders, and hear first about new releases.">
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="form__row">
          <label>
            First name
            <input name="first_name" autoComplete="given-name" required />
          </label>
          <label>
            Last name
            <input name="last_name" autoComplete="family-name" required />
          </label>
        </div>
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input type="password" name="password" autoComplete="new-password" required />
        </label>
        <label>
          Confirm password
          <input type="password" name="confirm" autoComplete="new-password" required />
        </label>
        {error && <p className="form__error">{error}</p>}
        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? 'Preparing your welcome…' : 'Create Account'}
        </button>
      </form>
      <p className="auth__switch">
        Already a member? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  )
}
