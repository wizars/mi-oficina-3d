// ============================================================
//  Menú de selección — renderiza una tarjeta por cada juego
//  del registro (games.js). No hay nada cableado a mano: añade
//  un juego al registro y aparece aquí solo.
// ============================================================
import { GAMES } from './games.js';

/**
 * Construye la tarjeta de un juego.
 * @param {import('./games.js').Game} game
 * @returns {HTMLAnchorElement}
 */
function buildCard(game) {
  const card = document.createElement('a');
  card.className = 'card';
  card.href = game.path;
  card.style.setProperty('--accent', game.accent);
  card.setAttribute('aria-label', `Jugar a ${game.title}`);

  const cover = document.createElement('div');
  cover.className = 'cover';
  cover.textContent = game.emoji;
  cover.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'body';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = game.title;

  const tagline = document.createElement('div');
  tagline.className = 'tagline';
  tagline.textContent = game.tagline;

  const desc = document.createElement('p');
  desc.className = 'desc';
  desc.textContent = game.description;

  const tags = document.createElement('div');
  tags.className = 'tags';
  for (const label of game.tags ?? []) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = label;
    tags.appendChild(tag);
  }

  const play = document.createElement('span');
  play.className = 'play';
  play.textContent = '▶ Jugar';

  body.append(title, tagline, desc, tags, play);
  card.append(cover, body);
  return card;
}

const grid = document.getElementById('grid');
if (!grid) throw new Error('menu.js: falta el contenedor #grid en index.html');

if (GAMES.length === 0) {
  const empty = document.createElement('p');
  empty.className = 'empty';
  empty.textContent = 'Todavía no hay juegos disponibles.';
  grid.appendChild(empty);
} else {
  const frag = document.createDocumentFragment();
  for (const game of GAMES) frag.appendChild(buildCard(game));
  grid.appendChild(frag);
}
