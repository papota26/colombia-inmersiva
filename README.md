# Colombia Inmersiva 3D

Experiencia web educativa de *scrollytelling* 3D sobre la política, el Estado y la democracia colombiana.
Una guacamaya guía a la persona por cinco escenarios conectados en un único mundo tridimensional.

## Cómo ejecutarla

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173
npm run build      # versión de producción en dist/
npm run preview    # sirve dist/ para probarla
```

La carpeta `dist/` se puede publicar tal cual en Netlify, Vercel, GitHub Pages o cualquier hosting estático.

## Stack

| Pieza | Para qué |
|---|---|
| **Three.js + React Three Fiber** | Escena 3D, modelos, luces y sombras |
| **@react-three/drei** | Carga glTF, entorno de reflejos, etiquetas HTML en 3D |
| **@react-three/postprocessing** | Profundidad de campo, *bloom*, viñeta, grano de película y tono ACES |
| **GSAP + ScrollTrigger + SplitText** | Tipografía monumental animada y sincronización con el scroll |
| **Lenis** | Desplazamiento suave, sincronizado con ScrollTrigger |

## Cómo está organizada

```
src/
  content.js          todo el texto educativo (fácil de editar)
  state.js            progreso del scroll compartido entre DOM y 3D
  App.jsx             orden de secciones, Lenis y navegación
  ui/                 portada, capítulos, línea de tiempo, fichas de derechos
  three/
    path.js           trayectoria de la cámara (fotogramas clave por sección)
    Atmosphere.jsx    cielo, niebla y sol que cambian por capítulo
    World.jsx         terreno, vegetación instanciada con viento, neblina, rayos de sol
    Macaw.jsx         guacamaya (modelo glTF animado) que guía el recorrido
    scenes/           balanza, ciudad que crece, orquídea, libro, mariposa, mapa
```

Para cambiar textos, edita solo `src/content.js`. Para mover la cámara, edita `KEYS` en `src/three/path.js`.

## Recursos fotorrealistas (CC0, Poly Haven)

| Recurso | Archivo | Uso |
|---|---|---|
| Cielo HDRI `kloofendal_48d_partly_cloudy_puresky` | `public/textures/sky_2k.hdr` | Cielo, iluminación global y reflejos; el sol se detecta en la imagen y la luz direccional se alinea con él |
| Árbol `island_tree_02` (escaneado, reducido de 1 M a 16 mil triángulos) | `public/models/nature/tree_lo.glb` | Bosque instanciado |
| Helecho, anturio, calathea, roca y piedras con musgo | `public/models/nature/*.glb` | Sotobosque y rocas |
| Texturas PBR: `leafy_grass`, `forrest_ground_01`, `rock_face`, `marble_01`, `white_plaster_rough_01`, `clay_roof_tiles`, `cobblestone_floor_01`, `concrete_wall_008`, `brown_leather` | `public/textures/*.webp` | Terreno (mezcla de 3 materiales), pórtico, ciudad colonial, institución, libro y relieve del mapa |

Personas: 15 avatares de [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) (licencia MIT), convertidos de FBX a glTF con FBX2glTF y animados con su captura de movimiento de respiración en reposo.
Pasto: briznas instanciadas por GPU con viento.

Los modelos se optimizaron con `gltf-transform` (simplificación meshopt, texturas WebP de 512–1024 px).
Posproceso: oclusión ambiental N8AO, profundidad de campo, *bloom* para el sol, tone mapping PBR Neutral y SMAA.

## Qué es modelo 3D real y qué es procedural (sin simulaciones)

- **Guacamaya:** modelo glTF real con animación de aleteo por *morph targets*. Es el modelo "Parrot" de mirada.com para ro.me, distribuido con los ejemplos de three.js. Sus colores son los de una guacamaya roja, no los de la guacamaya azul y amarilla.
- **Escaneados reales:** árboles, helechos, anturios, calatheas y rocas (Poly Haven).
- **Generado por código** porque no existe una versión escaneada con licencia libre: palmas de cera, heliconias, orquídeas Cattleya, mariposas morfo, figuras de ciudadanos y la arquitectura. La arquitectura usa materiales PBR escaneados (mármol, yeso, tejas, concreto).
- **Mapa:** el contorno viene de datos reales (Natural Earth vía world.geo.json). Las cordilleras, los ríos y las ciudades están **aproximados** a mano para la visualización y no tienen precisión cartográfica.

### Para subir aún más la calidad visual
El estilo actual es naturalista y estilizado. Para llegar a un fotorrealismo de documental, cambia la geometría procedural por modelos glTF escaneados (Sketchfab, Poly Haven, Quixel), comprimidos con `gltf-transform` (Draco/Meshopt y texturas KTX2). La arquitectura ya los admite: basta con `useGLTF` dentro de cada escena.

## Sobre Canva

Canva **no puede** ejecutar nada de esto: no admite Three.js, WebGL personalizado, GSAP ScrollTrigger, Lenis ni código JavaScript propio. Necesitan código externo:

- toda la escena 3D y la cámara ligada al scroll;
- la guacamaya animada, el libro que pasa páginas y la ciudad que crece;
- la línea de tiempo sincronizada con el libro;
- las fichas interactivas de derechos y mecanismos;
- la tipografía con animación de entrada por letras.

Si se necesita una versión en Canva, lo viable es exportar vídeos o capturas de esta experiencia e insertarlos allí. También se puede enlazar desde Canva a esta web publicada.

## Accesibilidad y rendimiento

- `prefers-reduced-motion`: desactiva el scroll suave, el movimiento de cámara en mano y las animaciones de texto.
- Navegación por teclado con foco visible y menú que se cierra con Escape. El canvas es decorativo (`aria-hidden`) y todo el contenido está en HTML real.
- En móvil hay un 60 % menos de vegetación, sombras de menor resolución, posproceso reducido y un campo de visión más amplio.
- `PerformanceMonitor` baja la calidad automáticamente si el equipo no mantiene la fluidez.
- Los escenarios lejanos se ocultan según la distancia de la cámara (carga progresiva).

## Skills de diseño usadas

Ver `DESIGN.md`. El plan de diseño se escribió con la skill **frontend-design** de `anthropics/skills`, instalada en `.claude/skills/`, y se revisó con capturas en un navegador real.
