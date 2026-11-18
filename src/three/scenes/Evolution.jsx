import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CENTERS } from '../path'
import { heightAt } from '../World'
import { rng, noise3 } from '../flora'
import { local, range } from '../../state'
import { pbr } from '../assets'

// la textura escaneada es gris medio: se aclara para lograr la cal blanca colonial
const plaster = () => ({ ...pbr('white_plaster_rough_01', 1), color: new THREE.Color(2.4, 2.35, 2.2), emissive: new THREE.Color('#5a5246'), emissiveIntensity: 0.35 })
// fachadas de pueblo colombiano: cal blanca y colores intensos (Guatapé, Cartagena, Barichara)
const FACADES = ['#ffffff', '#ffd23f', '#1e88e5', '#e53935', '#43a047', '#fb8c00', '#00acc1', '#d81b60', '#ffffff', '#fdd835', '#8e24aa']
const tiles = () => ({ ...pbr('clay_roof_tiles', 1.4) })

const C = CENTERS.c2

/** Montañas andinas que se hunden en la tierra para dar paso a la ciudad. */
function Mountains() {
  const ref = useRef()
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(60, 60, 120, 120)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position
    const col = new Float32Array(p.count * 3)
    const low = new THREE.Color('#3f6330')
    const mid = new THREE.Color('#6d7445')
    const high = new THREE.Color('#9a927a')
    const c = new THREE.Color()
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const d = Math.hypot(x, z) / 30
      const ridge = 1 - Math.abs(noise3(x * 0.07, 2, z * 0.07))
      let h = Math.max(0, 1 - d) ** 1.6 * (8 + ridge ** 3 * 9) + noise3(x * 0.2, 4, z * 0.2) * 0.8
      h = Math.max(0, h)
      p.setY(i, h)
      c.copy(low).lerp(mid, THREE.MathUtils.smoothstep(h, 4, 12)).lerp(high, THREE.MathUtils.smoothstep(h, 9, 15))
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [])
  useFrame(() => {
    const l = local('c2')
    const s = 1 - range(l, 0.12, 0.42) * 0.985
    ref.current.scale.y = s
    ref.current.visible = s > 0.02
  })
  return (
    <mesh ref={ref} geometry={geo} position={[C.x, heightAt(C.x, C.z) - 0.3, C.z - 4]} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} {...pbr('rock_face', 6, { color: false })} />
    </mesh>
  )
}

/** Ciudad colonial: casas blancas con tejado de barro alrededor de una plaza e iglesia. */
function ColonialTown() {
  const walls = useRef()
  const roofs = useRef()
  const church = useRef()
  const houses = useMemo(() => {
    const r = rng(5)
    const out = []
    // manzanas en damero, como las fundaciones españolas
    for (let gx = -4; gx <= 4; gx++) {
      for (let gz = -4; gz <= 3; gz++) {
        if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue // plaza mayor
        const bx = gx * 5.2
        const bz = gz * 5.2
        for (let k = 0; k < 4; k++) {
          const ox = (k % 2 ? 1 : -1) * 1.15
          const oz = (k < 2 ? 1 : -1) * 1.15
          const x = bx + ox + (r() - 0.5) * 0.3
          const z = bz + oz + (r() - 0.5) * 0.3
          const d = Math.hypot(x, z)
          if (d > 23 || r() < 0.12) continue
          if (x > 6 && x < 22 && z < 7 && z > -17) continue // solar de la institución
          if (x > -6.5 && x < -0.5 && z > -12 && z < -3.5) continue // iglesia
          out.push({ x, z, w: 1.9 + r() * 0.5, h: 1.3 + r() * 0.9 + (r() < 0.12 ? 1.1 : 0), dep: 1.9 + r() * 0.4, d, tone: 0.9 + r() * 0.12, rot: r() < 0.5 ? 0 : Math.PI / 2 })
        }
      }
    }
    return out
  }, [])
  const roofGeo = useMemo(() => {
    // tejado a dos aguas (prisma triangular)
    const s = new THREE.Shape()
    s.moveTo(-0.58, 0)
    s.lineTo(0.58, 0)
    s.lineTo(0, 0.42)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.08, bevelEnabled: false })
    g.translate(0, 0, -0.54)
    return g
  }, [])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), e: new THREE.Euler() }), [])
  const base = heightAt(C.x, C.z) - 0.05

  useLayoutEffect(() => {
    const col = new THREE.Color()
    houses.forEach((h, i) => {
      col.set(FACADES[i % FACADES.length]).multiplyScalar(0.62 * h.tone)
      walls.current.setColorAt(i, col)
      col.setRGB(1, 0.97, 0.94).multiplyScalar(0.85 + (h.tone - 0.9) * 2.2)
      roofs.current.setColorAt(i, col)
    })
    walls.current.instanceColor.needsUpdate = true
    roofs.current.instanceColor.needsUpdate = true
  }, [houses])

  useFrame(() => {
    const l = local('c2')
    houses.forEach((h, i) => {
      // la ciudad se expande desde la plaza hacia afuera
      const g = range(l, 0.3 + (h.d / 23) * 0.18, 0.4 + (h.d / 23) * 0.2)
      const y = Math.max(0.001, g)
      tmp.q.setFromEuler(tmp.e.set(0, h.rot, 0))
      tmp.p.set(C.x + h.x, base + (h.h * y) / 2, C.z + h.z)
      const vis = g > 0.02 ? 1 : 0.0001
      tmp.s.set(h.w * vis, h.h * y, h.dep * vis)
      walls.current.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s))
      tmp.p.set(C.x + h.x, base + h.h * y, C.z + h.z)
      tmp.s.set(h.w * 1.08 * vis, y, h.dep * 1.08 * vis)
      roofs.current.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s))
    })
    walls.current.instanceMatrix.needsUpdate = true
    roofs.current.instanceMatrix.needsUpdate = true
    const cg = range(l, 0.28, 0.4)
    church.current.scale.set(1, Math.max(0.001, cg), 1)
  })

  return (
    <group>
      <instancedMesh ref={walls} args={[undefined, undefined, houses.length]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial {...plaster()} />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[roofGeo, undefined, houses.length]} castShadow>
        <meshStandardMaterial {...tiles()} />
      </instancedMesh>
      {/* plaza empedrada */}
      <mesh rotation-x={-Math.PI / 2} position={[C.x, base + 0.03, C.z]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial {...pbr('cobblestone_floor_01', 4)} />
      </mesh>
      {/* iglesia colonial en el costado norte de la plaza */}
      <group ref={church} position={[C.x - 3.5, base, C.z - 7.4]}>
        <mesh position={[0, 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 4, 6]} />
          <meshStandardMaterial {...plaster()} />
        </mesh>
        <mesh position={[0, 4.6, 0]} rotation-y={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0, 2.9, 1.3, 4, 1]} />
          <meshStandardMaterial {...tiles()} />
        </mesh>
        {[-1.4, 1.4].map((x) => (
          <group key={x} position={[x, 0, 3.2]}>
            <mesh position={[0, 3.6, 0]} castShadow>
              <boxGeometry args={[1.2, 7.2, 1.2]} />
              <meshStandardMaterial {...plaster()} />
            </mesh>
            <mesh position={[0, 7.7, 0]} castShadow>
              <sphereGeometry args={[0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#c9b98f" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/** Estructura institucional contemporánea: piedra, vidrio y una cubierta horizontal. */
function Institution() {
  const ref = useRef()
  const base = heightAt(C.x, C.z)
  useFrame(() => {
    const l = local('c2')
    const g = range(l, 0.6, 0.88)
    ref.current.scale.set(1, Math.max(0.001, g), 1)
    ref.current.visible = g > 0.002
  })
  return (
    <group ref={ref} position={[C.x + 14, base, C.z - 5]} rotation-y={-Math.PI / 2}>
      <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[18, 6.4, 7]} />
        <meshStandardMaterial {...pbr('concrete_wall_008', 2)} />
      </mesh>
      {/* fachada de vidrio con parteluces */}
      <mesh position={[0, 3.4, 3.52]}>
        <boxGeometry args={[16, 5, 0.05]} />
        <meshStandardMaterial color="#29455e" metalness={0.6} roughness={0.12} envMapIntensity={1.4} />
      </mesh>
      {Array.from({ length: 17 }, (_, i) => (
        <mesh key={i} position={[-8 + i, 3.4, 3.6]} castShadow>
          <boxGeometry args={[0.12, 5, 0.18]} />
          <meshStandardMaterial {...pbr('concrete_wall_008', 0.5)} color="#f0ebe0" />
        </mesh>
      ))}
      <mesh position={[0, 6.7, 0.8]} castShadow>
        <boxGeometry args={[21, 0.5, 10]} />
        <meshStandardMaterial {...pbr('concrete_wall_008', 3)} color="#f3eee2" />
      </mesh>
      <mesh position={[7.5, 7.5, -1]} castShadow>
        <boxGeometry args={[3, 15, 3]} />
        <meshStandardMaterial {...pbr('concrete_wall_008', 1.5)} />
      </mesh>
    </group>
  )
}

export function Evolution() {
  return (
    <group>
      <ColonialTown />
      <Institution />
    </group>
  )
}
