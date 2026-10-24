import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { CartProvider } from './cart/CartContext'
import { ChatProvider } from './chat/ChatContext'
import Layout from './components/Layout'
import About from './pages/About'
import { CreateAccount, Login } from './pages/Auth'
import Home from './pages/Home'
import ProductDetail from './pages/ProductDetail'
import Products from './pages/Products'

// HashRouter so deep links work on GitHub Pages, which has no server-side routing.
export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <ChatProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="products" element={<Products />} />
                <Route path="products/:id" element={<ProductDetail />} />
                <Route path="about" element={<About />} />
                <Route path="login" element={<Login />} />
                <Route path="create-account" element={<CreateAccount />} />
                <Route path="*" element={<Home />} />
              </Route>
            </Routes>
          </HashRouter>
        </ChatProvider>
      </CartProvider>
    </AuthProvider>
  )
}
