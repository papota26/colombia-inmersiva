import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CENTERS } from '../path'
import { heightAt } from '../World'
import { timeline } from '../../content'
import { local, range } from '../../state'
import { RoseField } from './Rose'
import { pbr } from '../assets'

// cuero escaneado teñido de verde para las tapas
const leather = new THREE.MeshStandardMaterial({ ...pbr('brown_leather', 2), color: '#3d7a58' })

const W = 3 // ancho de página
const H = 4 // alto de página
const SEG = 24
const N = timeline.length
const C = CENTERS.c3

// ---------- texturas de página dibujadas en canvas ----------
const PAPER = '#f3ecda'
const INK = '#1d3226'

function paper(ctx, w, h) {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, w, h)
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(120,90,40,0.18)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ')
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y)
      line = w
      y += lh
    } else line = test
  }
  ctx.fillText(line, x, y)
}

function drawYear(ctx, w, h, ev) {
  paper(ctx, w, h)
  ctx.fillStyle = ev.kind === 'Ruptura' ? '#9b3f22' : '#0e6b53'
  ctx.font = '500 34px "Hanken Grotesk", sans-serif'
  ctx.fillText(ev.kind, 56, 92)
  ctx.fillStyle = INK
  ctx.font = '230px Marcellus, serif'
  ctx.fillText(ev.year, 40, 330)
  ctx.fillStyle = '#d4a12a'
  ctx.fillRect(56, 372, 120, 6)
  ctx.fillStyle = INK
  ctx.font = '54px Marcellus, serif'
  wrap(ctx, ev.title, 56, 462, w - 112, 66)
}

function drawText(ctx, w, h, ev) {
  paper(ctx, w, h)
  ctx.fillStyle = INK
  ctx.font = '400 36px "Hanken Grotesk", sans-serif'
  wrap(ctx, ev.text, 56, 120, w - 112, 54)
  ctx.fillStyle = 'rgba(29,50,38,0.5)'
  ctx.font = '30px Marcellus, serif'
  ctx.fillText(ev.year, w - 150, h - 60)
}

function drawCover(ctx, w, h) {
  ctx.fillStyle = '#17402d'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#d4a12a'
  ctx.lineWidth = 6
  ctx.strokeRect(36, 36, w - 72, h - 72)
  ctx.lineWidth = 2
  ctx.strokeRect(52, 52, w - 104, h - 104)
  ctx.fillStyle = '#e2bb52'
  ctx.textAlign = 'center'
  ctx.font = '60px Marcellus, serif'
  ctx.fillText('Constitución', w / 2, h / 2 - 40)
  ctx.fillText('Política', w / 2, h / 2 + 34)
  ctx.font = '38px Marcellus, serif'
  ctx.fillText('de Colombia', w / 2, h / 2 + 100)
  ctx.textAlign = 'left'
}

function makeTex(draw, mirror = false) {
  const c = document.createElement('canvas')
  c.width = 768
  c.height = 1024
  const ctx = c.getContext('2d')
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  if (mirror) {
    tex.wrapS = THREE.RepeatWrapping
    tex.repeat.x = -1
    tex.offset.x = 1
  }
  const redraw = () => {
    draw(ctx, c.width, c.height)
    tex.needsUpdate = true
  }
  redraw()
  return { tex, redraw }
}

/** Geometría de hoja: tira de SEG segmentos a lo largo de u (0..W), z de -H/2 a H/2. */
function leafGeometry() {
  const g = new THREE.BufferGeometry()
  const pos = new Float32Array((SEG + 1) * 2 * 3)
  const uv = new Float32Array((SEG + 1) * 2 * 2)
  const idx = []
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG
    for (let j = 0; j < 2; j++) {
      const k = i * 2 + j
      pos.set([u * W, 0, j ? H / 2 : -H / 2], k * 3)
      uv.set([u, j ? 0 : 1], k * 2)
    }
    if (i < SEG) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Curva la hoja: el borde exterior se retrasa respecto al lomo mientras gira. */
function bendLeaf(geo, theta) {
  const p = geo.attributes.position
  const lag = Math.sin(theta) * 0.55
  for (let i = 0; i <= SEG; i++) {
    const u = (i / SEG) * W
    const th = theta - lag * (i / SEG) * (theta < Math.PI / 2 ? -1 : 1) * 0.6
    const x = Math.cos(th) * u
    const y = Math.sin(th) * u
    p.setXY(i * 2, x, y)
    p.setXY(i * 2 + 1, x, y)
  }
  p.needsUpdate = true
  geo.computeVertexNormals()
}

export function Book() {
  const root = useRef()
  const cover = useRef()
  const leaves = useRef([])

  // Hoja i: frente = texto del evento i; reverso = año del evento i+1.
  const textures = useMemo(() => {
    const fronts = timeline.map((ev) => makeTex((c, w, h) => drawText(c, w, h, ev)))
    const backs = timeline.map((ev, i) => makeTex((c, w, h) => (timeline[i + 1] ? drawYear(c, w, h, timeline[i + 1]) : paper(c, w, h)), true))
    const coverOut = makeTex(drawCover)
    const coverIn = makeTex((c, w, h) => drawYear(c, w, h, timeline[0]), true)
    return { fronts, backs, coverOut, coverIn }
  }, [])

  useEffect(() => {
    // redibuja cuando cargan las fuentes web
    document.fonts?.ready.then(() => {
      const all = [...textures.fronts, ...textures.backs, textures.coverOut, textures.coverIn]
      all.forEach((t) => t.redraw())
    })
  }, [textures])

  const leafData = useMemo(
    () =>
      timeline.map((_, i) => {
        const geo = leafGeometry()
        return {
          geo,
          front: new THREE.MeshStandardMaterial({ map: textures.fronts[i].tex, roughness: 0.9, side: THREE.FrontSide }),
          back: new THREE.MeshStandardMaterial({ map: textures.backs[i].tex, roughness: 0.9, side: THREE.BackSide }),
        }
      }),
    [textures],
  )
  const coverGeo = useMemo(() => leafGeometry(), [])
  const coverMats = useMemo(
    () => ({
      out: new THREE.MeshStandardMaterial({ map: textures.coverOut.tex, normalMap: pbr('brown_leather', 2).normalMap, roughness: 0.55, side: THREE.FrontSide }),
      inner: new THREE.MeshStandardMaterial({ map: textures.coverIn.tex, roughness: 0.9, side: THREE.BackSide }),
    }),
    [textures],
  )

  const base = heightAt(C.x, C.z) + 0.55

  useFrame(() => {
    const l = local('c3')
    const tl = local('c3tl')
    // el libro emerge entre las flores
    const rise = range(l, -0.12, 0.06)
    root.current.position.y = base - 2.4 * (1 - rise)
    root.current.rotation.y = (1 - rise) * 0.6

    // la tapa se abre y deja ver el primer año (tapa: el exterior mira hacia abajo al abrir)
    const open = range(l, 0.03, 0.1)
    bendLeaf(coverGeo, open * Math.PI)
    cover.current.position.y = THREE.MathUtils.lerp(0.1 + (N + 1) * 0.012, 0.055, open)

    leafData.forEach((d, i) => {
      const f = i < N - 1 ? range(tl, (i + 1) / N - 0.075, (i + 1) / N + 0.005) : 0
      const theta = f * Math.PI
      bendLeaf(d.geo, theta)
      const g = leaves.current[i]
      if (g) g.position.y = THREE.MathUtils.lerp(0.1 + (N - i) * 0.012, 0.07 + i * 0.012, f) + Math.sin(theta) * 0.02
    })
  })

  return (
    <group position={[C.x, 0, C.z]}>
      <group ref={root}>
        {/* tapa posterior y lomo */}
        <mesh position={[W / 2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[W + 0.18, 0.1, H + 0.3]} />
          <primitive object={leather} attach="material" />
        </mesh>
        <mesh position={[-W / 2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[W + 0.18, 0.1, H + 0.3]} />
          <primitive object={leather} attach="material" />
        </mesh>
        {/* bloque de papel bajo las hojas */}
        <mesh position={[W / 2 - 0.02, 0.06, 0]} receiveShadow>
          <boxGeometry args={[W - 0.05, 0.06, H - 0.02]} />
          <meshStandardMaterial color="#e9e0c8" roughness={1} />
        </mesh>
        {leafData.map((d, i) => (
          <group key={i} ref={(el) => (leaves.current[i] = el)}>
            <mesh geometry={d.geo} material={d.front} castShadow receiveShadow />
            <mesh geometry={d.geo} material={d.back} />
          </group>
        ))}
        {/* tapa delantera (exterior verde con letras doradas; interior con el año 1886) */}
        <group ref={cover}>
          <mesh geometry={coverGeo} material={coverMats.out} castShadow />
          <mesh geometry={coverGeo} material={coverMats.inner} />
        </group>
      </group>
      {/* rosas grandes que florecen alrededor del libro */}
      <RoseField
        detail="hi"
        items={[
          [-4.0, -1.6, 1.25, '#d10f2f', 0],
          [4.4, -2.4, 1.4, '#ff3d8b', -0.08],
          [-3.3, 2.5, 1.0, '#ffb000', 0.05],
          [3.7, 2.3, 1.1, '#fff1ec', -0.04],
          [0.6, -4.6, 1.5, '#c4005e', 0.02],
        ].map(([x, z, sc, color, offset]) => ({ x, y: heightAt(C.x + x, C.z + z) - 0.03, z, s: sc, rot: x, tilt: 0.25, color, offset }))}
        getOpen={() => range(local('c3'), -0.1, 0.14)}
      />
    </group>
  )
}
