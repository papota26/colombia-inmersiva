# Colombia Inmersiva — plan de diseño

Plan escrito con la skill `frontend-design` (anthropics/skills) **antes** de programar:
primero tokens y principios, luego revisión contra el brief, luego código, luego crítica con capturas.

## Sujeto, público y trabajo principal
- **Sujeto:** la política, el Estado y la democracia colombiana contados a través del paisaje.
- **Público:** estudiantes de colegio y universidad (16–25 años) y ciudadanía curiosa.
- **Trabajo de la página:** que se aprendan cinco preguntas de formación ciudadana sin sentir que se lee un documento.

## Color (6 tokens)
| Token | Hex | Uso |
|---|---|---|
| `--selva` | `#12382A` | fondos de texto, velos sobre la escena |
| `--esmeralda` | `#0E7C61` | estados activos, derechos fundamentales |
| `--oro` | `#D4A12A` | progreso, balanza, foco del teclado |
| `--terracota` | `#B4532F` | tejas coloniales, derechos sociales |
| `--azul` | `#14365F` | agua, cielo alto, participación |
| `--marfil` | `#F2ECDD` | texto principal y fichas |

El color fuerte lo pone la escena 3D (guacamaya, heliconias). La interfaz se queda en tonos de selva y marfil para no competir.

## Tipografía
- **Marcellus**: titulares. Es una romana de inscripción, como las letras talladas en la piedra del Capitolio y de las iglesias coloniales. Sirve para la tipografía monumental del brief.
- **Hanken Grotesk**: texto corrido, botones y fichas. Es neutra y muy legible sobre imagen.
- Escala de 1.333 (cuarta justa): 14 · 16 · 18 · 21 · 28 · 38 · 50 · 67 · clamp hasta 180 px en portada.

## Maquetación
```
┌───────────────────────── barra de progreso (oro, 2px) ─────────┐
│ Colombia Inmersiva                                    Capítulos │
│                                                             ·1 │
│   [texto alineado a la izquierda,      ESCENA 3D FIJA       ·2 │
│    máx. 34rem, velo selva              (cámara de cine)     ·3 │
│    degradado a la izquierda]                                ·4 │
│                                                             ·5 │
└─────────────────────────────────────────────────────────────────┘
```
- La escena 3D es **una sola** y continua: la cámara viaja por un mundo de unos 600 m. No hay cortes, solo trayectos.
- El texto pasa por encima en "pasos" de una pantalla. El texto va alineado a la izquierda y el objeto 3D queda a la derecha del encuadre.
- En móvil el texto baja al tercio inferior y el objeto sube.

## Principios
1. **La naturaleza conduce.** La guacamaya es el hilo: abre la película y guía cada trayecto.
2. **Un objeto memorable por capítulo** (balanza, ciudad que crece, libro, mariposa, mapa). Lo demás se mantiene quieto y sobrio.
3. **Fichas de herbario** para lo interactivo. Remiten a la Real Expedición Botánica de Mutis: papel marfil, pestaña de color por categoría y nombre en romana. Sustituyen a las tarjetas SaaS redondeadas y genéricas.
4. **Luz de documental:** sol bajo, neblina y sombras suaves. Nada de neón ni de hologramas.

## Revisión del plan contra el brief (paso obligatorio de la skill)
- *Primer borrador:* fondo crema con serif de alto contraste y acento terracota. Es el rasgo nº 1 de "página hecha por IA" que lista la skill. **Cambio:** el fondo es la escena y la terracota se usa solo como categoría de derechos y en las tejas.
- *Primer borrador:* tarjetas idénticas con sombra gris para los derechos. **Cambio:** fichas de herbario con pestaña de color.
- *Primer borrador:* etiquetas en MAYÚSCULAS espaciadas sobre cada título. **Cambio:** solo "Capítulo 0X", porque los capítulos sí son una secuencia. Las mayúsculas quedan para COLOMBIA INMERSIVA, que pide el brief.
- *Animación:* el brief pide entradas animadas. Hay una sola orquestación fuerte (la portada) y titulares con revelado por máscara. Los párrafos solo aparecen, sin "fade-up" en cada tarjeta.

## Base de calidad
Diseño adaptable hasta 360 px, foco visible con el teclado, respeto a `prefers-reduced-motion`, contraste AA sobre los velos y menos geometría y posproceso en móvil.
