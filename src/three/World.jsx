import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CENTERS } from './path'
import { SUN_DIR } from './Atmosphere'
import { rng, noise3, waxPalmGeometry, heliconiaGeometry, smallOrchidGeometry, softTexture } from './flora'
import { usePBRTextures, usePlant } from './assets'
import { isMobile, scroll, range } from '../state'

const Z_FAR = -440
const Z_NEAR = 70

// Claros donde no crece vegetación alta (para los escenarios).
const CLEARINGS = [
  [CENTERS.c1, 15],
  [CENTERS.c2, 30],
  [CENTERS.orchid, 6],
  [CENTERS.c3, 8],
  [CENTERS.c4, 10],
]

/** Altura del terreno en (x, z). Corredor suave al centro, cordilleras a los lados. */
export function heightAt(x, z) {
  const ax = Math.abs(x)
  let h = noise3(x * 0.03, 0, z * 0.03) * 1.1 + noise3(x * 0.12, 3, z * 0.12) * 0.25
  const side = THREE.MathUtils.smoothstep(ax, 20, 110)
  const ridge = 1 - Math.abs(noise3(x * 0.012, 9, z * 0.012))
  h += side * (10 + ridge * ridge * 46 + noise3(x * 0.05, 5, z * 0.05) * 6)
  for (const [c, r] of CLEARINGS) {
    const d = Math.hypot(x - c.x, z - c.z)
    h *= THREE.MathUtils.smoothstep(d, r * 0.5, r * 1.6) * 0.85 + 0.15
  }
  return h
}

function inClearing(x, z, pad = 0) {
  return CLEARINGS.some(([c, r]) => Math.hypot(x - c.x, z - c.z) < r + pad)
}

/** Viento: balancea los vértices según su altura y la posición de la instancia. */
const wind = { value: 0 }
function addWind(material, strength = 0.06) {
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, r) => {
    prev?.(shader, r)
    shader.uniforms.uTime = wind
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = sin(uTime * 1.3 + ip.x * 0.4 + ip.z * 0.3) + sin(uTime * 2.7 + ip.z) * 0.35;
        transformed.x += sway * ${strength.toFixed(4)} * position.y * position.y;
        transformed.z += cos(uTime * 1.1 + ip.x) * ${(strength * 0.6).toFixed(4)} * position.y * position.y;`,
      )
  }
  material.customProgramCacheKey = () => `wind${strength}`
  return material
}

/* ------------------------------------------------------------------ */
/* Terreno: mezcla de tres materiales PBR escaneados                   */
/* ------------------------------------------------------------------ */

function Terrain() {
  const T = usePBRTextures(['leafy_grass', 'forrest_ground_01', 'rock_face'])
  const geo = useMemo(() => {
    const w = 360
    const d = Z_NEAR - Z_FAR
    const g = new THREE.PlaneGeometry(w, d, isMobile ? 140 : 240, isMobile ? 190 : 340)
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0, (Z_NEAR + Z_FAR) / 2)
    const p = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      p.setY(i, heightAt(x, z))
      uv.setXY(i, x / 5, z / 5) // ~5 m por repetición
    }
    g.computeVertexNormals()
    const n = g.attributes.normal
    const wts = new Float32Array(p.count * 3)
    const col = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const h = p.getY(i)
      const slope = 1 - n.getY(i)
      // roca en pendientes y cumbres; hojarasca bajo el bosque; pasto en claros
      let rock = THREE.MathUtils.smoothstep(slope, 0.18, 0.4) + THREE.MathUtils.smoothstep(h, 30, 46)
      rock = Math.min(1, rock)
      const clear = CLEARINGS.reduce((m, [c, r]) => Math.max(m, 1 - THREE.MathUtils.smoothstep(Math.hypot(x - c.x, z - c.z), r * 0.6, r * 1.3)), 0)
      const n1 = noise3(x * 0.06, 2, z * 0.06) * 0.5 + 0.5
      let forest = THREE.MathUtils.clamp(n1 * 1.1 - 0.35 + THREE.MathUtils.smoothstep(Math.abs(x), 6, 18) * 0.3 - clear * 0.8, 0, 0.85)
      let grass = 1 - forest
      forest *= 1 - rock
      grass *= 1 - rock
      const s = rock + forest + grass
      wts.set([grass / s, forest / s, rock / s], i * 3)
      // variación cromática a gran escala (rompe la repetición de la textura)
      const v = 0.82 + noise3(x * 0.015, 7, z * 0.015) * 0.18 + noise3(x * 0.2, 8, z * 0.2) * 0.05
      col.set([v * 0.45, v * 0.82, v * 0.36], i * 3) // tinte húmedo y verde de selva
    }
    g.setAttribute('blendW', new THREE.BufferAttribute(wts, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])

  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: T.leafy_grass.map,
      normalMap: T.leafy_grass.normalMap,
      roughnessMap: T.leafy_grass.roughnessMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
    })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.tForest = { value: T.forrest_ground_01.map }
      sh.uniforms.tRock = { value: T.rock_face.map }
      sh.uniforms.nForest = { value: T.forrest_ground_01.normalMap }
      sh.uniforms.nRock = { value: T.rock_face.normalMap }
      sh.uniforms.aForest = { value: T.forrest_ground_01.roughnessMap }
      sh.uniforms.aRock = { value: T.rock_face.roughnessMap }
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 blendW;\nvarying vec3 vBlend;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlend = blendW;')
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vBlend;\nuniform sampler2D tForest, tRock, nForest, nRock, aForest, aRock;',
        )
        .replace(
          'vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
          `vec2 ruv = vMapUv * 0.37;
          vec4 sampledDiffuseColor = texture2D( map, vMapUv ) * vBlend.x + texture2D( tForest, vMapUv * 0.8 ) * vBlend.y + texture2D( tRock, ruv ) * vBlend.z;`,
        )
        .replace(
          'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
          `vec3 mapN = ( texture2D( normalMap, vNormalMapUv ).xyz * vBlend.x + texture2D( nForest, vNormalMapUv * 0.8 ).xyz * vBlend.y + texture2D( nRock, vNormalMapUv * 0.37 ).xyz * vBlend.z ) * 2.0 - 1.0;`,
        )
        .replace(
          'vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );',
          `vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv ) * vBlend.x + texture2D( aForest, vRoughnessMapUv * 0.8 ) * vBlend.y + texture2D( aRock, vRoughnessMapUv * 0.37 ) * vBlend.z;`,
        )
    }
    return m
  }, [T])

  return <mesh geometry={geo} material={mat} receiveShadow />
}

/* ------------------------------------------------------------------ */
/* Instancias por bloques: cada bloque se descarta si queda fuera de cámara */
/* ------------------------------------------------------------------ */

const CHUNK = 50

function ChunkedInstances({ variants, items, windStrength = 0.01, castShadow = true }) {
  // items: { v (variante), x, y, z, s, rot, tint, hue }
  const groups = useMemo(() => {
    const map = new Map()
    items.forEach((it) => {
      const key = `${it.v}:${Math.floor(it.z / CHUNK)}:${it.x < 0 ? 'l' : 'r'}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(it)
    })
    return [...map.entries()]
  }, [items])
  const mats = useMemo(() => {
    const cache = new Map()
    variants.flat().forEach((p) => {
      if (!cache.has(p.material)) cache.set(p.material, addWind(p.material.clone(), windStrength))
    })
    return cache
  }, [variants, windStrength])
  return groups.map(([key, list]) => {
    const v = Number(key.split(':')[0])
    return variants[v].map((part, pi) => (
      <Chunk key={`${key}-${pi}`} geometry={part.geometry} material={mats.get(part.material)} list={list} castShadow={castShadow} />
    ))
  })
}

function Chunk({ geometry, material, list, castShadow }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const c = new THREE.Color()
    list.forEach((it, i) => {
      q.setFromEuler(e.set(it.tilt || 0, it.rot, (it.tilt || 0) * 0.6))
      s.set(it.s, it.s * (it.sy || 1), it.s)
      p.set(it.x, it.y, it.z)
      ref.current.setMatrixAt(i, m.compose(p, q, s))
      c.setRGB(it.tint * (1 + (it.hue || 0)), it.tint, it.tint * (1 - (it.hue || 0)))
      ref.current.setColorAt(i, c)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [list, geometry, material])
  return <instancedMesh ref={ref} args={[geometry, material, list.length]} castShadow={castShadow} receiveShadow />
}

function scatter({ count, seed, minX, maxX, scale: [s0, s1], pad = 0, zRange = [Z_NEAR - 10, Z_FAR + 10], variants = 1, extra }) {
  const r = rng(seed)
  const out = []
  let guard = 0
  while (out.length < count && guard++ < count * 20) {
    const side = r() < 0.5 ? -1 : 1
    const x = side * (minX + Math.pow(r(), 1.5) * (maxX - minX))
    const z = zRange[0] + (zRange[1] - zRange[0]) * r()
    if (inClearing(x, z, pad)) continue
    const s = s0 + r() * (s1 - s0)
    out.push({
      v: Math.floor(r() * variants),
      x,
      z,
      y: heightAt(x, z) - 0.05,
      s,
      rot: r() * Math.PI * 2,
      tint: 0.85 + r() * 0.25,
      hue: (r() - 0.5) * 0.08,
      tilt: (r() - 0.5) * 0.08,
      ...(extra ? extra(r) : {}),
    })
  }
  return out
}

/** Plantas procedurales que no existen escaneadas con licencia libre: palma de cera, heliconia, orquídea. */
function ProcInstances({ geometry, items, windStrength, roughness = 0.75, castShadow = true }) {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness, side: THREE.DoubleSide, envMapIntensity: 0.8 }),
    [roughness],
  )
  const list = useMemo(() => items.map((it) => ({ ...it, v: 0 })), [items])
  const variants = useMemo(() => [[{ geometry, material }]], [geometry, material])
  return <ChunkedInstances variants={variants} items={list} windStrength={windStrength} castShadow={castShadow} />
}

export function Vegetation() {
  const k = isMobile ? 0.35 : 1
  const tree = usePlant('tree_lo', 1, { leaf: '#b4d688', bark: '#b3a796' })
  const fern = usePlant('fern', 2, { leaf: '#d2e8a8' })
  const anthurium = usePlant('anthurium', 3)
  const calathea = usePlant('calathea', 3)
  const boulder = usePlant('boulder', 1)
  const rocks = usePlant('rocks', 5)
  // palmera: modelo de alanoid330b (Sketchfab, CC BY 4.0), estirada para evocar la palma de cera
  const palm = usePlant('palm', 1)
  // flores silvestres fotoescaneadas (Poly Haven, CC0) como compañía de las rosas
  const gazania = usePlant('wf_gazania', 2)
  const periwinkle = usePlant('wf_periwinkle', 4)
  const heli = useMemo(() => heliconiaGeometry(), [])
  const orchid = useMemo(() => smallOrchidGeometry(), [])

  // Árbol escaneado: 3,4 m de alto en origen → se escala a 9–17 m.
  const treeItems = useMemo(() => scatter({ count: Math.round(250 * k), seed: 20, minX: 9, maxX: 70, scale: [2.8, 5.2], pad: 3 }), [k])
  const fernItems = useMemo(() => scatter({ count: Math.round(1100 * k), seed: 61, minX: 1.8, maxX: 30, scale: [1.8, 3.6], pad: -4, variants: 2 }), [k])
  const anthItems = useMemo(() => scatter({ count: Math.round(520 * k), seed: 62, minX: 2.2, maxX: 22, scale: [1.6, 3], pad: -4, variants: 3 }), [k])
  const calItems = useMemo(() => scatter({ count: Math.round(520 * k), seed: 63, minX: 2.2, maxX: 22, scale: [1.6, 3], pad: -4, variants: 3 }), [k])
  const boulderItems = useMemo(() => scatter({ count: Math.round(14 * k), seed: 64, minX: 4, maxX: 30, scale: [0.8, 2.2], pad: 0 }), [k])
  const rockItems = useMemo(() => scatter({ count: Math.round(70 * k), seed: 65, minX: 3, maxX: 25, scale: [0.4, 0.9], pad: -2, variants: 5 }), [k])

  const palmItems = useMemo(() => scatter({ count: Math.round(110 * k), seed: 40, minX: 12, maxX: 60, scale: [2.6, 3.6], pad: 4, extra: (r) => ({ tilt: 0, sy: 1.6 + r() * 0.6 }) }), [k])
  const heliItems = useMemo(() => {
    const base = scatter({ count: Math.round(220 * k), seed: 50, minX: 2.8, maxX: 14, scale: [1.4, 2.5], pad: -2 })
    const r = rng(51)
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? -1 : 1
      const x = side * (2.4 + r() * 4.5)
      const z = 4 + r() * 20
      base.push({ x, z, y: heightAt(x, z), s: 1.7 + r() * 1.4, rot: r() * 6.28, tint: 1 })
    }
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      const rad = 4.2 + r() * 3
      const x = CENTERS.c3.x + Math.cos(a) * rad
      const z = CENTERS.c3.z + Math.sin(a) * rad
      if (z > CENTERS.c3.z + 3 && Math.abs(x) < 3) continue
      base.push({ x, z, y: heightAt(x, z), s: 1.3 + r() * 1.2, rot: r() * 6.28, tint: 1 })
    }
    return base
  }, [k])
  const orchidItems = useMemo(() => {
    const base = scatter({ count: Math.round(160 * k), seed: 70, minX: 2, maxX: 9, scale: [1.6, 2.6], pad: -3 })
    const r = rng(71)
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2
      const rad = 3.2 + r() * 3.5
      const x = CENTERS.c3.x + Math.cos(a) * rad
      const z = CENTERS.c3.z + Math.sin(a) * rad
      base.push({ x, z, y: heightAt(x, z), s: 2 + r() * 1.5, rot: r() * 6.28, tint: 1 })
    }
    return base
  }, [k])

  const wildItems = useMemo(() => {
    const r = rng(77)
    const out = []
    const add = (cx, cz, rad, n, rx = 1) => {
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r()) * rad
        const x = cx + Math.cos(a) * d * rx
        const z = cz + Math.sin(a) * d
        if (Math.abs(x) < 1.2) continue
        out.push({ x, z, y: heightAt(x, z) - 0.02, s: 1.4 + r() * 1.2, rot: r() * 6.28, tint: 1, v: Math.floor(r() * 4) })
      }
    }
    add(0, 14, 12, Math.round(260 * k), 0.8)
    add(CENTERS.c3.x, CENTERS.c3.z, 9, Math.round(140 * k))
    add(CENTERS.c1.x, CENTERS.c1.z + 6, 12, Math.round(120 * k))
    return out
  }, [k])
  const gazItems = useMemo(() => wildItems.filter((_, i) => i % 2).map((it) => ({ ...it, v: it.v % 2, s: it.s * 0.5 })), [wildItems])
  const periItems = useMemo(() => wildItems.filter((_, i) => i % 2 === 0), [wildItems])

  useFrame((_, dt) => {
    wind.value += dt
  })

  return (
    <group>
      <Terrain />
      <ChunkedInstances variants={gazania} items={gazItems} windStrength={0.3} castShadow={false} />
      <ChunkedInstances variants={periwinkle} items={periItems} windStrength={0.3} castShadow={false} />
      <ChunkedInstances variants={tree} items={treeItems} windStrength={0.004} />
      <ChunkedInstances variants={fern} items={fernItems} windStrength={0.2} castShadow={false} />
      <ChunkedInstances variants={anthurium} items={anthItems} windStrength={0.15} castShadow={false} />
      <ChunkedInstances variants={calathea} items={calItems} windStrength={0.15} castShadow={false} />
      <ChunkedInstances variants={boulder} items={boulderItems} windStrength={0} />
      <ChunkedInstances variants={rocks} items={rockItems} windStrength={0} castShadow={false} />
      <ChunkedInstances variants={palm} items={palmItems} windStrength={0.004} />
      <ProcInstances geometry={heli} items={heliItems} windStrength={0.05} roughness={0.5} />
    </group>
  )
}

/** Neblina baja que deriva entre los árboles y nubes que la cámara atraviesa. */
export function Mist() {
  const tex = useMemo(() => softTexture(), [])
  const group = useRef()
  const items = useMemo(() => {
    const r = rng(90)
    const arr = []
    const n = isMobile ? 40 : 80
    for (let i = 0; i < n; i++) {
      const z = Z_NEAR - 20 - r() * (Z_NEAR - Z_FAR - 20)
      const x = (r() - 0.5) * 70
      arr.push({ x, z, y: heightAt(x, z) + 1 + r() * 3, s: 14 + r() * 16, o: 0.05 + r() * 0.07, sp: 0.2 + r() * 0.4, low: true })
    }
    // capa de nubes entre la selva y la vista aérea
    for (let i = 0; i < (isMobile ? 40 : 70); i++) {
      arr.push({ x: (r() - 0.5) * 160, z: -340 - r() * 150, y: 20 + r() * 30, s: 40 + r() * 50, o: 0.22 + r() * 0.25, sp: 0.4, low: false })
    }
    // jirones de nube alrededor del mapa
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      arr.push({ x: Math.cos(a) * 52, z: -520 + Math.sin(a) * 60, y: 6 + r() * 8, s: 30 + r() * 30, o: 0.55, sp: 0.1, low: false })
    }
    return arr
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    group.current.children.forEach((s, i) => {
      const it = items[i]
      s.position.x = it.x + Math.sin(t * 0.05 * it.sp + i) * 4
    })
  })
  return (
    <group ref={group}>
      {items.map((it, i) => (
        <sprite key={i} position={[it.x, it.y, it.z]} scale={[it.s, it.s * (it.low ? 0.45 : 0.6), 1]}>
          <spriteMaterial map={tex} transparent opacity={it.o} depthWrite={false} color={it.low ? '#f4f1e4' : '#ffffff'} />
        </sprite>
      ))}
    </group>
  )
}

const shaftVert = /* glsl */ `
varying float vLen; varying float vRim;
void main(){
  vLen = uv.y;
  vec4 wp = modelMatrix * vec4(position,1.0);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vec3 v = normalize(cameraPosition - wp.xyz);
  vRim = abs(dot(n, v));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const shaftFrag = /* glsl */ `
uniform float uOpacity; uniform vec3 uColor;
varying float vLen; varying float vRim;
void main(){
  float a = smoothstep(0.0, 0.25, vLen) * smoothstep(1.0, 0.55, vLen) * pow(vRim, 2.5) * uOpacity;
  gl_FragColor = vec4(uColor * a, a);
}`

/** Rayos de sol entre los árboles (conos aditivos alineados con el sol). */
export function LightShafts() {
  const groups = useMemo(() => {
    const r = rng(101)
    const mk = (cx, cz, n, spread) =>
      Array.from({ length: n }, () => ({
        x: cx + (r() - 0.5) * spread,
        z: cz + (r() - 0.5) * spread * 1.4,
        w: 0.5 + r() * 1.4,
        o: 0.1 + r() * 0.12,
      }))
    return [
      { sec: 'hero', items: mk(0, -14, isMobile ? 6 : 11, 26) },
      { sec: 'c4', items: mk(0, -312, isMobile ? 6 : 12, 22) },
      { sec: 'c1', items: mk(0, -80, 5, 22) },
    ]
  }, [])
  const mats = useRef([])
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), SUN_DIR), [])
  useFrame(() => {
    groups.forEach((g, gi) => {
      const s = scroll.sections[g.sec]
      let vis = 1
      if (s) {
        const span = s.end - s.start
        vis = range(scroll.progress, s.start - span * 0.8, s.start) * (1 - range(scroll.progress, s.end, s.end + span * 0.8))
        if (g.sec === 'hero') vis = 1 - range(scroll.progress, s.end, s.end + 0.05)
      }
      const m = mats.current[gi]
      if (m) m.uniforms.uOpacity.value = vis
    })
  })
  return groups.map((g, gi) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: shaftVert,
      fragmentShader: shaftFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 1 }, uColor: { value: new THREE.Color('#ffe6b8').multiplyScalar(0.7) } },
    })
    mats.current[gi] = mat
    return (
      <group key={gi}>
        {g.items.map((it, i) => (
          <mesh
            key={i}
            position={[it.x, heightAt(it.x, it.z) + 14, it.z]}
            quaternion={quat}
            material={mat}
            scale={[it.w, 1, it.w]}
          >
            <cylinderGeometry args={[0.7, 2.2, 34, 14, 1, true]} />
          </mesh>
        ))}
      </group>
    )
  })
}
