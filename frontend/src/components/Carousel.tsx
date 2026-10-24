import { useRef, type ReactNode } from 'react'

interface Props {
  id?: string
  title: string
  subtitle?: string
  count?: number
  children: ReactNode
}

export default function Carousel({ id, title, subtitle, count, children }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <section className="carousel" id={id}>
      <div className="carousel__head">
        <div>
          <h2 className="carousel__title">
            {title}
            {count !== undefined && <span className="carousel__count">{count} pieces</span>}
          </h2>
          {subtitle && <p className="carousel__subtitle">{subtitle}</p>}
        </div>
        <div className="carousel__arrows">
          <button onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`}>‹</button>
          <button onClick={() => scroll(1)} aria-label={`Scroll ${title} right`}>›</button>
        </div>
      </div>
      <div className="carousel__track" ref={trackRef}>
        {children}
      </div>
    </section>
  )
}
