import * as THREE from 'three'
import { useMemo } from 'react'
import { noise3 } from '../flora'
import { pbr } from '../assets'
import { isMobile } from '../../state'

// Cerro inspirado en Monserrate (Bogotá): pico empinado y boscoso con el santuario blanco
// en la cima, el cerro de Guadalupe al lado y la línea del teleférico.
export const MONSERRATE = new THREE.Vector3(62, 0, -200)
const PEAK = 74

function ridgeHeight(x, z) {
  // pico principal (Monserrate) y otro algo más bajo al sur (Guadalupe)
  const r1 = Math.hypot(x, z)
  const r2 = Math.hypot(x + 6, z - 26)
  let h = PEAK * Math.exp(-Math.pow(r1 / 23, 1.3)) + 58 * Math.exp(-Math.pow(r2 / 20, 1.4))
  // cordón que los une y estribaciones
  h += 18 * Math.exp(-Math.pow(Math.abs(x + 3) / 10, 2)) * Math.exp(-Math.pow((z - 12) / 30, 2))
  const n = noise3(x * 0.06, 3, z * 0.06)
  const ridged = 1 - Math.abs(noise3(x * 0.11, 8, z * 0.11))
  h += (n * 3 + ridged * ridged * 4) * Math.min(1, h / 20)
  // la cumbre se aplana un poco donde está el santuario
  const top = Math.exp(-Math.pow(r1 / 3.2, 2))
  return h * (1 - top * 0.04) + noise3(x * 0.5, 1, z * 0.5) * 0.35
}

function Mountain() {
  const geo = useMemo(() => {
    const size = 110
    const seg = isMobile ? 120 : 200
    const g = new THREE.PlaneGeometry(size, size, seg, seg)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const edge = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), size / 2 - 14, size / 2)
      p.setY(i, ridgeHeight(x, z) * edge - 1)
      uv.setXY(i, x / 26, z / 26)
    }
    g.computeVertexNormals()
    const n = g.attributes.normal
    const col = new Float32Array(p.count * 3)
    const forest = new THREE.Color('#1b4420')
    const forest2 = new THREE.Color('#2a6227')
    const paramo = new THREE.Color('#7c8a3c')
    const rock = new THREE.Color('#6e6a5e')
    const c = new THREE.Color()
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const h = p.getY(i)
      const slope = 1 - n.getY(i)
      c.copy(forest).lerp(forest2, noise3(x * 0.15, 5, z * 0.15) * 0.5 + 0.5)
      c.lerp(paramo, THREE.MathUtils.smoothstep(h, 52, 70) * 0.6)
      c.lerp(rock, THREE.MathUtils.smoothstep(slope, 0.72, 0.9) * 0.7)
      // copas de árboles: variación fina de luz
      const k = 2.2 + noise3(x * 1.2, 2, z * 1.2) * 0.4
      col.set([c.r * k + 0.25, c.g * k + 0.25, c.b * k + 0.2], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  // foto aérea de pasto y roca (Poly Haven) teñida por altura: bosque abajo, páramo arriba
  const tex = useMemo(() => pbr('aerial_grass_rock', 1), [])
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial vertexColors {...tex} normalScale={[1.6, 1.6]} />
    </mesh>
  )
}

const white = new THREE.MeshStandardMaterial({ color: '#fbf8f1', roughness: 0.7 })
const tile = new THREE.MeshStandardMaterial({ color: '#b5502d', roughness: 0.8 })
const dark = new THREE.MeshStandardMaterial({ color: '#3a3430', roughness: 0.6 })

/** Santuario de la cima: nave blanca con fachada de espadaña, tejado de barro y anexos. */
function Sanctuary() {
  const h = ridgeHeight(0, 0) - 1
  return (
    <group position={[0, h - 0.3, 0]} rotation-y={0.9} scale={1.7}>
      <mesh position={[0, 1.1, 0]} material={white} castShadow receiveShadow>
        <boxGeometry args={[2.2, 2.2, 5]} />
      </mesh>
      <mesh position={[0, 2.45, 0]} rotation-y={Math.PI / 2} material={tile} castShadow>
        <cylinderGeometry args={[0, 1.7, 0.7, 4, 1]} />
      </mesh>
      {/* fachada con espadaña y campanario */}
      <mesh position={[0, 1.9, 2.55]} material={white} castShadow>
        <boxGeometry args={[2.6, 3.8, 0.4]} />
      </mesh>
      <mesh position={[0, 4.1, 2.55]} material={white} castShadow>
        <boxGeometry args={[1.2, 0.9, 0.3]} />
      </mesh>
      <mesh position={[0, 4.75, 2.55]} material={white}>
        <coneGeometry args={[0.3, 0.6, 4]} />
      </mesh>
      <mesh position={[0, 1.0, 2.76]} material={dark}>
        <boxGeometry args={[0.7, 1.3, 0.05]} />
      </mesh>
      {/* anexos y terraza */}
      <mesh position={[-2.4, 0.7, -0.6]} material={white} castShadow>
        <boxGeometry args={[2, 1.4, 3]} />
      </mesh>
      <mesh position={[-2.4, 1.55, -0.6]} rotation-y={Math.PI / 2} material={tile}>
        <cylinderGeometry args={[0, 1.4, 0.5, 4, 1]} />
      </mesh>
      <mesh position={[1.9, 0.5, -1.6]} material={white} castShadow>
        <boxGeometry args={[1.4, 1, 1.8]} />
      </mesh>
    </group>
  )
}

/** Teleférico: cable desde la base hasta la cima con una cabina roja. */
function Cable() {
  const top = new THREE.Vector3(-2.5, ridgeHeight(-2.5, 3) + 0.6, 3)
  const base = new THREE.Vector3(-24, ridgeHeight(-24, 8) + 1, 8)
  const mid = base.clone().lerp(top, 0.5)
  const len = base.distanceTo(top)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(base).normalize())
  const cabin = base.clone().lerp(top, 0.62)
  return (
    <group>
      <mesh position={mid} quaternion={q}>
        <cylinderGeometry args={[0.035, 0.035, len, 4]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[cabin.x, cabin.y - 0.6, cabin.z]} castShadow>
        <boxGeometry args={[0.9, 0.9, 1.3]} />
        <meshStandardMaterial color="#c3262a" roughness={0.5} />
      </mesh>
    </group>
  )
}

export function Monserrate() {
  return (
    <group position={MONSERRATE}>
      <Mountain />
      <Sanctuary />
      <Cable />
    </group>
  )
}
