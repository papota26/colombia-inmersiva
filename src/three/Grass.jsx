import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { heightAt } from './World'
import { CENTERS } from './path'
import { rng } from './flora'
import { isMobile } from '../state'

// Pasto denso: miles de briznas instanciadas que se mecen con el viento.
// Es lo que más acerca la escena a una fotografía de paisaje.

function bladeGeometry() {
  const seg = 4
  const g = new THREE.PlaneGeometry(0.05, 1, 1, seg)
  g.translate(0, 0.5, 0)
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const root = new THREE.Color('#1f4a18')
  const tip = new THREE.Color('#6fb23a')
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    // se afina hacia la punta y se curva levemente
    p.setX(i, p.getX(i) * (1 - y * 0.85))
    p.setZ(i, y * y * 0.18)
    c.copy(root).lerp(tip, Math.pow(y, 0.8))
    col.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  // normales hacia arriba: el pasto se ilumina como una superficie suave
  const n = g.attributes.normal
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0.98, 0.2)
  return g
}

const time = { value: 0 }

function grassMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.7 })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 ip = instanceMatrix[3].xyz;
      float w = sin(uTime * 1.6 + ip.x * 0.35 + ip.z * 0.25) * 0.6 + sin(uTime * 3.1 + ip.x * 1.3) * 0.25;
      transformed.x += w * 0.12 * position.y * position.y;
      transformed.z += cos(uTime * 1.2 + ip.z * 0.4) * 0.06 * position.y * position.y;`,
    )
  }
  m.customProgramCacheKey = () => 'grass'
  return m
}

/** Un parche de pasto centrado en (cx, cz) de tamaño w × d, evitando zonas ocupadas. */
function Patch({ cx, cz, w, d, count, avoid = () => false, seed = 1, geometry, material }) {
  const ref = useRef()
  const n = Math.round(count * (isMobile ? 0.3 : 1))
  useLayoutEffect(() => {
    const r = rng(seed)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const c = new THREE.Color()
    let i = 0
    let guard = 0
    while (i < n && guard++ < n * 4) {
      // más densidad cerca del centro, bordes que se desvanecen
      const x = cx + (r() - 0.5) * w * (0.6 + r() * 0.4)
      const z = cz + (r() - 0.5) * d * (0.6 + r() * 0.4)
      if (avoid(x, z)) continue
      const h = 0.25 + r() * r() * 0.55
      q.setFromEuler(e.set((r() - 0.5) * 0.4, r() * Math.PI * 2, (r() - 0.5) * 0.4))
      s.set(0.8 + r() * 0.8, h, 1)
      p.set(x, heightAt(x, z) - 0.02, z)
      ref.current.setMatrixAt(i, m.compose(p, q, s))
      const v = 0.75 + r() * 0.45
      c.setRGB(v * (0.9 + r() * 0.2), v, v * (0.8 + r() * 0.15))
      ref.current.setColorAt(i, c)
      i++
    }
    ref.current.count = i
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [cx, cz, w, d, n, seed, avoid, geometry, material])
  return <instancedMesh ref={ref} args={[geometry, material, n]} receiveShadow />
}

export function Grass() {
  const geometry = useMemo(() => bladeGeometry(), [])
  const material = useMemo(() => grassMaterial(), [])
  useFrame((_, dt) => {
    time.value += dt
  })
  const c1 = CENTERS.c1
  const c3 = CENTERS.c3
  const c4 = CENTERS.c4
  return (
    <group>
      {/* portada: el prado que la cámara recorre al empezar */}
      <Patch cx={0} cz={6} w={34} d={44} count={70000} seed={1} geometry={geometry} material={material} />
      <Patch cx={0} cz={-34} w={26} d={36} count={30000} seed={2} geometry={geometry} material={material} />
      {/* capítulo 1: claro de la balanza (sin pasto sobre el pedestal ni la escalinata) */}
      <Patch
        cx={c1.x}
        cz={c1.z + 4}
        w={36}
        d={34}
        count={55000}
        seed={3}
        avoid={(x, z) => Math.hypot(x - c1.x, z - c1.z) < 2.8 || (z < c1.z - 14 && Math.abs(x) < 15)}
        geometry={geometry}
        material={material}
      />
      {/* capítulo 3: alrededor del libro */}
      <Patch
        cx={c3.x}
        cz={c3.z}
        w={26}
        d={26}
        count={40000}
        seed={4}
        avoid={(x, z) => Math.abs(x - c3.x) < 3.6 && Math.abs(z - c3.z) < 2.6}
        geometry={geometry}
        material={material}
      />
      {/* capítulo 4: claro de los ciudadanos */}
      <Patch cx={c4.x} cz={c4.z + 2} w={30} d={34} count={50000} seed={5} geometry={geometry} material={material} />
    </group>
  )
}
