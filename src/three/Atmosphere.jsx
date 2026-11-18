import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { scroll, isMobile } from '../state'
import { useSky } from './assets'

// Ambiente por escenario: tinte de la niebla (bruma atmosférica), densidad,
// intensidad del sol y exposición del cielo. El cielo en sí es un HDRI real.
const MOODS = {
  hero: { tint: '#c9d39a', mix: 0.22, d: 0.0055, sun: 3.6, sky: 1.05 },
  c1: { tint: '#c4d0a8', mix: 0.2, d: 0.005, sun: 3.7, sky: 1.05 },
  c2: { tint: '#cfd8b0', mix: 0.18, d: 0.0038, sun: 3.6, sky: 1.08 },
  c3: { tint: '#e6c38a', mix: 0.25, d: 0.006, sun: 3.4, sky: 1.05 },
  c4: { tint: '#7fa064', mix: 0.35, d: 0.008, sun: 3.0, sky: 1.0 },
  t5: { tint: '#dfe6ea', mix: 0.3, d: 0.0045, sun: 3.0, sky: 1.05 },
  c5: { tint: '#c8d6e2', mix: 0.2, d: 0.0026, sun: 3.2, sky: 1.05 },
  fin: { tint: '#e3a878', mix: 0.45, d: 0.0024, sun: 2.0, sky: 0.8 },
}
const ORDER = ['hero', 'c1', 'c2', 'c3', 'c4', 't5', 'c5', 'fin']
const TINTS = Object.fromEntries(ORDER.map((k) => [k, new THREE.Color(MOODS[k].tint)]))

// Dirección hacia el sol. Se recalcula con la elevación real del HDRI; el azimut se
// fija a contraluz (el sol delante de la cámara, un poco a la izquierda).
export const SUN_DIR = new THREE.Vector3(-0.38, 0.42, -1).normalize()
const TARGET_AZ = Math.atan2(-1, -0.38)

function moodAt(p, out) {
  const pts = ORDER.map((k) => {
    const s = scroll.sections[k]
    return s ? (s.start + s.end) / 2 : 0
  })
  let i = 0
  while (i < ORDER.length - 2 && p > pts[i + 1]) i++
  const t = THREE.MathUtils.smoothstep(p, pts[i], pts[i + 1])
  const A = MOODS[ORDER[i]]
  const B = MOODS[ORDER[i + 1]]
  out.tint.copy(TINTS[ORDER[i]]).lerp(TINTS[ORDER[i + 1]], t)
  for (const k of ['mix', 'd', 'sun', 'sky']) out[k] = THREE.MathUtils.lerp(A[k], B[k], t)
  return out
}

export function Atmosphere() {
  const { scene } = useThree()
  const sky = useSky()
  const sun = useRef()
  const mood = useMemo(() => ({ tint: new THREE.Color(), mix: 0, d: 0.01, sun: 3, sky: 1 }), [])
  const fog = useMemo(() => new THREE.FogExp2('#c3c8a2', 0.01), [])
  const target = useMemo(() => new THREE.Object3D(), [])

  // Rotar el HDRI para que su sol quede a contraluz y alinear la luz direccional con él.
  const rotY = useMemo(() => {
    const el = Math.max(0.2, sky.sunElevation)
    SUN_DIR.set(Math.cos(el) * Math.cos(TARGET_AZ), Math.sin(el), Math.cos(el) * Math.sin(TARGET_AZ)).normalize()
    return sky.sunAzimuth - TARGET_AZ
  }, [sky])

  useLayoutEffect(() => {
    scene.background = sky.tex
    scene.environment = sky.tex
    scene.backgroundRotation.set(0, rotY, 0)
    scene.environmentRotation.set(0, rotY, 0)
    scene.environmentIntensity = 1.3
    scene.fog = fog
    return () => {
      scene.background = null
      scene.environment = null
    }
  }, [scene, sky, rotY, fog])

  useFrame(({ camera }) => {
    moodAt(scroll.progress, mood)
    // bruma = color real del horizonte del HDRI, teñida según el capítulo
    fog.color.copy(sky.horizon).multiplyScalar(mood.sky).lerp(mood.tint, mood.mix)
    fog.density = mood.d
    scene.backgroundIntensity = mood.sky
    const look = camera.userData.target || camera.position
    target.position.copy(look)
    sun.current.position.copy(look).addScaledVector(SUN_DIR, 80)
    sun.current.target = target
    sun.current.intensity = mood.sun
  })

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={sun}
        color="#ffe4b5"
        castShadow
        shadow-mapSize={isMobile ? [1024, 1024] : [4096, 4096]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.05}
        shadow-radius={4}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
    </>
  )
}
