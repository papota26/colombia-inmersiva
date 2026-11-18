import * as THREE from 'three'
import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { isMobile } from '../state'

// Recursos CC0 de Poly Haven (polyhaven.com): HDRI, texturas PBR y plantas fotoescaneadas.
const BASE = import.meta.env.BASE_URL
// en celulares se usan texturas más ligeras (menos memoria gráfica y descarga)
const M = isMobile ? '_m' : ''
export const url = (p) => `${BASE}${p}`

/* ------------------------------------------------------------------ */
/* Cielo HDRI                                                          */
/* ------------------------------------------------------------------ */

/**
 * Carga el HDRI y averigua la dirección del sol (píxel más brillante) y el
 * color medio del horizonte, para alinear la luz direccional y la niebla.
 */
export function useSky() {
  const tex = useLoader(HDRLoader, url('textures/sky_2k.hdr'))
  return useMemo(() => {
    tex.mapping = THREE.EquirectangularReflectionMapping
    const { data, width: W, height: H } = tex.image
    const half = data instanceof Uint16Array
    const read = (i) => (half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i])
    const ch = data.length / (W * H)
    let best = -1
    let br = 0
    let bc = 0
    const hor = new THREE.Color(0, 0, 0)
    let hn = 0
    for (let r = 0; r < H; r += 2) {
      for (let c = 0; c < W; c += 2) {
        const i = (r * W + c) * ch
        const l = read(i) * 0.2126 + read(i + 1) * 0.7152 + read(i + 2) * 0.0722
        if (l > best) {
          best = l
          br = r
          bc = c
        }
        // franja justo por encima del horizonte
        const v = 1 - (r + 0.5) / H
        if (v > 0.5 && v < 0.54) {
          hor.r += read(i)
          hor.g += read(i + 1)
          hor.b += read(i + 2)
          hn++
        }
      }
    }
    hor.multiplyScalar(1 / Math.max(1, hn))
    const u = (bc + 0.5) / W
    const v = 1 - (br + 0.5) / H
    const az = (u - 0.5) * Math.PI * 2
    const el = (v - 0.5) * Math.PI
    return { tex, sunAzimuth: az, sunElevation: el, horizon: hor }
  }, [tex])
}

/* ------------------------------------------------------------------ */
/* Texturas PBR (difusa, normal, ARM = oclusión/rugosidad/metal)       */
/* ------------------------------------------------------------------ */

const loader = new THREE.TextureLoader()
const cache = new Map()

/** Conjunto PBR listo para MeshStandardMaterial. `repeat` en repeticiones por unidad de UV. */
export function pbr(name, repeat = 1, { color = true } = {}) {
  const key = `${name}:${repeat}`
  if (cache.has(key)) return cache.get(key)
  const mk = (suffix, srgb) => {
    const t = loader.load(url(`textures/${name}_${suffix}${M}.webp`))
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat, repeat)
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const arm = mk('arm', false)
  const set = {
    map: color ? mk('diff', true) : undefined,
    normalMap: mk('nor', false),
    roughnessMap: arm,
    aoMap: arm,
    aoMapIntensity: 0.9,
  }
  cache.set(key, set)
  return set
}

/** Carga varias texturas PBR con useLoader (cuentan para la barra de carga). */
export function usePBRTextures(names) {
  const files = names.flatMap((n) => [`textures/${n}_diff${M}.webp`, `textures/${n}_nor${M}.webp`, `textures/${n}_arm${M}.webp`]).map(url)
  const texs = useLoader(THREE.TextureLoader, files)
  return useMemo(() => {
    const out = {}
    names.forEach((n, i) => {
      const [d, nr, a] = texs.slice(i * 3, i * 3 + 3)
      d.colorSpace = THREE.SRGBColorSpace
      for (const t of [d, nr, a]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.anisotropy = 8
      }
      out[n] = { map: d, normalMap: nr, roughnessMap: a, aoMap: a }
    })
    return out
  }, [texs, names])
}

/** Copia de un conjunto PBR con otra repetición (las texturas comparten imagen). */
export function withRepeat(set, rx, ry = rx) {
  const o = {}
  for (const [k, t] of Object.entries(set)) {
    if (t?.isTexture) {
      const c = t.clone()
      c.repeat.set(rx, ry)
      c.needsUpdate = true
      o[k] = c
    }
  }
  return o
}

/* ------------------------------------------------------------------ */
/* Plantas fotoescaneadas                                              */
/* ------------------------------------------------------------------ */

/**
 * Los archivos de Poly Haven traen varias variantes de una planta alineadas en X
 * dentro de una sola malla. Esta función las separa (por los huecos más grandes
 * entre triángulos) y devuelve cada variante centrada, con la base en y = 0.
 */
function splitVariants(parts, count) {
  // centroides X de todos los triángulos de todas las piezas
  const xs = []
  for (const p of parts) {
    const pos = p.geometry.attributes.position
    const idx = p.geometry.index
    const n = idx ? idx.count / 3 : pos.count / 3
    for (let t = 0; t < n; t += 7) {
      const a = idx ? idx.getX(t * 3) : t * 3
      xs.push(pos.getX(a))
    }
  }
  xs.sort((a, b) => a - b)
  const gaps = []
  for (let i = 1; i < xs.length; i++) gaps.push([xs[i] - xs[i - 1], (xs[i] + xs[i - 1]) / 2])
  gaps.sort((a, b) => b[0] - a[0])
  const cuts = gaps.slice(0, count - 1).map((g) => g[1]).sort((a, b) => a - b)
  const bucket = (x) => cuts.filter((c) => x > c).length

  const variants = Array.from({ length: count }, () => [])
  for (const p of parts) {
    const g = p.geometry
    const pos = g.attributes.position
    const idx = g.index
    const per = Array.from({ length: count }, () => [])
    const n = idx.count / 3
    for (let t = 0; t < n; t++) {
      const a = idx.getX(t * 3)
      const b = idx.getX(t * 3 + 1)
      const c = idx.getX(t * 3 + 2)
      const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3
      per[bucket(cx)].push(a, b, c)
    }
    per.forEach((tris, vi) => {
      if (!tris.length) return
      const sub = g.clone()
      sub.setIndex(tris)
      variants[vi].push({ geometry: sub, material: p.material })
    })
  }
  // centrar cada variante y apoyarla en el suelo
  return variants
    .filter((v) => v.length)
    .map((v) => {
      const box = new THREE.Box3()
      v.forEach((p) => {
        p.geometry.computeBoundingBox()
        box.union(p.geometry.boundingBox)
      })
      const c = box.getCenter(new THREE.Vector3())
      return v.map((p) => {
        const g = p.geometry.clone()
        g.translate(-c.x, -box.min.y, -c.z)
        g.computeBoundingSphere()
        return { geometry: g, material: p.material, height: box.max.y - box.min.y }
      })
    })
}

/** Convierte atributos cuantizados (meshopt / KHR_mesh_quantization) a Float32. */
function dequantize(g) {
  for (const name of Object.keys(g.attributes)) {
    const at = g.attributes[name]
    if (at.isInterleavedBufferAttribute || at.normalized || !(at.array instanceof Float32Array)) {
      const n = at.count
      const size = at.itemSize
      const arr = new Float32Array(n * size)
      for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) arr[i * size + k] = at.getComponent(i, k)
      g.setAttribute(name, new THREE.BufferAttribute(arr, size))
    }
  }
  return g
}

/** Ajusta materiales escaneados: hojas con recorte alfa (sin problemas de orden) y doble cara. */
function prepMaterial(m, tint) {
  const mat = m.clone()
  const isLeaf = /leaf|leaves/i.test(m.name) || m.transparent || m.alphaTest > 0
  const c = isLeaf ? tint.leaf : tint.bark
  if (c) mat.color.set(c)
  if (mat.transparent || mat.alphaMap || mat.map) {
    mat.transparent = false
    mat.alphaTest = 0.45
    mat.depthWrite = true
  }
  mat.side = THREE.DoubleSide
  mat.envMapIntensity = 0.9
  return mat
}

/** Devuelve las variantes de un modelo de planta: [[{geometry, material}], ...]. */
export function usePlant(name, variants = 1, tint = {}) {
  const gltf = useGLTF(url(`models/nature/${name}.glb`))
  return useMemo(() => {
    gltf.scene.updateMatrixWorld(true)
    const parts = []
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        const g = dequantize(o.geometry.clone())
        g.applyMatrix4(o.matrixWorld) // hornea la transformación para instanciar
        if (!g.index) {
          const m = mergeVertices(g)
          parts.push({ geometry: m, material: prepMaterial(o.material, tint) })
        } else parts.push({ geometry: g, material: prepMaterial(o.material, tint) })
      }
    })
    return splitVariants(parts, variants)
  }, [gltf, variants, tint.leaf, tint.bark])
}

for (const n of ['wf_gazania', 'wf_periwinkle', 'palm', 'tree_lo', 'fern', 'anthurium', 'calathea', 'boulder', 'rocks']) useGLTF.preload(url(`models/nature/${n}.glb`))
