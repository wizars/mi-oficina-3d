// ============================================================
//  Registro de juegos — fuente única de la verdad.
//
//  Para añadir un juego nuevo:
//    1. Crea su carpeta en games/<id>/ con su propio index.html.
//    2. Añade una entrada a este array.
//  El menú (menu.js) se regenera solo a partir de aquí.
// ============================================================

/**
 * @typedef {Object} Game
 * @property {string} id        Identificador y nombre de carpeta en games/.
 * @property {string} title     Título visible.
 * @property {string} emoji     Icono de portada (emoji).
 * @property {string} tagline   Frase corta bajo el título.
 * @property {string} description  Descripción algo más larga (en la tarjeta).
 * @property {string} path      Ruta a la página del juego (relativa a la raíz).
 * @property {string} accent    Color de acento (CSS) de la tarjeta.
 * @property {string[]} tags    Etiquetas cortas (p. ej. "Móvil", "Arcade").
 */

/** @type {Game[]} */
export const GAMES = [
  {
    id: 'oficina',
    title: 'Mi Oficina 3D',
    emoji: '🏢',
    tagline: 'Paseo en 1ª persona por la oficina escaneada',
    description:
      'Recreación 3D de la oficina escaneada con LiDAR, por la que deambulan ' +
      'monigotes estilo Minecraft con las caras de los compañeros.',
    path: 'games/oficina/',
    accent: '#3b82f6',
    tags: ['1ª persona', 'Three.js'],
  },
  {
    id: 'autopista',
    title: 'Autopista Infinita',
    emoji: '🏎️',
    tagline: 'Racer arcade infinito — roza, encadena combos, sobrevive',
    description:
      'Curvas, rasantes, túneles y ciclo día/noche. Roza el tráfico para ' +
      'encadenar combos y elige a tu piloto. Jugable también en móvil.',
    path: 'games/autopista/',
    accent: '#ffd23f',
    tags: ['Arcade', 'Móvil'],
  },
];
