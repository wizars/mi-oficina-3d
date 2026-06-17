// ============================================================
//  Mi Oficina 3D  —  escaneo LiDAR + paseo en 1ª persona + monigotes
//  Todo el motor en este archivo. No hace falta tocar nada.
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CARAS } from './caras.js';

const CHAR_KEYS = Object.keys(CARAS);   // las 8 personas con su foto

// --- Las 8 teselas del escaneo (están en la carpeta scan/) ---
const TILES = [
  'scan/126E308F5DDC43049CE196DF1B74B592_mesh.fbx',
  'scan/17C59C94A0DD49E08686E2002F485E41_mesh.fbx',
  'scan/982236C0D8914000AB105568A6E3A2D8_mesh.fbx',
  'scan/9D86821F55BC4D3ABE2FC6AD70EA354E_mesh.fbx',
  'scan/ABFEF4CCF8F246B6B41F711380A653D0_mesh.fbx',
  'scan/DFDEAAC487934C69B137D5016692D433_mesh.fbx',
  'scan/E9D3E9B5E801458CA6CAEEC0BF123251_mesh.fbx',
  'scan/F13795B862F34834939F3E70CCF740BE_mesh.fbx',
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

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
const PUNCH_REACH = 3.6;   // alcance del puñetazo (m)
const WHIP_REACH = 6.5;    // alcance del látigo (m)
const HP_MAX = 2;          // 2 puñetazos (1 de daño) o 1 latigazo (2 de daño)

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
  if (key === 'rauli') addChestLogo(root, 'racing.png', 0.26, 0.30);    // escudo del Racing
  if (key === 'jorge') addChestLogo(root, 'guinness.png', 0.32, 0.20);  // logo de Guinness
  if (key === 'raul')  addChestLogo(root, 'arekson.png', 0.34, 0.20);   // logo de arekson group

  const m = {
    root, legL, legR, armL, armR, head, key,
    name: char.name,
    state: 'walk',
    hp: HP_MAX,
    cigStick, cigEmber, cigBurn: 0, immortal: false,
    target: randomFloorPoint(),
    phase: Math.random() * 6.28,
    vel: new THREE.Vector3(),
  };

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
  for (const m of monigotes) {
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

    // --- caminar hacia el destino ---
    if (!m.target) { m.target = randomFloorPoint(); continue; }
    const dx = m.target.x - m.root.position.x;
    const dz = m.target.z - m.root.position.z;
    const dist = Math.hypot(dx, dz);

    let walking = false;
    if (dist < 0.6) {
      m.target = randomFloorPoint();        // ha llegado -> nuevo destino
    } else {
      const nx = dx / dist, nz = dz / dist;
      m.root.position.x += nx * NPC_SPEED * dt;
      m.root.position.z += nz * NPC_SPEED * dt;
      m.root.rotation.set(0, Math.atan2(nx, nz), 0);   // mira hacia donde anda
      walking = true;
    }

    groundMonigote(m);

    // --- animación de andar (balanceo de piernas y brazos opuestos) ---
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

// ---------- Ataque (w = 'punch' clic izq. | 'whip' clic dcho.) ----------
function attack(w) {
  const reach = w === 'whip' ? WHIP_REACH : PUNCH_REACH;
  const dmg   = w === 'whip' ? 2 : 1;                  // látigo mata de 1, puño de 2
  if (w === 'whip') sfxWhip(); else sfxPunch();        // sonido del arma (siempre)
  rayPunch.setFromCamera({ x: 0, y: 0 }, camera);
  rayPunch.far = reach;
  const hits = rayPunch.intersectObjects(hitMeshes, false);
  const fwd = camera.getWorldDirection(new THREE.Vector3());

  if (w === 'whip') {
    const target = hits.length ? hits[0].point.clone()
                               : camera.position.clone().addScaledVector(fwd, reach);
    showWhip(target);
  }

  if (!hits.length) return;
  const m = hits[0].object.userData.owner;
  if (!m) return;
  spawnBlood(hits[0].point);            // SANGRE siempre (esté de pie o ya en el suelo)
  if (m.state === 'walk' && !m.immortal) {
    sfxScream();                        // grito de dolor
    m.hp -= dmg;
    if (m.hp <= 0) startDeath(m);
  }
}

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
    punch:  ['punch.ogg', 'punch.mp3', 'punch.wav'],
    whip:   ['whip.ogg', 'whip.mp3', 'whip.wav'],
    scream: ['scream.ogg', 'scream.mp3', 'scream.wav'],
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

// ---------- Incendio: cuando muere Álvaro toda la sala se incendia ----------
let onFire = false;
const flames = [];
function startFire() {
  if (onFire) return;
  onFire = true;
  showToast('🔥 ¡Álvaro ha caído! La sala arde y muere todo el mundo...');
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
  for (const f of flames) {
    const s = 0.65 + 0.5 * Math.abs(Math.sin(t * f.speed + f.phase));
    f.mesh.scale.set(1, s, 1);
    f.mesh.position.y = f.baseY + (f.h * s) / 2;
    f.mesh.material.opacity = 0.55 + 0.35 * Math.sin(t * f.speed * 1.2 + f.phase);
    f.mesh.rotation.y += dt * 2.5;
  }
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
  hud.innerHTML = '👊 Clic izq. = puño (2 golpes) &nbsp;|&nbsp; 🔴 Clic dcho. = látigo (1 golpe) &nbsp;|&nbsp; <b>Esc</b> soltar';
}

overlay.addEventListener('click', () => { ensureAudio(); controls.lock(); });
controls.addEventListener('lock', () => { overlay.classList.add('hidden'); cross.style.display = 'block'; hud.style.display = 'block'; updateHud(); });
controls.addEventListener('unlock', () => { overlay.classList.remove('hidden'); cross.style.display = 'none'; hud.style.display = 'none'; });

// Clic izquierdo = puño · Clic derecho = látigo
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!controls.isLocked) return;
  if (e.button === 0) attack('punch');
  else if (e.button === 2) attack('whip');
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());  // sin menú con clic dcho.

const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup',   (e) => { keys[e.code] = false; });

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const upV = new THREE.Vector3(0, 1, 0);

function movePlayer(dt) {
  if (!controls.isLocked) return;
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

  const speed = (keys['ShiftLeft'] || keys['ShiftRight'] ? RUN_SPEED : WALK_SPEED) * dt;

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
  if (keys['Space'])       pos.y += WALK_SPEED * dt;
  if (keys['ControlLeft']) pos.y -= WALK_SPEED * dt;

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
  updateBlood(dt);
  updateWhip(dt);
  updateFire(dt, t);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.style.opacity = '0'; }
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
