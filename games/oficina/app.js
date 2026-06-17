// ============================================================
//  Mi Oficina 3D  —  escaneo LiDAR + paseo en 1ª persona + monigotes
//  Todo el motor en este archivo. No hace falta tocar nada.
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CARAS } from './data/caras.js';

const CHAR_KEYS = Object.keys(CARAS);   // las 8 personas con su foto

// --- Las 8 teselas del escaneo (están en la carpeta scan/) ---
const TILES = [
  'assets/models/126E308F5DDC43049CE196DF1B74B592_mesh.fbx',
  'assets/models/17C59C94A0DD49E08686E2002F485E41_mesh.fbx',
  'assets/models/982236C0D8914000AB105568A6E3A2D8_mesh.fbx',
  'assets/models/9D86821F55BC4D3ABE2FC6AD70EA354E_mesh.fbx',
  'assets/models/ABFEF4CCF8F246B6B41F711380A653D0_mesh.fbx',
  'assets/models/DFDEAAC487934C69B137D5016692D433_mesh.fbx',
  'assets/models/E9D3E9B5E801458CA6CAEEC0BF123251_mesh.fbx',
  'assets/models/F13795B862F34834939F3E70CCF740BE_mesh.fbx',
];

const TARGET_WIDTH = 17.5;   // ancho real de tu oficina en metros (para fijar la escala)
const EYE_HEIGHT   = 1.65;   // altura de los ojos del jugador (m)
const WALK_SPEED   = 3.2;    // m/s andando
const RUN_SPEED    = 6.4;    // m/s corriendo
const NPC_COUNT    = 7;      // nº de monigotes
const NPC_SPEED    = 1.25;   // m/s de los monigotes

// ---------- Escena básica ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10141b);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 1000);
camera.position.set(0, EYE_HEIGHT, 0);

// ¿dispositivo táctil? (móvil / tablet) → activa los controles táctiles.
// Conservador: puntero principal grueso, hay táctil, y NO hay ningún ratón
// (así un portátil táctil con ratón mantiene los controles de escritorio).
// Se puede forzar con ?touch=1 (o desactivar con ?touch=0) para pruebas.
const _forceTouch = new URLSearchParams(location.search).get('touch');
const IS_TOUCH = _forceTouch === '1' ? true : _forceTouch === '0' ? false : (
  matchMedia('(pointer:coarse)').matches && navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer:fine)').matches
);
if (IS_TOUCH) document.body.classList.add('touch');

const renderer = new THREE.WebGLRenderer({ antialias: !IS_TOUCH });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));   // menos resolución en móvil = más fluido
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

// Luces (solo afectan a los monigotes; la oficina va "sin sombras", como la foto)
scene.add(new THREE.HemisphereLight(0xffffff, 0x444a55, 1.6));
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(5, 12, 6);
scene.add(sun);

// ---------- Estado global del mundo (se rellena tras cargar) ----------
const office = new THREE.Group();
scene.add(office);
const collidables = [];          // mallas de la oficina para los raycasts (suelo y paredes)
let worldBounds = new THREE.Box3();
const monigotes = [];
const hitMeshes = [];      // mallas de los monigotes, para detectar puñetazos

const down = new THREE.Vector3(0, -1, 0);
const headTmp = new THREE.Vector3();
const rayFloor = new THREE.Raycaster();
const rayWall  = new THREE.Raycaster();
rayWall.far = 1.0;
const rayPunch = new THREE.Raycaster();

// ── ARSENAL DEL JUGADOR ─────────────────────────────────────────────
// dmg = puntos de vida que resta a un monigote (vida máxima 100).
const WEAPONS = {
  punch:   { name: 'Puño',         icon: '👊', dmg: 20,  reach: 3.4, cd: 0.32, kind: 'melee'   },
  whip:    { name: 'Látigo',       icon: '🔴', dmg: 42,  reach: 6.5, cd: 0.42, kind: 'melee'   },
  shotgun: { name: 'Escopeta',     icon: '🔫', dmg: 16,  reach: 16,  cd: 0.75, kind: 'shotgun', pellets: 8 }, // ≈128 a quemarropa
  rocket:  { name: 'Lanzacohetes', icon: '🚀', dmg: 150, reach: 4.5, cd: 1.5,  kind: 'rocket',  splash: 4.5 },
  grenade: { name: 'Granada',      icon: '💣', dmg: 110, reach: 4.0, cd: 1.3,  kind: 'grenade', splash: 4.0 },
};
const WEAPON_ORDER = ['punch', 'whip', 'shotgun', 'rocket', 'grenade'];
let currentWeapon = 'punch';
const weaponCd = {};                 // enfriamiento por arma (s)
const projectiles = [];              // cohetes y granadas en vuelo
const explosions = [];               // efectos de explosión

// Compat: alcances antiguos
const PUNCH_REACH = WEAPONS.punch.reach;
const WHIP_REACH  = WEAPONS.whip.reach;

// ── VIDA ────────────────────────────────────────────────────────────
const MONI_HP = 100;                 // vida de cada monigote
const PLAYER_HP_MAX = 100;           // vida del jugador
let playerHP = PLAYER_HP_MAX;
let playerDead = false;

// ── ARMAS DE LOS MONIGOTES (daño que TE hacen) ──────────────────────
const NPC_WEAPONS = {
  punch: { name: 'puño',   reach: 1.7, dmg: 6,  cd: 2.2, wind: 0.34 },
  whip:  { name: 'látigo', reach: 3.6, dmg: 9,  cd: 2.6, wind: 0.44 },
  bat:   { name: 'bate',   reach: 2.2, dmg: 13, cd: 2.9, wind: 0.40 },
};
const NPC_WEAPON_KEYS = ['punch', 'whip', 'bat'];
const MAX_ATTACKERS  = 2;            // como mucho 2 monigotes atacándote a la vez
const AGGRO_RADIUS   = 9;            // se fijan en ti si estás a menos de 9 m
const DEAGGRO_RADIUS = 16;           // te pierden si te alejas más de 16 m
const _pv = new THREE.Vector3();     // temporal para cálculos de proyectiles

// ---------- Carga de las 8 teselas ----------
const bar = document.querySelector('#bar > i');
const loadingEl = document.getElementById('loading');

const manager = new THREE.LoadingManager();
let done = 0;
function tick() { bar.style.width = Math.round((done / TILES.length) * 100) + '%'; }

const loader = new FBXLoader(manager);

function loadTile(url) {
  return new Promise((resolve) => {
    loader.load(
      url,
      (obj) => {
        try {
          obj.traverse((c) => {
            if (c.isMesh) {
              // Material "sin luz" usando la textura del escaneo (es una foto, ya viene iluminada)
              const oldMat = Array.isArray(c.material) ? c.material[0] : c.material;
              const map = oldMat && oldMat.map ? oldMat.map : null;
              if (map) map.colorSpace = THREE.SRGBColorSpace;
              c.material = new THREE.MeshBasicMaterial(
                map ? { map } : { color: 0x9aa0aa }
              );
              c.frustumCulled = false;
              collidables.push(c);
            }
          });
          office.add(obj);
        } catch (e) { console.warn('Aviso procesando', url, e); }
        done++; tick(); resolve(true);
      },
      undefined,
      (err) => { console.warn('No se pudo cargar', url, err); done++; tick(); resolve(false); }
    );
  });
}

// Arranca el mundo en cuanto cargan todas... o tras 10s aunque alguna tesela se atasque.
let worldReady = false;
function safeSetup() {
  if (worldReady) return;
  worldReady = true;
  try { setupWorld(); }
  catch (e) { console.error('Error montando el mundo:', e); fallbackSetup(); }
  finally { loadingEl.style.display = 'none'; }   // pase lo que pase, fuera la barra de carga
}
Promise.all(TILES.map(loadTile)).then(safeSetup);
setTimeout(safeSetup, 10000);

// ---------- Colocar el mundo una vez cargado ----------
function setupWorld() {
  if (collidables.length === 0) {
    loadingEl.innerHTML = '⚠️ No se pudo cargar el escaneo. Mira la consola (F12).';
    return;
  }

  // 0) El escaneo viene boca abajo (techo y suelo invertidos): darle la vuelta 180º
  office.rotation.x = Math.PI;
  office.updateMatrixWorld(true);

  // 1) Escala real: ajustar el ancho de la oficina a TARGET_WIDTH metros
  let box = new THREE.Box3().setFromObject(office);
  const size = box.getSize(new THREE.Vector3());
  const horiz = Math.max(size.x, size.z) || 1;
  const s = TARGET_WIDTH / horiz;
  office.scale.setScalar(s);

  // 2) Centrar en el origen y poner el suelo a la altura 0
  office.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(office);
  const center = box.getCenter(new THREE.Vector3());
  office.position.x -= center.x;
  office.position.z -= center.z;
  office.position.y -= box.min.y;
  office.updateMatrixWorld(true);

  worldBounds = new THREE.Box3().setFromObject(office);
  console.log('Oficina lista. Escala x' + s.toFixed(3) + '  · teselas cargadas: ' + (collidables.length));

  // 3) Colocar al jugador en un punto del suelo cerca del centro
  const start = floorPointNear(0, 0);
  camera.position.set(start.x, start.y + EYE_HEIGHT, start.z);

  // 4) Crear los monigotes (uno por persona)
  for (let i = 0; i < CHAR_KEYS.length; i++) spawnMonigote(i);

  loadingEl.style.display = 'none';
}

// Plan B: si algo falla al montar el mundo, al menos te deja moverte
function fallbackSetup() {
  try { worldBounds = new THREE.Box3().setFromObject(office); } catch (e) {}
  camera.position.set(0, EYE_HEIGHT, 0);
  loadingEl.style.display = 'none';
}

// Devuelve un punto del suelo bajo (x,z); si justo ahí hay un hueco, prueba alrededor
function floorPointNear(x, z) {
  const top = (isFinite(worldBounds.max.y) ? worldBounds.max.y : 10) + 5;
  const offsets = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,2],[-2,2],[2,-2],[-2,-2],[4,0],[-4,0],[0,4],[0,-4]];
  for (const [ox, oz] of offsets) {
    rayFloor.set(new THREE.Vector3(x + ox, top, z + oz), down);
    rayFloor.far = 1000;
    const hit = rayFloor.intersectObjects(collidables, false)[0];
    if (hit) return hit.point.clone();
  }
  return new THREE.Vector3(x, 0, z);
}

// Punto aleatorio del suelo dentro de la oficina (para que deambulen los monigotes)
function randomFloorPoint() {
  const pad = 1.2;
  for (let i = 0; i < 16; i++) {
    const x = THREE.MathUtils.lerp(worldBounds.min.x + pad, worldBounds.max.x - pad, Math.random());
    const z = THREE.MathUtils.lerp(worldBounds.min.z + pad, worldBounds.max.z - pad, Math.random());
    const top = worldBounds.max.y + 5;
    rayFloor.set(new THREE.Vector3(x, top, z), down);
    rayFloor.far = 1000;
    const hit = rayFloor.intersectObjects(collidables, false)[0];
    if (hit) return hit.point.clone();
  }
  return null;
}

// ---------- Monigotes ----------
const COLORS = [0xff5d5d, 0x4dd2ff, 0xffd166, 0x8aff80, 0xc792ff, 0xff9f43, 0x6ee7d6];
const texLoader = new THREE.TextureLoader();
const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf2efe6 });   // cigarro
const emberMat = new THREE.MeshBasicMaterial({ color: 0xff5a1e });   // brasa

// Una extremidad en forma de CAJA (estilo Minecraft) que pivota por arriba (hombro/cadera)
function blockLimb(w, len, mat) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
  mesh.position.y = -len / 2;   // cuelga hacia abajo desde el pivote
  g.add(mesh);
  return g;
}

// Logo en el pecho: carga un PNG de la carpeta; si no está, simplemente no se ve
function addChestLogo(root, file, w, h) {
  const mat = new THREE.MeshBasicMaterial({ transparent: true });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  plane.position.set(0, 0.66, 0.094);
  plane.visible = false;
  root.add(plane);
  texLoader.load(file,
    (t) => { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.needsUpdate = true; plane.visible = true; },
    undefined, () => {});
}

// Crea un monigote articulado (origen en los PIES, y=0)
// Barra de vida flotante (sprite que siempre mira a la cámara) para un monigote
function makeHpBar() {
  const cv = document.createElement('canvas'); cv.width = 96; cv.height = 14;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(0.7, 0.1, 1);
  sprite.renderOrder = 999;
  sprite.visible = false;
  const draw = (frac) => {
    frac = Math.max(0, Math.min(1, frac));
    ctx.clearRect(0, 0, 96, 14);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, 96, 14);
    ctx.fillStyle = frac > 0.5 ? '#5bd75b' : frac > 0.22 ? '#e8c14a' : '#e0584a';
    ctx.fillRect(2, 2, frac * 92, 10);
    tex.needsUpdate = true;
  };
  draw(1);
  return { sprite, draw };
}

function spawnMonigote(i) {
  const key = CHAR_KEYS[i % CHAR_KEYS.length];
  const char = CARAS[key];
  const shirt = char.shirt, pants = char.pants;

  const root = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.95, flatShading: true });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.95, flatShading: true });
  const skinMat  = new THREE.MeshStandardMaterial({ color: 0xe2b48c, roughness: 0.95, flatShading: true });

  const armW = key === 'daniel' ? 0.17 : 0.12;   // Dani con abrigo gordo -> brazos más anchos

  // TORSO (caja)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.18), shirtMat);
  torso.position.y = 0.62;
  root.add(torso);

  // CABEZA (cubo) con la foto en la cara frontal (+Z)
  const faceTex = texLoader.load(char.face);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36),
    [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat]);   // foto en +Z
  head.position.y = 1.08;
  root.add(head);

  // BRAZOS y PIERNAS (cajas que pivotan por arriba)
  const armL = blockLimb(armW, 0.46, shirtMat); armL.position.set(-(0.17 + armW / 2), 0.84, 0); root.add(armL);
  const armR = blockLimb(armW, 0.46, shirtMat); armR.position.set( (0.17 + armW / 2), 0.84, 0); root.add(armR);
  const legL = blockLimb(0.15, 0.46, pantsMat); legL.position.set(-0.085, 0.46, 0); root.add(legL);
  const legR = blockLimb(0.15, 0.46, pantsMat); legR.position.set( 0.085, 0.46, 0); root.add(legR);

  let cigStick = null, cigEmber = null;

  // ----- Extras por personaje -----
  if (key === 'alvaro') {
    // Cigarro desproporcionado en la boca (se irá consumiendo)
    const cig = new THREE.Group();
    cigStick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), whiteMat);
    cigStick.rotation.x = Math.PI / 2; cigStick.position.z = 0.3;
    cigEmber = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.05, 8), emberMat);
    cigEmber.rotation.x = Math.PI / 2; cigEmber.position.z = 0.62;
    cig.add(cigStick); cig.add(cigEmber);
    cig.position.set(0.05, -0.08, 0.18);   // zona de la boca (relativo al centro de la cabeza)
    head.add(cig);
  }
  if (key === 'daniel') {
    // Abrigo gordo + bufanda + gorro (para el frío)
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2e, roughness: 1, flatShading: true });
    const knit = new THREE.MeshStandardMaterial({ color: 0x7a2d2d, roughness: 1, flatShading: true });
    const trim = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 1, flatShading: true });
    const coat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.62, 0.36), coatMat);
    coat.position.y = 0.64; root.add(coat);
    // gorro de lana (sobre la cabeza)
    const beanie = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.18, 0.40), knit);
    beanie.position.y = 0.22; head.add(beanie);
    const beanieBrim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), trim);
    beanieBrim.position.y = 0.13; head.add(beanieBrim);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), trim);
    pom.position.y = 0.33; head.add(pom);
    // bufanda (rodea el cuello y cuelga por delante)
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.40), knit);
    scarf.position.y = 0.95; root.add(scarf);
    const scarfEnd = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.30, 0.08), knit);
    scarfEnd.position.set(0.10, 0.80, 0.20); root.add(scarfEnd);
  }
  if (key === 'rodrigo') {
    // Vaso de whisky en la mano derecha (cuelga del brazo)
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0xd9a441, transparent: true, opacity: 0.85, roughness: 0.25 }));
    glass.position.set(0, -0.5, 0.07); armR.add(glass);
  }
  if (key === 'miguel') {
    // One Piece: sombrero de paja de Luffy
    const straw = new THREE.MeshStandardMaterial({ color: 0xe3c766, roughness: 1, flatShading: true });
    const brimHat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 16), straw);
    brimHat.position.y = 0.19; head.add(brimHat);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.12, 16), straw);
    crown.position.y = 0.25; head.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.176, 0.176, 0.05, 16),
      new THREE.MeshStandardMaterial({ color: 0xb3271e, roughness: 1, flatShading: true }));
    band.position.y = 0.225; head.add(band);
  }
  if (key === 'rauli') addChestLogo(root, 'assets/images/logos/racing.png', 0.26, 0.30);    // escudo del Racing
  if (key === 'jorge') addChestLogo(root, 'assets/images/logos/guinness.png', 0.32, 0.20);  // logo de Guinness
  if (key === 'raul')  addChestLogo(root, 'assets/images/logos/arekson.png', 0.34, 0.20);   // logo de arekson group

  // Arma del monigote: puño / látigo / bate (repartidas entre los 8)
  const npcWeapon = NPC_WEAPON_KEYS[i % NPC_WEAPON_KEYS.length];
  if (npcWeapon === 'bat') {
    // bate de madera en la mano derecha
    const bat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.9, flatShading: true }));
    bat.position.set(0, -0.42, 0.05); armR.add(bat);
  }

  const m = {
    root, legL, legR, armL, armR, head, key,
    name: char.name,
    state: 'walk',
    hp: MONI_HP, maxHp: MONI_HP,
    weapon: npcWeapon,
    aggro: false, atkCd: 1 + Math.random() * 3, atkAnim: 0, struck: false,
    cigStick, cigEmber, cigBurn: 0, immortal: false,
    target: randomFloorPoint(),
    phase: Math.random() * 6.28,
    vel: new THREE.Vector3(),
  };
  m.hpBar = makeHpBar();
  scene.add(m.hpBar.sprite);

  // marcar las mallas para detectar golpes
  const parts = [torso, head, armL.children[0], armR.children[0], legL.children[0], legR.children[0]];
  for (const p of parts) { p.userData.owner = m; hitMeshes.push(p); }

  const p0 = randomFloorPoint() || new THREE.Vector3(0, 0, 0);
  root.position.copy(p0);
  scene.add(root);
  monigotes.push(m);
}

// Apoya los pies del monigote en el suelo (origen del modelo = pies)
function groundMonigote(m) {
  const top = (isFinite(worldBounds.max.y) ? worldBounds.max.y : 10) + 5;
  rayFloor.set(new THREE.Vector3(m.root.position.x, top, m.root.position.z), down);
  rayFloor.far = 1000;
  const hit = rayFloor.intersectObjects(collidables, false)[0];
  if (hit) m.root.position.y = hit.point.y;
}

function updateMonigotes(dt) {
  const ppos = camera.position;
  // contar cuántos te están atacando ahora mismo (para no saturarte)
  let attackers = 0;
  for (const m of monigotes) if (m.aggro && m.state === 'walk') attackers++;

  for (const m of monigotes) {
    updateHpBar(m);

    if (m.state === 'dead') continue;                 // peso muerto: se queda tirado, no se mueve
    if (m.state === 'hit') { updateHit(m, dt); continue; }

    // Cigarro de Álvaro: se consume en ~30 s; si se acaba entero -> INMORTAL
    if (m.cigStick && !m.immortal) {
      m.cigBurn = Math.min(1, m.cigBurn + dt / 30);
      const rem = 1 - m.cigBurn;
      m.cigStick.scale.y = rem;
      m.cigStick.position.z = 0.3 * rem;
      m.cigEmber.position.z = 0.6 * rem + 0.02;
      if (m.cigBurn >= 1) {
        m.cigStick.visible = false; m.cigEmber.visible = false;   // el cigarro desaparece del todo
        m.immortal = true;
        showToast('🚬 Álvaro se ha fumado el cigarro entero: ¡ahora es INMORTAL!');
      }
    }

    if (m.atkCd > 0) m.atkCd -= dt;

    // distancia al jugador (en horizontal)
    const dpx = ppos.x - m.root.position.x;
    const dpz = ppos.z - m.root.position.z;
    const pdist = Math.hypot(dpx, dpz) || 0.0001;

    // --- decidir si te ataca (suave: como mucho MAX_ATTACKERS y de uno en uno) ---
    if (playerDead || onFire) {
      m.aggro = false;
    } else if (m.aggro) {
      if (pdist > DEAGGRO_RADIUS) m.aggro = false;
    } else if (attackers < MAX_ATTACKERS && pdist < AGGRO_RADIUS &&
               m.atkCd <= 0 && Math.random() < dt * 0.4) {
      m.aggro = true; attackers++;
    }

    // --- animación de golpe en curso ---
    if (m.atkAnim > 0) animateNpcAttack(m, dt);

    let walking = false;
    if (m.aggro) {
      m.root.rotation.set(0, Math.atan2(dpx, dpz), 0);     // siempre te mira
      const reach = NPC_WEAPONS[m.weapon].reach;
      if (m.atkAnim > 0) {
        // quieto mientras descarga el golpe
      } else if (pdist > reach * 0.85) {
        const nx = dpx / pdist, nz = dpz / pdist;          // acercarse
        m.root.position.x += nx * NPC_SPEED * 1.2 * dt;
        m.root.position.z += nz * NPC_SPEED * 1.2 * dt;
        walking = true;
      } else if (m.atkCd <= 0) {
        startNpcAttack(m);                                 // ¡a por ti!
      }
    } else {
      // deambular tranquilo (comportamiento original)
      if (!m.target) m.target = randomFloorPoint();
      else {
        const dx = m.target.x - m.root.position.x;
        const dz = m.target.z - m.root.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.6) m.target = randomFloorPoint();
        else {
          const nx = dx / dist, nz = dz / dist;
          m.root.position.x += nx * NPC_SPEED * dt;
          m.root.position.z += nz * NPC_SPEED * dt;
          m.root.rotation.set(0, Math.atan2(nx, nz), 0);
          walking = true;
        }
      }
    }

    groundMonigote(m);

    // animación de andar (si no está golpeando)
    if (m.atkAnim <= 0) {
      const sw = walking ? 0.55 : 0;
      m.phase += dt * 8;
      const s = Math.sin(m.phase) * sw;
      m.legL.rotation.x =  s;
      m.legR.rotation.x = -s;
      m.armL.rotation.x = -s;
      m.armR.rotation.x =  s;
      if (walking) m.root.position.y += Math.abs(Math.sin(m.phase)) * 0.02;  // botecito al andar
    }
  }
}

// Coloca la barra de vida sobre la cabeza; solo visible si está herido
function updateHpBar(m) {
  const bar = m.hpBar; if (!bar) return;
  if (m.state === 'dead' || m.immortal || m.hp >= m.maxHp) { bar.sprite.visible = false; return; }
  bar.sprite.visible = true;
  m.head.getWorldPosition(headTmp);
  bar.sprite.position.set(headTmp.x, headTmp.y + 0.42, headTmp.z);
}

// El monigote levanta el brazo y, al bajarlo, te golpea si sigues en alcance
function startNpcAttack(m) {
  m.atkAnim = NPC_WEAPONS[m.weapon].wind + 0.22;
  m.struck = false;
}
function animateNpcAttack(m, dt) {
  m.atkAnim -= dt;
  const w = NPC_WEAPONS[m.weapon];
  const total = w.wind + 0.22;
  const elapsed = total - m.atkAnim;
  let ang;
  if (elapsed < w.wind) ang = -2.2 * (elapsed / w.wind);                    // sube el brazo
  else ang = -2.2 + 2.9 * Math.min(1, (elapsed - w.wind) / 0.12);          // lo baja de golpe
  m.armR.rotation.x = ang;

  if (!m.struck && elapsed >= w.wind) {
    m.struck = true;
    const dx = camera.position.x - m.root.position.x;
    const dz = camera.position.z - m.root.position.z;
    if (!playerDead && Math.hypot(dx, dz) <= w.reach + 0.4) {
      damagePlayer(w.dmg, m);
      if (m.weapon === 'whip') sfxWhip(); else sfxThud();
    }
    m.atkCd = w.cd + Math.random() * 1.2;
  }
  if (m.atkAnim <= 0) m.armR.rotation.x = 0;
}

// Derrumbe natural: gira hasta tumbarse (en la dirección aleatoria elegida) y baja al suelo
function updateHit(m, dt) {
  m.fall += dt * 3.2;
  const p = Math.min(1, m.fall);
  const e = p * p * (3 - 2 * p);   // smoothstep -> caída suave y natural

  const top = (isFinite(worldBounds.max.y) ? worldBounds.max.y : 10) + 5;
  rayFloor.set(new THREE.Vector3(m.root.position.x, top, m.root.position.z), down);
  rayFloor.far = 1000;
  const hit = rayFloor.intersectObjects(collidables, false)[0];
  const floorY = hit ? hit.point.y : m.root.position.y;

  m.root.quaternion.slerpQuaternions(m.startQuat, m.fallQuat, e);   // se va tumbando
  m.root.position.y = floorY + 0.18 * e;                            // baja al suelo
  setLimb(m.legL, m.limbStart.legL, m.limbTarget.legL, e);
  setLimb(m.legR, m.limbStart.legR, m.limbTarget.legR, e);
  setLimb(m.armL, m.limbStart.armL, m.limbTarget.armL, e);
  setLimb(m.armR, m.limbStart.armR, m.limbTarget.armR, e);

  if (p >= 1) m.state = 'dead';
}

function setLimb(g, s, t, e) {
  g.rotation.x = s.x + (t.x - s.x) * e;
  g.rotation.z = s.z + (t.z - s.z) * e;
}

// ════════════════════════════════════════════════════════════════
//  ARSENAL DEL JUGADOR  (puño · látigo · escopeta · cohetes · granadas)
// ════════════════════════════════════════════════════════════════
function selectWeapon(w) {
  if (!WEAPONS[w]) return;
  currentWeapon = w;
  refreshWeaponStrip();
  const fb = document.getElementById('bFire');
  if (fb) fb.textContent = WEAPONS[w].icon;
}

function fire() {
  if (!isActive() || playerDead) return;
  const w = currentWeapon, def = WEAPONS[w];
  if ((weaponCd[w] || 0) > 0) return;        // aún recargando
  weaponCd[w] = def.cd;
  if (def.kind === 'melee') meleeAttack(w, def);
  else if (def.kind === 'shotgun') shotgunAttack(def);
  else spawnProjectile(def.kind, def);       // rocket | grenade
}

// Resta vida a un monigote; si llega a 0 lo derriba
function damageMonigote(m, dmg) {
  if (!m || m.state !== 'walk' || m.immortal) return;
  m.hp -= dmg;
  if (m.hpBar) m.hpBar.draw(m.hp / m.maxHp);
  sfxScream();
  if (m.hp <= 0) startDeath(m);
}

function meleeAttack(w, def) {
  if (w === 'whip') sfxWhip(); else sfxPunch();
  rayPunch.setFromCamera({ x: 0, y: 0 }, camera);
  rayPunch.far = def.reach;
  const hits = rayPunch.intersectObjects(hitMeshes, false);
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  if (w === 'whip') {
    const target = hits.length ? hits[0].point.clone()
                               : camera.position.clone().addScaledVector(fwd, def.reach);
    showWhip(target);
  }
  if (!hits.length) return;
  const m = hits[0].object.userData.owner; if (!m) return;
  spawnBlood(hits[0].point);
  damageMonigote(m, def.dmg);
}

function shotgunAttack(def) {
  sfxShotgun();
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const rgt = new THREE.Vector3().crossVectors(fwd, upV).normalize();
  const upW = new THREE.Vector3().crossVectors(rgt, fwd).normalize();
  const acc = new Map();                       // daño acumulado por monigote
  for (let p = 0; p < def.pellets; p++) {
    const dir = fwd.clone()
      .addScaledVector(rgt, (Math.random() - 0.5) * 0.18)
      .addScaledVector(upW, (Math.random() - 0.5) * 0.18).normalize();
    rayPunch.set(camera.position, dir); rayPunch.far = def.reach;
    const hit = rayPunch.intersectObjects(hitMeshes, false)[0];
    if (hit && hit.object.userData.owner) {
      acc.set(hit.object.userData.owner, (acc.get(hit.object.userData.owner) || 0) + def.dmg);
      spawnBlood(hit.point);
    }
  }
  spawnExplosionFx(camera.position.clone().addScaledVector(fwd, 0.6), 0.55, 0xfff0b0);  // fogonazo
  for (const [m, dmg] of acc) damageMonigote(m, dmg);
}

function spawnProjectile(kind, def) {
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const mesh = new THREE.Mesh(
    kind === 'rocket' ? new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8)
                      : new THREE.SphereGeometry(0.09, 8, 6),
    new THREE.MeshStandardMaterial({
      color: kind === 'rocket' ? 0x992222 : 0x3a4a26,
      emissive: kind === 'rocket' ? 0x551111 : 0x000000, roughness: 0.7 }));
  if (kind === 'rocket') { mesh.quaternion.copy(camera.quaternion); mesh.rotateX(Math.PI / 2); }
  mesh.position.copy(camera.position).addScaledVector(fwd, 0.5);
  scene.add(mesh);
  const vel = fwd.clone().multiplyScalar(kind === 'rocket' ? 26 : 13);
  if (kind === 'grenade') vel.y += 4.5;        // arco
  if (kind === 'rocket') sfxRocket(); else sfxThrow();
  projectiles.push({ kind, mesh, vel, def, life: kind === 'rocket' ? 3.5 : 2.2, fuse: kind === 'grenade' ? 1.6 : 0 });
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.life -= dt;
    if (pr.kind === 'grenade') { pr.vel.y -= 12 * dt; pr.fuse -= dt; }

    const step = pr.vel.clone().multiplyScalar(dt);
    const moveLen = step.length();

    let wallHit = null;
    if (moveLen > 0.0001) {
      rayWall.set(pr.mesh.position, step.clone().normalize());
      rayWall.far = moveLen + 0.1;
      wallHit = rayWall.intersectObjects(collidables, false)[0] || null;
    }
    let near = null;
    for (const m of monigotes) {
      if (m.state !== 'walk') continue;
      _pv.copy(m.root.position); _pv.y += 0.7;
      if (_pv.distanceTo(pr.mesh.position) < 0.65) { near = m; break; }
    }

    if (pr.kind === 'rocket') {
      if (wallHit || near || pr.life <= 0) {
        explode(wallHit ? wallHit.point : pr.mesh.position, pr.def.splash, pr.def.dmg, 0xff7a1e);
        scene.remove(pr.mesh); projectiles.splice(i, 1); continue;
      }
    } else { // granada
      if (near || pr.fuse <= 0 || pr.life <= 0) {
        explode(pr.mesh.position, pr.def.splash, pr.def.dmg, 0xffb020);
        scene.remove(pr.mesh); projectiles.splice(i, 1); continue;
      }
    }

    pr.mesh.position.add(step);
    if (pr.kind === 'grenade') {
      pr.mesh.rotation.x += dt * 6;
      // no atravesar el suelo: rebote suave
      rayFloor.set(new THREE.Vector3(pr.mesh.position.x, pr.mesh.position.y + 1, pr.mesh.position.z), down);
      rayFloor.far = 1000;
      const fh = rayFloor.intersectObjects(collidables, false)[0];
      if (fh && pr.mesh.position.y < fh.point.y + 0.09) {
        pr.mesh.position.y = fh.point.y + 0.09;
        pr.vel.y = Math.abs(pr.vel.y) * 0.35;
        pr.vel.x *= 0.6; pr.vel.z *= 0.6;
      }
    }
  }
}

function explode(pos, radius, dmg, color) {
  sfxExplosion();
  spawnExplosionFx(pos, radius, color);
  for (const m of monigotes) {
    if (m.state !== 'walk' || m.immortal) continue;
    _pv.copy(m.root.position); _pv.y += 0.7;
    const d = _pv.distanceTo(pos);
    if (d <= radius) { damageMonigote(m, dmg * (1 - 0.6 * d / radius)); spawnBlood(_pv.clone()); }
  }
  // ¡cuidado con tus propias explosiones si estás cerca!
  const pd = camera.position.distanceTo(pos);
  if (pd <= radius && !playerDead) damagePlayer(Math.round(dmg * (1 - pd / radius) * 0.35), { name: 'tu propia explosión' });
}

function spawnExplosionFx(pos, radius, color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.position.copy(pos); mesh.scale.setScalar(0.3);
  scene.add(mesh);
  explosions.push({ mesh, t: 0, max: 0.45, radius: Math.max(1, radius) });
}
function updateExplosions(dt) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i]; e.t += dt;
    const p = e.t / e.max;
    e.mesh.scale.setScalar(0.3 + p * e.radius);
    e.mesh.material.opacity = 0.9 * (1 - p);
    if (p >= 1) { scene.remove(e.mesh); explosions.splice(i, 1); }
  }
}

// ════════════════════════════════════════════════════════════════
//  VIDA DEL JUGADOR / MUERTE / REAPARICIÓN
// ════════════════════════════════════════════════════════════════
function updatePlayerHud() {
  const fill = document.getElementById('hpFill');
  const label = document.getElementById('hpLabel');
  const f = Math.max(0, playerHP) / PLAYER_HP_MAX;
  if (fill) { fill.style.width = (f * 100) + '%'; fill.style.background = f > 0.5 ? '#5bd75b' : f > 0.22 ? '#e8c14a' : '#e0584a'; }
  if (label) label.textContent = 'VIDA ' + Math.max(0, Math.round(playerHP));
}
let _flashT = 0;
function flashDamage() {
  const el = document.getElementById('damageFlash');
  if (el) { el.style.opacity = '1'; _flashT = 0.12; }
}
function damagePlayer(amount, src, flash = true) {
  if (playerDead) return;
  playerHP = Math.max(0, playerHP - amount);
  updatePlayerHud();
  if (flash) flashDamage();
  if (playerHP <= 0) playerDie(src);
}
function playerDie(src) {
  if (playerDead) return;
  playerDead = true;
  const sub = document.getElementById('deadSub');
  if (sub) sub.textContent = (src === 'fire') ? 'Te ha consumido el incendio 🔥'
    : (src && src.name) ? (src.name + ' te ha rematado') : 'Te han dado de baja';
  document.getElementById('dead').classList.add('show');
  if (controls.isLocked) controls.unlock();
}
function respawn() {
  playerDead = false; playerHP = PLAYER_HP_MAX; updatePlayerHud();
  extinguishFire();
  for (const m of monigotes) reviveMonigote(m);
  const p = randomFloorPoint();
  if (p) camera.position.set(p.x, p.y + EYE_HEIGHT, p.z);
  document.getElementById('dead').classList.remove('show');
}
function reviveMonigote(m) {
  m.state = 'walk'; m.hp = m.maxHp; m.aggro = false; m.atkAnim = 0; m.struck = false;
  m.atkCd = 1 + Math.random() * 3;
  m.root.quaternion.identity();
  m.root.rotation.set(0, Math.random() * 6.28, 0);
  m.armL.rotation.set(0, 0, 0); m.armR.rotation.set(0, 0, 0);
  m.legL.rotation.set(0, 0, 0); m.legR.rotation.set(0, 0, 0);
  const p = randomFloorPoint(); if (p) m.root.position.copy(p);
  groundMonigote(m);
  if (m.hpBar) { m.hpBar.draw(1); m.hpBar.sprite.visible = false; }
  if (m.key === 'alvaro') {
    m.immortal = false; m.cigBurn = 0;
    if (m.cigStick) { m.cigStick.visible = true; m.cigStick.scale.y = 1; m.cigStick.position.z = 0.3;
      m.cigEmber.visible = true; m.cigEmber.position.z = 0.62; }
  }
}

// Barra de armas (se construye automáticamente desde WEAPONS)
const weaponStripEl = document.getElementById('weaponStrip');
const weaponChips = {};
function refreshWeaponStrip() {
  for (const w in weaponChips) weaponChips[w].classList.toggle('sel', w === currentWeapon);
}
function buildWeaponStrip() {
  if (!weaponStripEl) return;
  WEAPON_ORDER.forEach((w, idx) => {
    const def = WEAPONS[w];
    const chip = document.createElement('div');
    chip.className = 'wchip';
    chip.innerHTML = '<span class="wi">' + def.icon + '</span><span class="wn">' + def.name + '</span><span class="wk">' + (idx + 1) + '</span>';
    chip.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); selectWeapon(w); });
    weaponStripEl.appendChild(chip);
    weaponChips[w] = chip;
  });
}
buildWeaponStrip();
selectWeapon('punch');
updatePlayerHud();

// Inicia el derrumbe con dirección y posturas ALEATORIAS
function startDeath(m) {
  m.state = 'hit';
  m.fall = 0;
  const ang = Math.random() * Math.PI * 2;
  const d = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(d, (Math.random() - 0.5) * 1.2)); // ladeo
  m.startQuat = m.root.quaternion.clone();
  m.fallQuat = q;
  const r = (a) => (Math.random() - 0.5) * a;
  m.limbStart = {
    legL: { x: m.legL.rotation.x, z: 0 }, legR: { x: m.legR.rotation.x, z: 0 },
    armL: { x: m.armL.rotation.x, z: 0 }, armR: { x: m.armR.rotation.x, z: 0 },
  };
  m.limbTarget = {
    legL: { x: r(1.4), z: r(0.7) }, legR: { x: r(1.4), z: r(0.7) },
    armL: { x: r(2.2), z: r(1.2) }, armR: { x: r(2.2), z: r(1.2) },
  };
  if (m.key === 'alvaro') startFire();   // si muere Álvaro -> arde la sala
}

// ============================================================
//  SONIDO  —  usa archivos reales si existen (punch/whip/scream .mp3/.wav/.ogg)
//  y, si no, sintetiza efectos convincentes con Web Audio.
// ============================================================
let audioCtx = null;
const samples = {};         // name -> AudioBuffer (si se cargó un archivo real)
let samplesTried = false;

function ensureAudio() {
  if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  loadSamples();
}
function loadSamples() {
  if (samplesTried || !audioCtx) return;
  samplesTried = true;
  const want = {
    punch:  ['assets/audio/punch.ogg', 'assets/audio/punch.mp3', 'assets/audio/punch.wav'],
    whip:   ['assets/audio/whip.ogg', 'assets/audio/whip.mp3', 'assets/audio/whip.wav'],
    scream: ['assets/audio/scream.ogg', 'assets/audio/scream.mp3', 'assets/audio/scream.wav'],
  };
  for (const name in want) tryLoad(name, want[name], 0);
}
function tryLoad(name, urls, i) {
  if (i >= urls.length) return;
  fetch(urls[i]).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(audio => { samples[name] = audio; })
    .catch(() => tryLoad(name, urls, i + 1));
}
function playSample(name, delay, gain) {
  if (!samples[name] || !audioCtx) return false;
  const src = audioCtx.createBufferSource(); src.buffer = samples[name];
  const g = audioCtx.createGain(); g.gain.value = gain || 0.9;
  src.connect(g).connect(audioCtx.destination);
  src.start(audioCtx.currentTime + (delay || 0));
  return true;
}
function noise(dur) {
  const n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Puñetazo: golpe grave (cuerpo) + slap de ruido
function sfxPunch() {
  ensureAudio(); if (!audioCtx) return;
  if (playSample('punch')) return;
  const ctx = audioCtx, t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.13);
  const og = ctx.createGain(); og.gain.setValueAtTime(0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + 0.2);
  const nb = ctx.createBufferSource(); nb.buffer = noise(0.12);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1900, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.1);
  const ng = ctx.createGain(); ng.gain.setValueAtTime(0.85, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  nb.connect(lp).connect(ng).connect(ctx.destination); nb.start(t); nb.stop(t + 0.12);
}
// Látigo: zumbido del aire (bandpass que sube) + CRACK agudo final
function sfxWhip() {
  ensureAudio(); if (!audioCtx) return;
  if (playSample('whip')) return;
  const ctx = audioCtx, t = ctx.currentTime;
  const nb = ctx.createBufferSource(); nb.buffer = noise(0.18);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(5500, t + 0.11);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.5, t + 0.1); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
  nb.connect(bp).connect(ng).connect(ctx.destination); nb.start(t); nb.stop(t + 0.18);
  const cb = ctx.createBufferSource(); cb.buffer = noise(0.05);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
  const cg = ctx.createGain(); cg.gain.setValueAtTime(0.9, t + 0.1); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
  cb.connect(hp).connect(cg).connect(ctx.destination); cb.start(t + 0.1); cb.stop(t + 0.17);
}
// Grito: voz con formantes (bandpass), 3 osciladores desafinados + vibrato + aspereza
function sfxScream(delay = 0) {
  ensureAudio(); if (!audioCtx) return;
  if (playSample('scream', delay, 1.0)) return;
  const ctx = audioCtx, t = ctx.currentTime + delay;
  const base = 300 + Math.random() * 140;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
  out.gain.setValueAtTime(0.5, t + 0.35);
  out.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 900; f1.Q.value = 6;
  const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2300; f2.Q.value = 8;
  f1.connect(out); f2.connect(out); out.connect(ctx.destination);
  for (const det of [0, 8, -6]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 0.8 + det, t);
    o.frequency.linearRampToValueAtTime(base * 1.3 + det, t + 0.12);
    o.frequency.linearRampToValueAtTime(base * 0.9 + det, t + 0.6);
    const vib = ctx.createOscillator(); vib.frequency.value = 13 + Math.random() * 9;
    const vg = ctx.createGain(); vg.gain.value = 12; vib.connect(vg); vg.connect(o.frequency);
    o.connect(f1); o.connect(f2);
    o.start(t); o.stop(t + 0.7); vib.start(t); vib.stop(t + 0.7);
  }
  const nb = ctx.createBufferSource(); nb.buffer = noise(0.7);
  const ng = ctx.createGain(); ng.gain.value = 0.06; nb.connect(ng); ng.connect(f2); nb.start(t); nb.stop(t + 0.7);
}
// Escopeta: estallido de ruido grave + golpe
function sfxShotgun() {
  ensureAudio(); if (!audioCtx) return; const ctx = audioCtx, t = ctx.currentTime;
  const nb = ctx.createBufferSource(); nb.buffer = noise(0.25);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.2);
  const g = ctx.createGain(); g.gain.setValueAtTime(1.0, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  nb.connect(lp).connect(g).connect(ctx.destination); nb.start(t); nb.stop(t + 0.25);
  const o = ctx.createOscillator(); o.type = 'square';
  o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  const og = ctx.createGain(); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + 0.15);
}
// Disparo de cohete: silbido con bandpass
function sfxRocket() {
  ensureAudio(); if (!audioCtx) return; const ctx = audioCtx, t = ctx.currentTime;
  const nb = ctx.createBufferSource(); nb.buffer = noise(0.4);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  nb.connect(bp).connect(g).connect(ctx.destination); nb.start(t); nb.stop(t + 0.4);
}
// Explosión: ruido grave + sub-bajo descendente
function sfxExplosion() {
  ensureAudio(); if (!audioCtx) return; const ctx = audioCtx, t = ctx.currentTime;
  const nb = ctx.createBufferSource(); nb.buffer = noise(0.6);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1200, t); lp.frequency.exponentialRampToValueAtTime(120, t + 0.5);
  const g = ctx.createGain(); g.gain.setValueAtTime(1.0, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  nb.connect(lp).connect(g).connect(ctx.destination); nb.start(t); nb.stop(t + 0.6);
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.4);
  const og = ctx.createGain(); og.gain.setValueAtTime(0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + 0.45);
}
// Lanzar granada: "whoosh" corto
function sfxThrow() {
  ensureAudio(); if (!audioCtx) return; const ctx = audioCtx, t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.18);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.2);
}
// Golpe sordo (impacto de monigote sobre el jugador)
function sfxThud() {
  ensureAudio(); if (!audioCtx) return; const ctx = audioCtx, t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.12);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.18);
}

// ---------- Incendio: cuando muere Álvaro toda la sala se incendia ----------
let onFire = false;
let _origBg = null, _origFog = null;
const flames = [];
function startFire() {
  if (onFire) return;
  onFire = true;
  _origBg = scene.background; _origFog = scene.fog;   // para poder apagarlo luego
  showToast('🔥 ¡Álvaro ha caído! La sala arde... ¡corre o morirás!');
  scene.background = new THREE.Color(0x200800);
  scene.fog = new THREE.FogExp2(0x4a1500, 0.05);
  const b = worldBounds;
  for (let i = 0; i < 140; i++) {
    const x = THREE.MathUtils.lerp(b.min.x, b.max.x, Math.random());
    const z = THREE.MathUtils.lerp(b.min.z, b.max.z, Math.random());
    rayFloor.set(new THREE.Vector3(x, b.max.y + 5, z), down); rayFloor.far = 1000;
    const hit = rayFloor.intersectObjects(collidables, false)[0];
    if (!hit) continue;
    const h = 0.5 + Math.random() * 0.9;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18 + Math.random() * 0.16, h, 7),
      new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    cone.position.set(x, hit.point.y + h / 2, z);
    scene.add(cone);
    flames.push({ mesh: cone, baseY: hit.point.y, h, phase: Math.random() * 6.28, speed: 6 + Math.random() * 7 });
  }
  // Arde todo: mueren TODOS los monigotes en pie, con gritos de dolor escalonados
  let n = 0;
  for (const mm of monigotes) {
    if (mm.state === 'walk') { startDeath(mm); sfxScream(n * 0.13); n++; }
  }
}
function updateFire(dt, t) {
  if (!onFire) return;
  if (!playerDead) damagePlayer(dt * 45, 'fire', false);   // el incendio TAMBIÉN te mata (~2 s)
  for (const f of flames) {
    const s = 0.65 + 0.5 * Math.abs(Math.sin(t * f.speed + f.phase));
    f.mesh.scale.set(1, s, 1);
    f.mesh.position.y = f.baseY + (f.h * s) / 2;
    f.mesh.material.opacity = 0.55 + 0.35 * Math.sin(t * f.speed * 1.2 + f.phase);
    f.mesh.rotation.y += dt * 2.5;
  }
}
function extinguishFire() {
  if (!onFire) return;                  // no había incendio: no tocar fondo/niebla
  onFire = false;
  for (const f of flames) scene.remove(f.mesh);
  flames.length = 0;
  scene.background = _origBg;
  scene.fog = _origFog;
}

// ---------- Sangre: gotas que saltan, caen y SE QUEDAN como mancha en el suelo ----------
const bloodGeo = new THREE.SphereGeometry(0.05, 6, 6);
const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8e0000 });
const blood = [];        // gotas en movimiento
const stains = [];       // manchas ya posadas en el suelo
function spawnBlood(pos) {
  // suelo bajo el impacto
  const top = (isFinite(worldBounds.max.y) ? worldBounds.max.y : 10) + 5;
  rayFloor.set(new THREE.Vector3(pos.x, top, pos.z), down);
  rayFloor.far = 1000;
  const fh = rayFloor.intersectObjects(collidables, false)[0];
  const floorY = fh ? fh.point.y : pos.y - 1.2;

  for (let i = 0; i < 16; i++) {
    const dot = new THREE.Mesh(bloodGeo, bloodMat);
    dot.position.copy(pos);
    dot.scale.setScalar(0.4 + Math.random() * 0.9);
    scene.add(dot);
    blood.push({
      mesh: dot,
      vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2 + 1, (Math.random() - 0.5) * 3),
      floorY,
    });
  }
}
function updateBlood(dt) {
  for (let i = blood.length - 1; i >= 0; i--) {
    const b = blood[i];
    b.vel.y -= 9.8 * dt;
    b.mesh.position.addScaledVector(b.vel, dt);
    if (b.mesh.position.y <= b.floorY + 0.01) {           // toca suelo -> se queda como mancha
      b.mesh.position.y = b.floorY + 0.01;
      b.mesh.scale.y *= 0.2;                              // aplastada
      b.mesh.scale.x *= 1.6; b.mesh.scale.z *= 1.6;
      stains.push(b.mesh);
      blood.splice(i, 1);
      if (stains.length > 1200) { scene.remove(stains.shift()); }  // tope para no saturar
    }
  }
}

// ---------- Látigo: viewmodel SIEMPRE visible en la mano + chasquido ----------
const whipVM = new THREE.Group();
whipVM.position.set(0.42, -0.42, -0.85);   // abajo-derecha, delante de la cámara
whipVM.rotation.set(-0.2, 0.3, 0.15);
camera.add(whipVM);
const handleMat = new THREE.MeshBasicMaterial({ color: 0x6b4a2a });
const lashMat = new THREE.MeshBasicMaterial({ color: 0x241a10 });
whipVM.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.28), handleMat)); // mango
let _ly = 0, _lz = -0.14;
for (let i = 0; i < 7; i++) {                 // trenza: cubos que decrecen y cuelgan
  const s = 0.045 - i * 0.004;
  const cube = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), lashMat);
  _lz -= 0.055; _ly -= 0.012 * i;
  cube.position.set(0, _ly, _lz);
  whipVM.add(cube);
}

let whipLine = null, whipTimer = 0, whipSwing = 0;
function showWhip(target) {
  if (whipLine) scene.remove(whipLine);
  const from = camera.position.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 0.2);
  const geo = new THREE.BufferGeometry().setFromPoints([from, target]);
  whipLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x2a1c10 }));
  scene.add(whipLine);
  whipTimer = 0.12;
  whipSwing = 1;                              // dispara la animación del chasquido
}
function updateWhip(dt) {
  if (whipTimer > 0) {
    whipTimer -= dt;
    if (whipTimer <= 0 && whipLine) { scene.remove(whipLine); whipLine = null; }
  }
  if (whipSwing > 0) whipSwing = Math.max(0, whipSwing - dt * 4);
  const s = Math.sin((1 - whipSwing) * Math.PI);   // 0 -> 1 -> 0
  whipVM.rotation.x = -0.2 - s * 1.2;              // flick hacia delante
  whipVM.position.z = -0.85 - s * 0.3;
}

// ---------- Controles 1ª persona ----------
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(camera);   // PointerLockControls controla esta cámara directamente

const overlay = document.getElementById('overlay');
const cross = document.getElementById('cross');
const hud = document.getElementById('hud');
const toastEl = document.getElementById('toast');
let toastT = 0;
function showToast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.style.opacity = '1'; toastT = 4.5; }

function updateHud() {
  hud.innerHTML = '🔫 Clic = disparar &nbsp;|&nbsp; <b>1–5</b> / rueda = cambiar arma &nbsp;|&nbsp; <b>Esc</b> soltar';
}

// ---------- Estado de los controles táctiles ----------
let mobileActive = false;                 // true cuando se juega en móvil (sin pointer lock)
const touchVec = { x: 0, z: 0 };          // joystick: x = derecha, z = adelante  (-1..1)
let touchRun = false, touchUp = false, touchDown = false;
const isActive = () => controls.isLocked || mobileActive;   // ¿se mueve/ataca el jugador?
const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let yaw = 0, pitch = 0;

function startMobile() {
  ensureAudio();
  mobileActive = true;
  document.body.classList.add('playing');
  overlay.classList.add('hidden');
  cross.style.display = 'block';
  // partir de la orientación actual de la cámara para no dar un salto
  lookEuler.setFromQuaternion(camera.quaternion, 'YXZ');
  yaw = lookEuler.y; pitch = lookEuler.x;
  updatePlayerHud(); selectWeapon(currentWeapon);
}

// En escritorio: clic bloquea el ratón. En móvil: arranca el modo táctil.
overlay.addEventListener('click', () => {
  ensureAudio();
  if (IS_TOUCH) startMobile(); else controls.lock();
});
controls.addEventListener('lock', () => {
  overlay.classList.add('hidden'); cross.style.display = 'block'; hud.style.display = 'block';
  document.body.classList.add('playing');
  updateHud(); updatePlayerHud(); selectWeapon(currentWeapon);
});
controls.addEventListener('unlock', () => {
  cross.style.display = 'none'; hud.style.display = 'none';
  if (playerDead) return;                 // la pantalla de muerte gestiona su propia salida
  overlay.classList.remove('hidden');
  document.body.classList.remove('playing');
});

// Clic (izq. o dcho.) = disparar el arma seleccionada (con el ratón bloqueado)
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!controls.isLocked) return;
  if (e.button === 0 || e.button === 2) fire();
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());  // sin menú con clic dcho.

const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code.startsWith('Digit')) {        // 1–5: cambiar de arma
    const n = parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= WEAPON_ORDER.length) selectWeapon(WEAPON_ORDER[n - 1]);
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('wheel', (e) => {         // rueda del ratón: cambiar de arma
  if (!isActive()) return;
  const i = WEAPON_ORDER.indexOf(currentWeapon);
  const n = (i + (e.deltaY > 0 ? 1 : -1) + WEAPON_ORDER.length) % WEAPON_ORDER.length;
  selectWeapon(WEAPON_ORDER[n]);
}, { passive: true });
document.getElementById('respawnBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  respawn();
  if (!IS_TOUCH) controls.lock();
});

// ════════════════════════════════════════════════════════════════
//  CABLEADO DE CONTROLES TÁCTILES  (solo en dispositivos táctiles)
// ════════════════════════════════════════════════════════════════
if (IS_TOUCH) {
  const PITCH_MAX = Math.PI / 2 - 0.05;
  const LOOK_SENS = 0.0032;

  // --- Mirar: arrastrar un dedo por el lienzo (zona libre de UI) ---
  const cv = renderer.domElement;
  let lookId = null, lx = 0, ly = 0;
  cv.addEventListener('pointerdown', (e) => {
    if (!mobileActive || lookId !== null) return;
    lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    yaw   -= (e.clientX - lx) * LOOK_SENS;
    pitch -= (e.clientY - ly) * LOOK_SENS;
    pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitch));
    lx = e.clientX; ly = e.clientY;
    lookEuler.set(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(lookEuler);
  });
  const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
  cv.addEventListener('pointerup', endLook);
  cv.addEventListener('pointercancel', endLook);

  // --- Joystick de movimiento ---
  const joy = document.getElementById('joy');
  const nub = document.getElementById('joyNub');
  const JOY_R = 46;
  let joyId = null, jcx = 0, jcy = 0;
  function moveJoy(px, py) {
    let dx = px - jcx, dy = py - jcy;
    const d = Math.hypot(dx, dy) || 1;
    if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
    nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    touchVec.x =  dx / JOY_R;     // derecha = +
    touchVec.z = -dy / JOY_R;     // arriba (dy<0) = adelante = +
  }
  joy.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joyId = e.pointerId;
    const r = joy.getBoundingClientRect();
    jcx = r.left + r.width / 2; jcy = r.top + r.height / 2;
    moveJoy(e.clientX, e.clientY);
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveJoy(e.clientX, e.clientY); });
  const endJoy = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null; touchVec.x = 0; touchVec.z = 0;
    nub.style.transform = 'translate(-50%,-50%)';
  };
  joy.addEventListener('pointerup', endJoy);
  joy.addEventListener('pointercancel', endJoy);

  // --- Botones de acción ---
  const tap = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  };
  const hold = (id, set) => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, () => set(false)));
  };
  tap('bFire', () => { if (mobileActive) fire(); });
  hold('bUp',   v => touchUp = v);
  hold('bDown', v => touchDown = v);
  const runBtn = document.getElementById('bRun');
  if (runBtn) runBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    touchRun = !touchRun;
    runBtn.classList.toggle('on', touchRun);
  });
}

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const upV = new THREE.Vector3(0, 1, 0);

function movePlayer(dt) {
  if (!isActive() || playerDead) return;
  const pos = camera.position;

  // dirección de la cámara en horizontal
  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  right.crossVectors(fwd, upV).normalize();

  let ix = 0, iz = 0;
  if (keys['KeyW']) iz += 1;
  if (keys['KeyS']) iz -= 1;
  if (keys['KeyD']) ix += 1;
  if (keys['KeyA']) ix -= 1;
  // joystick táctil (analógico)
  if (mobileActive) { ix += touchVec.x; iz += touchVec.z; }

  const speed = (keys['ShiftLeft'] || keys['ShiftRight'] || touchRun ? RUN_SPEED : WALK_SPEED) * dt;

  if (ix !== 0 || iz !== 0) {
    const dir = new THREE.Vector3()
      .addScaledVector(fwd, iz)
      .addScaledVector(right, ix)
      .normalize();
    // mover por ejes con "deslizamiento" contra paredes
    tryMove(pos, dir.x * speed, 0, 0);
    tryMove(pos, 0, 0, dir.z * speed);
  }

  // subir / bajar manual (por si te quedas atascado)
  if (keys['Space']       || touchUp)   pos.y += WALK_SPEED * dt;
  if (keys['ControlLeft'] || touchDown) pos.y -= WALK_SPEED * dt;

  // seguir el suelo (gravedad sencilla): bajar los ojos a suelo + EYE_HEIGHT
  if (collidables.length) {
    rayFloor.set(new THREE.Vector3(pos.x, pos.y + 0.3, pos.z), down);
    rayFloor.far = 50;
    const hit = rayFloor.intersectObjects(collidables, false)[0];
    if (hit) {
      const targetY = hit.point.y + EYE_HEIGHT;
      pos.y += (targetY - pos.y) * Math.min(1, dt * 10); // suavizado
    }
  }
}

const tmp = new THREE.Vector3();
function tryMove(pos, dx, dy, dz) {
  tmp.set(dx, dy, dz);
  const len = tmp.length();
  if (len === 0) return;
  rayWall.set(pos, tmp.clone().normalize());
  rayWall.far = len + 0.3;
  const hit = rayWall.intersectObjects(collidables, false)[0];
  // avanza si no hay pared; y si estamos pegados/dentro (dist muy corta) tambien, para no atascarse
  if (!hit || hit.distance < 0.12) { pos.x += dx; pos.y += dy; pos.z += dz; }
}

// ---------- Bucle ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  movePlayer(dt);
  if (monigotes.length) updateMonigotes(dt, t);
  updateProjectiles(dt);
  updateExplosions(dt);
  updateBlood(dt);
  updateWhip(dt);
  updateFire(dt, t);
  for (const w in weaponCd) if (weaponCd[w] > 0) weaponCd[w] = Math.max(0, weaponCd[w] - dt);
  if (_flashT > 0) { _flashT -= dt; if (_flashT <= 0) { const df = document.getElementById('damageFlash'); if (df) df.style.opacity = '0'; } }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.style.opacity = '0'; }
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
