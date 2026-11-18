// Textos de la experiencia: cada capítulo responde una pregunta con ideas simples.
// Referencias: Constitución Política de Colombia (1991).

export const chapters = [
  {
    id: 'c1',
    n: '1',
    title: 'Política y Estado',
    question: '¿Cómo interpretar la política y sus repercusiones en el Estado colombiano?',
    steps: [
      { h: 'La política es cómo decidimos juntos', p: 'Es la forma en que una sociedad se organiza para tomar decisiones que afectan a todos. Pasa en el Congreso, pero también cuando una junta de acción comunal decide arreglar la vía del barrio.' },
      { h: 'El Estado convierte esas decisiones en acciones', p: 'El Congreso hace las leyes, el Gobierno las ejecuta y los jueces las hacen cumplir. Además, organismos como la Procuraduría y la Contraloría vigilan que nadie abuse del poder.' },
      { h: 'Y esas decisiones llegan a tu vida', p: 'Una ley decide cuántos colegios se construyen, si se protege un páramo o cuánto cuesta el transporte. Por eso informarse y participar no es un asunto lejano: cambia la vida diaria.' },
    ],
    opinion: 'En mi opinión, la política no es solo cosa de políticos: cada vez que opinamos, votamos o nos organizamos como comunidad también estamos haciendo política.',
  },
  {
    id: 'c2',
    n: '2',
    title: 'Evolución del Estado',
    question: '¿Cómo ha evolucionado el Estado y qué es un Estado constitucional?',
    steps: [
      { h: 'Antes mandaba el rey', p: 'Después mandó la ley: todos, también los gobernantes, deben cumplirla. Eso es un Estado de derecho, y se apoya en la separación de poderes para que ninguno mande solo.' },
      { h: 'Hoy manda la Constitución', p: 'Es la norma más alta del país (artículo 4). Ninguna ley puede ir contra ella, y la Corte Constitucional puede anular las que lo hagan.' },
      { h: 'Colombia es un Estado social de derecho', p: 'Además de cumplir la ley, el Estado debe ayudar a que todas las personas vivan con dignidad. Por eso tiene deberes con la salud, la educación y la reducción de la pobreza.' },
    ],
    opinion: 'Considero que el mayor avance fue pasar de un Estado que solo pone reglas a uno que también debe cuidar a las personas, aunque todavía falta para que eso se cumpla en todo el país.',
  },
  {
    id: 'c3',
    n: '3',
    title: 'Las constituciones',
    question: '¿Qué continuó y qué cambió en las constituciones de Colombia?',
    steps: [],
    opinion: 'Pienso que la Constitución de 1991 fue un cambio profundo porque nació de la presión de los estudiantes y le devolvió el poder a la gente.',
  },
  {
    id: 'c4',
    n: '4',
    title: 'Democracia y derechos',
    question: '¿Qué es la democracia y cuáles son nuestros derechos?',
    steps: [],
    opinion: 'Para mí, conocer nuestros derechos es la primera forma de defenderlos: un derecho que nadie conoce es fácil de vulnerar.',
  },
  {
    id: 'c5',
    n: '5',
    title: 'Participación',
    question: '¿Por qué la Constitución defiende los derechos y la participación?',
    steps: [],
    opinion: 'Creo que participar no termina en el voto: la Constitución nos da las herramientas, pero depende de nosotros usarlas.',
  },
]

export const timeline = [
  { year: '1886', title: 'Un país centralista', text: 'El poder se concentra en Bogotá y en el presidente, que gobierna seis años. La religión católica es la oficial y la soberanía reside en la nación.', kind: 'Origen' },
  { year: '1936', title: 'Primeros derechos sociales', text: 'Con López Pumarejo, la propiedad debe cumplir una función social, el Estado puede intervenir en la economía y se reconoce el derecho a la huelga.', kind: 'Reforma' },
  { year: '1957', title: 'Votan las mujeres', text: 'Por primera vez las mujeres votan en Colombia, en el plebiscito que dio origen al Frente Nacional.', kind: 'Reforma' },
  { year: '1991', title: 'Nueva Constitución', text: 'Tras el movimiento estudiantil de la séptima papeleta, el poder pasa al pueblo, nacen la tutela y la Corte Constitucional y se reconoce la diversidad étnica y cultural.', kind: 'Ruptura' },
]

export const kept = ['Somos una república', 'Hay presidente', 'Hay Congreso y jueces']
export const changed = ['El poder es del pueblo', 'El Estado no tiene religión', 'Existe la tutela', 'Se reconoce la diversidad']

export const principles = [
  ['Participación', 'Puedes votar, opinar y proponer.'],
  ['Igualdad', 'Todos tenemos los mismos derechos.'],
  ['Libertad', 'Puedes pensar y expresarte libremente.'],
  ['Pluralismo', 'Caben todas las culturas e ideas.'],
]

export const rights = {
  fundamentales: {
    label: 'Fundamentales',
    note: 'Los tienes por ser persona. Si te los violan, puedes poner una tutela.',
    cards: [
      ['Vida', 'Nadie puede quitártela.'],
      ['Igualdad', 'Nadie puede discriminarte.'],
      ['Expresión', 'Puedes decir lo que piensas.'],
      ['Debido proceso', 'Te deben escuchar antes de sancionarte.'],
    ],
  },
  desc: {
    label: 'Sociales, económicos y culturales',
    note: 'El Estado debe garantizarlos para que vivas con dignidad.',
    cards: [
      ['Salud', 'Atención médica cuando la necesites.'],
      ['Educación', 'Colegio público gratuito.'],
      ['Vivienda', 'Un lugar digno donde vivir.'],
      ['Cultura', 'Acceso al arte y a las tradiciones.'],
    ],
  },
}

export const mechanisms = [
  ['Voto', 'Eliges a tus gobernantes.'],
  ['Plebiscito', 'Apoyas o rechazas una decisión del presidente.'],
  ['Referendo', 'Apruebas o rechazas una ley.'],
  ['Consulta popular', 'Respondes una pregunta importante para tu región.'],
  ['Cabildo abierto', 'Debates con el concejo los temas de tu barrio.'],
  ['Iniciativa legislativa', 'Propones una ley con firmas.'],
  ['Revocatoria', 'Sacas del cargo a un alcalde o gobernador que incumple.'],
]

export const protection = [
  ['Tutela', 'Protege tus derechos fundamentales en 10 días.'],
  ['Acción popular', 'Protege lo que es de todos, como el ambiente.'],
]
