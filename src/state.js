// Estado compartido entre el DOM (scroll) y la escena 3D, sin re-render de React.
// ScrollTrigger escribe `progress`; los componentes 3D lo leen en useFrame.

export const scroll = {
  progress: 0, // 0..1 en todo el documento
  sections: {}, // id -> { start, end } en unidades de progreso
  ready: false,
  readyAt: null, // segundos (performance.now) en que terminó la carga
}

export const isMobile =
  typeof window !== 'undefined' &&
  (window.matchMedia('(max-width: 760px)').matches || window.matchMedia('(pointer: coarse)').matches)

export const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const smooth = (v) => {
  v = clamp01(v)
  return v * v * (3 - 2 * v)
}
/** remapea x de [a,b] a [0,1] con suavizado */
export const range = (x, a, b) => smooth((x - a) / (b - a))

/** progreso local 0..1 de una sección */
export function local(id) {
  const s = scroll.sections[id]
  if (!s) return 0
  return clamp01((scroll.progress - s.start) / (s.end - s.start))
}

/** Mide las secciones del DOM y las convierte a unidades de progreso. */
export function measureSections() {
  const max = document.documentElement.scrollHeight - window.innerHeight
  if (max <= 0) return
  document.querySelectorAll('[data-scene]').forEach((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY
    scroll.sections[el.dataset.scene] = {
      start: top / max,
      end: Math.min(1, (top + el.offsetHeight - window.innerHeight) / max),
    }
  })
  scroll.ready = true
}
