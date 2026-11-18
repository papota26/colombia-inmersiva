import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CENTERS } from '../path'
import { heightAt } from '../World'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { rng, wingTexture } from '../flora'
import { url } from '../assets'
import { local, range, isMobile } from '../../state'

const C = CENTERS.c4

/** Mariposa con dos alas que aletean; `kind` morfo azul o amarilla. */
export function Butterfly({ kind = 'morpho', size = 1, ref }) {
  const tex = useMemo(() => wingTexture(kind), [kind])
  const wingGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.translate(0.5, 0, 0) // bisagra en el cuerpo
    return g
  }, [])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.35, metalness: kind === 'morpho' ? 0.35 : 0, emissive: kind === 'morpho' ? '#0c2f6e' : '#000', emissiveIntensity: 0.6 }),
    [tex, kind],
  )
  const l = useRef()
  const r = useRef()
  const seed = useMemo(() => Math.random() * 10, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 11 + seed
    const flap = Math.sin(t) * 0.95 + 0.25
    l.current.rotation.y = flap
    r.current.rotation.y = Math.PI - flap
  })
  return (
    <group ref={ref} scale={size}>
      <group rotation-x={Math.PI / 2}>
        <mesh ref={l} geometry={wingGeo} material={mat} castShadow />
        <mesh ref={r} geometry={wingGeo} material={mat} castShadow />
      </group>
      <mesh rotation-x={Math.PI / 2}>
        <capsuleGeometry args={[0.035, 0.5, 4, 8]} />
        <meshStandardMaterial color="#15130f" roughness={0.6} />
      </mesh>
    </group>
  )
}

// Personas reales: avatares de Microsoft Rocketbox (licencia MIT), con animación de respiración.
const PEOPLE = [
  'Female_Adult_03', 'Female_Adult_07', 'Female_Adult_08', 'Female_Adult_11', 'Female_Party_02',
  'Business_Female_01', 'Female_Child_01', 'Male_Adult_04', 'Male_Adult_05', 'Male_Adult_07',
  'Male_Adult_09', 'Male_Adult_12', 'Male_Adult_17', 'Male_Child_02', 'Wood_Male_01',
]
const purl = (n) => url(`models/people/${n}.glb`)
PEOPLE.forEach((n) => useGLTF.preload(purl(n)))

/** Quita las pistas de la raíz (traen la conversión de ejes de 3ds Max) y adapta el esqueleto de niño. */
function idleFor(clip, child) {
  const c = clip.clone()
  if (child) c.tracks.forEach((t) => (t.name = t.name.replace('Bip01', 'Bip02')))
  c.tracks = c.tracks.filter((t) => !/^Bip0[12]\./.test(t.name) && !t.name.includes('Footsteps') && !t.name.endsWith('.position'))
  return c
}

function Person({ name, position, rotation, delay, clipF, clipM, getOrder }) {
  const { scene } = useGLTF(purl(name))
  const model = useMemo(() => {
    const m = cloneSkinned(scene)
    const mats = []
    m.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        o.frustumCulled = false
        o.material = o.material.clone()
        o.material.envMapIntensity = 0.9
        mats.push(o.material)
      }
    })
    m.userData.mats = mats
    return m
  }, [scene])
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model])
  useEffect(() => {
    const female = name.includes('Female')
    const a = mixer.clipAction(idleFor(female ? clipF : clipM, name.includes('Child')))
    a.play()
    a.time = delay * 2
    a.timeScale = 0.85 + (delay % 0.3)
    return () => mixer.stopAllAction()
  }, [mixer, name, clipF, clipM, delay])
  const ref = useRef()
  useFrame((_, dt) => {
    const g = getOrder()
    ref.current.visible = g > 0.01
    if (!ref.current.visible) return
    mixer.update(dt)
    // aparece suavemente cuando la mariposa pasa cerca
    model.userData.mats.forEach((mt) => {
      mt.transparent = g < 0.99
      mt.opacity = g
    })
    ref.current.position.y = position[1] - (1 - g) * 0.15
  })
  return (
    <group ref={ref} position={position} rotation={[0, rotation, 0]}>
      <primitive object={model} />
    </group>
  )
}

function Crowd() {
  const clipF = useGLTF(url('models/people/anim_f.glb')).animations[0]
  const clipM = useGLTF(url('models/people/anim_m.glb')).animations[0]
  const people = useMemo(() => {
    const r = rng(33)
    const out = []
    const n = isMobile ? 12 : 22
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2
      const d = 1.2 + Math.sqrt(r()) * 5.5
      const x = C.x + Math.cos(a) * d
      const z = C.z + 4 + Math.sin(a) * d * 0.6
      out.push({
        name: PEOPLE[i % PEOPLE.length],
        position: [x, heightAt(x, z), z],
        rotation: Math.atan2(-(x - C.x), 9 - (z - C.z)) + (r() - 0.5) * 0.7,
        delay: r(),
        order: (x - C.x + 9) / 18,
      })
    }
    return out
  }, [])
  return people.map((p, i) => (
    <Person
      key={i}
      {...p}
      clipF={clipF}
      clipM={clipM}
      getOrder={() => range(local('c4'), 0.04 + p.order * 0.3, 0.14 + p.order * 0.3)}
    />
  ))
}

/** Recorrido de la mariposa por el bosque hasta posarse sobre la multitud. */
function GuideButterfly() {
  const ref = useRef()
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1, 3.2, -292),
        new THREE.Vector3(-4, 2.6, -300),
        new THREE.Vector3(-8, 2.2, -312),
        new THREE.Vector3(-3, 3.2, -318),
        new THREE.Vector3(3, 2.4, -314),
        new THREE.Vector3(8, 3, -318),
        new THREE.Vector3(2, 4.2, -322),
      ]),
    [],
  )
  const p = useMemo(() => new THREE.Vector3(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    const l = local('c4')
    const t = range(l, -0.05, 0.42) * 0.92 + Math.sin(clock.elapsedTime * 0.3) * 0.02 + 0.02
    curve.getPointAt(Math.min(0.999, Math.max(0, t)), p)
    curve.getPointAt(Math.min(1, Math.max(0, t) + 0.01), ahead)
    p.y += Math.sin(clock.elapsedTime * 2.2) * 0.15
    ref.current.position.copy(p)
    ref.current.lookAt(ahead)
  })
  return <Butterfly ref={ref} size={0.55} />
}

/** Mariposas amarillas ambientales. */
function Swarm() {
  const refs = useRef([])
  const items = useMemo(() => {
    const r = rng(77)
    return Array.from({ length: 9 }, () => ({ x: (r() - 0.5) * 18, z: C.z + (r() - 0.5) * 20, y: 1.5 + r() * 3, sp: 0.3 + r() * 0.5, ph: r() * 6 }))
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    items.forEach((it, i) => {
      const b = refs.current[i]
      if (!b) return
      b.position.set(it.x + Math.sin(t * it.sp + it.ph) * 2, it.y + Math.sin(t * 1.7 + it.ph) * 0.4, it.z + Math.cos(t * it.sp + it.ph) * 2)
      b.rotation.y = -t * it.sp - it.ph
    })
  })
  return items.map((_, i) => <Butterfly key={i} kind="yellow" size={0.22} ref={(el) => (refs.current[i] = el)} />)
}

export function Citizens() {
  return (
    <group>
      <GuideButterfly />
      <Crowd />
      <Swarm />
    </group>
  )
}
