# Claude Arcade

Colección de **mini-juegos web** con **Three.js**, **sin build ni dependencias**:
una página de inicio (menú) deja elegir juego y la arquitectura está pensada para
ir añadiendo juegos sin tocar el resto. Se sirve como ficheros estáticos (un
`server.js` mínimo en local, o GitHub Pages).

> Idioma: todo el texto de cara al usuario, los comentarios y los commits van en
> **español** (ver el CLAUDE.md global del usuario).

## Stack y restricciones (no negociables)

- **Sin paso de compilación.** No hay `package.json`, ni bundler, ni `npm install`.
  No introduzcas uno salvo petición explícita.
- **JavaScript con módulos ES nativos** (`<script type="module">`), no CommonJS
  (salvo `server.js`, que corre en Node).
- **Three.js por CDN con _import maps_.** Cada juego declara su propia versión en
  su `index.html`; no se comparte una global. La oficina usa **r0.160**; la
  autopista, **r0.128** (se fijó así a propósito para preservar su render — no la
  subas de versión sin probar el juego en el navegador).
- Compatible con **GitHub Pages** (estático). Las URLs limpias de carpeta
  (`games/<id>/`) funcionan porque Pages sirve `index.html` por defecto; el
  `server.js` local replica ese comportamiento.

## Estructura

```
index.html            menú de selección (raíz: landing de GitHub Pages — DEBE quedarse aquí)
server.js             servidor estático local (Node, puerto 8123)
start.bat             lanzador (arranca server.js + abre el navegador)
compartir.bat         lanzador + túnel público (Azure Dev Tunnels)
menu/
  menu.js             render del menú
  games.js            registro de juegos (FUENTE ÚNICA de la verdad)
  styles/menu.css     estilos del menú
games/
  oficina/            Mi Oficina 3D  (1ª persona, escaneo LiDAR en FBX)
  autopista/          Autopista Infinita (racer arcade, jugable en móvil)
```

Cada juego en `games/<id>/` es **autocontenido** y sigue el **mismo layout**, con
rutas **relativas** a su propia carpeta:

```
games/<id>/
  index.html              página (enlaza styles/ y app.js; sin <style> ni base64 inline)
  app.js                  motor del juego (ES module)
  styles/<id>.css         estilos
  data/*.js               datos del juego (p. ej. caras.js)        [si aplica]
  assets/images/...       imágenes (.jpg/.png)                     [si aplica]
  assets/audio/...        sonidos (.ogg/...)                       [si aplica]
  assets/models/...       modelos 3D (.fbx/...)                    [si aplica]
```

## Cómo ejecutarlo

Requiere Node.js. Doble clic en `start.bat`, o:

```
node server.js
```

y abre `http://localhost:8123` (verás el menú).

## Cómo añadir un juego nuevo

1. Crea `games/<id>/` con el layout estándar de arriba: `index.html`, `app.js`,
   `styles/<id>.css` (CSS externo, no inline) y los recursos bajo
   `assets/{images,audio,models}/` y/o `data/`. Import map de Three.js + módulo
   externo, con rutas relativas a su carpeta.
2. Añade una entrada al array `GAMES` de `menu/games.js` (`id`, `title`, `emoji`,
   `tagline`, `description`, `path`, `accent`, `tags`).

El menú (`menu.js`) recorre el registro y pinta una tarjeta por juego: **no hay
nada cableado a mano**. Inyecta los datos con `textContent`/`setAttribute` (nunca
`innerHTML`); mantén esa norma para evitar XSS.

## Convenciones y avisos

- **`?v=N` para romper caché.** Los `index.html` cargan su `app.js?v=N` y su CSS
  `styles/<id>.css?v=N`. Al editar uno de esos ficheros, sube su número (GitHub
  Pages cachea con agresividad).
- **No mezcles refactors con cambios funcionales** (ver CLAUDE.md global).
  Cambios pequeños y autocontenidos.
- **Fotos de las caras = ficheros, NO base64.** Cada juego tiene sus imágenes en
  `assets/images/caras/*.jpg` (cargadas por ruta relativa). En la oficina,
  `data/caras.js` mapea cada persona a la ruta de su foto; en la autopista,
  `CHARS` hace lo propio (más los `*_mirror.jpg` del retrovisor). **Por decisión
  de diseño cada juego tiene sus propias imágenes**, aunque algunas sean
  idénticas entre juegos: no las deduplicar ni las compartir entre `games/`.
- El juego de la oficina detecta sonidos opcionales (`punch`/`whip`/`scream` en
  `.ogg`/`.mp3`/`.wav`) dentro de `games/oficina/assets/audio/`; sustitúyelos
  para cambiarlos.
