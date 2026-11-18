import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import geo from '../../data/col.geo.json'
import { CENTERS } from '../path'
import { noise3, personParts } from '../flora'
import { local, range, isMobile } from '../../state'
import { pbr } from '../assets'

const C = CENTERS.c5
const K = 4.2 // unidades por grado
const LON0 = -72.95
const LAT0 = 4.15
const ring = geo.features[0].geometry.coordinates[0]

const toX = (lon) => (lon - LON0) * K
const toY = (lat) => (lat - LAT0) * K // en el plano del Shape; se convierte en -z al rotar

// Cordilleras y sistemas montañosos aproximados (lon, lat).
const RANGES = [
  { amp: 2.6, w: 0.45, pts: [[-77.9, 0.9], [-77.0, 2.6], [-76.4, 4.6], [-76.1, 6.4], [-76.3, 7.6]] }, // Occidental
  { amp: 3.6, w: 0.5, pts: [[-77.2, 1.2], [-76.4, 2.4], [-75.6, 4.0], [-75.4, 5.6], [-75.3, 7.2], [-74.8, 8.4]] }, // Central
  { amp: 3.2, w: 0.65, pts: [[-76.3, 1.8], [-75.2, 3.2], [-74.2, 4.6], [-73.2, 6.0], [-72.6, 7.2], [-72.9, 8.4], [-72.9, 9.8], [-72.6, 10.9]] }, // Oriental y Perijá
  { amp: 4.6, w: 0.32, pts: [[-73.9, 10.7], [-73.6, 10.9]] }, // Sierra Nevada de Santa Marta
  { amp: 1.0, w: 0.3, pts: [[-73.9, 2.3], [-73.8, 3.0]] }, // Serranía de La Macarena
  { amp: 0.8, w: 0.3, pts: [[-77.3, 5.6], [-77.5, 7.5]] }, // Serranía del Baudó
]

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Altura del relieve en (lon, lat). */
function relief(lon, lat) {
  let h = 0
  for (const r of RANGES) {
    let d = Infinity
    for (let i = 0; i < r.pts.length - 1; i++) d = Math.min(d, distSeg(lon, lat, ...r.pts[i], ...r.pts[i + 1]))
    if (r.pts.length === 2 && r.amp > 4) d = Math.hypot(lon - r.pts[0][0], lat - r.pts[0][1]) * 0.8
    h += r.amp * Math.exp(-((d / r.w) ** 2))
  }
  const ridged = 1 - Math.abs(noise3(lon * 1.6, 7, lat * 1.6))
  return h * (0.7 + ridged * 0.5) + noise3(lon * 3, 1, lat * 3) * 0.08 * (1 + h)
}

// Ríos principales (lon, lat), con ancho al nacer y al desembocar.
const RIVERS = [
  { w: [0.12, 0.42], pts: [[-76.4, 1.9], [-75.3, 2.9], [-74.8, 4.3], [-74.74, 5.2], [-74.4, 6.5], [-73.85, 7.07], [-73.97, 9.0], [-74.43, 9.24], [-74.8, 10.4], [-74.85, 11.05]] }, // Magdalena
  { w: [0.1, 0.3], pts: [[-76.6, 2.2], [-76.5, 3.45], [-75.9, 5.0], [-75.6, 6.6], [-75.0, 7.9], [-74.5, 8.9]] }, // Cauca
  { w: [0.08, 0.32], pts: [[-73.6, 4.1], [-72.4, 4.4], [-70.8, 5.4], [-69.8, 6.0], [-67.6, 6.2]] }, // Meta
  { w: [0.1, 0.3], pts: [[-76.6, 5.6], [-76.9, 7.0], [-77.0, 8.1]] }, // Atrato
  { w: [0.1, 0.38], pts: [[-76.3, 1.2], [-74.5, 0.4], [-72.6, -0.7], [-70.5, -1.4], [-69.6, -1.3]] }, // Caquetá
  { w: [0.08, 0.34], pts: [[-73.9, 2.6], [-72.5, 2.6], [-71.0, 3.0], [-69.5, 3.8], [-67.9, 4.0]] }, // Guaviare
  { w: [0.08, 0.3], pts: [[-76.9, 0.6], [-75.5, -0.2], [-74.0, -1.0], [-72.5, -2.2], [-70.0, -2.9]] }, // Putumayo
  { w: [0.3, 0.45], pts: [[-67.85, 6.2], [-67.6, 5.0], [-67.75, 4.0]] }, // Orinoco (frontera)
  { w: [0.07, 0.16], pts: [[-76.2, 7.3], [-75.9, 8.5], [-75.85, 9.3]] }, // Sinú
  { w: [0.06, 0.14], pts: [[-77.0, 1.6], [-77.6, 1.9], [-78.3, 2.4]] }, // Patía
  { w: [0.07, 0.2], pts: [[-72.5, 1.3], [-70.5, 1.0], [-69.4, 0.4]] }, // Vaupés
  { w: [0.07, 0.18], pts: [[-71.9, 7.0], [-70.7, 7.1], [-69.4, 6.9]] }, // Arauca
  { w: [0.3, 0.5], pts: [[-70.1, -4.1], [-69.95, -4.2]] }, // Amazonas
]

const CITIES = [
  ['Bogotá', -74.07, 4.71, 1.6],
  ['Medellín', -75.58, 6.24, 1.2],
  ['Cali', -76.53, 3.45, 1.1],
  ['Barranquilla', -74.8, 10.96, 1.0],
  ['Cartagena', -75.48, 10.39, 0.9],
  ['Bucaramanga', -73.12, 7.12, 0.8],
  ['Pasto', -77.28, 1.21, 0.7],
  ['Quibdó', -76.66, 5.69, 0.6],
  ['Leticia', -69.94, -4.2, 0.6],
  ['San Andrés', -81.7, 12.55, 0.5],
]

/** Recorte del país como textura alfa (bordes limpios sin triangular el interior). */
function maskTexture(bounds) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 1400
  const x = c.getContext('2d')
  x.fillStyle = '#000'
  x.fillRect(0, 0, c.width, c.height)
  x.fillStyle = '#fff'
  x.beginPath()
  ring.forEach(([lon, lat], i) => {
    const u = ((lon - bounds.lon0) / (bounds.lon1 - bounds.lon0)) * c.width
    const v = (1 - (lat - bounds.lat0) / (bounds.lat1 - bounds.lat0)) * c.height
    i ? x.lineTo(u, v) : x.moveTo(u, v)
  })
  x.closePath()
  x.fill()
  const t = new THREE.CanvasTexture(c)
  return t
}

function Land() {
  const bounds = { lon0: -79.3, lon1: -66.6, lat0: -4.6, lat1: 12.8 }
  const { surface, mask, slab } = useMemo(() => {
    const w = (bounds.lon1 - bounds.lon0) * K
    const h = (bounds.lat1 - bounds.lat0) * K
    const g = new THREE.PlaneGeometry(w, h, isMobile ? 160 : 260, isMobile ? 220 : 360)
    const p = g.attributes.position
    const col = new Float32Array(p.count * 3)
    const lowN = new THREE.Color('#8f9b58') // Caribe seco
    const low = new THREE.Color('#4a7a3a') // llanos
    const amazon = new THREE.Color('#2b5a2c')
    const mount = new THREE.Color('#6f7651')
    const paramo = new THREE.Color('#a49a6c')
    const snow = new THREE.Color('#f3f1ea')
    const c = new THREE.Color()
    const cx = ((bounds.lon0 + bounds.lon1) / 2 - LON0) * K
    const cy = ((bounds.lat0 + bounds.lat1) / 2 - LAT0) * K
    for (let i = 0; i < p.count; i++) {
      const lon = (p.getX(i) + cx) / K + LON0
      const lat = (p.getY(i) + cy) / K + LAT0
      const r = relief(lon, lat)
      p.setZ(i, Math.max(0, r) + 0.12)
      c.copy(low).lerp(amazon, THREE.MathUtils.smoothstep(lat, 2.5, -1)).lerp(lowN, THREE.MathUtils.smoothstep(lat, 8.5, 10.5) * (lon > -76 ? 1 : 0.3))
      c.lerp(mount, THREE.MathUtils.smoothstep(r, 0.6, 1.8)).lerp(paramo, THREE.MathUtils.smoothstep(r, 2.6, 3.6)).lerp(snow, THREE.MathUtils.smoothstep(r, 4.2, 4.9))
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    g.rotateX(-Math.PI / 2)
    g.translate(cx, 0, -cy)

    // Losa con el contorno del país para dar grosor (estratos de tierra).
    const shape = new THREE.Shape(ring.map(([lon, lat]) => new THREE.Vector2(toX(lon), toY(lat))))
    const sg = new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false })
    sg.rotateX(-Math.PI / 2)
    sg.translate(0, -2.25, 0)
    return { surface: g, mask: maskTexture(bounds), slab: sg }
  }, [])
  return (
    <group>
      <mesh geometry={surface} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} alphaMap={mask} alphaTest={0.5} side={THREE.DoubleSide} normalMap={pbr('rock_face', 18, { color: false }).normalMap} normalScale={[0.8, 0.8]} />
      </mesh>
      <mesh geometry={slab} receiveShadow position-y={0.02}>
        <meshStandardMaterial color="#7a4a2e" roughness={1} />
      </mesh>
    </group>
  )
}

/** Cinta de río sobre el relieve: serpentea, se ensancha río abajo y se apoya en el terreno. */
function riverRibbon({ w, pts }, widthScale = 1, lift = 0.05, seed = 0) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([lon, lat]) => new THREE.Vector3(toX(lon), 0, -toY(lat))))
  const n = Math.max(40, pts.length * 40)
  const pos = []
  const uv = []
  const idx = []
  const p = new THREE.Vector3()
  const tg = new THREE.Vector3()
  for (let i = 0; i <= n; i++) {
    const t = i / n
    curve.getPointAt(t, p)
    curve.getTangentAt(t, tg)
    const side = new THREE.Vector3(-tg.z, 0, tg.x).normalize()
    // meandros: desplazamiento lateral suave
    const m = noise3(t * 18 + seed, seed, 0) * 0.35 + Math.sin(t * 60 + seed) * 0.06
    p.addScaledVector(side, m)
    const width = THREE.MathUtils.lerp(w[0], w[1], Math.pow(t, 0.8)) * widthScale * (1 + noise3(t * 30, seed, 4) * 0.25)
    for (const sgn of [-1, 1]) {
      const q = p.clone().addScaledVector(side, (sgn * width) / 2)
      const lon = q.x / K + LON0
      const lat = -q.z / K + LAT0
      q.y = Math.max(0, relief(lon, lat)) + 0.12 + lift
      pos.push(q.x, q.y, q.z)
      uv.push(sgn < 0 ? 0 : 1, t * 40)
    }
    if (i < n) {
      const a = i * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Normal de ondas para el agua (ruido suave pintado en un canvas). */
function waterNormal() {
  const N = 128
  const c = document.createElement('canvas')
  c.width = c.height = N
  const x = c.getContext('2d')
  const img = x.createImageData(N, N)
  const h = (i, j) => noise3(i * 0.09, j * 0.09, 2) * 0.6 + noise3(i * 0.23, j * 0.23, 5) * 0.4
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dx = h(i + 1, j) - h(i - 1, j)
      const dy = h(i, j + 1) - h(i, j - 1)
      const v = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize()
      const k = (j * N + i) * 4
      img.data[k] = (v.x * 0.5 + 0.5) * 255
      img.data[k + 1] = (v.y * 0.5 + 0.5) * 255
      img.data[k + 2] = (v.z * 0.5 + 0.5) * 255
      img.data[k + 3] = 255
    }
  x.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function Rivers() {
  const { water, banks } = useMemo(
    () => ({
      water: RIVERS.map((r, i) => riverRibbon(r, 1.7, 0.05, i * 3.1)),
      banks: RIVERS.map((r, i) => riverRibbon(r, 3.0, 0.0, i * 3.1)),
    }),
    [],
  )
  const normal = useMemo(() => waterNormal(), [])
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#124f6e',
        roughness: 0.06,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        normalMap: normal,
        normalScale: new THREE.Vector2(0.6, 0.6),
        envMapIntensity: 1.6,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [normal],
  )
  const bankMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#3a4a26', roughness: 0.95, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -1, side: THREE.DoubleSide }),
    [],
  )
  const ref = useRef()
  useFrame((_, dt) => {
    // el agua corre: la textura de ondas se desplaza
    normal.offset.y -= dt * 0.25
    // los ríos se trazan cuando la cámara desciende sobre el mapa
    const d = range(local('c5'), 0.0, 0.25)
    ref.current.children.forEach((m) => m.geometry.setDrawRange(0, Math.floor(m.geometry.index.count * d / 6) * 6))
  })
  return (
    <group ref={ref}>
      {banks.map((g, i) => (
        <mesh key={`b${i}`} geometry={g} material={bankMat} receiveShadow />
      ))}
      {water.map((g, i) => (
        <mesh key={`w${i}`} geometry={g} material={mat} />
      ))}
    </group>
  )
}

function Cities() {
  const ref = useRef()
  const labels = useRef([])
  const body = useRef()
  const head = useRef()
  const parts = useMemo(() => personParts(), [])
  const people = useMemo(() => {
    const out = []
    CITIES.forEach(([, lon, lat, size], ci) => {
      const n = Math.round(size * 8)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ci
        const d = 0.7 + (i % 3) * 0.35
        const x = toX(lon) + Math.cos(a) * d
        const z = -toY(lat) + Math.sin(a) * d
        out.push({ x, z, y: relief(lon, lat), ci, cloth: ['#b4532f', '#14365f', '#d4a12a', '#0e7c61', '#f2ecdd'][i % 5] })
      }
    })
    return out
  }, [])
  useLayoutEffect(() => {
    const c = new THREE.Color()
    people.forEach((p, i) => {
      body.current.setColorAt(i, c.set(p.cloth))
      head.current.setColorAt(i, c.set('#8a5a3c'))
    })
    body.current.instanceColor.needsUpdate = true
    head.current.instanceColor.needsUpdate = true
  }, [people])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3() }), [])
  useFrame(({ clock }) => {
    const l = local('c5')
    const g = range(l, 0.12, 0.3)
    ref.current.children.forEach((c, i) => c.scale.setScalar(Math.max(0.001, g) * (1 + Math.sin(clock.elapsedTime * 2 + i) * 0.08)))
    labels.current.forEach((el) => el && (el.style.opacity = String(g)))
    people.forEach((p, i) => {
      const gi = range(l, 0.3 + (p.ci / CITIES.length) * 0.25, 0.4 + (p.ci / CITIES.length) * 0.25)
      tmp.p.set(p.x, p.y, p.z)
      tmp.s.setScalar(Math.max(0.0001, gi) * 0.85)
      tmp.m.compose(tmp.p, tmp.q, tmp.s)
      body.current.setMatrixAt(i, tmp.m)
      head.current.setMatrixAt(i, tmp.m)
    })
    body.current.instanceMatrix.needsUpdate = true
    head.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <group ref={ref}>
        {CITIES.map(([name, lon, lat, size], i) => (
          <group key={name} position={[toX(lon), relief(lon, lat) + 0.2, -toY(lat)]}>
            <mesh>
              <sphereGeometry args={[0.18 + size * 0.14, 16, 12]} />
              <meshStandardMaterial color="#f0c24a" emissive="#d4a12a" emissiveIntensity={1.6} toneMapped={false} />
            </mesh>
            <mesh position={[0, 1.6, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 3.2, 6]} />
              <meshBasicMaterial color="#f6dc8c" transparent opacity={0.6} />
            </mesh>
          </group>
        ))}
      </group>
      {!isMobile &&
        CITIES.slice(0, 9).map(([name, lon, lat], i) => (
          <Html key={name} position={[toX(lon), relief(lon, lat) + 3.6, -toY(lat)]} center zIndexRange={[5, 0]} pointerEvents="none">
            <span className="city-label" ref={(el) => (labels.current[i] = el)}>
              {name}
            </span>
          </Html>
        ))}
      <instancedMesh ref={body} args={[parts.body, undefined, people.length]}>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={head} args={[parts.head, undefined, people.length]}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
    </group>
  )
}

export function ColombiaMap() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const l = local('c5')
    ref.current.position.y = -6 * (1 - range(l, -0.6, 0)) + Math.sin(clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group position={[C.x, 0, C.z]}>
      <group ref={ref}>
        <Land />
        <Rivers />
        <Cities />
      </group>
      {/* mar de nubes bajo el mapa */}
      <mesh rotation-x={-Math.PI / 2} position-y={-3}>
        <circleGeometry args={[260, 48]} />
        <meshStandardMaterial color="#b7c9d6" roughness={1} />
      </mesh>
    </group>
  )
}
