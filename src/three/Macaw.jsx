import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { scroll, range, local, isMobile } from '../state'
import { CENTERS } from './path'

// Modelo: "Parrot" de mirada.com para ro.me (incluido en los ejemplos de three.js).
const URL = `${import.meta.env.BASE_URL}models/parrot.glb`

// Órbitas de la guacamaya en cada escenario: centro, radio, altura sobre el centro.
const ORBITS = [
  ['hero', new THREE.Vector3(0, 5.2, 12), 4.5, 0.6],
  ['c1', CENTERS.c1, 9, 6],
  ['c2', CENTERS.c2, 16, 9],
  ['c3', CENTERS.c3, 7, 5.5],
  ['c4', CENTERS.c4, 7, 4],
  ['c5', CENTERS.c5, 22, 26],
]

function Macaw({ offset = [0, 0, 0], phase = 0, size = 1, orbitScale = 1, speed = 1 }) {
  const { scene, animations } = useGLTF(URL)
  const root = useRef()
  const { actions, mixer } = useAnimations(animations, root)
  const model = useMemo(() => {
    const m = scene.clone()
    m.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.material = o.material.clone()
        o.material.roughness = 0.55
        o.material.metalness = 0
      }
    })
    return m
  }, [scene])

  useEffect(() => {
    const a = Object.values(actions)[0]
    a?.play()
  }, [actions])

  const tmp = useMemo(
    () => ({ lead: new THREE.Vector3(), orbit: new THREE.Vector3(), fwd: new THREE.Vector3(), goal: new THREE.Vector3(), prev: new THREE.Vector3(), look: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() }),
    [],
  )
  const first = useRef(true)

  useFrame(({ camera, clock }, dt) => {
    const t = clock.elapsedTime
    const g = root.current
    if (!g || !scroll.ready) return
    // Punto guía: delante de la cámara, ligeramente arriba, con un vaivén de vuelo.
    const tgt = camera.userData.target
    if (!tgt) return
    const tp = t * speed + phase
    const big = 1 + range(scroll.progress, scroll.sections.t5?.start ?? 2, scroll.sections.c5?.start ?? 2) * 2.4
    tmp.fwd.copy(tgt).sub(camera.position).normalize()
    tmp.lead
      .copy(camera.position)
      .addScaledVector(tmp.fwd, (10 + offset[2]) * big)
      .add(new THREE.Vector3(Math.sin(tp * 0.7) * 2.2 + offset[0] * big, 1.6 + offset[1] * big + Math.sin(tp * 1.3) * 0.5, 0))

    // Órbita del escenario activo: la guacamaya ronda el objeto principal mientras se lee.
    let w = 0
    for (const [id, c, r, h] of ORBITS) {
      const s = scroll.sections[id]
      if (!s) continue
      const l = local(id)
      const inside = range(l, 0, 0.06) * (1 - range(l, 0.9, 1))
      const pin = scroll.progress >= s.start && scroll.progress <= s.end ? inside : 0
      const weight = id === 'hero' ? 1 - range(l, 0.45, 1) : pin
      if (weight > w) {
        w = weight
        const a = tp * (id === 'c5' ? 0.12 : 0.28) + phase
        const rr = r * orbitScale
        tmp.orbit.set(c.x + Math.cos(a) * rr, c.y + h + offset[1] + Math.sin(tp * 0.9) * 0.6, c.z + Math.sin(a) * rr * 0.7)
      }
    }
    tmp.goal.copy(tmp.lead).lerp(tmp.orbit, w)

    tmp.prev.copy(g.position)
    if (first.current) {
      g.position.copy(tmp.goal)
      first.current = false
    } else {
      g.position.lerp(tmp.goal, 1 - Math.exp(-dt * 1.6))
    }
    // orientar según la velocidad (el modelo mira hacia +z)
    const vel = tmp.look.copy(g.position).sub(tmp.prev)
    if (vel.lengthSq() > 1e-6) {
      tmp.m.lookAt(g.position.clone().add(vel), g.position, THREE.Object3D.DEFAULT_UP)
      tmp.q.setFromRotationMatrix(tmp.m)
      // inclinación en los giros
      g.quaternion.slerp(tmp.q, 1 - Math.exp(-dt * 4))
    }
    mixer.timeScale = 1.1 * (0.9 + speed * 0.2)
    // un poco más grande en el mapa aéreo para que se lea desde lo alto
    g.scale.setScalar(0.019 * big * size)
  })

  return (
    <group ref={root}>
      <primitive object={model} />
    </group>
  )
}

useGLTF.preload(URL)

/** Bandada: la guacamaya guía y otras que vuelan a su alrededor, cada una con su ritmo. */
const FLOCK = [
  { offset: [0, 0, 0], phase: 0, size: 1, orbitScale: 1, speed: 1 },
  { offset: [-3.5, 1.4, 3], phase: 1.7, size: 0.85, orbitScale: 1.35, speed: 1.12 },
  { offset: [4, 2.2, 6], phase: 3.1, size: 0.8, orbitScale: 0.8, speed: 0.92 },
  { offset: [-6, 3.2, 10], phase: 4.4, size: 0.75, orbitScale: 1.6, speed: 1.05 },
  { offset: [6.5, 0.8, 13], phase: 5.6, size: 0.7, orbitScale: 1.2, speed: 1.18 },
  { offset: [1.5, 4, 16], phase: 2.4, size: 0.7, orbitScale: 1.9, speed: 0.95 },
  { offset: [-9, 5, 20], phase: 0.8, size: 0.65, orbitScale: 2.2, speed: 1.1 },
  { offset: [9, 6, 22], phase: 2.9, size: 0.65, orbitScale: 2.4, speed: 0.88 },
  { offset: [-2, 7, 26], phase: 5.1, size: 0.6, orbitScale: 2.7, speed: 1.15 },
  { offset: [4, 2.6, 9], phase: 3.7, size: 0.8, orbitScale: 1.45, speed: 1.02 },
  { offset: [-5, 2, 7], phase: 1.2, size: 0.8, orbitScale: 1.1, speed: 0.97 },
  { offset: [11, 8, 30], phase: 4.0, size: 0.55, orbitScale: 3, speed: 1.08 },
  { offset: [-12, 8.5, 32], phase: 0.3, size: 0.55, orbitScale: 3.2, speed: 0.93 },
  { offset: [0, 10, 36], phase: 2.0, size: 0.5, orbitScale: 3.5, speed: 1.12 },
]

export function Flock() {
  const n = isMobile ? 6 : FLOCK.length
  return FLOCK.slice(0, n).map((b, i) => <Macaw key={i} {...b} />)
}
