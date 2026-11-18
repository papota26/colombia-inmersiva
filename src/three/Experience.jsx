import * as THREE from 'three'
import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise, DepthOfField, ToneMapping, N8AO, SMAA, HueSaturation, BrightnessContrast } from '@react-three/postprocessing'
import { Grass } from './Grass'
import { Monserrate, MONSERRATE } from './scenes/Monserrate'
import { Rose, RoseField, ROSE_COLORS } from './scenes/Rose'
import { heightAt } from './World'
import { rng } from './flora'
import { ToneMappingMode } from 'postprocessing'
import { useState } from 'react'
import { scroll, isMobile, reducedMotion, range } from '../state'
import { cameraAt, CENTERS } from './path'
import { Atmosphere } from './Atmosphere'
import { Vegetation, Mist, LightShafts } from './World'
import { Flock } from './Macaw'
import { Justice } from './scenes/Justice'
import { Evolution } from './scenes/Evolution'
import { Orchid } from './scenes/Orchid'
import { Book } from './scenes/Book'
import { Citizens } from './scenes/Citizens'
import { ColombiaMap } from './scenes/ColombiaMap'
import { local } from '../state'

/** Cámara de cine: sigue la trayectoria con amortiguación y un leve movimiento de mano. */
function CameraRig() {
  const pos = useMemo(() => new THREE.Vector3(), [])
  const tgt = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(0, 5, 0), [])
  const mouse = useRef({ x: 0, y: 0 })
  const intro = useRef(0)
  useFrame((state, dt) => {
    const { camera, pointer, clock } = state
    if (!scroll.ready) return
    cameraAt(scroll.progress, pos, tgt)
    // acercamiento lento de apertura (dolly-in) durante los primeros segundos
    intro.current = Math.min(1, intro.current + dt / 5)
    const dolly = 1 - THREE.MathUtils.smootherstep(intro.current, 0, 1)
    pos.z += dolly * 14
    pos.y += dolly * 3
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 3.2)
    mouse.current.x += (pointer.x - mouse.current.x) * 0.04
    mouse.current.y += (pointer.y - mouse.current.y) * 0.04
    const t = clock.elapsedTime
    const hand = reducedMotion ? 0 : 1
    camera.position.lerp(pos, k)
    camera.position.x += (mouse.current.x * 0.6 + Math.sin(t * 0.31) * 0.12) * hand * k
    camera.position.y += (mouse.current.y * 0.3 + Math.sin(t * 0.47) * 0.08) * hand * k
    look.lerp(tgt, k)
    camera.lookAt(look)
    camera.userData.target = look
    if (import.meta.env.DEV || window.__debug) {
      window.__cam = camera
      window.__info = state.gl.info
      window.__scene = state.scene
    }
  })
  return null
}

/** Monta y oculta escenarios según la distancia de la cámara (carga progresiva). */
function Near({ center, radius = 150, children }) {
  const ref = useRef()
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = camera.position.distanceTo(center) < radius
  })
  return <group ref={ref}>{children}</group>
}

/** Rosa gigante que florece en la transición hacia las constituciones. */
function TransitionOrchid() {
  const p = CENTERS.orchid
  // justo en la línea de mirada de la cámara durante la transición
  const x = -1.4
  const z = -203.5
  const y = heightAt(x, z) - 0.05
  return (
    <Near center={p} radius={110}>
      <Rose
        position={[x, y, z]}
        rotation={[0.85, 0, -0.3]}
        scale={3.4}
        color="#c8002a"
        getOpen={() => {
          const s = scroll.sections.t3
          if (!s) return 0
          return range(scroll.progress, s.start - (s.end - s.start) * 0.1, s.start + (s.end - s.start) * 0.65)
        }}
      />
    </Near>
  )
}

/** Florece al entrar (unos segundos después de la carga) y termina de abrirse con el scroll. */
function heroOpen() {
  const t = scroll.readyAt == null ? 0 : performance.now() / 1000 - scroll.readyAt
  const s = scroll.sections.hero
  const byScroll = s ? range(scroll.progress, s.start, s.start + (s.end - s.start) * 0.4) : 0
  return Math.max(THREE.MathUtils.smootherstep(t, 1.2, 7.5), byScroll)
}

function Flowers() {
  // grupo de la portada: rosas de varios colores alrededor de la protagonista, cada una
  // con su propio momento de apertura
  const heroItems = useMemo(() => {
    const r = rng(404)
    const out = []
    for (let i = 0; i < (isMobile ? 10 : 16); i++) {
      const a = r() * Math.PI * 2
      const d = 0.5 + r() * 1.8
      const x = -2.4 + Math.cos(a) * d
      const z = 16 + Math.sin(a) * d * 0.8
      out.push({ x, z, y: heightAt(x, z) - 0.03, s: 0.7 + r() * 0.5, rot: r() * 6.28, tilt: (r() - 0.5) * 0.3, color: ROSE_COLORS[i % ROSE_COLORS.length], offset: (r() - 0.6) * 0.5 })
    }
    for (let i = 0; i < (isMobile ? 12 : 26); i++) {
      const side = i % 2 ? -1 : 1
      const x = side * (2.5 + r() * 7)
      const z = 3 + r() * 22
      out.push({ x, z, y: heightAt(x, z) - 0.03, s: 0.6 + r() * 0.5, rot: r() * 6.28, tilt: (r() - 0.5) * 0.3, color: ROSE_COLORS[Math.floor(r() * ROSE_COLORS.length)], offset: (r() - 0.5) * 0.4 })
    }
    return out
  }, [])
  const bookItems = useMemo(() => {
    const r = rng(405)
    const out = []
    const c = CENTERS.c3
    for (let i = 0; i < (isMobile ? 14 : 30); i++) {
      const a = r() * Math.PI * 2
      const d = 3.4 + r() * 4.5
      const x = c.x + Math.cos(a) * d
      const z = c.z + Math.sin(a) * d
      out.push({ x, z, y: heightAt(x, z) - 0.03, s: 0.55 + r() * 0.45, rot: r() * 6.28, tilt: (r() - 0.5) * 0.3, color: ROSE_COLORS[Math.floor(r() * ROSE_COLORS.length)], offset: (r() - 0.5) * 0.4 })
    }
    return out
  }, [])
  const g = heightAt(-2.4, 16)
  return (
    <>
      <Near center={CENTERS.hero} radius={90}>
        {/* rosa roja protagonista en primer plano de la portada */}
        <Rose position={[-2.4, g - 0.03, 16]} rotation={[0.12, 0.4, 0]} scale={1.7} color="#d10f2f" getOpen={heroOpen} />
        <RoseField items={heroItems} getOpen={heroOpen} />
      </Near>
      <Near center={CENTERS.c3} radius={90}>
        <RoseField items={bookItems} getOpen={() => range(local('c3'), -0.1, 0.15)} />
      </Near>
    </>
  )
}

function Effects({ quality }) {
  const target = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    if (camera.userData.target) target.copy(camera.userData.target)
  })
  if (quality === 'low') {
    return (
      <EffectComposer multisampling={0}>
        <Vignette offset={0.3} darkness={0.45} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <HueSaturation saturation={0.48} />
        <BrightnessContrast brightness={0.03} contrast={0.18} />
        <SMAA />
      </EffectComposer>
    )
  }
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes aoRadius={2.2} distanceFalloff={1.2} intensity={2.4} color="#0b1a10" />
      <DepthOfField target={target} focalLength={0.035} bokehScale={2.4} height={540} />
      <Bloom intensity={0.35} luminanceThreshold={1.1} luminanceSmoothing={0.3} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <HueSaturation saturation={0.48} />
      <BrightnessContrast brightness={0.03} contrast={0.18} />
      <Vignette offset={0.3} darkness={0.45} />
      <Noise opacity={0.025} />
      <SMAA />
    </EffectComposer>
  )
}

export default function Experience() {
  const [quality, setQuality] = useState(isMobile ? 'low' : 'high')
  return (
    <Canvas
      className="stage"
      shadows
      dpr={isMobile ? [1, 1.5] : [1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
      camera={{ fov: isMobile ? 62 : 45, near: 0.1, far: 2000, position: [0, 6, 40] }}
      aria-hidden="true"
    >
      <PerformanceMonitor onDecline={() => setQuality('low')} />
      <AdaptiveDpr pixelated={false} />
      <CameraRig />
      <Suspense fallback={null}>
        <Atmosphere />
        <Vegetation />
        <Grass />
        <Mist />
        <LightShafts />
        <Flock />
        <Near center={CENTERS.c1}>
          <Justice />
        </Near>
        <Near center={CENTERS.c2} radius={170}>
          <Evolution />
        </Near>
        <Near center={MONSERRATE} radius={300}>
          <Monserrate />
        </Near>
        <Flowers />
        <TransitionOrchid />
        <Near center={CENTERS.c3}>
          <Book />
        </Near>
        <Near center={CENTERS.c4}>
          <Citizens />
        </Near>
        <Near center={CENTERS.c5} radius={260}>
          <ColombiaMap />
        </Near>
      </Suspense>
      <Effects quality={quality} />
    </Canvas>
  )
}

export { local }
