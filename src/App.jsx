import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { chapters } from './content'
import { scroll, measureSections, reducedMotion } from './state'
import { Header, Loader } from './ui/Chrome'
import { Hero, Chapter, TimelineChapter, RightsChapter, ParticipationChapter, Interlude, Closing } from './ui/Sections'

gsap.registerPlugin(ScrollTrigger)
// En la versión publicada como artifact de claude.ai, los .glb y .hdr viajan como JSON
// (base64) porque ese hosting no sirve tipos binarios de 3D. Se decodifican a blobs en
// memoria y los cargadores de three.js los reciben con su ruta original.
async function unpackBinaries() {
  if (!import.meta.env.VITE_PACKED) return
  const { DefaultLoadingManager } = await import('three')
  const list = await (await fetch('./packed/index.json')).json()
  const map = {}
  await Promise.all(
    list.map(async (p) => {
      const { b64 } = await (await fetch(`./packed/${p.replace(/\//g, '__')}.json`)).json()
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      map[p] = URL.createObjectURL(new Blob([bin]))
    }),
  )
  DefaultLoadingManager.setURLModifier((u) => {
    const hit = Object.keys(map).find((k) => u.endsWith(k))
    return hit ? map[hit] : u
  })
}
const Experience = lazy(() => unpackBinaries().then(() => import('./three/Experience')))

const ORDER = ['c1', 'c2', 'c3', 'c4', 'c5']

export default function App() {
  const [ready, setReady] = useState(false)
  const [active, setActive] = useState(null)
  const lenis = useRef(null)
  const activeRef = useRef(null)

  useEffect(() => {
    if (!reducedMotion) {
      lenis.current = new Lenis({ duration: 1.35, smoothWheel: true })
      lenis.current.on('scroll', ScrollTrigger.update)
    }
    const tick = (time) => {
      lenis.current?.raf(time * 1000)
      const max = document.documentElement.scrollHeight - window.innerHeight
      scroll.progress = max > 0 ? window.scrollY / max : 0
      document.documentElement.style.setProperty('--p', scroll.progress.toFixed(4))
      // capítulo activo para la navegación
      let cur = null
      for (const id of ORDER) {
        const s = scroll.sections[id]
        if (s && scroll.progress >= s.start - 0.004) cur = id
      }
      const fin = scroll.sections.fin
      if (fin && scroll.progress > fin.start + 0.002) cur = null
      if (cur !== activeRef.current) {
        activeRef.current = cur
        setActive(cur)
      }
    }
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    const measure = () => {
      measureSections()
      ScrollTrigger.refresh()
    }
    measure()
    window.addEventListener('resize', measure)
    document.fonts?.ready.then(measure)
    const late = setTimeout(measure, 1200)
    return () => {
      gsap.ticker.remove(tick)
      window.removeEventListener('resize', measure)
      clearTimeout(late)
      lenis.current?.destroy()
    }
  }, [])

  // bloquear el scroll hasta que termine la carga
  useEffect(() => {
    if (!ready) lenis.current?.stop()
    else {
      lenis.current?.start()
      scroll.readyAt = performance.now() / 1000
    }
    document.documentElement.classList.toggle('is-loading', !ready)
  }, [ready])

  const go = useCallback((id) => {
    const el = document.getElementById(id)
    if (!el) return
    const y = id === 'hero' ? 0 : el.getBoundingClientRect().top + window.scrollY
    if (lenis.current) lenis.current.scrollTo(y, { duration: 2.4 })
    else window.scrollTo({ top: y })
    // mover el foco para lectores de pantalla y teclado
    el.querySelector('h1, h2')?.setAttribute('tabindex', '-1')
    setTimeout(() => el.querySelector('h1, h2')?.focus({ preventScroll: true }), reducedMotion ? 0 : 2400)
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <Experience />
      </Suspense>
      <div className="veil" aria-hidden="true" />
      <Loader onDone={useCallback(() => setReady(true), [])} />
      <Header active={active} onGo={go} />
      <main>
        <Hero ready={ready} onExplore={() => go('c1')} />
        <Interlude id="t1" tall={170} />
        <Chapter c={chapters[0]} />
        <Interlude id="t2" tall={160} />
        <Chapter c={chapters[1]} />
        <Interlude id="t3" tall={170} />
        <TimelineChapter lenis={lenis.current} />
        <Interlude id="t4" tall={150} />
        <RightsChapter />
        <Interlude id="t5" tall={200} />
        <ParticipationChapter />
        <Closing onTop={() => go('hero')} />
      </main>
    </>
  )
}
