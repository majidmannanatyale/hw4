import { Link } from 'react-router-dom'
import { about } from '../content'

export default function About() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow eyebrow--light">About Us</p>
          <h1>{about.headline}</h1>
          <p className="page-hero__lede">{about.intro}</p>
        </div>
      </section>

      <section className="section container story">
        <div className="story__aside">
          <p className="eyebrow">Our Story</p>
          <p className="story__since">Since<br /><span>2008</span></p>
        </div>
        <div className="story__body">
          {about.story.map((para, i) => (
            <p key={i} className={i === 0 ? 'story__lead' : ''}>{para}</p>
          ))}
        </div>
      </section>

      <section className="values">
        <div className="container">
          <p className="eyebrow eyebrow--light">What We Hold To</p>
          <div className="values__grid">
            {about.values.map((v) => (
              <div key={v.title} className="value">
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section container">
        <p className="eyebrow">Our Houses</p>
        <h2 className="section__title">Visit Us in Person</h2>
        <div className="locations">
          {about.locations.map((l, i) => (
            <div key={l.name} className="location">
              {i === 0 && <span className="location__badge">Flagship</span>}
              <h3>{l.name}</h3>
              <p className="location__address">{l.address}</p>
              <p className="location__hours">{l.hours}</p>
              <p>{l.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section container timeline-wrap">
        <p className="eyebrow">Milestones</p>
        <ol className="timeline">
          {about.milestones.map((m) => (
            <li key={m.year}>
              <span className="timeline__year">{m.year}</span>
              <span className="timeline__event">{m.event}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="members">
        <div className="container members__inner">
          <div>
            <p className="eyebrow">The Concierge</p>
            <h2 className="section__title">At Your Service</h2>
            <p>{about.contact.concierge}</p>
            <p className="contact-line">
              <a href={`mailto:${about.contact.email}`}>{about.contact.email}</a> · {about.contact.phone}
            </p>
          </div>
          <Link to="/products" className="btn btn--primary">Browse the Collection</Link>
        </div>
      </section>
    </>
  )
}
