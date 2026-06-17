# 🏢 Mi Oficina 3D

Un mini-juego web hecho con **Three.js**: te paseas en primera persona por una
recreación 3D de la oficina (escaneada con LiDAR de un iPhone) y por ella deambulan
**monigotes estilo Minecraft** con las caras de los compañeros.

## 🌐 Jugar online (GitHub Pages)

- 🏢 **Mi Oficina 3D** → https://wizars.github.io/mi-oficina-3d/
- 🏎️ **Autopista Infinita** (racer con los mismos compañeros, **jugable en móvil**) → https://wizars.github.io/mi-oficina-3d/autopista.html

## ▶️ Cómo ejecutarlo

Requiere **Node.js** instalado.

1. Doble clic en **`start.bat`** (arranca un servidor local y abre el navegador).
2. Si no, desde una terminal en esta carpeta:
   ```
   node server.js
   ```
   y abre **http://localhost:8123** en Chrome.

Para **compartirlo por internet** (túnel de Azure Dev Tunnels): doble clic en
**`compartir.bat`** (requiere el CLI `devtunnel` y sesión iniciada).

## 🎮 Controles

| Acción | Tecla / Ratón |
|---|---|
| Moverte | **W A S D** |
| Mirar | **Ratón** |
| Correr | **Shift** |
| Subir / bajar | **Espacio** / **Ctrl** |
| 👊 Puño (mata en 2 golpes) | **Clic izquierdo** |
| 🔴 Látigo (mata en 1 golpe) | **Clic derecho** |
| Soltar el ratón | **Esc** |

## 🧍 Los monigotes (extras)

- **Álvaro Gonzalo** — cigarro gigante que se consume en ~30 s; si se lo fuma entero se vuelve **inmortal**. Si muere, **¡toda la sala se incendia!** 🔥
- **Daniel Villegas** — abrigo gordo, bufanda y gorro.
- **Rodrigo Peña** — vaso de whisky en la mano.
- **Miguel Arbea** — sombrero de paja (One Piece).
- **Raúl Iglesias** — escudo del Racing en la camiseta.
- **Jorge García** — logo de Guinness.
- **Raúl Elizalde** — logo de arekson group.
- **Noé Gutiérrez**.

Hay **sangre** (se queda en el suelo) y **sonidos** (puñetazo, latigazo y gritos).

## 🛠️ Tecnología

- **Three.js** (cargado por CDN con import maps).
- Escaneo: **Scaniverse** (iPhone LiDAR) exportado en FBX (8 teselas en `scan/`).
- Servidor estático mínimo en Node (`server.js`).

## 📂 Estructura

```
index.html      · página y estilos
app.js          · todo el motor del juego
caras.js        · fotos de las caras (base64)
server.js       · servidor web local
start.bat       · lanzador
compartir.bat   · lanzador + túnel público
scan/           · las 8 teselas FBX del escaneo
*.png / *.ogg   · logos y sonidos
```

> Sustituye cualquier `punch.mp3` / `whip.mp3` / `scream.mp3` (o `.ogg`/`.wav`) en
> esta carpeta para cambiar los efectos de sonido; se usan automáticamente.
