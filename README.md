# 🎮 Claude Arcade

Una pequeña colección de **mini-juegos web** hechos con **Three.js** (sin
instalar nada, sin build). Una página de inicio te deja elegir a qué juego
entrar y la arquitectura está pensada para **ir añadiendo juegos** sin tocar el
resto.

Ahora mismo hay dos:

- 🏢 **Mi Oficina 3D** — paseo en 1ª persona por una recreación 3D de la oficina
  (escaneada con LiDAR de un iPhone), por la que deambulan **monigotes estilo
  Minecraft** con las caras de los compañeros.
- 🏎️ **Autopista Infinita** — racer arcade infinito con los mismos compañeros
  como pilotos (**jugable en móvil**).

## 🌐 Jugar online (GitHub Pages)

- 🎮 **Menú** → https://wizars.github.io/mi-oficina-3d/
- 🏢 **Mi Oficina 3D** → https://wizars.github.io/mi-oficina-3d/games/oficina/
- 🏎️ **Autopista Infinita** → https://wizars.github.io/mi-oficina-3d/games/autopista/

## ▶️ Cómo ejecutarlo en local

Requiere **Node.js** instalado.

1. Doble clic en **`start.bat`** (arranca un servidor local y abre el navegador).
2. Si no, desde una terminal en esta carpeta:
   ```
   node server.js
   ```
   y abre **http://localhost:8123** en Chrome (verás el menú).

Para **compartirlo por internet** (túnel de Azure Dev Tunnels): doble clic en
**`compartir.bat`** (requiere el CLI `devtunnel` y sesión iniciada).

## 🏗️ Arquitectura y cómo añadir un juego

Todos los juegos comparten el **mismo stack**: HTML + un módulo ES (`app.js`) que
carga Three.js por CDN mediante *import maps*. No hay framework ni paso de
compilación; el `server.js` (o GitHub Pages) sirve los ficheros estáticos.

El menú se genera **solo** a partir de un registro central. Para añadir un juego:

1. Crea su carpeta en `games/<id>/` siguiendo el layout estándar: `index.html`,
   `app.js`, `styles/<id>.css`, y los recursos en `assets/` (`images/`, `audio/`,
   `models/`) y/o `data/`.
2. Añade una entrada al array de [`menu/games.js`](menu/games.js).

El menú ([`menu/menu.js`](menu/menu.js)) recorre ese registro y pinta una tarjeta
por juego: no hay nada cableado a mano.

## 🎮 Controles — Mi Oficina 3D

| Acción | Tecla / Ratón |
|---|---|
| Moverte | **W A S D** |
| Mirar | **Ratón** |
| Correr | **Shift** |
| Subir / bajar | **Espacio** / **Ctrl** |
| 👊 Puño (mata en 2 golpes) | **Clic izquierdo** |
| 🔴 Látigo (mata en 1 golpe) | **Clic derecho** |
| Soltar el ratón | **Esc** |

En móvil aparecen joystick y botones táctiles automáticamente.

## 🏎️ Controles — Autopista Infinita

`◀ ▶` / `A D` girar · `W` / `↑` turbo · **Espacio** salto · `H` bocina ·
`P` pausa · `M` mute. En móvil: botones táctiles en horizontal.

## 🧍 Los monigotes (oficina)

- **Álvaro Gonzalo** — cigarro gigante que se consume en ~30 s; si se lo fuma
  entero se vuelve **inmortal**. Si muere, **¡toda la sala se incendia!** 🔥
- **Daniel Villegas** — abrigo gordo, bufanda y gorro.
- **Rodrigo Peña** — vaso de whisky en la mano.
- **Miguel Arbea** — sombrero de paja (One Piece).
- **Raúl Iglesias** — escudo del Racing en la camiseta.
- **Jorge García** — logo de Guinness.
- **Raúl Elizalde** — logo de arekson group.
- **Noé Gutiérrez**.

Hay **sangre** (se queda en el suelo) y **sonidos** (puñetazo, latigazo y gritos).

## 🛠️ Tecnología

- **Three.js** cargado por CDN con *import maps* (la oficina usa r0.160; la
  autopista, r0.128 — cada juego fija su versión en su propio import map).
- Escaneo de la oficina: **Scaniverse** (iPhone LiDAR) exportado en FBX
  (8 teselas en `games/oficina/assets/models/`).
- Servidor estático mínimo en Node (`server.js`), que resuelve `carpeta/` →
  `carpeta/index.html` igual que GitHub Pages.

## 📂 Estructura

```
index.html               · menú de selección (raíz: landing de GitHub Pages)
server.js                · servidor web local
start.bat                · lanzador
compartir.bat            · lanzador + túnel público
menu/
  menu.js                ·   render del menú
  games.js               ·   registro de juegos (fuente única)
  styles/menu.css        ·   estilos del menú
games/
  oficina/               · Mi Oficina 3D
    index.html           ·   página
    app.js               ·   motor del juego
    styles/oficina.css   ·   estilos
    data/caras.js        ·   datos de cada compañero (nombre + ruta de foto)
    assets/images/caras/ ·   fotos de las caras (.jpg)
    assets/images/logos/ ·   logos del pecho (.png)
    assets/audio/        ·   sonidos (.ogg)
    assets/models/       ·   las 8 teselas FBX del escaneo
  autopista/             · Autopista Infinita
    index.html           ·   página y HUD
    app.js               ·   motor del juego (mismo stack que la oficina)
    styles/autopista.css ·   estilos
    assets/images/caras/ ·   fotos de pilotos y retrovisores (.jpg)
```

> En la oficina los efectos de sonido son **opcionales**: si colocas `punch` /
> `whip` / `scream` (`.ogg`/`.mp3`/`.wav`) en `games/oficina/assets/audio/` se usan
> automáticamente; si no, se sintetizan. De serie vienen `whip.ogg` y `scream.ogg`
> (el puñetazo va sintetizado).
