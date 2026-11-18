import { useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { chapters, timeline, kept, changed, principles, rights, mechanisms, protection } from '../content'
import { reducedMotion } from '../state'

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)

/* ---------- Portada ---------- */
export function Hero({ ready, onExplore }) {
  const ref = useRef()
  useGSAP(
    () => {
      if (!ready) return
      const split = SplitText.create('.hero-title .line', { type: 'chars', mask: 'chars' })
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      if (reducedMotion) {
        gsap.set('.hero [data-enter]', { opacity: 1 })
        return
      }
      tl.from(split.chars, { yPercent: 110, duration: 1.8, stagger: 0.06, delay: 0.9 })
        .to('.hero [data-enter]', { opacity: 1, y: 0, duration: 1.4, stagger: 0.15 }, '-=1.1')
      // al desplazarse, el título se eleva y se desvanece mientras la guacamaya avanza
      gsap.to('.hero-inner', {
        yPercent: -30,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: ref.current, start: 'top top', end: '55% top', scrub: true },
      })
    },
    { scope: ref, dependencies: [ready] },
  )
  return (
    <section ref={ref} className="hero" data-scene="hero" id="hero">
      <div className="hero-sticky">
        <div className="hero-inner">
          <h1 className="hero-title">
            <span className="line">Colombia</span>
            <span className="line">Inmersiva</span>
          </h1>
          <p className="hero-sub" data-enter>
            Un recorrido por el poder, la Constitución y la democracia.
          </p>
          <button className="btn" data-enter onClick={onExplore}>
            Explorar Colombia
          </button>
        </div>
        <p className="scroll-cue" data-enter aria-hidden="true">
          Desliza para seguir a la guacamaya
        </p>
      </div>
    </section>
  )
}

/* ---------- Pregunta del capítulo ---------- */
function ChapterIntro({ c }) {
  const ref = useRef()
  useGSAP(
    () => {
      if (reducedMotion) return
      const split = SplitText.create(ref.current.querySelector('.ch-title'), { type: 'lines,words', mask: 'lines' })
      gsap.from(split.lines, {
        yPercent: 105,
        duration: 1.4,
        stagger: 0.1,
        ease: 'expo.out',
        scrollTrigger: { trigger: ref.current, start: 'top 70%' },
      })
      gsap.from(ref.current.querySelector('.ch-label'), { opacity: 0, duration: 1.2, scrollTrigger: { trigger: ref.current, start: 'top 70%' } })
    },
    { scope: ref },
  )
  return (
    <div className="ch-intro" ref={ref}>
      <p className="ch-label">Pregunta {c.n} de 5</p>
      <h2 className="ch-title" id={`${c.id}-t`}>
        {c.question}
      </h2>
    </div>
  )
}

function Step({ s, children, wide }) {
  return (
    <div className={`step ${wide ? 'step-wide' : ''}`}>
      <article className="panel">
        {s?.h && <h3>{s.h}</h3>}
        {s?.p && <p>{s.p}</p>}
        {children}
      </article>
    </div>
  )
}

/** Frase de opinión personal al cierre de cada pregunta. */
function Opinion({ text }) {
  if (!text) return null
  return (
    <div className="step">
      <figure className="opinion">
        <figcaption>Mi opinión</figcaption>
        <blockquote>{text}</blockquote>
      </figure>
    </div>
  )
}

export function Chapter({ c }) {
  return (
    <section className="chapter" data-scene={c.id} id={c.id} aria-labelledby={`${c.id}-t`}>
      <ChapterIntro c={c} />
      {c.steps.map((s, i) => (
        <Step key={i} s={s} />
      ))}
      <Opinion text={c.opinion} />
    </section>
  )
}

/* ---------- Pregunta 3: línea de tiempo sincronizada con el libro ---------- */
export function TimelineChapter({ lenis }) {
  const c = chapters[2]
  const wrap = useRef()
  const [idx, setIdx] = useState(0)
  useGSAP(() => {
    ScrollTrigger.create({
      trigger: wrap.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => setIdx(Math.min(timeline.length - 1, Math.floor(self.progress * timeline.length + 0.04))),
    })
  })
  const go = (i) => {
    const el = wrap.current
    const top = el.getBoundingClientRect().top + window.scrollY
    const span = el.offsetHeight - window.innerHeight
    const y = top + ((i + 0.3) / timeline.length) * span
    lenis ? lenis.scrollTo(y, { duration: 1.6 }) : window.scrollTo({ top: y, behavior: reducedMotion ? 'auto' : 'smooth' })
  }
  const ev = timeline[idx]
  return (
    <section className="chapter" data-scene="c3" id="c3" aria-labelledby="c3-t">
      <ChapterIntro c={c} />
      <div className="tl-wrap" data-scene="c3tl" ref={wrap} style={{ height: `${timeline.length * 100}vh` }}>
        <div className="tl-sticky">
          <article className="panel tl-panel" aria-live="polite">
            <p className="tl-year">{ev.year}</p>
            <h3>{ev.title}</h3>
            <p>{ev.text}</p>
          </article>
          <ol className="tl-nav" aria-label="Línea de tiempo">
            <span className="tl-line" style={{ '--tl': idx / (timeline.length - 1) }} aria-hidden="true" />
            {timeline.map((t, i) => (
              <li key={t.year}>
                <button className={i === idx ? 'is-active' : i < idx ? 'is-past' : ''} onClick={() => go(i)} aria-current={i === idx ? 'step' : undefined}>
                  <span className="dot" aria-hidden="true" />
                  {t.year}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <Step s={{ h: 'En resumen' }} wide>
        <div className="compare">
          <div>
            <p className="compare-h">Se mantuvo</p>
            <ul>{kept.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div className="is-break">
            <p className="compare-h">Cambió en 1991</p>
            <ul>{changed.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      </Step>
      <Opinion text={c.opinion} />
    </section>
  )
}

/* ---------- Pregunta 4: democracia y derechos ---------- */
function Specimen({ name, example, tone }) {
  const [open, setOpen] = useState(false)
  return (
    <li className={`specimen tone-${tone} ${open ? 'is-open' : ''}`}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="sp-name">{name}</span>
        <span className="sp-hint">{open ? 'Ocultar' : 'Ver qué significa'}</span>
      </button>
      <p className="sp-ex" hidden={!open}>
        {example}
      </p>
    </li>
  )
}

export function RightsChapter() {
  const c = chapters[3]
  const [tab, setTab] = useState('fundamentales')
  const [principle, setPrinciple] = useState(0)
  const keys = Object.keys(rights)
  const tones = { fundamentales: 'esmeralda', desc: 'terracota' }
  return (
    <section className="chapter" data-scene="c4" id="c4" aria-labelledby="c4-t">
      <ChapterIntro c={c} />
      <Step s={{ h: 'Democracia: el poder es del pueblo', p: 'La soberanía reside en el pueblo (artículo 3) y de él nace el poder de quienes gobiernan. Funciona con cuatro principios. Toca uno.' }}>
        <div className="principles" role="tablist" aria-label="Principios de la democracia">
          {principles.map(([t], i) => (
            <button key={t} role="tab" aria-selected={i === principle} className={i === principle ? 'is-active' : ''} onClick={() => setPrinciple(i)}>
              {t}
            </button>
          ))}
        </div>
        <p className="principle-def" role="tabpanel">
          {principles[principle][1]}
        </p>
      </Step>
      <Step wide s={{ h: 'Nuestros derechos' }}>
        <div className="tabs" role="tablist" aria-label="Tipos de derechos">
          {keys.map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tone-${tones[k]} ${tab === k ? 'is-active' : ''}`} onClick={() => setTab(k)}>
              {rights[k].label}
            </button>
          ))}
        </div>
        <p className="tab-note">{rights[tab].note}</p>
        <ul className="specimens" key={tab}>
          {rights[tab].cards.map(([n, e]) => (
            <Specimen key={n} name={n} example={e} tone={tones[tab]} />
          ))}
        </ul>
      </Step>
      <Opinion text={c.opinion} />
    </section>
  )
}

/* ---------- Pregunta 5: participación ---------- */
export function ParticipationChapter() {
  const c = chapters[4]
  return (
    <section className="chapter" data-scene="c5" id="c5" aria-labelledby="c5-t">
      <ChapterIntro c={c} />
      <Step s={{ h: 'Porque nació para incluir a todos', p: 'En 1991 el país buscaba salir de la violencia y la exclusión. La respuesta fue proteger a cada persona y darle poder a la gente: una democracia donde se participa todos los días, no solo el día de elecciones.' }} />
      <Step wide s={{ h: 'Así puedes participar' }}>
        <ul className="mech-list">
          {mechanisms.map(([n, d]) => (
            <li key={n}>
              <strong>{n}</strong>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </Step>
      <Step s={{ h: 'Y así puedes defenderte' }}>
        <ul className="mech-list">
          {protection.map(([n, d]) => (
            <li key={n}>
              <strong>{n}</strong>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </Step>
      <Opinion text={c.opinion} />
    </section>
  )
}

export function Interlude({ id, tall = 160 }) {
  return <section className="interlude" data-scene={id} style={{ height: `${tall}vh` }} aria-hidden="true" />
}

export function Closing({ onTop }) {
  return (
    <section className="closing" data-scene="fin" id="fin">
      <div className="closing-inner">
        <h2 className="closing-title">La Constitución se vive en el territorio</h2>
        <button className="btn" onClick={onTop}>
          Volver al inicio
        </button>
      </div>
      <footer className="credits">
        <p>Fuente: Constitución Política de Colombia (1991). Contenido educativo.</p>
        <p>
          Cielo, texturas y plantas fotoescaneadas: Poly Haven (CC0). Personas: Microsoft Rocketbox (MIT). Palmera: "palmera low poly" de alanoid330b (Sketchfab, CC BY 4.0). Guacamaya: "Parrot" de mirada.com para ro.me (ejemplos de three.js). Mapa: Natural Earth.
        </p>
      </footer>
    </section>
  )
}
