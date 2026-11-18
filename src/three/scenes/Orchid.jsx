import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Cattleya trianae, flor nacional de Colombia.
// Pétalos con textura pintada (venas, degradado, borde ondulado), material con brillo
// aterciopelado (sheen) y una floración por etapas: sépalos, pétalos y por último el labelo.

/* ---------------- texturas ---------------- */

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

/** Silueta de pétalo: ancho variable a lo largo de y, borde ondulado. */
function outline(ctx, w, h, broad, wave) {
  ctx.beginPath()
  const steps = 120
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const half = Math.pow(Math.sin(Math.pow(t, broad ? 0.7 : 0.85) * Math.PI), broad ? 0.75 : 1.1) * 0.5
    const ruffle = 1 + Math.sin(t * (broad ? 26 : 12)) * wave * t
    pts.push([half * ruffle, t])
  }
  pts.forEach(([x, t], i) => (i ? ctx.lineTo(w / 2 + x * w, h - t * h) : ctx.moveTo(w / 2 + x * w, h - t * h)))
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(w / 2 - pts[i][0] * w, h - pts[i][1] * h)
  ctx.closePath()
}

function petalTexture(broad) {
  const W = 256
  const H = 512
  const [c, x] = canvas(W, H)
  outline(x, W, H, broad, broad ? 0.05 : 0.02)
  x.save()
  x.clip()
  const g = x.createLinearGradient(0, H, 0, 0)
  g.addColorStop(0, '#fdf4f6')
  g.addColorStop(0.25, '#f6d9e6')
  g.addColorStop(0.7, '#eebcd6')
  g.addColorStop(1, '#e4a3c8')
  x.fillStyle = g
  x.fillRect(0, 0, W, H)
  // venas que nacen en la base
  x.strokeStyle = 'rgba(160, 70, 150, 0.22)'
  for (let i = 0; i < (broad ? 26 : 12); i++) {
    const a = (i / ((broad ? 26 : 12) - 1) - 0.5) * (broad ? 1.6 : 0.7)
    x.lineWidth = 0.6 + Math.random() * 0.8
    x.beginPath()
    x.moveTo(W / 2, H)
    x.quadraticCurveTo(W / 2 + Math.sin(a) * W * 0.4, H * 0.5, W / 2 + Math.sin(a) * W * 0.55, H * 0.02)
    x.stroke()
  }
  // brillo cristalino y moteado leve
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`
    x.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5)
  }
  x.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function lipTexture() {
  const W = 512
  const H = 256
  const [c, x] = canvas(W, H)
  // v = 0 (garganta) amarillo-naranja con estrías; v = 1 (borde) magenta profundo con orla clara
  const g = x.createLinearGradient(0, H, 0, 0)
  g.addColorStop(0, '#f6d24a')
  g.addColorStop(0.3, '#ef9b32')
  g.addColorStop(0.5, '#d04f8c')
  g.addColorStop(0.85, '#a8226d')
  g.addColorStop(1, '#e9a5cc')
  x.fillStyle = g
  x.fillRect(0, 0, W, H)
  x.strokeStyle = 'rgba(120, 20, 40, 0.55)'
  for (let i = 0; i < 40; i++) {
    const u = (i / 40) * W
    x.lineWidth = 1 + Math.random()
    x.beginPath()
    x.moveTo(u, H)
    x.lineTo(u + (Math.random() - 0.5) * 20, H * (0.45 + Math.random() * 0.15))
    x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/* ---------------- geometría ---------------- */

/** Malla de pétalo (base en el origen, crece en +y). La curvatura se aplica en cada fotograma. */
function petalMesh(len, width) {
  const g = new THREE.PlaneGeometry(width, len, 16, 28)
  g.translate(0, len / 2, 0)
  g.userData.rest = Float32Array.from(g.attributes.position.array)
  g.userData.len = len
  g.userData.width = width
  return g
}

/**
 * Deforma un pétalo: `curl` lo enrolla sobre su eje (capullo), `cup` lo ahueca,
 * `bend` lo arquea hacia atrás al abrirse; el borde ondula como en la Cattleya.
 */
function shapePetal(g, curl, cup, bend, ruffle) {
  const p = g.attributes.position
  const rest = g.userData.rest
  const { len, width } = g.userData
  for (let i = 0; i < p.count; i++) {
    const x0 = rest[i * 3]
    const y0 = rest[i * 3 + 1]
    const t = y0 / len
    const u = x0 / (width / 2) // -1..1
    // enrollado alrededor del eje y
    const ang = u * curl * Math.PI * 0.5
    const R = width / 2 / Math.max(0.001, curl * Math.PI * 0.5)
    let x = curl > 0.001 ? Math.sin(ang) * R : x0
    let z = curl > 0.001 ? (1 - Math.cos(ang)) * R : 0
    z += u * u * cup * width * 0.4
    z += Math.sin(t * Math.PI * 0.9) * -bend * len * 0.25 + t * t * bend * len * 0.35
    z += Math.sin(t * 22 + u * 3) * ruffle * Math.abs(u) * t * width * 0.08
    p.setXYZ(i, x, y0, z)
  }
  p.needsUpdate = true
  g.computeVertexNormals()
}

function lipGeometry() {
  const pts = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    pts.push(new THREE.Vector2(0.07 + Math.pow(t, 2.1) * 0.5, t * 0.85))
  }
  const g = new THREE.LatheGeometry(pts, 48, Math.PI * 0.62, Math.PI * 1.76)
  // borde muy ondulado (orla del labelo)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    const t = y / 0.85
    const a = Math.atan2(p.getZ(i), p.getX(i))
    const k = 1 + Math.sin(a * 14) * 0.09 * t * t * t
    p.setX(i, p.getX(i) * k)
    p.setZ(i, p.getZ(i) * k)
    p.setY(i, y + Math.sin(a * 9) * 0.03 * t * t)
  }
  g.computeVertexNormals()
  g.rotateX(Math.PI / 2) // abre hacia +z
  return g
}

/* ---------------- materiales compartidos ---------------- */

let shared = null
function materials() {
  if (shared) return shared
  const mk = (map) =>
    new THREE.MeshPhysicalMaterial({
      map,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.48,
      sheen: 1,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color('#ffd9f4'),
      emissive: new THREE.Color('#3a0f2e'),
      emissiveIntensity: 0.08,
    })
  shared = {
    sepal: mk(petalTexture(false)),
    petal: mk(petalTexture(true)),
    lip: new THREE.MeshPhysicalMaterial({
      map: lipTexture(),
      side: THREE.DoubleSide,
      roughness: 0.4,
      sheen: 1,
      sheenColor: new THREE.Color('#ff9fd0'),
      emissive: new THREE.Color('#2a0618'),
      emissiveIntensity: 0.1,
    }),
    column: new THREE.MeshStandardMaterial({ color: '#f6eef0', roughness: 0.5 }),
    stem: new THREE.MeshStandardMaterial({ color: '#4f7a2e', roughness: 0.6 }),
  }
  return shared
}

const BUD = new THREE.Color('#bcd49a')
const WHITE = new THREE.Color('#ffffff')
const ease = (v, a, b) => THREE.MathUtils.smootherstep(v, a, b)

/**
 * Orquídea. `getOpen()` devuelve 0 (capullo) .. 1 (flor abierta). Se construye mirando a +z.
 */
export function Orchid({ getOpen, scale = 1, ...props }) {
  const M = useMemo(() => materials(), [])
  // cada flor tiene su propia copia de geometría (se deforma) y de material (cambia de color)
  const parts = useMemo(() => {
    const sepalMat = M.sepal.clone()
    const petalMat = M.petal.clone()
    return {
      sepalMat,
      petalMat,
      sepals: [0, 2.2, -2.2].map((a) => ({ a, g: petalMesh(1.25, 0.34) })),
      petals: [1.05, -1.05].map((a) => ({ a, g: petalMesh(1.15, 0.78) })),
      lip: lipGeometry(),
    }
  }, [M])
  const refs = useRef({ sep: [], pet: [] })
  const lip = useRef()
  const last = useRef(-1)

  useFrame(({ clock }) => {
    const o = Math.min(1, Math.max(0, getOpen()))
    const breathe = Math.sin(clock.elapsedTime * 0.7) * 0.015
    const changed = Math.abs(o - last.current) > 0.002
    const s1 = ease(o, 0, 0.55) // sépalos
    const s2 = ease(o, 0.15, 0.8) // pétalos
    const s3 = ease(o, 0.35, 1) // labelo
    parts.sepals.forEach((sp, i) => {
      const m = refs.current.sep[i]
      if (!m) return
      m.rotation.x = (1 - s1) * 1.45 + 0.1 + breathe
      if (changed) shapePetal(sp.g, (1 - s1) * 0.9 + 0.08, 0.25, s1 * 0.35, s1)
    })
    parts.petals.forEach((pt, i) => {
      const m = refs.current.pet[i]
      if (!m) return
      m.rotation.x = (1 - s2) * 1.55 + 0.05 - breathe
      if (changed) shapePetal(pt.g, (1 - s2) * 1.2 + 0.05, 0.35, s2 * 0.25, s2 * 1.3)
    })
    lip.current.scale.set(0.35 + s3 * 0.65, 0.35 + s3 * 0.65, 0.5 + s3 * 0.5)
    lip.current.rotation.x = -0.2 - (1 - s3) * 0.6
    // el capullo es verdoso; el color de la flor llega al abrirse
    parts.sepalMat.color.copy(BUD).lerp(WHITE, s1)
    parts.petalMat.color.copy(BUD).lerp(WHITE, s2)
    last.current = o
  })

  return (
    <group scale={scale} {...props}>
      {parts.sepals.map((sp, i) => (
        <group key={`s${i}`} rotation-z={sp.a}>
          <mesh ref={(el) => (refs.current.sep[i] = el)} geometry={sp.g} material={parts.sepalMat} castShadow />
        </group>
      ))}
      {parts.petals.map((pt, i) => (
        <group key={`p${i}`} rotation-z={pt.a} position-z={0.02}>
          <mesh ref={(el) => (refs.current.pet[i] = el)} geometry={pt.g} material={parts.petalMat} castShadow />
        </group>
      ))}
      <mesh ref={lip} geometry={parts.lip} material={M.lip} position={[0, -0.08, 0.06]} castShadow />
      <mesh material={M.column} position={[0, 0.02, 0.18]} rotation-x={Math.PI / 2 - 0.3}>
        <capsuleGeometry args={[0.045, 0.22, 4, 10]} />
      </mesh>
      {/* tallo que sostiene la flor */}
      <mesh material={M.stem} position={[0, -0.6, -0.35]} rotation-x={0.35}>
        <cylinderGeometry args={[0.018, 0.028, 1.1, 8]} />
      </mesh>
    </group>
  )
}
