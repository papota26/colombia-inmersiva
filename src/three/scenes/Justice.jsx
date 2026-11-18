import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CENTERS } from '../path'
import { heightAt } from '../World'
import { local, range } from '../../state'
import { pbr } from '../assets'

// Oro pulido (reflejos reales del HDRI) y mármol escaneado (Poly Haven marble_01)
const gold = new THREE.MeshStandardMaterial({ color: '#e0b04a', metalness: 1, roughness: 0.22, envMapIntensity: 1.3 })
const stone = new THREE.MeshStandardMaterial({ ...pbr('marble_01', 1.5), color: '#f4efe4', aoMapIntensity: 0.6 })
const stoneDark = new THREE.MeshStandardMaterial({ ...pbr('marble_01', 3), color: '#ddd3bf', aoMapIntensity: 0.8 })

const UP = new THREE.Vector3(0, 1, 0)

function Pan({ side, ref }) {
  // plato colgado de tres cadenas; el origen es el punto de cuelgue en el extremo del astil
  const bowl = useMemo(() => {
    const pts = [
      [0, 0],
      [0.55, 0.02],
      [0.75, 0.16],
      [0.78, 0.2],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(pts, 32)
  }, [])
  const chains = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5
        const end = new THREE.Vector3(Math.cos(a) * 0.74, -1.42, Math.sin(a) * 0.74)
        return {
          pos: end.clone().multiplyScalar(0.5),
          quat: new THREE.Quaternion().setFromUnitVectors(UP, end.clone().normalize()),
          len: end.length(),
        }
      }),
    [],
  )
  return (
    <group ref={ref} position={[side * 1.9, 0, 0]}>
      {chains.map((c, i) => (
        <mesh key={i} position={c.pos} quaternion={c.quat} material={gold}>
          <cylinderGeometry args={[0.012, 0.012, c.len, 4]} />
        </mesh>
      ))}
      <mesh geometry={bowl} position={[0, -1.62, 0]} material={gold} castShadow />
    </group>
  )
}

function Scale() {
  const root = useRef()
  const beam = useRef()
  const pans = useRef([])
  useFrame(({ clock }) => {
    const l = local('c1')
    // emerge del suelo entre la vegetación y se equilibra a medida que se aprende
    const rise = range(l, -0.15, 0.22)
    root.current.position.y = 3.6 - 5 + rise * 5 + heightAt(0, CENTERS.c1.z)
    root.current.rotation.y = (1 - rise) * 1.2 + Math.sin(clock.elapsedTime * 0.25) * 0.05
    const tilt = 0.32 * (1 - range(l, 0.35, 0.8)) * Math.cos(clock.elapsedTime * 0.6) + 0.02 * Math.sin(clock.elapsedTime)
    beam.current.rotation.z = tilt
    // los platos cuelgan siempre en vertical
    pans.current.forEach((p) => p && (p.rotation.z = -tilt))
  })
  return (
    <group ref={root} position={[CENTERS.c1.x, 0, CENTERS.c1.z]} scale={1.55}>
      {/* pedestal */}
      <mesh position={[0, -2.3, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1.1, 0.5, 32]} />
      </mesh>
      <mesh position={[0, -0.8, 0]} material={gold} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 2.6, 16]} />
      </mesh>
      <mesh position={[0, 0.62, 0]} material={gold} castShadow>
        <sphereGeometry args={[0.16, 24, 16]} />
      </mesh>
      <mesh position={[0, 0.95, 0]} material={gold}>
        <coneGeometry args={[0.08, 0.5, 16]} />
      </mesh>
      {/* astil */}
      <group ref={beam} position={[0, 0.55, 0]}>
        <mesh rotation-z={Math.PI / 2} material={gold} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 3.9, 12]} />
        </mesh>
        {[-1, 1].map((s, i) => (
          <Pan key={s} side={s} ref={(el) => (pans.current[i] = el)} />
        ))}
      </group>
    </group>
  )
}

/** Pórtico neoclásico inspirado en el Capitolio Nacional: escalinata, columnas, frontón. */
function Portico() {
  const ref = useRef()
  const cols = 10
  const width = 22
  const pediment = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-width / 2 - 0.6, 0)
    s.lineTo(width / 2 + 0.6, 0)
    s.lineTo(0, 2.6)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false })
    g.translate(0, 0, -0.8)
    return g
  }, [])
  const flute = useMemo(() => new THREE.CylinderGeometry(0.42, 0.48, 8, 20), [])
  useFrame(() => {
    const l = local('c1')
    ref.current.position.y = heightAt(0, CENTERS.c1.z - 18) - 0.2 - (1 - range(l, -0.4, 0.15)) * 4
  })
  return (
    <group ref={ref} position={[0, 0, CENTERS.c1.z - 18]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.3 + i * 0.6, 2.6 - i * 0.7]} material={i % 2 ? stoneDark : stone} receiveShadow castShadow>
          <boxGeometry args={[width + 3 - i, 0.6, 2]} />
        </mesh>
      ))}
      {Array.from({ length: cols }, (_, i) => (
        <group key={i} position={[-width / 2 + (i * width) / (cols - 1), 1.8 + 4, 0]}>
          <mesh geometry={flute} material={stone} castShadow receiveShadow />
          <mesh position={[0, 4.15, 0]} material={stoneDark}>
            <boxGeometry args={[1.2, 0.3, 1.2]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 10.5, 0]} material={stone} castShadow>
        <boxGeometry args={[width + 1.2, 1.1, 1.8]} />
      </mesh>
      <mesh position={[0, 11.05, 0]} geometry={pediment} material={stoneDark} castShadow />
      {/* muro posterior en sombra */}
      <mesh position={[0, 6, -2.4]} material={stoneDark} receiveShadow>
        <boxGeometry args={[width + 1, 12, 0.6]} />
      </mesh>
    </group>
  )
}

export function Justice() {
  return (
    <group>
      <Scale />
      <Portico />
    </group>
  )
}
