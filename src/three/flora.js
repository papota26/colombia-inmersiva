import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createNoise3D } from 'simplex-noise'

// Generador pseudoaleatorio determinista: el bosque es el mismo en cada carga.
export function rng(seed = 1) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const noise3 = createNoise3D(rng(7))

/** Pinta toda la geometría de un color (atributo `color`), con leve variación por vértice. */
function paint(geo, color, jitter = 0.06, r = rng(3)) {
  const c = new THREE.Color(color)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const k = 1 + (r() - 0.5) * jitter * 2
    arr[i * 3] = c.r * k
    arr[i * 3 + 1] = c.g * k
    arr[i * 3 + 2] = c.b * k
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

function clean(geo) {
  // Normaliza atributos para poder fusionar geometrías.
  const g = geo.index ? geo.toNonIndexed() : geo
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k)
  return g
}

/** Copa orgánica: icosaedro deformado con ruido. */
function blob(radius, detail, seed, squash = 0.8) {
  let g = new THREE.IcosahedronGeometry(radius, detail)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = noise3(v.x * 0.9 + seed, v.y * 0.9, v.z * 0.9)
    v.multiplyScalar(1 + n * 0.28)
    v.y *= squash
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

/** Árbol de selva: tronco y varias copas. Altura ~1 (se escala por instancia). */
export function treeGeometry(variant = 0) {
  const r = rng(11 + variant)
  const parts = []
  const trunk = new THREE.CylinderGeometry(0.022, 0.045, 0.72, 7)
  trunk.translate(0, 0.36, 0)
  parts.push(paint(clean(trunk), '#4a3424', 0.1))
  const greens = ['#2f5d2c', '#3d6b2f', '#28502a', '#4b7a35', '#355f33']
  const count = 6 + Math.floor(r() * 4)
  for (let i = 0; i < count; i++) {
    const rad = 0.12 + r() * 0.12
    const b = blob(rad, 2, i * 3.1 + variant, 0.42 + r() * 0.18)
    const ang = r() * Math.PI * 2
    const sp = Math.sqrt(r()) * 0.34
    b.translate(Math.cos(ang) * sp, 0.74 + r() * 0.2 - sp * 0.25, Math.sin(ang) * sp)
    parts.push(paint(clean(b), greens[Math.floor(r() * greens.length)], 0.14, r))
  }
  const g = mergeGeometries(parts)
  g.computeBoundingSphere()
  return g
}

/** Palma de cera del Quindío: tronco altísimo, claro y anillado, corona pequeña. Altura ~1. */
export function waxPalmGeometry() {
  const parts = []
  const trunk = new THREE.CylinderGeometry(0.012, 0.018, 0.92, 7, 24)
  trunk.translate(0, 0.46, 0)
  // anillos: alterna el tono a lo largo del tronco
  const t = clean(trunk)
  const pos = t.attributes.position
  const col = new Float32Array(pos.count * 3)
  const a = new THREE.Color('#cfc8b6')
  const b = new THREE.Color('#9c9583')
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const c = Math.sin(y * 260) > 0.6 ? b : a
    col.set([c.r, c.g, c.b], i * 3)
  }
  t.setAttribute('color', new THREE.BufferAttribute(col, 3))
  parts.push(t)
  // corona: hojas pinnadas como cintas curvas
  const fronds = 11
  for (let i = 0; i < fronds; i++) {
    const seg = 8
    const leaf = new THREE.PlaneGeometry(0.2, 0.026, seg, 1)
    const p = leaf.attributes.position
    for (let j = 0; j < p.count; j++) {
      const x = p.getX(j) + 0.1 // 0..0.2
      const droop = -x * x * 5.5
      p.setXYZ(j, x, droop + p.getY(j) * 0.2, p.getY(j))
    }
    leaf.rotateY((i / fronds) * Math.PI * 2)
    leaf.rotateZ(0) // ya caen con la curva
    leaf.translate(0, 0.92, 0)
    parts.push(paint(clean(leaf), i % 2 ? '#3f6a35' : '#527a3e', 0.1))
  }
  return mergeGeometries(parts)
}

/** Heliconia: tallo con brácteas rojas de punta amarilla en zigzag y hojas anchas. Altura ~1. */
export function heliconiaGeometry() {
  const parts = []
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 1, 5)
  stem.translate(0, 0.5, 0)
  parts.push(paint(clean(stem), '#4f6b2b'))
  const bracts = 7
  for (let i = 0; i < bracts; i++) {
    const cone = new THREE.ConeGeometry(0.035, 0.2 - i * 0.012, 6)
    cone.rotateZ(i % 2 ? 1.15 : -1.15)
    cone.translate((i % 2 ? -1 : 1) * 0.07, 0.48 + i * 0.07, 0)
    const g = clean(cone)
    // degradado rojo -> amarillo hacia la punta
    const p = g.attributes.position
    const col = new Float32Array(p.count * 3)
    const red = new THREE.Color('#e3121f')
    const yel = new THREE.Color('#ffd000')
    const grn = new THREE.Color('#6f8f2e')
    for (let j = 0; j < p.count; j++) {
      const d = Math.abs(p.getX(j)) / 0.17
      const c = red.clone().lerp(yel, THREE.MathUtils.smoothstep(d, 0.55, 0.95))
      if (d > 0.97) c.lerp(grn, 0.5)
      col.set([c.r, c.g, c.b], j * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    parts.push(g)
  }
  for (let i = 0; i < 3; i++) {
    const leaf = bananaLeaf(0.55, 0.14)
    leaf.rotateY(i * 2.1 + 0.4)
    leaf.translate(0, 0.08 + i * 0.1, 0)
    parts.push(paint(clean(leaf), i ? '#3c6a2c' : '#4e7d34', 0.08))
  }
  return mergeGeometries(parts)
}

/** Hoja ancha curvada (plátano/heliconia) que nace en el origen. */
export function bananaLeaf(len, width) {
  const seg = 10
  const g = new THREE.PlaneGeometry(len, width, seg, 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + len / 2 // 0..len
    const t = x / len
    const w = Math.sin(t * Math.PI) * p.getY(i) * 2 // ahusada
    const y = Math.sin(t * 1.8) * len * 0.55 - t * t * len * 0.35 + Math.abs(w) * 0.25
    p.setXYZ(i, x * 0.85, y, w)
  }
  g.computeVertexNormals()
  return g
}

/** Pétalo con forma de elipse curvada; base en el origen, crece en +y. */
export function petalGeometry(len = 1, width = 0.42, cup = 0.25, segs = 12) {
  const g = new THREE.PlaneGeometry(width, len, 6, segs)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + len / 2 // 0..len
    const t = Math.min(1, Math.max(0, y / len))
    const half = Math.sin(Math.pow(t, 0.75) * Math.PI) * 0.5 + 0.02
    const x = p.getX(i) * half * 2
    const z = (x * x) / (width * width) * cup * len - Math.sin(t * Math.PI * 0.9) * cup * 0.4 * len
    // borde ondulado de la Cattleya
    const ruffle = Math.sin(x * 22) * 0.02 * t * t
    p.setXYZ(i, x, y, z + ruffle)
  }
  g.computeVertexNormals()
  return g
}

/** Copa simple para la orquídea pequeña instanciada (flor completa en una geometría). */
export function smallOrchidGeometry() {
  const parts = []
  for (let i = 0; i < 5; i++) {
    const pt = petalGeometry(0.12, 0.06, 0.3, 4)
    pt.rotateX(-1.1)
    pt.rotateY((i / 5) * Math.PI * 2)
    parts.push(paint(clean(pt), i === 0 ? '#c2417a' : '#e6b7d4', 0.05))
  }
  const lip = new THREE.SphereGeometry(0.025, 6, 4)
  lip.translate(0, 0.01, 0.02)
  parts.push(paint(clean(lip), '#e8c43a'))
  const stem = new THREE.CylinderGeometry(0.004, 0.006, 0.35, 4)
  stem.translate(0, -0.17, 0)
  parts.push(paint(clean(stem), '#4b6b2e'))
  const g = mergeGeometries(parts)
  g.translate(0, 0.35, 0)
  return g
}

/** Helecho/arbusto bajo para el sotobosque. */
export function shrubGeometry() {
  const parts = []
  for (let i = 0; i < 6; i++) {
    const l = bananaLeaf(0.5, 0.08)
    l.rotateY((i / 6) * Math.PI * 2)
    parts.push(paint(clean(l), i % 2 ? '#35602c' : '#467535', 0.1))
  }
  return mergeGeometries(parts)
}

/** Ciudadano estilizado en tres piezas (cuerpo, cabeza, sombrero vueltiao) para instanciar
 *  por separado: así cada pieza recibe su propio color (ropa, tono de piel). Altura ~1. */
export function personParts() {
  const pts = [
    [0, 0], [0.09, 0], [0.1, 0.05], [0.085, 0.42], [0.13, 0.5],
    [0.15, 0.62], [0.13, 0.76], [0.06, 0.8], [0.04, 0.83], [0, 0.84],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const body = new THREE.LatheGeometry(pts, 14)
  body.computeVertexNormals()
  const head = new THREE.SphereGeometry(0.075, 14, 10)
  head.translate(0, 0.91, 0)
  const brim = clean(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 18).translate(0, 0.965, 0))
  const crown = clean(new THREE.CylinderGeometry(0.055, 0.075, 0.08, 14).translate(0, 1.0, 0))
  paint(brim, '#efe6cf', 0.02)
  const p = crown.attributes.position
  const col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const dark = Math.sin((p.getY(i) - 0.96) * 160) > 0.3
    const v = dark ? 0.08 : 0.92
    col.set([v, v * 0.97, v * 0.88], i * 3)
  }
  crown.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const hat = mergeGeometries([brim, crown])
  return { body, head, hat }
}

/** Textura de ala de mariposa morfo (azul iridiscente con borde negro y puntos). */
export function wingTexture(kind = 'morpho') {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')
  x.clearRect(0, 0, 256, 256)
  // forma del ala: anterior + posterior
  x.beginPath()
  x.moveTo(6, 128)
  x.bezierCurveTo(40, 10, 200, -10, 250, 40)
  x.bezierCurveTo(240, 100, 200, 120, 150, 130)
  x.bezierCurveTo(220, 150, 230, 220, 170, 248)
  x.bezierCurveTo(110, 256, 40, 200, 6, 128)
  x.closePath()
  x.save()
  x.clip()
  if (kind === 'morpho') {
    const g = x.createRadialGradient(40, 128, 10, 60, 128, 230)
    g.addColorStop(0, '#5fd0ff')
    g.addColorStop(0.45, '#1f7fe0')
    g.addColorStop(0.75, '#123c8c')
    g.addColorStop(0.9, '#0b0d14')
    x.fillStyle = g
  } else {
    const g = x.createRadialGradient(40, 128, 10, 60, 128, 230)
    g.addColorStop(0, '#f6d64a')
    g.addColorStop(0.7, '#e2a51f')
    g.addColorStop(0.9, '#2a1a0b')
    x.fillStyle = g
  }
  x.fillRect(0, 0, 256, 256)
  x.fillStyle = 'rgba(255,255,255,0.85)'
  for (const [px, py, r] of [
    [215, 50, 5],
    [198, 70, 4],
    [228, 72, 3],
    [180, 222, 4],
    [160, 236, 3],
  ]) {
    x.beginPath()
    x.arc(px, py, r, 0, Math.PI * 2)
    x.fill()
  }
  x.restore()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Textura radial suave para neblina y nubes. */
export function softTexture(inner = 'rgba(255,255,255,0.9)') {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, inner)
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export { noise3 }
