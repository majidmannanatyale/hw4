import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { clearChatHistory, fetchChatHistory, sendChat, type ChatProductCard, type PageContext } from '../api'
import { useAuth } from '../auth/AuthContext'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  products?: ChatProductCard[]
  followUps?: string[]
}

interface ChatState {
  open: boolean
  draft: string
  messages: ChatMessage[]
}

interface ChatContextValue extends ChatState {
  typing: boolean
  setOpen: (open: boolean) => void
  setDraft: (draft: string) => void
  send: (text?: string) => void
  reset: () => void
}

const STORAGE_KEY = 'campus-customs-chat'
const GREETING: ChatMessage = {
  role: 'assistant',
  content: 'Good day, and welcome to Campus Customs. How may I help you find the right piece?',
  followUps: ['What hoodies do you have?', 'Gifts under $60', 'Show me navy quarter-zips'],
}
const INITIAL: ChatState = { open: false, draft: '', messages: [GREETING] }

function load(): ChatState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? { ...INITIAL, ...(JSON.parse(saved) as Partial<ChatState>) } : INITIAL
  } catch {
    return INITIAL
  }
}

/** Where the guest is right now, so the agent can resolve "this item". */
function currentPage(): PageContext {
  const path = (window.location.hash || '').replace(/^#/, '') || '/'
  const m = path.match(/^\/products\/([^/?]+)/)
  return { path, product_id: m ? decodeURIComponent(m[1]) : null }
}

const ChatContext = createContext<ChatContextValue | null>(null)

/** Lives above the router so the chat keeps its state across pages. Signed-in guests have their
 *  history stored server-side (restored on login/reload); anonymous chats stay in localStorage only. */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth()
  const [state, setState] = useState<ChatState>(load)
  const [typing, setTyping] = useState(false)
  const sendingRef = useRef(false)
  const prevUserId = useRef<number | null>(user?.id ?? null)

  // Persist UI state always; persist messages locally only for anonymous guests (no cross-user leak).
  useEffect(() => {
    const toSave = user ? { open: state.open, draft: state.draft, messages: [] } : state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  }, [state, user])

  // Restore a signed-in guest's saved conversation; on logout, clear it so nothing leaks to the next guest.
  // Anonymous initial state is left as the stored/greeting value loaded above.
  useEffect(() => {
    let alive = true
    if (user && token) {
      fetchChatHistory(token).then((history) => {
        if (!alive) return
        const restored: ChatMessage[] = history.map((m) => ({ role: m.role, content: m.content, products: m.products }))
        setState((s) => ({ ...s, messages: restored.length ? restored : [GREETING] }))
      })
    } else if (prevUserId.current !== null) {
      // Transition from signed-in to signed-out: start fresh so the previous guest's chat isn't shown.
      setState((s) => ({ ...s, messages: [GREETING] }))
    }
    prevUserId.current = user?.id ?? null
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, token])

  const send = (text?: string) => {
    if (sendingRef.current) return
    const message = (text ?? state.draft).trim()
    if (!message) return

    const history = state.messages.map((m) => ({ role: m.role, content: m.content }))
    sendingRef.current = true
    setTyping(true)
    setState((s) => ({ ...s, draft: '', messages: [...s.messages, { role: 'user', content: message }] }))

    sendChat(message, history, token, currentPage())
      .then((res) => {
        setState((s) => ({
          ...s,
          messages: [
            ...s.messages,
            { role: 'assistant', content: res.reply, products: res.products, followUps: res.follow_ups },
          ],
        }))
      })
      .catch((err: Error) => {
        setState((s) => ({ ...s, messages: [...s.messages, { role: 'assistant', content: err.message }] }))
      })
      .finally(() => {
        sendingRef.current = false
        setTyping(false)
      })
  }

  const value: ChatContextValue = {
    ...state,
    typing,
    setOpen: (open) => setState((s) => ({ ...s, open })),
    setDraft: (draft) => setState((s) => ({ ...s, draft })),
    send,
    reset: () => {
      if (user && token) clearChatHistory(token)
      setState({ ...INITIAL, open: true })
      setTyping(false)
    },
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used inside ChatProvider')
  return ctx
}
