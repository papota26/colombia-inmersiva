import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Rosa modelada pétalo a pétalo: 34 pétalos en espiral (ángulo áureo), con copa,
// bordes que se enrollan hacia afuera y textura aterciopelada. La floración ocurre en
// la GPU: capullo cerrado → pétalos exteriores que se abren primero → centro abierto.

const DETAIL = { lo: [34, 10, 16], hi: [52, 16, 26] }
const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const STEM = 1.0 // altura del tallo (la rosa mide ~1.25 de alto)

function petalGeometry([PETALS, sx, sy]) {
  const parts = []
  for (let i = 0; i < PETALS; i++) {
    const L = i / (PETALS - 1) // 0 centro … 1 exterior
    const g = new THREE.PlaneGeometry(1, 1, sx, sy)
    const n = g.attributes.position.count
    const info = new Float32Array(n * 4)
    for (let k = 0; k < n; k++) info.set([i * GOLDEN, L, 0.15 + Math.pow(L, 0.8) * 0.2, 0.15 + L * 0.2], k * 4)
    g.setAttribute('aPetal', new THREE.BufferAttribute(info, 4))
    // color base del pétalo: corazón claro y amarillento, borde algo más oscuro
    const uv = g.attributes.uv
    const col = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) {
      const t = uv.getY(k)
      const u = Math.abs(uv.getX(k) * 2 - 1)
      const base = 1 - THREE.MathUtils.smoothstep(t, 0, 0.22)
      const edge = THREE.MathUtils.smoothstep(t, 0.75, 1) * 0.18 + u * u * 0.08
      col.set([1 - edge * 0.6, 1 - edge + base * 0.15 - (1 - L) * 0.06, 1 - edge - base * 0.25], k * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    parts.push(g)
  }
  return parts
}

/** Tallo, sépalos y hojas (no se deforman ni se tiñen con el color de la rosa). */
function greenGeometry() {
  const parts = []
  const flag = (g, c) => {
    const n = g.attributes.position.count
    g.setAttribute('aPetal', new THREE.BufferAttribute(new Float32Array(n * 4), 4))
    const col = new Float32Array(n * 3)
    const cc = new THREE.Color(c)
    for (let k = 0; k < n; k++) col.set([cc.r, cc.g, cc.b], k * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    return g.index ? g.toNonIndexed() : g
  }
  // tallo levemente curvo
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.03, STEM * 0.4, 0.02),
    new THREE.Vector3(-0.02, STEM * 0.75, -0.01),
    new THREE.Vector3(0, STEM, 0),
  ])
  parts.push(flag(new THREE.TubeGeometry(curve, 16, 0.014, 6), '#2f6b25'))
  // receptáculo y sépalos
  const rec = new THREE.SphereGeometry(0.045, 10, 8)
  rec.scale(1, 0.8, 1).translate(0, STEM, 0)
  parts.push(flag(rec, '#3d7a2b'))
  for (let i = 0; i < 5; i++) {
    const s = new THREE.ConeGeometry(0.02, 0.16, 4)
    s.translate(0, 0.08, 0)
    s.rotateZ(1.9)
    s.rotateY((i / 5) * Math.PI * 2)
    s.translate(0, STEM, 0)
    parts.push(flag(s, '#356f27'))
  }
  // hojas aserradas
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.PlaneGeometry(0.11, 0.24, 6, 10)
    const p = leaf.attributes.position
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) + 0.12
      const t = y / 0.24
      const w = Math.sin(Math.min(1, t * 1.05) * Math.PI) * (1 + Math.sin(t * 40) * 0.08)
      p.setXYZ(k, p.getX(k) * w, y, -Math.abs(p.getX(k)) * 0.5 + t * t * 0.06)
    }
    leaf.computeVertexNormals()
    leaf.rotateX(-0.9)
    leaf.rotateY(i * 2.3)
    leaf.translate(0, STEM * (0.35 + i * 0.18), 0)
    parts.push(flag(leaf, i % 2 ? '#2e6a24' : '#3b7d2c'))
  }
  return parts
}

const geoCache = {}
function roseGeometry(detail = 'lo') {
  if (geoCache[detail]) return geoCache[detail].clone()
  const petals = petalGeometry(DETAIL[detail]).map((g) => g.toNonIndexed())
  const g = mergeGeometries([...petals, ...greenGeometry()])
  g.setAttribute('aUV', g.attributes.uv.clone())
  g.computeBoundingSphere()
  g.boundingSphere.radius = 1.4
  geoCache[detail] = g
  return g.clone()
}

/** Textura de terciopelo con venas finas para los pétalos. */
function velvetTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')
  x.fillStyle = '#ffffff'
  x.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 70; i++) {
    const u = Math.random() * 256
    x.strokeStyle = `rgba(90,0,20,${0.05 + Math.random() * 0.08})`
    x.lineWidth = 0.6 + Math.random() * 1.2
    x.beginPath()
    x.moveTo(128 + (u - 128) * 0.2, 256)
    x.quadraticCurveTo(u, 128, u + (u - 128) * 0.3, 0)
    x.stroke()
  }
  for (let i = 0; i < 4000; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '60,0,10'},${Math.random() * 0.05})`
    x.fillRect(Math.random() * 256, Math.random() * 256, 1, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function roseMaterial() {
  const uOpen = { value: 0 }
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    map: velvetTexture(),
    roughness: 0.55,
    sheen: 1,
    sheenRoughness: 0.3,
    sheenColor: new THREE.Color('#ffc7d8'),
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOpen = uOpen
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aPetal;
        attribute vec2 aUV;
        uniform float uOpen;
        #ifdef USE_INSTANCING
          attribute float aOffset;
        #endif
        vec3 roseN; vec3 roseP; float roseIs;
        void roseBuild(vec2 uvv) {
          roseIs = step(0.001, aPetal.z);
          float op = uOpen;
          #ifdef USE_INSTANCING
            op = clamp(op + aOffset, 0.0, 1.0);
          #endif
          float phi = aPetal.x; float L = aPetal.y;
          float start = (1.0 - L) * 0.55;
          float o = smoothstep(start, start + 0.45, op);
          float theta = mix(0.04 + L * 0.16, 0.1 + pow(L, 1.7) * 0.82, o);
          float cup = mix(3.4, 2.5 + (1.0 - L) * 1.6, o);
          float u = uvv.x * 2.0 - 1.0; float t = uvv.y;
          // borde superior redondeado (el pétalo de rosa es ancho y romo arriba)
          t *= 1.0 - 0.22 * u * u * smoothstep(0.45, 1.0, t);
          float len = aPetal.z * mix(0.82, 1.0, o);
          float wid = aPetal.w * mix(0.7, 1.0, o);
          float prof = sqrt(max(1.0 - pow(abs(t - 0.66) / 0.66, 2.4), 0.0)) * mix(0.45, 1.0, smoothstep(0.0, 0.4, t)) + 0.05;
          float a = u * cup * 0.5;
          float xs = sin(a) / (cup * 0.5) * wid * 0.5 * prof;
          float zs = (1.0 - cos(a)) / (cup * 0.5) * wid * 0.5 * prof;
          // bordes que se enrollan hacia afuera en los pétalos exteriores abiertos
          zs -= o * L * 0.35 * wid * smoothstep(0.55, 1.0, abs(u)) * smoothstep(0.4, 1.0, t);
          float curl = o * L * L * 1.4;
          float r = len * (sin(theta) * t + curl * t * t * 0.45);
          float y = len * (cos(theta) * t - curl * t * t * 0.3);
          vec3 R = vec3(cos(phi), 0.0, sin(phi));
          vec3 T = vec3(-sin(phi), 0.0, cos(phi));
          vec3 Y = vec3(0.0, 1.0, 0.0);
          vec3 N = -R * cos(theta) + Y * sin(theta);
          float rb = mix(0.004, 0.035, L) * mix(0.6, 1.0, o);
          roseP = R * (rb + r) + Y * (${STEM.toFixed(2)} + 0.02 + y + L * 0.015) + T * xs + N * zs;
          roseN = normalize(-T * sin(a) + N * cos(a));
        }`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        roseBuild(aUV);
        if (roseIs > 0.5) objectNormal = roseN;`,
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n        if (roseIs > 0.5) transformed = roseP;`)
      .replace(
        '#include <color_vertex>',
        `vColor = vec4( 1.0 );
        #ifdef USE_COLOR
          vColor.rgb *= color;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, step(0.001, aPetal.z)); // solo los pétalos toman el color
        #endif`,
      )
    // la textura de terciopelo solo en los pétalos
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vRose;\nvoid main() {').replace(
      '#include <fog_vertex>',
      '#include <fog_vertex>\n  vRose = roseIs;',
    )
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRose;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb / max(sampledDiffuseColor.rgb, vec3(0.001)), diffuseColor.rgb, vRose);')
  }
  m.customProgramCacheKey = () => 'rose-v2'
  m.userData.uOpen = uOpen
  return m
}

// Variedades de rosa colombiana (Colombia es uno de los mayores exportadores de flores del mundo)
export const ROSE_COLORS = ['#d10f2f', '#ff3d8b', '#ffb000', '#ff6a1a', '#fff1ec', '#c4005e', '#e8203a']

/**
 * Grupo de rosas instanciadas. items: { x, y, z, s, rot, tilt, color, offset }
 * `offset` adelanta o atrasa la floración de cada rosa (así no se abren todas a la vez).
 */
export function RoseField({ items, getOpen, detail = 'lo' }) {
  const geometry = useMemo(() => roseGeometry(detail), [detail])
  const mat = useMemo(() => roseMaterial(), [])
  const ref = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const c = new THREE.Color()
    const offs = new Float32Array(items.length)
    items.forEach((it, i) => {
      q.setFromEuler(e.set(it.tilt || 0, it.rot || 0, it.rz ?? (it.tilt || 0) * 0.6))
      s.setScalar(it.s)
      p.set(it.x, it.y, it.z)
      ref.current.setMatrixAt(i, m.compose(p, q, s))
      ref.current.setColorAt(i, c.set(it.color || ROSE_COLORS[i % ROSE_COLORS.length]))
      offs[i] = it.offset || 0
    })
    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offs, 1))
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items, geometry, mat])
  useFrame(({ clock }) => {
    mat.userData.uOpen.value = getOpen(clock.elapsedTime)
  })
  return <instancedMesh ref={ref} args={[geometry, mat, items.length]} castShadow receiveShadow frustumCulled={false} />
}

/** Rosa protagonista (una sola instancia, más grande). */
export function Rose({ getOpen, position, rotation = [0, 0, 0], scale = 1, color = '#d10f2f', detail = 'hi' }) {
  const items = useMemo(
    () => [{ x: position[0], y: position[1], z: position[2], s: scale, rot: rotation[1], tilt: rotation[0], rz: rotation[2], color, offset: 0 }],
    [position, rotation, scale, color],
  )
  return <RoseField items={items} getOpen={getOpen} detail={detail} />
}
