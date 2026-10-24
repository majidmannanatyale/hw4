import { Link } from 'react-router-dom'
import { categoryOf, imageSrc } from '../api'
import Carousel from '../components/Carousel'
import ProductCard from '../components/ProductCard'
import { home } from '../content'
import { useProducts } from '../useProducts'

const HERO_PICKS = ['basic-hoodie-big-yale', 'benjamin-franklin-1-4-zip', 'baseball-left-chest-crewneck']

export default function Home() {
  const { products } = useProducts()
  const heroProducts = HERO_PICKS.map((id) => products?.find((p) => p.product_id === id)).filter((p) => p !== undefined)
  const officeLayer = products?.filter((p) => categoryOf(p) === 'quarter-zips') ?? []

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <p className="eyebrow eyebrow--light">{home.eyebrow}</p>
            <h1 className="hero__headline">{home.headline}</h1>
            <p className="hero__subhead">{home.subhead}</p>
            <div className="hero__ctas">
              <Link to="/products" className="btn btn--light">{home.primaryCta}</Link>
              <Link to="/about" className="btn btn--ghost-light">{home.secondaryCta}</Link>
            </div>
          </div>
          <div className="hero__gallery" aria-hidden>
            {heroProducts.map((p, i) => (
              <div key={p.product_id} className={`hero__frame hero__frame--${i}`}>
                <img src={imageSrc(p)} alt="" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pillars">
        <div className="container pillars__grid">
          {home.pillars.map((p, i) => (
            <div key={p.title} className="pillar">
              <span className="pillar__num">{['I', 'II', 'III'][i]}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section container">
        <p className="eyebrow">The Collections</p>
        <h2 className="section__title">Casual on Saturday, Composed on Monday</h2>
        <div className="collections">
          {home.collections.map((c) => (
            <Link key={c.title} to={`/products?c=${c.category}`} className="collection">
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <span className="collection__link">Explore →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="manifesto">
        <div className="container">
          <span className="manifesto__rule" />
          <blockquote>“{home.quote}”</blockquote>
          <span className="manifesto__rule" />
        </div>
      </section>

      {officeLayer.length > 0 && (
        <div className="container section">
          <Carousel title="The Office Layer" subtitle="Quarter-zips made for the oxford and the boardroom." count={officeLayer.length}>
            {officeLayer.map((p) => (
              <ProductCard key={p.product_id} product={p} />
            ))}
          </Carousel>
        </div>
      )}

      <section className="members">
        <div className="container members__inner">
          <div>
            <p className="eyebrow">Membership</p>
            <h2 className="section__title">{home.membersTitle}</h2>
            <p>{home.membersBody}</p>
          </div>
          <Link to="/create-account" className="btn btn--primary">Become a Member</Link>
        </div>
      </section>
    </>
  )
}
