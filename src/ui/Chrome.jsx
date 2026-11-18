import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { chapters } from '../content'

export function Loader({ onDone }) {
  const { progress, active } = useProgress()
  const [hidden, setHidden] = useState(false)
  const [fonts, setFonts] = useState(false)
  useEffect(() => {
    document.fonts?.ready.then(() => setFonts(true))
    const fallback = setTimeout(() => setFonts(true), 4000)
    return () => clearTimeout(fallback)
  }, [])
  useEffect(() => {
    if (fonts && !active && progress >= 100) {
      const t = setTimeout(() => {
        setHidden(true)
        onDone()
      }, 600)
      return () => clearTimeout(t)
    }
  }, [fonts, active, progress, onDone])
  return (
    <div className={`loader ${hidden ? 'is-hidden' : ''}`} role="status" aria-live="polite">
      <p className="loader-name">Colombia Inmersiva</p>
      <div className="loader-bar">
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <p className="loader-note">Preparando la selva · {Math.round(progress)} %</p>
    </div>
  )
}

export function Header({ active, onGo }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const go = (id) => {
    setOpen(false)
    onGo(id)
  }
  return (
    <>
      <div className="progress" aria-hidden="true">
        <span />
      </div>
      <header className="header">
        <button className="brand" onClick={() => go('hero')} aria-label="Volver al inicio">
          Colombia Inmersiva
        </button>
        <button className="menu-btn" aria-expanded={open} aria-controls="menu" onClick={() => setOpen((o) => !o)}>
          {open ? 'Cerrar' : 'Capítulos'}
        </button>
      </header>
      <nav id="menu" className={`menu ${open ? 'is-open' : ''}`} aria-label="Capítulos" inert={!open}>
        <ol>
          {chapters.map((c) => (
            <li key={c.id}>
              <button onClick={() => go(c.id)} aria-current={active === c.id ? 'step' : undefined}>
                <span className="menu-n">{c.n}</span>
                <span className="menu-t">{c.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <nav className="rail" aria-label="Progreso por capítulos">
        {chapters.map((c) => (
          <button key={c.id} className={active === c.id ? 'is-active' : ''} onClick={() => onGo(c.id)} aria-label={`Capítulo ${c.n}: ${c.title}`}>
            <span className="rail-n">{c.n}</span>
            <span className="rail-t">{c.title}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
