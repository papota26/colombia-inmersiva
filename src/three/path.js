import * as THREE from 'three'
import { scroll } from '../state'

// Centros de cada escenario en el mundo (un solo mundo continuo de ~600 m).
export const CENTERS = {
  hero: new THREE.Vector3(0, 6, -2),
  c1: new THREE.Vector3(0, 3, -76),
  c2: new THREE.Vector3(0, 5, -160),
  orchid: new THREE.Vector3(-5.5, 4.2, -212),
  c3: new THREE.Vector3(0, 1.2, -245),
  c4: new THREE.Vector3(0, 2, -316),
  c5: new THREE.Vector3(0, 0, -520),
}

const v = (x, y, z) => new THREE.Vector3(x, y, z)

// Fotogramas clave: [sección, progreso local, posición de cámara, punto de mira].
// Entre secciones sin claves la cámara "viaja" siguiendo a la guacamaya.
const KEYS = [
  ['hero', 0, v(0, 3.2, 26), v(0, 5.6, 0)],
  ['hero', 1, v(0, 4.6, 9), v(0, 5, -30)],
  ['c1', 0, v(0, 3.2, -55), v(0, 3.8, -76)],
  ['c1', 0.33, v(7, 4.2, -63), v(-1.5, 3.4, -77)],
  ['c1', 0.66, v(-7, 3.4, -64), v(1.5, 3.4, -78)],
  ['c1', 1, v(0, 7, -64), v(0, 4, -92)],
  ['c2', 0, v(-4, 13, -122), v(14, 9, -170)],
  ['c2', 0.4, v(19, 12, -142), v(0, 3, -160)],
  ['c2', 0.8, v(-34, 18, -112), v(48, 36, -200)],
  ['c2', 1, v(0, 9, -180), v(-3, 4, -210)],
  ['t3', 0.45, v(2.5, 4, -193), v(-4.5, 4, -212)],
  ['c3', 0, v(0, 5.4, -229), v(0, 1.4, -245)],
  ['c3', 0.5, v(3.6, 6.4, -236), v(0, 1.2, -246)],
  ['c3', 1, v(0, 8, -238), v(0, 1, -247)],
  ['c4', 0, v(0, 2.8, -289), v(0, 2.6, -310)],
  ['c4', 0.5, v(-4.5, 3, -301), v(2, 2, -318)],
  ['c4', 1, v(4, 4.4, -305), v(0, 2.5, -322)],
  ['t5', 0.5, v(0, 34, -372), v(0, 46, -430)],
  ['c5', 0, v(0, 82, -466), v(0, 0, -520)],
  ['c5', 0.5, v(-12, 56, -492), v(-2, 0, -518)],
  ['c5', 1, v(4, 96, -498), v(0, 0, -522)],
  ['fin', 1, v(0, 150, -478), v(0, 0, -526)],
]

function keyAt(k) {
  const s = scroll.sections[k[0]]
  if (!s) return 0
  return s.start + (s.end - s.start) * k[1]
}

function catmull(p0, p1, p2, p3, t, out) {
  const t2 = t * t
  const t3 = t2 * t
  out.set(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  )
  return out
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Evalúa posición y mira de la cámara para un progreso global p. */
export function cameraAt(p, outPos, outTgt) {
  const ats = KEYS.map(keyAt)
  let i = 0
  while (i < KEYS.length - 2 && p > ats[i + 1]) i++
  const a = ats[i]
  const b = ats[i + 1]
  let t = b > a ? (p - a) / (b - a) : 0
  t = ease(Math.min(1, Math.max(0, t)))
  const k = (j) => KEYS[Math.min(KEYS.length - 1, Math.max(0, j))]
  catmull(k(i - 1)[2], k(i)[2], k(i + 1)[2], k(i + 2)[2], t, outPos)
  catmull(k(i - 1)[3], k(i)[3], k(i + 1)[3], k(i + 2)[3], t, outTgt)
}
