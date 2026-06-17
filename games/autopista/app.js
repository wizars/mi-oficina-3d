// ============================================================
//  Autopista Infinita — motor del juego (Three.js · ES module)
//  Mismo stack que el resto de juegos: import maps + módulo externo.
//  Lógica idéntica a la versión original; solo cambia el empaquetado.
// ============================================================
import * as THREE from 'three';

// ╔══════════════════════════════════════════════════════════════════╗
// ║  AUTOPISTA INFINITA V6 — motor de arco corregido                 ║
// ║  Todas las entidades viven en coordenadas (s, lat):              ║
// ║    s   = metros recorridos a lo largo del spline                 ║
// ║    lat = desplazamiento lateral respecto al centro de la vía     ║
// ╚══════════════════════════════════════════════════════════════════╝
(function(){'use strict';
// ─── DETECCIÓN MÓVIL / TÁCTIL ────────────────────────────────────────
const IS_TOUCH = window.matchMedia('(pointer:coarse)').matches
  || ('ontouchstart' in window) || navigator.maxTouchPoints>0;
if(IS_TOUCH) document.body.classList.add('touch');
const PR_CAP = IS_TOUCH ? 1.25 : 1.5;   // limita resolución en móvil (rendimiento)

// ─── PERSONAJES ──────────────────────────────────────────────────────
const CHARS={
  raul:   {name:'Raúl Elizalde', face:'assets/images/caras/raul.jpg',    mirror:'assets/images/caras/raul_mirror.jpg',          eyes:[{x:168,y:140},{x:258,y:134}], shirt:0xc7a13a, pants:0x2b3a55},
  rauli:  {name:'Raúl Iglesias', face:'assets/images/caras/rauli.jpg',   mirror:'assets/images/caras/rauli_mirror.jpg',    eyes:[{x:163,y:140},{x:268,y:136}], shirt:0x17181c, pants:0x2b3a55},
  rodrigo:{name:'Rodrigo Peña',  face:'assets/images/caras/rodrigo.jpg', mirror:'assets/images/caras/rodrigo_mirror.jpg',  eyes:[{x:150,y:138},{x:256,y:135}], shirt:0xc8b8a2, pants:0x3a2e28},
  daniel: {name:'Daniel Villegas',face:'assets/images/caras/daniel.jpg', mirror:'assets/images/caras/daniel_mirror.jpg',   eyes:[{x:146,y:140},{x:248,y:137}], shirt:0xf5f2ea, pants:0x3a4252},
  jorge:  {name:'Jorge García',  face:'assets/images/caras/jorge.jpg',   mirror:'assets/images/caras/jorge_mirror.jpg',    eyes:[{x:158,y:143},{x:266,y:141}], shirt:0xe8e0cc, pants:0x3a3d44},
  alvaro: {name:'Álvaro Gonzalo', face:'assets/images/caras/alvaro.jpg', mirror:'assets/images/caras/alvaro_mirror.jpg',  eyes:[{x:170,y:138},{x:262,y:138}], shirt:0x6abea3, pants:0x2c3a45},
  noe:    {name:'Noé Gutiérrez',  face:'assets/images/caras/noe.jpg',    mirror:'assets/images/caras/noe_mirror.jpg',      eyes:[{x:166,y:140},{x:262,y:138}], shirt:0xe8e8ea, pants:0x2c2f36},
  miguel: {name:'Miguel Arbea',   face:'assets/images/caras/miguel.jpg', mirror:'assets/images/caras/miguel_mirror.jpg', eyes:[{x:158,y:140},{x:262,y:138}], shirt:0x6abea3, pants:0x2b3a55},
};
const CHAR_KEYS=Object.keys(CHARS);
const MIGUEL_FACE='assets/images/caras/miguel.jpg';
const DANIEL_FACE='assets/images/caras/daniel.jpg';
const RAULI_FACE='assets/images/caras/rauli.jpg';
let selectedChar=CHARS.raul;

const charsel=document.getElementById('charsel');
CHAR_KEYS.forEach(k=>{
  const ch=CHARS[k];
  const btn=document.createElement('div');
  btn.className='charbtn'+(k==='raul'?' sel':'');
  btn.innerHTML=`<img src="${ch.face}" alt="${ch.name}"><div class="cname">${ch.name.split(' ')[0]}<br>${ch.name.split(' ').slice(1).join(' ')}</div>`;
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.charbtn').forEach(b=>b.classList.remove('sel'));
    btn.classList.add('sel'); selectedChar=CHARS[k];
  });
  charsel.appendChild(btn);
});

// ─── DIFICULTAD (declarada ANTES de los listeners) ───────────────────
const DIFFS={
  facil:  {start:26,accel:1.1, cap:78, spawnMult:1.5,ratio:.44,lane:.18,pedMin:1.4,pedRng:1.2},
  normal: {start:32,accel:1.5, cap:95, spawnMult:1.0,ratio:.36,lane:.28,pedMin:0.9,pedRng:1.0},
  dificil:{start:40,accel:2.0, cap:112,spawnMult:.7, ratio:.30,lane:.40,pedMin:0.6,pedRng:.8},
};
let diff=DIFFS.normal;
document.querySelectorAll('.difbtn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.difbtn').forEach(o=>o.classList.remove('sel'));
  b.classList.add('sel'); diff=DIFFS[b.dataset.dif];
}));

// ─── RENDERER / ESCENA ───────────────────────────────────────────────
const container=document.getElementById('game');
const renderer=new THREE.WebGLRenderer({antialias:!IS_TOUCH,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,PR_CAP));

// ─── CALIDAD GRÁFICA (toggle ALTA/BAJA) ──────────────────────────────
const QUALITY_KEY='autopista_quality_v1';
let QUALITY=localStorage.getItem(QUALITY_KEY)||(IS_TOUCH?'baja':'alta');  // 'alta' | 'baja'
function applyQuality(){
  if(QUALITY==='alta'){
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,PR_CAP));
    renderer.shadowMap.enabled=true;
  } else {
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled=false;
  }
}
applyQuality();
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
container.appendChild(renderer.domElement);

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(68,window.innerWidth/window.innerHeight,.1,800);
scene.add(camera);

const UP=new THREE.Vector3(0,1,0);

// ─── SPLINE EN COORDENADAS DE ARCO ───────────────────────────────────
// La carretera tiene anchura VARIABLE: hay zonas de 4 carriles (autovía, halfW=8)
// y zonas de 2 carriles (carretera secundaria, halfW=4) con transiciones suaves.
const ROAD_W=16;                          // ancho total en zona autovía
const HW_FULL=8;                          // half-width autovía (4 carriles)
const HW_NARROW=4;                        // half-width carretera (2 carriles)
const LANES_FULL=[-6,-2,2,6];             // 4 carriles
const LANES_NARROW=[-2,2];                // 2 carriles
const CPT_COUNT=46;
const CPT_SPACING=34;     // metros entre puntos de control

// Anchos paralelos a curvePts (un valor por punto)
let roadHalfWidths=[];

// Lee el ancho local en metros (half-width)
function halfWidthAtS(s){
  if(!roadHalfWidths.length)return HW_FULL;
  const u=Math.max(0,Math.min(.9999,s/splineLen));
  const fIdx=u*(roadHalfWidths.length-1);
  const i=Math.floor(fIdx), f=fIdx-i;
  return roadHalfWidths[i]*(1-f)+roadHalfWidths[Math.min(roadHalfWidths.length-1,i+1)]*f;
}
function lanesAtS(s){
  // Si el ancho está cerca de full → 4 carriles; si cerca de narrow → 2
  return halfWidthAtS(s)>HW_NARROW+1.5 ? LANES_FULL : LANES_NARROW;
}
// Genera los anchos paralelos a curvePts: la mayoría full, con zonas estrechas
function genRoadWidths(curvePts){
  const n=curvePts.length;
  const w=new Array(n).fill(HW_FULL);
  let i=12;   // tras la entrada
  while(i<n-14){
    const transLen=3, zoneLen=8+Math.floor(Math.random()*5);
    // transición de 4 → 2 carriles
    for(let j=0;j<transLen&&i+j<n;j++){
      const t=(j+1)/(transLen+1);
      w[i+j]=HW_FULL+(HW_NARROW-HW_FULL)*t;
    }
    // zona estrecha
    for(let j=0;j<zoneLen&&i+transLen+j<n;j++){w[i+transLen+j]=HW_NARROW;}
    // transición de 2 → 4 carriles
    for(let j=0;j<transLen&&i+transLen+zoneLen+j<n;j++){
      const t=(j+1)/(transLen+1);
      w[i+transLen+zoneLen+j]=HW_NARROW+(HW_FULL-HW_NARROW)*t;
    }
    i+=transLen*2+zoneLen+18+Math.floor(Math.random()*8);
  }
  return w;
}

// ─── MÓDULOS DE CARRETERA — curvas MUCHO MÁS PRONUNCIADAS ──────────
const ROAD_MODULES=[
  // Rectas
  {name:'recta_larga', len:10, fn:(st,len,i)=>{ st.dx*=.6; st.dy*=.7; }},
  {name:'recta', len:6, fn:(st,len,i)=>{ st.dx*=.6; st.dy*=.7; }},
  // Curvas suaves
  {name:'curvaL_suave', len:6, fn:(st,len,i)=>{ st.dx-=2.5; st.dy*=.7; }},
  {name:'curvaR_suave', len:6, fn:(st,len,i)=>{ st.dx+=2.5; st.dy*=.7; }},
  // Curvas CERRADAS (más pronunciadas que antes)
  {name:'curvaL_cerrada', len:5, fn:(st,len,i)=>{ st.dx-=5.5; st.dy*=.6; }},
  {name:'curvaR_cerrada', len:5, fn:(st,len,i)=>{ st.dx+=5.5; st.dy*=.6; }},
  // Curvas EXTREMAS (¡agárrate!)
  {name:'curvaL_extrema', len:6, fn:(st,len,i)=>{ st.dx-=8.0; st.dy*=.4; }},
  {name:'curvaR_extrema', len:6, fn:(st,len,i)=>{ st.dx+=8.0; st.dy*=.4; }},
  // Horquillas (cambio brusco de dirección)
  {name:'horquillaL', len:9, fn:(st,len,i)=>{
    const k=i/len;
    if(k<.5)st.dx-=7.5; else st.dx+=7.5;
  }},
  {name:'horquillaR', len:9, fn:(st,len,i)=>{
    const k=i/len;
    if(k<.5)st.dx+=7.5; else st.dx-=7.5;
  }},
  // Doble S (chicane)
  {name:'chicane', len:12, fn:(st,len,i)=>{
    const k=i/len;
    st.dx += Math.sin(k*Math.PI*4)*4.5;
    st.dy*=.7;
  }},
  // S suave (izquierda-derecha)
  {name:'S_suave', len:10, fn:(st,len,i)=>{
    const k=i/len;
    st.dx += Math.sin(k*Math.PI*2)*3.0;
    st.dy*=.7;
  }},
  // Subida y bajada muy pronunciadas
  {name:'subida_brusca', len:5, fn:(st,len,i)=>{ st.dy+=3.8; st.dx*=.6; }},
  {name:'bajada_brusca', len:5, fn:(st,len,i)=>{ st.dy-=3.5; st.dx*=.6; }},
  // Valle profundo
  {name:'valle_hondo', len:9, fn:(st,len,i)=>{
    const k=i/len;
    st.dy += -Math.sin(k*Math.PI)*4.5;
    st.dx*=.5;
  }},
  // Montaña alta (apta para puentes)
  {name:'montaña_alta', len:11, fn:(st,len,i)=>{
    const k=i/len;
    st.dy += Math.sin(k*Math.PI)*5.0;
    st.dx*=.5;
  }},
  // Curva en bajada (técnica)
  {name:'curva_bajada', len:7, fn:(st,len,i)=>{
    st.dx+=(Math.random()<.5?-4.0:4.0); st.dy-=2.5;
  }},
  // Curva en subida (frena con confianza)
  {name:'curva_subida', len:7, fn:(st,len,i)=>{
    st.dx+=(Math.random()<.5?-4.0:4.0); st.dy+=2.5;
  }},
  // Ondulada
  {name:'ondulada', len:7, fn:(st,len,i)=>{
    st.dy += Math.sin(i*.9)*1.2; st.dx*=.7;
  }},
];

function pickModule(){return ROAD_MODULES[Math.floor(Math.random()*ROAD_MODULES.length)];}

function genCPT(startPt,count){
  const pts=[];
  let x=startPt.x, y=startPt.y, z=startPt.z;
  const state={dx:0,dy:0};
  let i=0;
  // Entrada suave (5 primeros puntos rectos)
  for(;i<Math.min(5,count);i++){
    state.dx*=.4; state.dy*=.4;
    x+=state.dx*.32; y+=state.dy*.28; z-=CPT_SPACING;
    x=Math.max(-40,Math.min(40,x)); y=Math.max(0,Math.min(20,y));
    pts.push(new THREE.Vector3(x,y,z));
  }
  while(i<count){
    const m=pickModule();
    const moduleLen=Math.min(m.len, count-i);
    for(let j=0;j<moduleLen;j++,i++){
      m.fn(state, moduleLen, j);
      // Permitir derivas más fuertes (era ±15, ahora ±20)
      state.dx=Math.max(-20,Math.min(20,state.dx));
      state.dy=Math.max(-9,Math.min(9,state.dy));
      state.dx+=(Math.random()-.5)*.4;
      state.dy+=(Math.random()-.5)*.3;
      x+=state.dx*.34; x=Math.max(-40,Math.min(40,x));
      y+=state.dy*.28; y=Math.max(0,Math.min(20,y));
      z-=CPT_SPACING;
      pts.push(new THREE.Vector3(x,y,z));
    }
  }
  return pts;
}

let curvePts=[new THREE.Vector3(0,0,0)];
curvePts=curvePts.concat(genCPT(curvePts[0],CPT_COUNT*2));

let roadSpline=null, splineLen=1;
function rebuildSpline(){
  roadSpline=new THREE.CatmullRomCurve3(curvePts,false,'catmullrom',0.4);
  roadSpline.arcLengthDivisions=600;
  splineLen=roadSpline.getLength();
  // Regenerar anchos paralelos a los puntos
  roadHalfWidths=genRoadWidths(curvePts);
}
rebuildSpline();

// Frame de referencia en s (metros) → posición, tangente, derecha, arriba
const _pos=new THREE.Vector3(),_tan=new THREE.Vector3(),_right=new THREE.Vector3(),_up2=new THREE.Vector3();
function frameAt(s, out){
  const u=Math.max(0,Math.min(.9999,s/splineLen));
  out.pos.copy(roadSpline.getPointAt(u));
  out.tan.copy(roadSpline.getTangentAt(u)).normalize();
  out.right.crossVectors(UP,out.tan).normalize();
  out.up.crossVectors(out.tan,out.right).normalize();
  return out;
}
const F={pos:new THREE.Vector3(),tan:new THREE.Vector3(),right:new THREE.Vector3(),up:new THREE.Vector3()};
const F2={pos:new THREE.Vector3(),tan:new THREE.Vector3(),right:new THREE.Vector3(),up:new THREE.Vector3()};
const FRONT=new THREE.Vector3(0,0,-1); // los coches están modelados mirando a -z

function placeOnRoad(obj, s, lat, yOff){
  frameAt(s,F2);
  obj.position.copy(F2.pos)
    .add(F2.right.clone().multiplyScalar(lat))
    .add(F2.up.clone().multiplyScalar(yOff||0));
  obj.quaternion.setFromUnitVectors(FRONT, F2.tan);
}

// ─── GEOMETRÍA DE CARRETERA Y HIERBA ─────────────────────────────────
// Aumentamos STRIPS para que las transiciones de ancho sean suaves
const ROAD_STRIPS=200, ROAD_SEGS_W=4;
// halfWidth puede ser un número fijo O una función f(t,sMeters)→ancho
function buildRibbon(halfWidth, yLift, uvRepeat, extraMargin){
  const positions=[],uvs=[],normals=[],indices=[];
  const margin=extraMargin||0;
  const wf=typeof halfWidth==='function'?halfWidth:null;
  for(let i=0;i<=ROAD_STRIPS;i++){
    const t=i/ROAD_STRIPS;
    const sMeters=t*splineLen;
    const pos=roadSpline.getPointAt(t);
    const tan=roadSpline.getTangentAt(t).normalize();
    const right=new THREE.Vector3().crossVectors(UP,tan).normalize();
    const up=new THREE.Vector3().crossVectors(tan,right).normalize();
    const hw=(wf?wf(t,sMeters):halfWidth)+margin;
    for(let j=0;j<=ROAD_SEGS_W;j++){
      const u=j/ROAD_SEGS_W, rx=(u-.5)*2*hw;
      positions.push(pos.x+right.x*rx, pos.y+right.y*rx+yLift, pos.z+right.z*rx);
      uvs.push(u, t*uvRepeat);
      normals.push(up.x,up.y,up.z);
    }
    if(i<ROAD_STRIPS){
      const r=i*(ROAD_SEGS_W+1),rn=(i+1)*(ROAD_SEGS_W+1);
      for(let j=0;j<ROAD_SEGS_W;j++){const a=r+j,b=r+j+1,c=rn+j,d=rn+j+1;indices.push(a,c,b,b,c,d);}
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(positions),3));
  geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uvs),2));
  geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(normals),3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices),1));
  return geo;
}
// Función que devuelve el halfWidth en t∈[0,1] usando roadHalfWidths interpolado
function halfWidthFn(t, sMeters){
  if(!roadHalfWidths.length)return HW_FULL;
  const fIdx=t*(roadHalfWidths.length-1);
  const i=Math.floor(fIdx), f=fIdx-i;
  return roadHalfWidths[i]*(1-f)+roadHalfWidths[Math.min(roadHalfWidths.length-1,i+1)]*f;
}

function makeRoadTex(){
  const cv=document.createElement('canvas');cv.width=1024;cv.height=1024;
  const c=cv.getContext('2d');
  // base asfalto con gradiente sutil
  const g0=c.createLinearGradient(0,0,1024,0);
  g0.addColorStop(0,'#2a2d33'); g0.addColorStop(.5,'#33363e'); g0.addColorStop(1,'#2a2d33');
  c.fillStyle=g0; c.fillRect(0,0,1024,1024);
  // grano fino
  for(let i=0;i<48000;i++){
    const v=(Math.random()-.5)*.20;
    c.fillStyle=`rgba(${v>0?255:0},${v>0?255:0},${v>0?255:0},${Math.abs(v)})`;
    c.fillRect(Math.random()*1024,Math.random()*1024,1+Math.random()*2.5,1+Math.random()*2.5);
  }
  // parches de reparación oscuros (cuadrados/rectángulos)
  for(let i=0;i<8;i++){
    const w=50+Math.random()*180, h=40+Math.random()*100;
    const x=Math.random()*1024, y=Math.random()*1024;
    c.fillStyle=`rgba(15,15,18,${.25+Math.random()*.3})`;
    c.fillRect(x,y,w,h);
    // bordes irregulares
    c.fillStyle='rgba(0,0,0,.5)';
    c.fillRect(x-1,y-1,w+2,2); c.fillRect(x-1,y+h-1,w+2,2);
    c.fillRect(x-1,y,2,h); c.fillRect(x+w-1,y,2,h);
  }
  // manchas de aceite (oscuras, irregulares)
  for(let i=0;i<14;i++){
    const cx=Math.random()*1024, cy=Math.random()*1024;
    const r=8+Math.random()*22;
    const grd=c.createRadialGradient(cx,cy,2,cx,cy,r);
    grd.addColorStop(0,'rgba(8,8,10,.7)');
    grd.addColorStop(.6,'rgba(8,8,10,.3)');
    grd.addColorStop(1,'rgba(8,8,10,0)');
    c.fillStyle=grd; c.fillRect(cx-r,cy-r,r*2,r*2);
  }
  // grietas (líneas finas oscuras)
  c.strokeStyle='rgba(8,8,10,.45)';
  for(let i=0;i<24;i++){
    c.lineWidth=.5+Math.random()*1.2;
    let x=Math.random()*1024, y=Math.random()*1024;
    c.beginPath(); c.moveTo(x,y);
    const segs=3+Math.floor(Math.random()*5);
    for(let s=0;s<segs;s++){
      x+=(Math.random()-.5)*60; y+=(Math.random()-.5)*60;
      c.lineTo(x,y);
    }
    c.stroke();
  }
  // marcas de neumáticos antiguas (líneas paralelas tenues)
  for(let i=0;i<6;i++){
    const x=Math.random()*1024;
    const len=80+Math.random()*200;
    const y=Math.random()*1024;
    c.fillStyle='rgba(12,12,14,.22)';
    c.fillRect(x,y,2,len);
    c.fillRect(x+18,y,2,len);
  }
  // BORDES blancos sólidos
  c.fillStyle='#e2dccc';
  c.fillRect(1024*.136-5,0,10,1024);
  c.fillRect(1024*.864-5,0,10,1024);
  // SEPARADORES DE CARRIL discontinuos
  [.318,.5,.682].forEach(u=>{
    for(let y=0;y<1024;y+=200){
      c.fillStyle='rgba(226,220,204,.95)';
      c.fillRect(u*1024-4,y,8,100);
    }
  });
  const tex=new THREE.CanvasTexture(cv);
  tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
  tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  return tex;
}
function makeGrassTex(){
  const cv=document.createElement('canvas');cv.width=256;cv.height=256;
  const c=cv.getContext('2d');c.fillStyle='#4e6e38';c.fillRect(0,0,256,256);
  for(let i=0;i<6000;i++){const v=(Math.random()-.5)*.22;c.fillStyle=`rgba(${v>0?200:0},${v>0?255:0},0,${Math.abs(v)})`;c.fillRect(Math.random()*256,Math.random()*256,1+Math.random()*3,1+Math.random()*3);}
  const t=new THREE.CanvasTexture(cv);t.wrapS=THREE.RepeatWrapping;t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,1);return t;
}

const roadMat=new THREE.MeshStandardMaterial({map:makeRoadTex(),roughness:.7,metalness:.08});
let roadMesh=new THREE.Mesh(buildRibbon(halfWidthFn,.02,60,3),roadMat);
roadMesh.receiveShadow=true; scene.add(roadMesh);

const grassMat=new THREE.MeshStandardMaterial({map:makeGrassTex(),roughness:1});
let grassMesh=new THREE.Mesh(buildRibbon(halfWidthFn,-.06,40,55),grassMat);
grassMesh.receiveShadow=true; scene.add(grassMesh);

// ─── FONDO QUE SIGUE A LA CÁMARA ─────────────────────────────────────
const bgGroup=new THREE.Group(); scene.add(bgGroup);

// Cielo dinámico
const skyCv=document.createElement('canvas');skyCv.width=2;skyCv.height=256;
const skyCtx=skyCv.getContext('2d');
const skyTex=new THREE.CanvasTexture(skyCv);
scene.background=skyTex;
scene.fog=new THREE.Fog(0xd9cdb0,90,300);
const DAY_LEN=100; let dayPhase=.10;
const Cc=h=>new THREE.Color(h);
const SKY_STOPS=[[0,Cc(0x3d6fb8),Cc(0xcfe0e8)],[.33,Cc(0x3d6fb8),Cc(0xd9cdb0)],[.46,Cc(0x533a72),Cc(0xff9d5c)],[.56,Cc(0x070b1a),Cc(0x1a2238)],[.84,Cc(0x070b1a),Cc(0x141c30)],[.94,Cc(0x5a5e9e),Cc(0xf2b48a)],[1,Cc(0x3d6fb8),Cc(0xcfe0e8)]];
const tA=new THREE.Color(),tB=new THREE.Color();
function skyColors(p){for(let i=0;i<SKY_STOPS.length-1;i++){const a=SKY_STOPS[i],b=SKY_STOPS[i+1];if(p>=a[0]&&p<=b[0]){const t=(p-a[0])/(b[0]-a[0]||1);tA.copy(a[1]).lerp(b[1],t);tB.copy(a[2]).lerp(b[2],t);return[tA,tB];}}return[SKY_STOPS[0][1],SKY_STOPS[0][2]];}
function nightness(p){if(p<.44)return 0;if(p<.56)return(p-.44)/.12;if(p<.86)return 1;if(p<.97)return 1-(p-.86)/.11;return 0;}

// Estrellas (en bgGroup)
const starGeo=new THREE.BufferGeometry();
{const pos=new Float32Array(400*3);for(let i=0;i<400;i++){const a=Math.random()*Math.PI*2,e=.1+Math.random()*1.4,r=480;pos[i*3]=Math.cos(a)*Math.cos(e)*r;pos[i*3+1]=Math.sin(e)*r*.6+50;pos[i*3+2]=Math.sin(a)*Math.cos(e)*r;}starGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));}
const starMat=new THREE.PointsMaterial({color:0xeef2ff,size:1.8,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false});
bgGroup.add(new THREE.Points(starGeo,starMat));

// Sol con halo más rico
const sunCv=document.createElement('canvas');sunCv.width=256;sunCv.height=256;
{const c=sunCv.getContext('2d');
  // núcleo brillante
  const g=c.createRadialGradient(128,128,4,128,128,128);
  g.addColorStop(0,'rgba(255,255,250,1)');
  g.addColorStop(.10,'rgba(255,250,220,.95)');
  g.addColorStop(.30,'rgba(255,235,180,.6)');
  g.addColorStop(.55,'rgba(255,220,150,.25)');
  g.addColorStop(1,'rgba(255,200,120,0)');
  c.fillStyle=g;c.fillRect(0,0,256,256);
  // rayos sutiles (cruz suave) que simulan el lens flare
  c.globalCompositeOperation='lighter';
  const gx=c.createLinearGradient(0,128,256,128);
  gx.addColorStop(0,'rgba(255,240,200,0)');gx.addColorStop(.5,'rgba(255,240,200,.18)');gx.addColorStop(1,'rgba(255,240,200,0)');
  c.fillStyle=gx;c.fillRect(0,120,256,16);
  const gy=c.createLinearGradient(128,0,128,256);
  gy.addColorStop(0,'rgba(255,240,200,0)');gy.addColorStop(.5,'rgba(255,240,200,.18)');gy.addColorStop(1,'rgba(255,240,200,0)');
  c.fillStyle=gy;c.fillRect(120,0,16,256);
}
const sunSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(sunCv),transparent:true,fog:false,depthWrite:false}));
sunSprite.scale.set(120,120,1); bgGroup.add(sunSprite);

// Lens flare adicional: anillo grande detrás del sol
const flareCv=document.createElement('canvas');flareCv.width=256;flareCv.height=256;
{const c=flareCv.getContext('2d');
  const g=c.createRadialGradient(128,128,40,128,128,128);
  g.addColorStop(0,'rgba(255,230,180,0)');
  g.addColorStop(.6,'rgba(255,220,160,.06)');
  g.addColorStop(.85,'rgba(255,220,160,.10)');
  g.addColorStop(1,'rgba(255,220,160,0)');
  c.fillStyle=g;c.fillRect(0,0,256,256);
}
const flareSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(flareCv),transparent:true,blending:THREE.AdditiveBlending,fog:false,depthWrite:false}));
flareSprite.scale.set(280,280,1); bgGroup.add(flareSprite);

// Nubes
const cloudCv=document.createElement('canvas');cloudCv.width=256;cloudCv.height=128;
{const c=cloudCv.getContext('2d');for(let i=0;i<16;i++){c.globalAlpha=.2+Math.random()*.3;c.fillStyle='rgba(255,255,255,.9)';c.beginPath();c.ellipse(40+Math.random()*176,50+Math.random()*30,26+Math.random()*36,12+Math.random()*12,0,0,Math.PI*2);c.fill();}}
const cloudTex=new THREE.CanvasTexture(cloudCv);
const clouds=[];
for(let i=0;i<5;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,transparent:true,opacity:.75,fog:false,depthWrite:false}));s.scale.set(130+Math.random()*90,40+Math.random()*22,1);s.position.set(-300+Math.random()*600,60+Math.random()*40,-380-Math.random()*120);s.userData.v=1.2+Math.random()*2;bgGroup.add(s);clouds.push(s);}

// Montañas y ciudad (en bgGroup, lejos)
const mtnMat=new THREE.MeshStandardMaterial({color:0x8b9bb0,roughness:1,flatShading:true});
for(let i=0;i<8;i++){const m=new THREE.Mesh(new THREE.ConeGeometry(30+Math.random()*50,28+Math.random()*34,5),mtnMat);m.position.set((i%2===0?-1:1)*(90+Math.random()*120),0,-300-Math.random()*120);bgGroup.add(m);}

const cityWindows=[];
function makeCity(side){
  const colors=[0x2a2f3a,0x323845,0x28303c,0x3a3550,0x243040];
  for(let i=0;i<10;i++){
    const w=8+Math.random()*14,h=20+Math.random()*60,d=8+Math.random()*14;
    const winCv=document.createElement('canvas');winCv.width=64;winCv.height=128;
    const wc=winCv.getContext('2d');wc.fillStyle='#23283a';wc.fillRect(0,0,64,128);
    for(let wy=4;wy<124;wy+=12)for(let wx=4;wx<60;wx+=10){if(Math.random()>.45){wc.fillStyle=Math.random()>.6?'#ffe9a0':'#c0d8ff';wc.fillRect(wx,wy,7,8);}}
    const winTex=new THREE.CanvasTexture(winCv);
    const mat=new THREE.MeshStandardMaterial({color:colors[i%colors.length],roughness:.85,metalness:.2,emissive:0xffffff,emissiveMap:winTex,emissiveIntensity:0});
    const bld=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    bld.position.set(side*(110+Math.random()*70),h*.5,-180-Math.random()*220);
    bgGroup.add(bld); cityWindows.push(mat);
  }
}
makeCity(-1);makeCity(1);

// ─── LUCES ───────────────────────────────────────────────────────────
const hemi=new THREE.HemisphereLight(0xcfe3ff,0x6a6a55,.75); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe9c4,1.5);
sun.castShadow=true;
sun.shadow.mapSize.set(QUALITY==='alta'?4096:1024, QUALITY==='alta'?4096:1024);
sun.shadow.camera.left=-80;sun.shadow.camera.right=80;
sun.shadow.camera.top=80;sun.shadow.camera.bottom=-80;
sun.shadow.camera.near=.5;sun.shadow.camera.far=200;
sun.shadow.bias=-.0003;
sun.shadow.radius=4;
scene.add(sun); scene.add(sun.target);
const moonLight=new THREE.DirectionalLight(0x4466bb,0); scene.add(moonLight); scene.add(moonLight.target);

// ─── POOLS DE DECORADO ───────────────────────────────────────────────
const postMat=new THREE.MeshStandardMaterial({color:0x5b6168,roughness:.6,metalness:.5});
const railMat=new THREE.MeshStandardMaterial({color:0x9aa2ad,roughness:.4,metalness:.7});
const lampGlowMat=new THREE.MeshStandardMaterial({color:0xfff3cf,emissive:0xffe9a8,emissiveIntensity:.2,roughness:.4});
const signMats=[];   // materiales emisivos que se encienden de noche

// 4 tipos de árbol con personalidad distinta
function makePine(){
  const t=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16,.26,2.4,6),new THREE.MeshStandardMaterial({color:0x4a3220,roughness:.95}));
  trunk.position.y=1.2;trunk.castShadow=true;t.add(trunk);
  const leafMat=new THREE.MeshStandardMaterial({color:0x2e5a30,roughness:.95,flatShading:true});
  // Tres conos apilados (forma piramidal de pino)
  for(let i=0;i<3;i++){
    const c=new THREE.Mesh(new THREE.ConeGeometry(1.3-i*.35,1.3,7),leafMat);
    c.position.y=2.4+i*.85;c.castShadow=true;t.add(c);
  }
  t.scale.setScalar(.85+Math.random()*1.1);t.rotation.y=Math.random()*Math.PI*2;return t;
}
function makeOak(){
  const t=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.28,.42,2.0,6),new THREE.MeshStandardMaterial({color:0x5e4128,roughness:.95}));
  trunk.position.y=1.0;trunk.castShadow=true;t.add(trunk);
  const leafMat=new THREE.MeshStandardMaterial({color:0x3d6b30,roughness:.95,flatShading:true});
  // Copa redonda compuesta de varias esferas
  const positions=[[0,2.6,0],[.85,2.4,.3],[-.7,2.5,-.4],[.2,3.1,-.4]];
  positions.forEach((p,i)=>{
    const r=1.1-i*.15;
    const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0),leafMat);
    m.position.set(p[0],p[1],p[2]);m.castShadow=true;t.add(m);
  });
  t.scale.setScalar(.9+Math.random()*1.2);t.rotation.y=Math.random()*Math.PI*2;return t;
}
function makePoplar(){
  const t=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.14,.22,3.2,6),new THREE.MeshStandardMaterial({color:0x8a7050,roughness:.92}));
  trunk.position.y=1.6;trunk.castShadow=true;t.add(trunk);
  const leafMat=new THREE.MeshStandardMaterial({color:0x6da34a,roughness:.92,flatShading:true});
  // Copa estrecha y alta (álamo)
  const c1=new THREE.Mesh(new THREE.ConeGeometry(.9,3.8,7),leafMat);
  c1.position.y=4.1;c1.castShadow=true;t.add(c1);
  t.scale.setScalar(.85+Math.random()*1.0);t.rotation.y=Math.random()*Math.PI*2;return t;
}
function makePalm(){
  // palmera (apenas para bioma costa)
  const t=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,3.6,6),new THREE.MeshStandardMaterial({color:0x9c7a4a,roughness:.95}));
  trunk.position.y=1.8;trunk.castShadow=true;t.add(trunk);
  const leafMat=new THREE.MeshStandardMaterial({color:0x4d8048,roughness:.85,flatShading:true,side:THREE.DoubleSide});
  // 6 hojas largas alrededor de la copa
  for(let i=0;i<6;i++){
    const leaf=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.5),leafMat);
    leaf.position.set(0,3.7,0);
    leaf.rotation.y=i*Math.PI/3;
    leaf.rotation.z=-.5+Math.random()*.2;
    leaf.translateX(.9);
    t.add(leaf);
  }
  t.scale.setScalar(.9+Math.random()*.6);t.rotation.y=Math.random()*Math.PI*2;return t;
}

// Función genérica que elige tipo según el "bioma" actual (se actualiza al regenerar)
let currentBiome='mixto';   // 'mixto', 'bosque', 'costa', 'desierto', 'montana'
function makeTree(){
  // Mezcla por bioma
  const r=Math.random();
  if(currentBiome==='bosque'){
    if(r<.55)return makePine();
    if(r<.85)return makeOak();
    return makePoplar();
  } else if(currentBiome==='costa'){
    if(r<.55)return makePalm();
    if(r<.8)return makeOak();
    return makePoplar();
  } else if(currentBiome==='desierto'){
    if(r<.5)return makePalm();
    return makeOak();
  } else if(currentBiome==='montana'){
    if(r<.7)return makePine();
    return makeOak();
  }
  // mixto
  if(r<.30)return makePine();
  if(r<.65)return makeOak();
  if(r<.85)return makePoplar();
  return makePalm();
}

function makeBushRock(){
  if(Math.random()<.55){
    const b=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color:0x355730,roughness:.95,flatShading:true});
    for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.5+Math.random()*.4,0),mat);m.position.set((Math.random()-.5)*.9,.35+Math.random()*.2,(Math.random()-.5)*.9);m.castShadow=true;b.add(m);}
    b.scale.setScalar(.7+Math.random()*.8);return b;
  }
  const r=new THREE.Mesh(new THREE.IcosahedronGeometry(.5+Math.random()*.5,0),new THREE.MeshStandardMaterial({color:0x7d8088,roughness:.95,flatShading:true}));
  r.scale.y=.55;r.position.y=.2;r.rotation.y=Math.random()*Math.PI;r.castShadow=true;return r;
}
function makeLamp(){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,7,6),postMat);pole.position.y=3.5;pole.castShadow=true;g.add(pole);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(2,.12,.12),postMat);arm.position.set(-1,6.9,0);g.add(arm);
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(.7,.18,.3),lampGlowMat);lamp.position.set(-2,6.85,0);g.add(lamp);
  return g;
}
const BB_TXTS=[['CUIDADO:','MIGUEL TIENE','EL PUÑO LISTO'],['RAÚL E.','PILOTO DEL AÑO','(según Raúl)'],['DANIEL','CRUZA POR DONDE','LE DA LA GANA'],['RODRIGO','NUNCA MIRA','AL CRUZAR'],['PRÓXIMA SALIDA:','NINGUNA','SIGA RECTO'],['JORGE G.','TIENE PRISA','¿ADÓNDE VAS?'],['TURBO: ON','CEREBRO: OFF','GG'],['¡CUIDADO!','RASANTE','A 200 km/h']];
let bbIdx=0;
function makeBillboard(){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:0x4a4f58,roughness:.7,metalness:.4});
  [-1.6,1.6].forEach(x=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.22,5,.22),mat);p.position.set(x,2.5,0);p.castShadow=true;g.add(p);});
  const cv=document.createElement('canvas');cv.width=512;cv.height=256;
  const c=cv.getContext('2d');
  c.fillStyle='#0e1420';c.fillRect(0,0,512,256);
  c.strokeStyle='#ffd23f';c.lineWidth=10;c.strokeRect(10,10,492,236);
  const lines=BB_TXTS[bbIdx++%BB_TXTS.length];
  c.fillStyle='#ffd23f';c.font='bold 46px "Trebuchet MS",sans-serif';c.textAlign='center';
  lines.forEach((l,i)=>c.fillText(l,256,90+i*62));
  const tex=new THREE.CanvasTexture(cv);
  const mat2=new THREE.MeshStandardMaterial({map:tex,roughness:.6,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:0});
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(6.4,3.2),mat2);
  panel.position.y=5.4;g.add(panel);signMats.push(mat2);
  return g;
}
const SIGN_TXTS=[['Santander','12'],['Bilbao','98'],['Laredo','46'],['Torrelavega','24']];
let signIdx=0;
function makeGantry(){
  const g=new THREE.Group();
  const bm=new THREE.MeshStandardMaterial({color:0x6b7280,roughness:.5,metalness:.6});
  [-1,1].forEach(s=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.28,8,.28),bm);p.position.set(s*(ROAD_W*.5+2),4,0);p.castShadow=true;g.add(p);});
  const beam=new THREE.Mesh(new THREE.BoxGeometry(ROAD_W+5,.34,.34),bm);beam.position.y=7.8;g.add(beam);
  const cv=document.createElement('canvas');cv.width=512;cv.height=160;
  const c=cv.getContext('2d');
  c.fillStyle='#0c5c3a';c.fillRect(0,0,512,160);
  c.strokeStyle='#e8eee9';c.lineWidth=8;c.strokeRect(8,8,496,144);
  const t=SIGN_TXTS[signIdx++%SIGN_TXTS.length];
  c.fillStyle='#f2f6f0';c.font='bold 64px "Trebuchet MS",sans-serif';c.fillText(t[0],36,102);
  c.font='bold 56px "Trebuchet MS",sans-serif';c.fillText(t[1],420,100);
  const tex=new THREE.CanvasTexture(cv);
  const mat2=new THREE.MeshStandardMaterial({map:tex,roughness:.6,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:0});
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(8,2.5),mat2);
  sign.position.set(-2,6.1,.3);g.add(sign);signMats.push(mat2);
  return g;
}
// Pilar de puente (cilindro alto de hormigón)
function makeBridgePillar(){
  const g=new THREE.Group();
  const concrete=new THREE.MeshStandardMaterial({color:0xb8b3a8,roughness:.85,metalness:.05});
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.8,1.0,12,8),concrete);
  pillar.position.y=-6;   // bajo la carretera, hacia abajo
  pillar.castShadow=true;pillar.receiveShadow=true;
  g.add(pillar);
  // base ensanchada
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.6,1.0,8),concrete);
  base.position.y=-12; g.add(base);
  return g;
}

// Barandilla del puente (a los lados, alta y robusta)
function makeBridgeRail(){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:0x9a9a9a,roughness:.4,metalness:.7});
  const concMat=new THREE.MeshStandardMaterial({color:0xc8c4b8,roughness:.85});
  const len=20;
  // Muro inferior de hormigón
  const wall=new THREE.Mesh(new THREE.BoxGeometry(.25,.7,len),concMat);
  wall.position.y=.4;wall.castShadow=true;g.add(wall);
  // Pasamanos metálico arriba
  const top=new THREE.Mesh(new THREE.BoxGeometry(.18,.10,len),mat);
  top.position.y=.9;g.add(top);
  // Postes verticales finos cada 2m
  for(let z=-len/2+1;z<=len/2-1;z+=2){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.10,.45,.10),mat);
    post.position.set(0,.65,z);g.add(post);
  }
  return g;
}

// Incorporación: rampa decorativa que sale de la carretera y se aleja en curva
function makeOnramp(){
  const g=new THREE.Group();
  const asfMat=new THREE.MeshStandardMaterial({color:0x33363e,roughness:.7});
  const concMat=new THREE.MeshStandardMaterial({color:0xc8c4b8,roughness:.85});
  // Rampa: una plancha curvada hecha de varios segmentos
  const N=14, len=35;
  const positions=[],uvs=[],indices=[];
  for(let i=0;i<=N;i++){
    const t=i/N;
    // posición curvada que se aleja
    const z=-t*len;                          // avanza hacia atrás
    const x=Math.pow(t,1.6)*-9;              // se desvía a la izquierda
    const y=-t*1.5;                          // baja ligeramente
    // ancho local que se va estrechando
    const w=3.5-(t*1.0);
    positions.push(x-w,y,z); positions.push(x+w,y,z);
    uvs.push(0,t*8); uvs.push(1,t*8);
    if(i<N){
      const a=i*2,b=i*2+1,c=(i+1)*2,d=(i+1)*2+1;
      indices.push(a,c,b, b,c,d);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(positions),3));
  geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uvs),2));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices),1));
  geo.computeVertexNormals();
  const ramp=new THREE.Mesh(geo,asfMat);
  ramp.receiveShadow=true; g.add(ramp);
  // Barrera de hormigón al lado
  for(let i=0;i<6;i++){
    const t=i/6;
    const z=-t*len; const x=Math.pow(t,1.6)*-9 - (3.5-t*1.0) - .3;
    const y=-t*1.5+.35;
    const b=new THREE.Mesh(new THREE.BoxGeometry(.4,.7,4),concMat);
    b.position.set(x,y,z); g.add(b);
  }
  return g;
}

function makeTunnel(){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:0x44484f,roughness:.9});
  // paredes laterales (a lo largo de -z local, como los coches)
  [-1,1].forEach(s=>{
    const wall=new THREE.Mesh(new THREE.BoxGeometry(1,7,60),mat);
    wall.position.set(s*(ROAD_W*.5+1.8),3.5,0);
    wall.receiveShadow=true;g.add(wall);
  });
  // techo
  const roof=new THREE.Mesh(new THREE.BoxGeometry(ROAD_W+5.6,1,60),mat);
  roof.position.y=7.5;roof.receiveShadow=true;g.add(roof);
  // luces interiores
  [-22,-8,8,22].forEach(zz=>{
    const ln=new THREE.Mesh(new THREE.BoxGeometry(1.8,.16,.5),new THREE.MeshStandardMaterial({color:0xffefb0,emissive:0xffde80,emissiveIntensity:.6}));
    ln.position.set(0,6.9,zz);g.add(ln);
  });
  return g;
}
// Quitamiedos metálicos (guard rail) — se colocan a lo largo de la carretera en tramos curvos.
// IMPORTANTE: construido a lo largo del eje Z (no X). FRONT=(0,0,-1), así que cuando
// quaternion.setFromUnitVectors(FRONT, tan) lo orienta, queda paralelo a la calzada.
function makeGuardRail(){
  const g=new THREE.Group();
  const railMat2=new THREE.MeshStandardMaterial({color:0xb8bcc4,roughness:.35,metalness:.85});
  const postMat2=new THREE.MeshStandardMaterial({color:0x4a4e56,roughness:.6,metalness:.5});
  const railLen=24;
  // Rail con 3 cintas horizontales que corren A LO LARGO de Z (paralelas a la marcha)
  for(let yy=0;yy<3;yy++){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.08,.14,railLen),railMat2);
    rail.position.y=1.05+yy*.08; rail.castShadow=true;
    g.add(rail);
  }
  // Postes verticales a lo largo de Z, cada 4m
  for(let z=-railLen/2+1;z<=railLen/2-1;z+=4){
    const p=new THREE.Mesh(new THREE.BoxGeometry(.10,1.1,.10),postMat2);
    p.position.set(0,.55,z); p.castShadow=true;
    g.add(p);
  }
  return g;
}

// Marcadores kilométricos: poste blanco con franja roja
function makeKmMarker(){
  const g=new THREE.Group();
  const postMat=new THREE.MeshStandardMaterial({color:0xe8e8e0,roughness:.7});
  const redMat=new THREE.MeshStandardMaterial({color:0xc1121f,roughness:.6});
  const post=new THREE.Mesh(new THREE.BoxGeometry(.22,1.2,.08),postMat);
  post.position.y=.6; post.castShadow=true; g.add(post);
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(.24,.18,.085),redMat);
  stripe.position.y=1.08; g.add(stripe);
  const base=new THREE.Mesh(new THREE.BoxGeometry(.3,.08,.18),postMat);
  base.position.y=.04; g.add(base);
  return g;
}

// Pools
const lampPool=[],treePool=[],bushPool=[],bbPool=[],gantryPool=[],railPool=[],kmPool=[];
for(let i=0;i<14;i++){const l=makeLamp();scene.add(l);lampPool.push(l);}
for(let i=0;i<30;i++){const t=makeTree();scene.add(t);treePool.push(t);}
for(let i=0;i<22;i++){const b=makeBushRock();scene.add(b);bushPool.push(b);}
for(let i=0;i<5;i++){const b=makeBillboard();scene.add(b);bbPool.push(b);}
for(let i=0;i<4;i++){const g=makeGantry();scene.add(g);gantryPool.push(g);}
for(let i=0;i<18;i++){const r=makeGuardRail();scene.add(r);railPool.push(r);}
for(let i=0;i<8;i++){const k=makeKmMarker();scene.add(k);kmPool.push(k);}
const tunnelObj=makeTunnel(); scene.add(tunnelObj);
// Pools de puente y rampa
const pillarPool=[], bridgeRailPool=[], rampPool=[];
for(let i=0;i<20;i++){const p=makeBridgePillar();p.visible=false;scene.add(p);pillarPool.push(p);}
for(let i=0;i<14;i++){const r=makeBridgeRail();r.visible=false;scene.add(r);bridgeRailPool.push(r);}
for(let i=0;i<4;i++){const r=makeOnramp();r.visible=false;scene.add(r);rampPool.push(r);}
let tunnelZone=null;   // {s0,s1}

// ── Árboles de fondo con instancing (lejanos, llenan el horizonte) ──
// Un único draw call para 300 árboles → barato.
const BG_TREES=300;
const bgTreeGeo=new THREE.ConeGeometry(1.4,3.2,5);
const bgTreeMat=new THREE.MeshStandardMaterial({color:0x365a36,roughness:.95,flatShading:true});
const bgTrees=new THREE.InstancedMesh(bgTreeGeo,bgTreeMat,BG_TREES);
bgTrees.frustumCulled=false;
scene.add(bgTrees);
const _dummy=new THREE.Object3D();
function repositionBgTrees(){
  // se colocan en una banda ancha a ambos lados, alejados de la carretera
  let ix=0;
  for(let s=20;s<splineLen-20&&ix<BG_TREES;s+=18){
    frameAt(s,F2);
    [-1,1].forEach(side=>{
      if(ix>=BG_TREES)return;
      for(let k=0;k<2;k++){
        if(ix>=BG_TREES)return;
        const dist=ROAD_W*.5+22+Math.random()*60;
        const sc=.7+Math.random()*1.5;
        const pos=F2.pos.clone().add(F2.right.clone().multiplyScalar(side*dist));
        pos.y=F2.pos.y;
        _dummy.position.copy(pos);
        _dummy.rotation.set(0,Math.random()*Math.PI*2,0);
        _dummy.scale.setScalar(sc);
        _dummy.updateMatrix();
        bgTrees.setMatrixAt(ix++,_dummy.matrix);
      }
    });
  }
  // ocultar los no usados moviéndolos lejos
  while(ix<BG_TREES){
    _dummy.position.set(0,-1000,0);_dummy.scale.setScalar(0);_dummy.updateMatrix();
    bgTrees.setMatrixAt(ix++,_dummy.matrix);
  }
  bgTrees.instanceMatrix.needsUpdate=true;
}

// ── Mediana central permanente (separa los 2 carriles izquierda de los 2 derecha) ──
// Es una larga "jersey" de hormigón que sigue la carretera.
const medianGeo=new THREE.BoxGeometry(.6,.65,10);
const medianMat=new THREE.MeshStandardMaterial({color:0xc8c4b8,roughness:.85});
const N_MEDIAN=46;
const medianInst=new THREE.InstancedMesh(medianGeo,medianMat,N_MEDIAN);
medianInst.castShadow=false;
medianInst.receiveShadow=true;
scene.add(medianInst);
function repositionMedian(){
  let ix=0;
  for(let s=0;s<splineLen-10&&ix<N_MEDIAN;s+=10){
    // Solo en zonas de autovía (4 carriles)
    if(halfWidthAtS(s)<HW_FULL-.5)continue;
    frameAt(s,F2);
    _dummy.position.copy(F2.pos);
    _dummy.position.y+=.32;
    _dummy.quaternion.setFromUnitVectors(FRONT,F2.tan);
    _dummy.scale.set(1,1,1);
    _dummy.updateMatrix();
    medianInst.setMatrixAt(ix++,_dummy.matrix);
  }
  while(ix<N_MEDIAN){
    _dummy.position.set(0,-1000,0);_dummy.scale.set(0,0,0);_dummy.updateMatrix();
    medianInst.setMatrixAt(ix++,_dummy.matrix);
  }
  medianInst.instanceMatrix.needsUpdate=true;
}

// ── Pájaros volando (sprites animados en el cielo) ──
const birds=[];
const birdCv=document.createElement('canvas');birdCv.width=64;birdCv.height=32;
{
  const c=birdCv.getContext('2d');
  c.strokeStyle='#1a1a1a';c.lineWidth=3;c.lineCap='round';
  // V de gaviota
  c.beginPath();c.moveTo(8,22);c.lineTo(32,8);c.lineTo(56,22);c.stroke();
}
const birdTex=new THREE.CanvasTexture(birdCv);
const birdMat=new THREE.SpriteMaterial({map:birdTex,transparent:true,depthWrite:false,fog:true});
for(let i=0;i<6;i++){
  const b=new THREE.Sprite(birdMat.clone());
  b.scale.set(3,1.5,1);
  b.position.set(-200+Math.random()*400,40+Math.random()*30,-180-Math.random()*120);
  b.userData={vx:6+Math.random()*4,sway:Math.random()*Math.PI*2};
  birds.push(b);
  bgGroup.add(b);
}

function populateDeco(){
  // ocultar todo primero (las piezas que no se usen quedan invisibles)
  lampPool.forEach(o=>o.visible=false);
  treePool.forEach(o=>o.visible=false);
  bushPool.forEach(o=>o.visible=false);
  bbPool.forEach(o=>o.visible=false);
  gantryPool.forEach(o=>o.visible=false);
  railPool.forEach(o=>o.visible=false);
  kmPool.forEach(o=>o.visible=false);
  pillarPool.forEach(o=>o.visible=false);
  bridgeRailPool.forEach(o=>o.visible=false);
  rampPool.forEach(o=>o.visible=false);
  let li=0,ti=0,bi=0,bbi=0,gi=0,ri=0,ki=0,pi=0,bri=0,rpi=0;
  const lampStep=130, treeStep=46, gantryStep=560, bbStep=440;
  const railStep=70, kmStep=350;

  // ── PUENTES: detectar tramos elevados (y>3) y poner pilares debajo + barandillas ──
  // Recorrer el spline buscando picos
  const bridgeZones=[];
  let inBridge=false, bridgeStart=0;
  for(let s=20;s<splineLen-20;s+=8){
    frameAt(s,F2);
    const elevated=F2.pos.y>3.0;
    if(elevated&&!inBridge){inBridge=true;bridgeStart=s;}
    else if(!elevated&&inBridge){inBridge=false;
      if(s-bridgeStart>40)bridgeZones.push({s0:bridgeStart,s1:s});
    }
  }
  if(inBridge)bridgeZones.push({s0:bridgeStart,s1:splineLen-20});
  // colocar pilares cada 16m en cada zona, y barandillas cada 20m
  for(const bz of bridgeZones){
    for(let s=bz.s0+8;s<bz.s1-8 && pi<pillarPool.length;s+=16){
      frameAt(s,F2);
      const pl=pillarPool[pi++];
      pl.position.copy(F2.pos);
      pl.quaternion.identity();
      pl.visible=true;
    }
    for(let s=bz.s0+10;s<bz.s1-10 && bri<bridgeRailPool.length;s+=20){
      frameAt(s,F2);
      const hw=halfWidthAtS(s);
      for(const side of [-1,1]){
        if(bri>=bridgeRailPool.length)break;
        const br=bridgeRailPool[bri++];
        br.position.copy(F2.pos).add(F2.right.clone().multiplyScalar(side*(hw+.5)));
        br.position.y=F2.pos.y-.1;
        br.quaternion.setFromUnitVectors(FRONT,F2.tan);
        br.visible=true;
      }
    }
  }

  // ── INCORPORACIONES (rampas decorativas) ──
  // 2-3 a lo largo del spline, en zonas anchas (4 carriles) y rectas
  let placed=0;
  for(let s=400;s<splineLen-200&&placed<3&&rpi<rampPool.length;s+=600+Math.random()*400){
    // Solo si hay 4 carriles y la zona es relativamente plana
    if(halfWidthAtS(s)<HW_FULL-.5)continue;
    frameAt(s,F2);
    frameAt(s+30,F);
    const curveSign=Math.abs(F2.tan.x*F.tan.z-F2.tan.z*F.tan.x);
    if(curveSign>.05)continue;   // saltar si hay curva pronunciada
    const ramp=rampPool[rpi++];
    // Lado random (-1 o 1)
    const side=Math.random()<.5?-1:1;
    ramp.position.copy(F2.pos).add(F2.right.clone().multiplyScalar(side*(HW_FULL+.2)));
    ramp.quaternion.setFromUnitVectors(FRONT,F2.tan);
    // mirror si va al otro lado
    if(side<0)ramp.scale.set(-1,1,1); else ramp.scale.set(1,1,1);
    ramp.visible=true;
    placed++;
  }

  // ── Quitamiedos: detectar tramos curvos y poner railes en el lado exterior ──
  for(let s=80;s<splineLen-80&&ri<railPool.length;s+=railStep){
    frameAt(s,F2);
    // Detectar curvatura mirando la tangente en s y en s+30
    frameAt(s+30,F);
    // Producto cruzado de las dos tangentes nos dice la dirección de la curva
    const curveSign=Math.sign(F2.tan.x*F.tan.z-F2.tan.z*F.tan.x);
    if(Math.abs(curveSign)<.001)continue;
    // Poner el rail en el lado EXTERIOR (donde te saldrías si no frenas)
    const side=curveSign>0?1:-1;
    const rail=railPool[ri++];
    rail.position.copy(F2.pos).add(F2.right.clone().multiplyScalar(side*(halfWidthAtS(s)+.6)));
    rail.position.y=F2.pos.y;
    rail.quaternion.setFromUnitVectors(FRONT,F2.tan);
    rail.visible=true;
  }

  // ── Marcadores kilométricos cada 350 m ──
  for(let s=120;s<splineLen-60&&ki<kmPool.length;s+=kmStep){
    frameAt(s,F2);
    const km=kmPool[ki++];
    // siempre a la derecha del arcén
    km.position.copy(F2.pos).add(F2.right.clone().multiplyScalar(-(halfWidthAtS(s)+2.5)));
    km.position.y=F2.pos.y;
    km.quaternion.setFromUnitVectors(FRONT,F2.tan);
    km.visible=true;
  }

  for(let s=60;s<splineLen-60&&li<lampPool.length;s+=lampStep){
    frameAt(s,F2);
    const side=(li%2===0)?1:-1;
    const lp=lampPool[li++];
    lp.position.copy(F2.pos).add(F2.right.clone().multiplyScalar(side*(halfWidthAtS(s)+2)));
    lp.quaternion.setFromUnitVectors(FRONT,F2.tan);
    if(side<0)lp.rotateY(Math.PI);
    lp.visible=true;
  }
  for(let s=40;s<splineLen-40&&ti<treePool.length;s+=treeStep){
    frameAt(s+Math.random()*20,F2);
    const side=Math.random()<.5?-1:1;
    const tr=treePool[ti++];
    tr.position.copy(F2.pos).add(F2.right.clone().multiplyScalar(side*(halfWidthAtS(s)+6+Math.random()*26)));
    tr.position.y=F2.pos.y; tr.visible=true;
  }
  for(let s=55;s<splineLen-40&&bi<bushPool.length;s+=62){
    frameAt(s+Math.random()*18,F2);
    const side=Math.random()<.5?-1:1;
    const b=bushPool[bi++];
    b.position.copy(F2.pos).add(F2.right.clone().multiplyScalar(side*(halfWidthAtS(s)+4+Math.random()*22)));
    b.position.y=F2.pos.y; b.visible=true;
  }
  for(let s=300;s<splineLen-80&&bbi<bbPool.length;s+=bbStep){
    frameAt(s,F2);
    const side=bbi%2===0?1:-1;
    const bb=bbPool[bbi++];
    bb.position.copy(F2.pos).add(F2.right.clone().multiplyScalar(side*(halfWidthAtS(s)+9)));
    bb.quaternion.setFromUnitVectors(FRONT,F2.tan);
    bb.rotateY(side>0?-.45:.45+Math.PI);
    bb.visible=true;
  }
  for(let s=220;s<splineLen-80&&gi<gantryPool.length;s+=gantryStep){
    frameAt(s,F2);
    const g=gantryPool[gi++];
    g.position.copy(F2.pos);
    g.quaternion.setFromUnitVectors(FRONT,F2.tan);
    g.visible=true;
  }
  // Túnel: buscar un tramo bajo
  tunnelZone=null; tunnelObj.visible=false;
  for(let s=500;s<splineLen-200;s+=120){
    frameAt(s,F2);
    if(F2.pos.y<2.5){
      tunnelObj.position.copy(F2.pos);
      tunnelObj.quaternion.setFromUnitVectors(FRONT,F2.tan);
      tunnelObj.visible=true;
      tunnelZone={s0:s-32,s1:s+32};
      break;
    }
  }
}
populateDeco();
repositionBgTrees();
repositionMedian();

// ─── VEHÍCULOS ───────────────────────────────────────────────────────
const headMat=new THREE.MeshStandardMaterial({color:0xfff4c8,emissive:0xfff0b0,emissiveIntensity:.6});
const tailMat=new THREE.MeshStandardMaterial({color:0x991111,emissive:0xff2222,emissiveIntensity:.8});
const darkMat=new THREE.MeshStandardMaterial({color:0x14161c,roughness:.7});
const glassMat=new THREE.MeshStandardMaterial({color:0x222d38,roughness:.1,metalness:.8});
const chromeMat=new THREE.MeshStandardMaterial({color:0xc9ced6,roughness:.2,metalness:.9});
function addWheels(car,pts,r){
  const wg=new THREE.CylinderGeometry(r,r,.38,14),hg=new THREE.CylinderGeometry(r*.46,r*.46,.4,8);
  pts.forEach(p=>{
    const w=new THREE.Mesh(wg,darkMat);w.rotation.z=Math.PI/2;w.position.set(p[0],r,p[1]);w.castShadow=true;car.add(w);
    const h=new THREE.Mesh(hg,chromeMat);h.rotation.z=Math.PI/2;h.position.set(p[0]*1.01,r,p[1]);car.add(h);
  });
}
function addLights(car,w,zf,zb,y){
  const lg=new THREE.BoxGeometry(.42,.18,.08);
  [-w,w].forEach(x=>{
    const hl=new THREE.Mesh(lg,headMat);hl.position.set(x,y,zf);car.add(hl);
    const tl=new THREE.Mesh(lg,tailMat);tl.position.set(x,y,zb);car.add(tl);
  });
}
function makeCar(color){
  const car=new THREE.Group();
  const p=new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.55});
  const b=new THREE.Mesh(new THREE.BoxGeometry(2,.62,4.1),p);b.position.y=.66;b.castShadow=true;car.add(b);
  const h=new THREE.Mesh(new THREE.BoxGeometry(1.9,.3,1.2),p);h.position.set(0,.95,-1.35);h.castShadow=true;car.add(h);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(1.72,.58,1.9),glassMat);cab.position.set(0,1.25,.25);cab.castShadow=true;car.add(cab);
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.8,.1,2),p);top.position.set(0,1.58,.25);car.add(top);
  const bf=new THREE.Mesh(new THREE.BoxGeometry(2.04,.3,.25),chromeMat);bf.position.set(0,.42,-2.1);car.add(bf);
  const bb=bf.clone();bb.position.z=2.1;car.add(bb);
  addWheels(car,[[-1.02,1.32],[1.02,1.32],[-1.02,-1.32],[1.02,-1.32]],.42);
  addLights(car,.62,-2.06,2.06,.72);
  car.userData.halfLen=2.05;return car;
}
function makeTruck(color){
  const car=new THREE.Group();
  const p=new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.4});
  const bm=new THREE.MeshStandardMaterial({color:0xd0d4da,roughness:.7});
  const cab=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.7,1.9),p);cab.position.set(0,1.25,-2.4);cab.castShadow=true;car.add(cab);
  const cargo=new THREE.Mesh(new THREE.BoxGeometry(2.4,2.3,4.8),bm);cargo.position.set(0,1.55,1.1);cargo.castShadow=true;car.add(cargo);
  addWheels(car,[[-1.1,-2.4],[1.1,-2.4],[-1.1,.4],[1.1,.4],[-1.1,2.6],[1.1,2.6]],.5);
  addLights(car,.75,-3.38,3.52,.7);
  car.userData.halfLen=3.4;return car;
}
function makeVan(color){
  const car=new THREE.Group();
  const p=new THREE.MeshStandardMaterial({color,roughness:.4,metalness:.45});
  const b=new THREE.Mesh(new THREE.BoxGeometry(2.1,1.6,4.6),p);b.position.y=1.05;b.castShadow=true;car.add(b);
  addWheels(car,[[-1.06,1.5],[1.06,1.5],[-1.06,-1.5],[1.06,-1.5]],.44);
  addLights(car,.66,-2.32,2.32,.65);
  car.userData.halfLen=2.4;return car;
}
const TRAFFIC_COLORS=[0x9b1c1c,0x1d4e89,0x2f6f43,0x6b3fa0,0xb35418,0xd8d8d8,0x20767c,0x334466];
const traffic=[];
for(let i=0;i<12;i++){
  let c;
  if(i<7)c=makeCar(TRAFFIC_COLORS[i%TRAFFIC_COLORS.length]);
  else if(i<10)c=makeTruck(i===7?0xc23b22:i===8?0x2255aa:0x556677);
  else c=makeVan(i===10?0xe8e8e8:0x3a3f49);
  c.visible=false;
  c.userData.active=false;c.userData.speed=0;c.userData.s=0;c.userData.lane=0;c.userData.targetLane=null;c.userData.passed=false;
  scene.add(c);traffic.push(c);
}

// ─── COCHE PROPIO ────────────────────────────────────────────────────
const playerCar=new THREE.Group();
const hoodMat=new THREE.MeshStandardMaterial({color:0xc7a13a,roughness:.3,metalness:.6});
const ownHood=new THREE.Mesh(new THREE.BoxGeometry(1.9,.22,1.7),hoodMat);ownHood.position.set(0,.92,-1.6);ownHood.castShadow=true;playerCar.add(ownHood);
const hoodTip=new THREE.Mesh(new THREE.BoxGeometry(1.94,.3,.4),hoodMat);hoodTip.position.set(0,.82,-2.4);playerCar.add(hoodTip);
// Sombra falsa del coche: elipse oscura semi-transparente en el suelo
const shadowCv=document.createElement('canvas');shadowCv.width=128;shadowCv.height=64;
{const sc=shadowCv.getContext('2d');const g=sc.createRadialGradient(64,32,4,64,32,60);g.addColorStop(0,'rgba(0,0,0,.7)');g.addColorStop(.7,'rgba(0,0,0,.3)');g.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=g;sc.fillRect(0,0,128,64);}
const shadowTex=new THREE.CanvasTexture(shadowCv);
const carShadow=new THREE.Mesh(new THREE.PlaneGeometry(4.4,2.4),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));
carShadow.rotation.x=-Math.PI/2;carShadow.position.y=.02;playerCar.add(carShadow);
const headlights=[];
[-0.62,0.62].forEach(x=>{
  const sp=new THREE.SpotLight(0xfff2cc,0,80,.38,.55,1.2);sp.position.set(x,.9,-2.3);sp.target.position.set(x*1.4,-1,-28);playerCar.add(sp);playerCar.add(sp.target);headlights.push(sp);
});
scene.add(playerCar);

// ─── COCKPIT (compacto, en el tercio inferior) ───────────────────────
// Diseño: todo se hunde hacia abajo (y negativa) y se aleja un poco (z más negativo)
// para que ocupe solo el ~30% inferior de la vista y deje libre la carretera.
const cockpit=new THREE.Group();
const dashMat=new THREE.MeshStandardMaterial({color:0x191b20,roughness:.85});
const trimMat=new THREE.MeshStandardMaterial({color:0x2a2d35,roughness:.7,metalness:.3});

// Salpicadero principal — bajo y ancho, fuera de la línea de visión
{const m=new THREE.Mesh(new THREE.BoxGeometry(2.6,.28,.5),dashMat);m.position.set(0,-.78,-1.15);cockpit.add(m);}
// Borde superior del salpicadero (línea que enmarca la carretera)
{const m=new THREE.Mesh(new THREE.BoxGeometry(2.6,.04,.55),trimMat);m.position.set(0,-.62,-1.18);cockpit.add(m);}
// Consola central baja (entre asientos)
{const m=new THREE.Mesh(new THREE.BoxGeometry(.5,.28,.7),dashMat);m.position.set(0,-.85,-.7);cockpit.add(m);}
// Palanca de cambios — más a la derecha y más baja
{
  const stick=new THREE.Group();
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.022,.026,.18,8),new THREE.MeshStandardMaterial({color:0x444851,roughness:.6,metalness:.6}));
  shaft.position.y=.09;stick.add(shaft);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.05,12,10),new THREE.MeshStandardMaterial({color:0x14161c,roughness:.4,metalness:.5}));
  knob.position.y=.19;stick.add(knob);
  stick.position.set(.16,-.78,-.55);cockpit.add(stick);
}

// Cuadro de instrumentos — pequeño, hundido en el salpicadero
{
  const gcv=document.createElement('canvas');gcv.width=384;gcv.height=128;
  const gx=gcv.getContext('2d');
  gx.fillStyle='#0a0c11';gx.fillRect(0,0,384,128);
  [[96,'#ffd23f','RPM'],[288,'#7ec8ff','SPD']].forEach(d=>{
    gx.strokeStyle='#3a4252';gx.lineWidth=4;gx.beginPath();gx.arc(d[0],64,42,0,Math.PI*2);gx.stroke();
    for(let a=0;a<11;a++){
      const ang=Math.PI*.72+a*(Math.PI*1.56/10);
      gx.strokeStyle='#aab4c4';gx.lineWidth=2;
      gx.beginPath();gx.moveTo(d[0]+Math.cos(ang)*34,64+Math.sin(ang)*34);
      gx.lineTo(d[0]+Math.cos(ang)*40,64+Math.sin(ang)*40);gx.stroke();
    }
    gx.strokeStyle=d[1];gx.lineWidth=3;
    gx.beginPath();gx.moveTo(d[0],64);
    gx.lineTo(d[0]+Math.cos(Math.PI*1.5)*32,64+Math.sin(Math.PI*1.5)*32);gx.stroke();
    gx.fillStyle=d[1];gx.beginPath();gx.arc(d[0],64,5,0,Math.PI*2);gx.fill();
  });
  const tex=new THREE.CanvasTexture(gcv);
  const gp=new THREE.Mesh(new THREE.PlaneGeometry(.72,.24),
    new THREE.MeshStandardMaterial({map:tex,emissive:0x445566,emissiveMap:tex,emissiveIntensity:.7,roughness:.4}));
  gp.position.set(0,-.66,-1.05);gp.rotation.x=-.42;cockpit.add(gp);
}

// VOLANTE — más pequeño, bajo, asomando como en un coche de verdad
const wheel=new THREE.Group();
const rimMat=new THREE.MeshStandardMaterial({color:0x1d1f24,roughness:.55,metalness:.15});
const rimAccent=new THREE.MeshStandardMaterial({color:0xc7a13a,roughness:.4,metalness:.6});
const rim=new THREE.Mesh(new THREE.TorusGeometry(.22,.030,12,32),rimMat);
wheel.add(rim);
function spoke(angle){
  const s=new THREE.Mesh(new THREE.BoxGeometry(.20,.04,.03),rimMat);
  s.position.x=Math.cos(angle)*.11;s.position.y=Math.sin(angle)*.11;
  s.rotation.z=angle;
  wheel.add(s);
}
spoke(0);spoke(Math.PI);spoke(-Math.PI/2);
const hub=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.04,16),rimAccent);
hub.rotation.x=Math.PI/2;wheel.add(hub);

// Volante hundido y centrado en el tercio inferior; muy poca inclinación
wheel.position.set(0,-.70,-.78);
wheel.rotation.x=-.10;
cockpit.add(wheel);

// Manos del piloto agarrando el volante (a las 9 y las 3, pequeñas)
const handMat=new THREE.MeshStandardMaterial({color:0xd9ab8c,roughness:.85});
const sleeveMat=new THREE.MeshStandardMaterial({color:0xc7a13a,roughness:.85});
function makeHand(side){
  const h=new THREE.Group();
  const sleeve=new THREE.Mesh(new THREE.BoxGeometry(.08,.10,.08),sleeveMat);
  sleeve.position.y=.05;h.add(sleeve);
  const hand=new THREE.Mesh(new THREE.BoxGeometry(.075,.09,.085),handMat);
  hand.position.y=-.03;h.add(hand);
  return h;
}
const handL=makeHand(-1);
const handR=makeHand(1);
cockpit.add(handL);cockpit.add(handR);

camera.add(cockpit);

// ─── PERSONAJES ──────────────────────────────────────────────────────
function makePerson(faceUrl,shirtHex,pantsHex,collarHex){
  const g=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:0xd9ab8c,roughness:.8});
  const hair=new THREE.MeshStandardMaterial({color:0x2a2016,roughness:.9});
  const shirt=new THREE.MeshStandardMaterial({color:shirtHex,roughness:.85});
  const pants=new THREE.MeshStandardMaterial({color:pantsHex,roughness:.9});
  const shoe=new THREE.MeshStandardMaterial({color:0x1a1c20,roughness:.7});
  const faceTex=new THREE.TextureLoader().load(faceUrl);faceTex.encoding=THREE.sRGBEncoding;
  const faceMat=new THREE.MeshStandardMaterial({map:faceTex,roughness:.75});
  const head=new THREE.Mesh(new THREE.BoxGeometry(.52,.58,.5),[hair,hair,hair,skin,faceMat,hair]);
  head.position.y=1.62;head.castShadow=true;g.add(head);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,.12,8),skin);neck.position.y=1.3;g.add(neck);
  const torso=new THREE.Mesh(new THREE.BoxGeometry(.62,.66,.32),shirt);torso.position.y=.92;torso.castShadow=true;g.add(torso);
  if(collarHex!==undefined){const col=new THREE.Mesh(new THREE.BoxGeometry(.64,.05,.34),new THREE.MeshStandardMaterial({color:collarHex,roughness:.8}));col.position.y=1.24;g.add(col);}
  function arm(s){
    const a=new THREE.Group();
    const sl=new THREE.Mesh(new THREE.BoxGeometry(.17,.26,.17),shirt);sl.position.set(0,-.13,0);a.add(sl);
    const fo=new THREE.Mesh(new THREE.BoxGeometry(.14,.34,.14),skin);fo.position.set(0,-.42,0);fo.castShadow=true;a.add(fo);
    const fi=new THREE.Mesh(new THREE.BoxGeometry(.16,.14,.16),skin);fi.position.set(0,-.64,0);a.add(fi);
    a.position.set(s*.40,1.18,0);g.add(a);return a;
  }
  const armL=arm(-1),armR=arm(1);
  function leg(s){
    const l=new THREE.Group();
    const th=new THREE.Mesh(new THREE.BoxGeometry(.2,.62,.2),pants);th.position.set(0,-.31,0);th.castShadow=true;l.add(th);
    const ft=new THREE.Mesh(new THREE.BoxGeometry(.2,.12,.32),shoe);ft.position.set(0,-.62,.06);l.add(ft);
    l.position.set(s*.16,.62,0);g.add(l);return l;
  }
  const legL=leg(-1),legR=leg(1);
  g.userData={armL,armR,legL,legR,head};
  g.visible=false;scene.add(g);return g;
}
const ATTACKERS_DEF=[
  {face:MIGUEL_FACE,shirt:0xf2efe6,pants:0x2b3a55,collar:0xa31621},
  {face:DANIEL_FACE,shirt:0xf5f2ea,pants:0x3a4252,collar:undefined},
  {face:RAULI_FACE, shirt:0x17181c,pants:0x2b3a55,collar:undefined},
];
const attackerPool=ATTACKERS_DEF.map(d=>makePerson(d.face,d.shirt,d.pants,d.collar));
let miguel=attackerPool[0];

let PEDS=[],pedTimer=3;
function buildPeds(){
  PEDS.forEach(p=>scene.remove(p));PEDS=[];
  const pedKeys=CHAR_KEYS.filter(k=>CHARS[k]!==selectedChar);
  pedKeys.forEach(k=>{
    const ch=CHARS[k];
    for(let c=0;c<4;c++){
      const p=makePerson(ch.face,ch.shirt||0xf5f2ea,ch.pants||0x3a4252);
      p.userData.head.scale.setScalar(1.25);
      p.userData.ped={active:false,vlat:0,fly:null,scared:false,s:0,lat:0};
      scene.add(p);PEDS.push(p);
    }
  });
}
buildPeds();

// ─── BOOSTS ──────────────────────────────────────────────────────────
const GOOD_TYPES=new Set(['shield','heal','x2','coin','magnet','slow']);
function makePickup(type){
  const colors={shield:0x2e7bff,heal:0x35d96b,x2:0xffd23f,coin:0xffd23f,magnet:0xff3344,slow:0x4dd8e8,oil:0x0c0d10,overdrive:0xff5a2a,fog:0x8e96a3};
  const emits={shield:0x1e4fd0,heal:0x1d8f43,x2:0xc99a14,coin:0xb8860b,magnet:0x991122,slow:0x1a7e8c,oil:0x050607,overdrive:0xd03a10,fog:0x3a4049};
  const w=new THREE.Group();
  if(type==='heal'){
    const mat=new THREE.MeshStandardMaterial({color:colors.heal,emissive:emits.heal,emissiveIntensity:.7});
    w.add(new THREE.Mesh(new THREE.BoxGeometry(.85,.3,.3),mat));
    w.add(new THREE.Mesh(new THREE.BoxGeometry(.3,.85,.3),mat));
  } else if(type==='fog'){
    const mat=new THREE.MeshStandardMaterial({color:colors.fog,emissive:emits.fog,emissiveIntensity:.5,roughness:.9});
    [[-.3,0],[.32,.05],[0,.22]].forEach(o=>{const s=new THREE.Mesh(new THREE.SphereGeometry(.34,8,8),mat);s.position.set(o[0],o[1],0);w.add(s);});
  } else {
    let geo;
    if(type==='shield')geo=new THREE.IcosahedronGeometry(.55,0);
    else if(type==='x2')geo=new THREE.OctahedronGeometry(.55,0);
    else if(type==='coin')geo=new THREE.CylinderGeometry(.5,.5,.1,18);
    else if(type==='magnet')geo=new THREE.TorusGeometry(.4,.16,10,18,Math.PI);
    else if(type==='slow')geo=new THREE.IcosahedronGeometry(.55,1);
    else if(type==='oil')geo=new THREE.CylinderGeometry(1.15,1.35,.05,18);
    else geo=new THREE.ConeGeometry(.5,1,8);
    const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:colors[type],emissive:emits[type],emissiveIntensity:.8,roughness:.3,metalness:type==='coin'?.8:0}));
    if(type==='coin')m.rotation.x=Math.PI/2;
    if(type==='magnet')m.rotation.z=Math.PI;
    w.add(m);
  }
  w.visible=false;w.userData={active:false,type,s:0,lat:0};
  scene.add(w);return w;
}
const PICKUPS=['shield','heal','x2','coin','coin','magnet','slow','oil','oil','overdrive','overdrive','fog'].map(makePickup);

// ─── PARTÍCULAS ──────────────────────────────────────────────────────
const SPARK_N=50;
const sparkGeo=new THREE.BufferGeometry();
const sparkPos=new Float32Array(SPARK_N*3);sparkGeo.setAttribute('position',new THREE.BufferAttribute(sparkPos,3));
const sparkVel=[];for(let i=0;i<SPARK_N;i++)sparkVel.push(new THREE.Vector3());
let sparkLife=0;
const sparkPts=new THREE.Points(sparkGeo,new THREE.PointsMaterial({color:0xffb347,size:.18,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
scene.add(sparkPts);
function sparks(x,y,z){
  for(let i=0;i<SPARK_N;i++){sparkPos[i*3]=x;sparkPos[i*3+1]=y;sparkPos[i*3+2]=z;sparkVel[i].set((Math.random()-.5)*10,Math.random()*8,(Math.random()-.5)*10);}
  sparkGeo.attributes.position.needsUpdate=true;sparkLife=.7;sparkPts.material.opacity=1;
}
function updateSparks(dt){
  if(sparkLife<=0)return;sparkLife-=dt;
  for(let i=0;i<SPARK_N;i++){sparkVel[i].y-=24*dt;sparkPos[i*3]+=sparkVel[i].x*dt;sparkPos[i*3+1]=Math.max(0,sparkPos[i*3+1]+sparkVel[i].y*dt);sparkPos[i*3+2]+=sparkVel[i].z*dt;}
  sparkGeo.attributes.position.needsUpdate=true;sparkPts.material.opacity=Math.max(0,sparkLife/.7);
}
const smokeCv=document.createElement('canvas');smokeCv.width=64;smokeCv.height=64;
{const c=smokeCv.getContext('2d');const g=c.createRadialGradient(32,32,4,32,32,30);g.addColorStop(0,'rgba(90,92,98,.85)');g.addColorStop(1,'rgba(90,92,98,0)');c.fillStyle=g;c.fillRect(0,0,64,64);}
const smokeTex=new THREE.CanvasTexture(smokeCv);
const smokes=[];
for(let i=0;i<12;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,transparent:true,opacity:0,depthWrite:false}));s.userData={t:2};scene.add(s);smokes.push(s);}
let smokeEmit=0;
function updateSmoke(dt,emitting,x,y,z){
  if(emitting){smokeEmit-=dt;if(smokeEmit<=0){smokeEmit=.12;const s=smokes.find(o=>o.userData.t>=1.6)||smokes[0];s.userData.t=0;s.position.set(x+(Math.random()-.5)*.8,y+1.1,z+(Math.random()-.5)*.5);s.scale.setScalar(.8);}}
  smokes.forEach(s=>{if(s.userData.t>=2)return;s.userData.t+=dt;const t=s.userData.t;s.position.y+=dt*1.4;const sc=.8+t*1.6;s.scale.set(sc,sc,1);s.material.opacity=Math.max(0,.65*(1-t/1.6));});
}

// ─── RETROVISOR / SANGRE / CRISTAL (idéntico v4) ─────────────────────
const mirrorCv=document.getElementById('mirrorCv'),mctx=mirrorCv.getContext('2d');
let mirrorImg=new Image(),bruise=0,deadEyes=false;
mirrorImg.src=CHARS.raul.mirror;mirrorImg.onload=drawMirror;
function drawMirror(){
  const W=mirrorCv.width,H=mirrorCv.height;
  mctx.clearRect(0,0,W,H);
  mctx.save();mctx.translate(W,0);mctx.scale(-1,1);
  if(mirrorImg.complete&&mirrorImg.naturalWidth>0)mctx.drawImage(mirrorImg,0,0,W,H);
  mctx.restore();
  const eyes=selectedChar.eyes.map(e=>({x:W-e.x,y:e.y}));
  for(let i=0;i<Math.min(bruise,2);i++){
    const e=eyes[i],str=(i===0&&bruise>=2)?1:.8;
    const g1=mctx.createRadialGradient(e.x,e.y,4,e.x,e.y,30);
    g1.addColorStop(0,`rgba(70,20,90,${.62*str})`);g1.addColorStop(.55,`rgba(95,30,70,${.45*str})`);g1.addColorStop(1,'rgba(60,25,80,0)');
    mctx.fillStyle=g1;mctx.beginPath();mctx.ellipse(e.x,e.y+4,30,22,-.15,0,Math.PI*2);mctx.fill();
    mctx.fillStyle=`rgba(130,40,60,${.3*str})`;mctx.beginPath();mctx.ellipse(e.x,e.y+14,20,9,0,0,Math.PI*2);mctx.fill();
  }
  if(deadEyes){
    mctx.strokeStyle='rgba(170,12,20,.95)';mctx.lineWidth=6;mctx.lineCap='round';
    for(const e of eyes){const r=16;mctx.beginPath();mctx.moveTo(e.x-r,e.y-r);mctx.lineTo(e.x+r,e.y+r);mctx.moveTo(e.x+r,e.y-r);mctx.lineTo(e.x-r,e.y+r);mctx.stroke();}
  }
}
const bloodCv=document.getElementById('blood'),bctx=bloodCv.getContext('2d');
let splats=[];
const MAX_SPLATS=8;   // cualquier exceso se descarta (los más viejos)
function addBlood(n, small){
  const W=bloodCv.width,H=bloodCv.height;
  for(let i=0;i<n;i++){
    // los splats de "atropello pequeño" son menos manchones, en bordes
    const inBorder=small;
    const cx=W*(inBorder?(Math.random()<.5?.1+Math.random()*.2:.7+Math.random()*.2):(.25+Math.random()*.5));
    const cy=H*(.18+Math.random()*.4);
    const r=small?(6+Math.random()*14):(12+Math.random()*26);
    const drops=[];
    const nDrops=small?2+Math.floor(Math.random()*3):4+Math.floor(Math.random()*4);
    for(let d=0;d<nDrops;d++){
      const ang=Math.random()*Math.PI*2, dist=Math.random()*r*1.4;
      drops.push({x:cx+Math.cos(ang)*dist,y:cy+Math.sin(ang)*dist*.7,r:2+Math.random()*r*.3,vy:6+Math.random()*22,trail:Math.random()<.4});
    }
    splats.push({cx,cy,r,drops,life:1,small:!!small});
    if(splats.length>MAX_SPLATS)splats.shift();   // eliminar el más viejo
  }
}
function drawBlood(dt){
  bctx.clearRect(0,0,bloodCv.width,bloodCv.height);
  splats=splats.filter(s=>s.life>0);
  for(const s of splats){
    // duran ~3-4 segundos (no 16 como antes)
    s.life-=dt*(s.small?.35:.22);
    // OPACIDAD MUY REDUCIDA: máximo 0.32 (era 0.85), translúcida y sin tapar visión
    const a=Math.max(0,Math.min(.32,s.life*.35));
    bctx.fillStyle=`rgba(155,18,22,${a})`;
    bctx.beginPath();bctx.ellipse(s.cx,s.cy,s.r,s.r*.8,0,0,Math.PI*2);bctx.fill();
    bctx.fillStyle=`rgba(180,28,32,${a*.85})`;
    for(const d of s.drops){
      d.y+=d.vy*dt; d.vy*=(1-dt*.5);
      bctx.beginPath();bctx.ellipse(d.x,d.y,d.r,d.r*1.4,0,0,Math.PI*2);bctx.fill();
      if(d.trail){bctx.fillRect(d.x-d.r*.2,d.y-d.r*3,d.r*.4,d.r*3);}
    }
  }
}
const glassCv=document.getElementById('glass'),gctx=glassCv.getContext('2d');
let shards=[],glassBroken=false;
function addCrack(cx,cy,size){
  const rays=7+Math.floor(Math.random()*5);
  gctx.save();gctx.strokeStyle='rgba(225,236,250,.8)';gctx.shadowColor='rgba(255,255,255,.5)';gctx.shadowBlur=2;
  for(let i=0;i<rays;i++){
    const ang=(i/rays)*Math.PI*2+Math.random()*.5;let x=cx,y=cy,len=size*(.5+Math.random()*.8);
    gctx.lineWidth=1.6;gctx.beginPath();gctx.moveTo(x,y);
    for(let st=0;st<4+Math.floor(Math.random()*3);st++){const seg=len/5;x+=Math.cos(ang+(Math.random()-.5)*.6)*seg;y+=Math.sin(ang+(Math.random()-.5)*.6)*seg;gctx.lineTo(x,y);}
    gctx.stroke();
  }
  gctx.fillStyle='rgba(235,243,252,.55)';gctx.beginPath();gctx.arc(cx,cy,4+size*.04,0,Math.PI*2);gctx.fill();gctx.restore();
}
function shatterGlass(){
  glassBroken=true;const W=glassCv.width,H=glassCv.height;shards=[];
  for(let i=0;i<70;i++){const cx=Math.random()*W,cy=Math.random()*H*.85;const pts=[];for(let p=0;p<3;p++){const a=(p/3)*Math.PI*2+Math.random(),r=14+Math.random()*46;pts.push([Math.cos(a)*r,Math.sin(a)*r]);}shards.push({x:cx,y:cy,pts,vx:(Math.random()-.5)*160,vy:60+Math.random()*340,rot:Math.random()*Math.PI,vr:(Math.random()-.5)*5,life:1.3});}
}
function drawGlass(dt){
  if(!glassBroken)return;gctx.clearRect(0,0,glassCv.width,glassCv.height);shards=shards.filter(s=>s.life>0&&s.y<glassCv.height+120);
  for(const s of shards){s.life-=dt*.5;s.vy+=900*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.rot+=s.vr*dt;const a=Math.max(0,Math.min(.5,s.life));gctx.save();gctx.translate(s.x,s.y);gctx.rotate(s.rot);gctx.fillStyle=`rgba(205,225,240,${a*.5})`;gctx.strokeStyle=`rgba(240,248,255,${a})`;gctx.lineWidth=1.2;gctx.beginPath();gctx.moveTo(s.pts[0][0],s.pts[0][1]);for(let p=1;p<s.pts.length;p++)gctx.lineTo(s.pts[p][0],s.pts[p][1]);gctx.closePath();gctx.fill();gctx.stroke();gctx.restore();}
}
function sizeOverlays(){bloodCv.width=window.innerWidth;bloodCv.height=window.innerHeight;glassCv.width=window.innerWidth;glassCv.height=window.innerHeight;}
sizeOverlays();

// ─── AUDIO ───────────────────────────────────────────────────────────
let actx=null,master=null,engOsc=null,engGain=null,engFilter=null,muted=false;
function initAudio(){
  if(actx)return;
  try{
    actx=new(window.AudioContext||window.webkitAudioContext)();
    master=actx.createGain();master.gain.value=muted?0:.5;master.connect(actx.destination);
    engOsc=actx.createOscillator();engOsc.type='sawtooth';
    engFilter=actx.createBiquadFilter();engFilter.type='lowpass';engFilter.frequency.value=320;
    engGain=actx.createGain();engGain.gain.value=0;
    engOsc.connect(engFilter);engFilter.connect(engGain);engGain.connect(master);engOsc.start();
  }catch(e){actx=null;}
}
function tone(freq,dur,type,gain,slideTo){if(!actx)return;const o=actx.createOscillator(),g=actx.createGain();o.type=type||'sine';o.frequency.setValueAtTime(freq,actx.currentTime);if(slideTo)o.frequency.exponentialRampToValueAtTime(slideTo,actx.currentTime+dur);g.gain.setValueAtTime(gain||.25,actx.currentTime);g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+dur);o.connect(g);g.connect(master);o.start();o.stop(actx.currentTime+dur+.02);}
function noise(dur,ftype,freq,gain){if(!actx)return;const len=Math.floor(actx.sampleRate*dur);const buf=actx.createBuffer(1,len,actx.sampleRate);const data=buf.getChannelData(0);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*(1-i/len);const src=actx.createBufferSource();src.buffer=buf;const f=actx.createBiquadFilter();f.type=ftype;f.frequency.value=freq;const g=actx.createGain();g.gain.value=gain;src.connect(f);f.connect(g);g.connect(master);src.start();}
const SND={
  crash(){noise(.45,'lowpass',260,.9);tone(70,.3,'square',.4,40);},
  punch(){noise(.2,'lowpass',150,.85);tone(60,.16,'sine',.5,38);},
  glass(){noise(.5,'highpass',2600,.7);},
  horn(){tone(440,.4,'square',.22);tone(554,.4,'square',.22);},
  ding(c){tone(740+Math.min(c,8)*70,.16,'sine',.3);},
  good(){tone(620,.12,'triangle',.3);setTimeout(()=>tone(930,.16,'triangle',.3),90);},
  bad(){tone(330,.2,'sawtooth',.28,180);},
  coin(){tone(990,.09,'square',.25);setTimeout(()=>tone(1320,.14,'square',.25),70);},
  levelup(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,.18,'triangle',.3),i*90));},
  siren(){[880,520,880,520].forEach((f,i)=>setTimeout(()=>tone(f,.22,'square',.22),i*180));},
  skid(){noise(.5,'highpass',1800,.18);},
  // Grito sintetizado: ruido + sweep agudo descendente
  scream(){
    if(!actx)return;
    // pitch random para variar entre peatones
    const f0=520+Math.random()*240;
    tone(f0,.32,'sawtooth',.18,f0*.4);
    setTimeout(()=>noise(.18,'bandpass',1200,.12),20);
  },
  // Click de intermitente
  click(){tone(2200,.04,'square',.12);setTimeout(()=>tone(1800,.04,'square',.10),60);},
  // Sonido de logro desbloqueado: arpegio brillante
  achievement(){[784,988,1175,1568].forEach((f,i)=>setTimeout(()=>tone(f,.22,'triangle',.32),i*80));},
  jump(){tone(220,.16,'triangle',.22,800);noise(.18,'highpass',2000,.10);},
};

// ─── MÚSICA DE FONDO: synthwave procedural loop ──────────────────────
// Un bajo + acordes pad + arpegio. Se construye sobre WebAudio y se va
// reprogramando cada compás.
let musicCtx=null;        // { masterGain, bassOsc, bassGain, padOsc, padGain, arpOsc, arpGain }
let musicTimer=0;
let musicStep=0;
let musicEnabled=false;
let musicBeatSec=0.32;     // 1 beat = 0.32s → 188 BPM
// Progresión I-vi-IV-V en Dm: Dm - Bb - F - C
const CHORD_ROOTS=[ 146.83, 116.54, 87.31, 130.81 ];  // Hz
// Patrón de arpegio por compás (4 notas) - segundo y quinto grado
const ARP_OFFSETS=[0, 7, 12, 7];  // semitones from root

function startMusic(){
  if(!actx||musicEnabled)return;
  musicCtx={};
  musicCtx.master=actx.createGain(); musicCtx.master.gain.value=0;
  musicCtx.master.connect(master);
  // Bajo
  musicCtx.bassOsc=actx.createOscillator(); musicCtx.bassOsc.type='triangle';
  musicCtx.bassFilter=actx.createBiquadFilter(); musicCtx.bassFilter.type='lowpass'; musicCtx.bassFilter.frequency.value=400;
  musicCtx.bassGain=actx.createGain(); musicCtx.bassGain.gain.value=0;
  musicCtx.bassOsc.connect(musicCtx.bassFilter); musicCtx.bassFilter.connect(musicCtx.bassGain); musicCtx.bassGain.connect(musicCtx.master);
  musicCtx.bassOsc.start();
  // Pad
  musicCtx.padOsc=actx.createOscillator(); musicCtx.padOsc.type='sawtooth';
  musicCtx.padFilter=actx.createBiquadFilter(); musicCtx.padFilter.type='lowpass'; musicCtx.padFilter.frequency.value=800;
  musicCtx.padGain=actx.createGain(); musicCtx.padGain.gain.value=0;
  musicCtx.padOsc.connect(musicCtx.padFilter); musicCtx.padFilter.connect(musicCtx.padGain); musicCtx.padGain.connect(musicCtx.master);
  musicCtx.padOsc.start();
  // Subir suavemente
  musicCtx.master.gain.setTargetAtTime(.22,actx.currentTime,1.5);
  musicEnabled=true;
  musicStep=0; musicTimer=0;
}
function stopMusic(){
  if(!musicCtx||!musicEnabled)return;
  musicCtx.master.gain.setTargetAtTime(0,actx.currentTime,.5);
  musicEnabled=false;
}
function setMusicIntensity(intensity){
  // intensity 0..1: con calor alto, la música se vuelve más intensa
  if(!musicCtx)return;
  const vol=.18+intensity*.12;
  musicCtx.master.gain.setTargetAtTime(muted?0:vol,actx.currentTime,.3);
  musicCtx.bassFilter.frequency.setTargetAtTime(300+intensity*600,actx.currentTime,.3);
  musicCtx.padFilter.frequency.setTargetAtTime(600+intensity*1400,actx.currentTime,.3);
}
function updateMusic(dt){
  if(!musicCtx||!musicEnabled||!actx)return;
  musicTimer-=dt;
  if(musicTimer<=0){
    const beat=musicStep%16;
    const measure=Math.floor(musicStep/16)%4;
    const root=CHORD_ROOTS[measure];
    const t=actx.currentTime;
    // Bajo en negras
    if(beat%4===0){
      musicCtx.bassOsc.frequency.setValueAtTime(root,t);
      musicCtx.bassGain.gain.setValueAtTime(.5,t);
      musicCtx.bassGain.gain.exponentialRampToValueAtTime(.001,t+musicBeatSec*.9);
    }
    // Pad en compás
    if(beat===0){
      musicCtx.padOsc.frequency.setValueAtTime(root*2,t);
      musicCtx.padGain.gain.setValueAtTime(.18,t);
      musicCtx.padGain.gain.linearRampToValueAtTime(.06,t+musicBeatSec*4);
    }
    // Arpegio en corcheas: tono rápido independiente
    if(beat%2===0){
      const off=ARP_OFFSETS[(beat/2)%ARP_OFFSETS.length];
      const f=root*4*Math.pow(2, off/12);
      tone(f, musicBeatSec*.6, 'square', .08);
    }
    musicTimer+=musicBeatSec;
    musicStep++;
  }
}

// ─── VIENTO ──────────────────────────────────────────────────────────
let windCtx=null;
function startWind(){
  if(!actx||windCtx)return;
  windCtx={};
  // ruido blanco filtrado y modulado
  const bufLen=2*actx.sampleRate;
  const buf=actx.createBuffer(1,bufLen,actx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<bufLen;i++)d[i]=Math.random()*2-1;
  const src=actx.createBufferSource(); src.buffer=buf; src.loop=true;
  const filt=actx.createBiquadFilter(); filt.type='bandpass'; filt.frequency.value=300; filt.Q.value=.6;
  const g=actx.createGain(); g.gain.value=0;
  src.connect(filt); filt.connect(g); g.connect(master);
  src.start();
  windCtx.src=src; windCtx.filt=filt; windCtx.gain=g;
}
function setWindIntensity(speedKmh){
  if(!windCtx)return;
  // intensidad 0..1 según velocidad (0 a ~350 km/h)
  const v=Math.min(1,speedKmh/350);
  windCtx.gain.gain.setTargetAtTime((muted?0:1)*(v*v)*.18, actx.currentTime,.3);
  windCtx.filt.frequency.setTargetAtTime(300+v*1200, actx.currentTime,.3);
}

// ─── REVERB SIMPLE DE TÚNEL ──────────────────────────────────────────
// Activa/desactiva un delay con feedback que se aplica al motor.
let tunnelReverbActive=false;
let tunnelDelayNode=null, tunnelFbGain=null, tunnelMixGain=null;
function setupTunnelReverb(){
  if(!actx||!engGain||tunnelDelayNode)return;
  tunnelDelayNode=actx.createDelay(); tunnelDelayNode.delayTime.value=.18;
  tunnelFbGain=actx.createGain(); tunnelFbGain.gain.value=0;
  tunnelMixGain=actx.createGain(); tunnelMixGain.gain.value=0;
  engGain.connect(tunnelDelayNode);
  tunnelDelayNode.connect(tunnelFbGain);
  tunnelFbGain.connect(tunnelDelayNode);
  tunnelDelayNode.connect(tunnelMixGain);
  tunnelMixGain.connect(master);
}
function setTunnelReverb(on){
  if(!actx)return;
  if(!tunnelDelayNode)setupTunnelReverb();
  if(!tunnelDelayNode)return;
  const target=on?.42:0;
  tunnelFbGain.gain.setTargetAtTime(on?.55:0,actx.currentTime,.2);
  tunnelMixGain.gain.setTargetAtTime(target,actx.currentTime,.2);
}

// ─── VOZ DE GPS IRÓNICA ──────────────────────────────────────────────
// Usa SpeechSynthesis API si está disponible; si no, hace un beep corto.
const GPS_PHRASES=[
  "Recalculando ruta.",
  "En doscientos metros, no haga absolutamente nada.",
  "Atención, peatones detectados. Acelere.",
  "Está usted conduciendo de forma ejemplar para un manual de conducción agresiva.",
  "Próxima salida: ninguna. Continúe recto.",
  "Ha alcanzado su destino. Era una broma.",
  "Avisando a sus seres queridos.",
  "Bocinazo recomendado.",
  "Si pudiera bajarme aquí, lo haría.",
  "Velocidad recomendada: superada hace tres kilómetros.",
];
let gpsVoice=null;
function pickSpanishVoice(){
  if(!window.speechSynthesis)return null;
  const voices=window.speechSynthesis.getVoices();
  return voices.find(v=>v.lang.startsWith('es'))||voices[0]||null;
}
function gpsSpeak(){
  if(muted)return;
  const txt=GPS_PHRASES[Math.floor(Math.random()*GPS_PHRASES.length)];
  if(window.speechSynthesis){
    if(!gpsVoice)gpsVoice=pickSpanishVoice();
    const u=new SpeechSynthesisUtterance(txt);
    if(gpsVoice)u.voice=gpsVoice;
    u.rate=1.05; u.pitch=.85; u.volume=.7;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } else {
    // fallback: beep doble
    SND.click();
  }
  // popup visual
  popText('📡 '+txt,'good');
}
// Cargar voces cuando el navegador las tenga
if(window.speechSynthesis){window.speechSynthesis.onvoiceschanged=()=>{gpsVoice=pickSpanishVoice();};}
const muteBtn=document.getElementById('muteBtn');
function setMuted(m){muted=m;muteBtn.textContent=muted?'🔇':'🔊';if(master)master.gain.value=muted?0:.5;}
muteBtn.addEventListener('click',()=>{initAudio();setMuted(!muted);});
const pauseBtn=document.getElementById('pauseBtn');
pauseBtn.addEventListener('click',()=>{
  if(state!=='playing')return;
  paused=!paused;
  ui.pause.classList.toggle('hidden',!paused);
});

// ─── ESTADO ──────────────────────────────────────────────────────────
const ui={
  score:document.getElementById('score'),speed:document.getElementById('speed'),
  level:document.getElementById('level'),menu:document.getElementById('menu'),
  over:document.getElementById('over'),pause:document.getElementById('pause'),
  finalScore:document.getElementById('finalScore'),recordTxt:document.getElementById('recordTxt'),
  hp:[document.getElementById('hp1'),document.getElementById('hp2'),document.getElementById('hp3')],
  turbofill:document.getElementById('turbofill'),turbobar:document.getElementById('turbobar'),
  combo:document.getElementById('combo'),banner:document.getElementById('banner'),
  pops:document.getElementById('pops'),bestHud:document.getElementById('bestHud'),
  jumpIcon:document.getElementById('jumpIcon'),jumpHint:document.getElementById('jumpHint'),
};
const redflash=document.getElementById('redflash'),whiteflash=document.getElementById('whiteflash');
const fxEl=document.getElementById('fx'),tunnelOverlay=document.getElementById('tunnelOverlay');

let state='menu',paused=false;
let speed=0,score=0,best=0,level=1;

// ════════════════════════════════════════════════════════════════════
// H6 — PROGRESIÓN PERSISTENTE: stats, récord, logros
// ════════════════════════════════════════════════════════════════════
const STATS_KEY='autopista_stats_v1';
const DEFAULT_STATS={
  bestScore:0,
  totalKm:0,
  totalGames:0,
  totalPeds:0,
  bestCombo:0,
  pedsByChar:{},   // {raul:N, rauli:N, ...}
  achievements:{}, // {id: timestamp}
};
let STATS=Object.assign({},DEFAULT_STATS);
function loadStats(){
  try{
    const raw=localStorage.getItem(STATS_KEY);
    if(raw){const parsed=JSON.parse(raw); STATS=Object.assign({},DEFAULT_STATS,parsed);
      STATS.pedsByChar=Object.assign({},parsed.pedsByChar||{});
      STATS.achievements=Object.assign({},parsed.achievements||{});}
  }catch(e){STATS=Object.assign({},DEFAULT_STATS);}
}
function saveStats(){
  try{localStorage.setItem(STATS_KEY,JSON.stringify(STATS));}catch(e){}
}
loadStats();

// Stats de la PARTIDA actual (se acumulan a STATS al morir)
let gameStats={km:0,peds:0,maxComboReached:0,startNight:false,kmSinceCrash:0,strikesInRow:0};

// ─── LOGROS ─────────────────────────────────────────────────────────
const ACHIEVEMENTS=[
  {id:'firstblood', name:'Primera sangre',  desc:'Atropella tu primer peatón',                 check:()=>gameStats.peds>=1},
  {id:'strike5',    name:'¡PLENO!',          desc:'5 atropellos seguidos sin chocar',           check:()=>gameStats.strikesInRow>=5},
  {id:'marathon',   name:'Maratón',          desc:'Recorre 10 km sin chocar',                  check:()=>gameStats.kmSinceCrash>=10},
  {id:'nocturnal',  name:'Nocturno',         desc:'Sobrevive una noche entera',                 check:()=>nightSurvived},
  {id:'hunter',     name:'Cazador',          desc:'100 peatones atropellados en total',         check:()=>STATS.totalPeds+gameStats.peds>=100},
  {id:'centurion',  name:'Centurión',        desc:'Combo ×10',                                  check:()=>gameStats.maxComboReached>=10},
  {id:'longHaul',   name:'Camionero',        desc:'100 km totales acumulados',                  check:()=>STATS.totalKm+gameStats.km>=100},
  {id:'wanted3',    name:'Estrella de oro',  desc:'Alcanza 3 estrellas de calor',               check:()=>heat>=.9},
  {id:'turbo10k',   name:'Adrenalina',       desc:'Marca 10.000 puntos en una partida',         check:()=>score>=10000},
  {id:'allChars',   name:'Casting completo', desc:'Juega con los 8 pilotos',                   check:()=>Object.keys(STATS.pedsByChar||{}).length>=8},
];
let nightSurvived=false;   // flag local, se setea en el bucle
let unlockedThisSession=new Set();

function checkAchievements(){
  for(const a of ACHIEVEMENTS){
    if(STATS.achievements[a.id])continue;
    if(unlockedThisSession.has(a.id))continue;
    if(a.check()){
      unlockedThisSession.add(a.id);
      STATS.achievements[a.id]=Date.now();
      saveStats();
      showAchievement(a);
    }
  }
}
function showAchievement(a){
  const el=document.createElement('div');
  el.className='achievement-pop';
  el.innerHTML=`<div class="ach-title">🏆 LOGRO</div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div>`;
  document.body.appendChild(el);
  // sonido especial
  if(SND&&SND.achievement)SND.achievement();
  setTimeout(()=>el.classList.add('show'),20);
  setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),500);},4000);
}

best=STATS.bestScore;   // récord persistente al iniciar

let nightStartTime=0;       // momento en que entró en zona nocturna
let achievementTimer=2;     // chequear logros cada segundo
let gpsTimer=8;             // tiempo hasta próxima voz GPS

let hp=3,invuln=0,spawnTimer=0,shake=0,steer=0;
let turbo=1,turboActive=false,combo=0,comboTimer=0;
const input={left:false,right:false,turbo:false};
let shieldT=0,x2T=0,invertT=0,overT=0,magnetT=0,slowT=0,fogT=0;
let jumpT=0;        // tiempo restante del salto activo (0 = en suelo)
let jumpCd=0;       // cooldown del salto
const JUMP_DUR=0.85, JUMP_COOLDOWN=2.0, JUMP_HEIGHT=2.8;
let pickupTimer=2;
let deathT=0,punchCount=0,nextPunchAt=0,punchAnimT=-1,punchesStarted=false,crashCar=null;
let miguelFrom=new THREE.Vector3(),miguelTo=new THREE.Vector3();
const WALK_START=1.0,WALK_DUR=1.7,PUNCH_PERIOD=.68,PUNCH_IMPACT=.42;

let playerS=60;          // metros recorridos sobre el spline
let laneOffset=0;        // metros laterales
const MAX_LANE_OFFSET=6.5;
let inTunnel=false;

// ─── HELPERS UI ──────────────────────────────────────────────────────
function popText(txt,cls){const el=document.createElement('div');el.className='pop '+(cls||'');el.textContent=txt;el.style.left=(44+Math.random()*12)+'%';el.style.top=(40+Math.random()*14)+'%';ui.pops.appendChild(el);setTimeout(()=>el.remove(),1050);}
let bannerTimer=null;
function showBanner(txt){ui.banner.textContent=txt;ui.banner.classList.add('show');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>ui.banner.classList.remove('show'),1700);}
function flash(el,ms){el.style.opacity=1;setTimeout(()=>{el.style.opacity=0;},ms);}
function updateFx(){
  const tags=[];
  if(shieldT>0)tags.push(`<div class="fxtag good">🛡 Escudo ${shieldT.toFixed(1)}s</div>`);
  if(x2T>0)tags.push(`<div class="fxtag good">★ ×2 ${x2T.toFixed(1)}s</div>`);
  if(magnetT>0)tags.push(`<div class="fxtag good">🧲 Imán ${magnetT.toFixed(1)}s</div>`);
  if(slowT>0)tags.push(`<div class="fxtag good">⏱ Slow ${slowT.toFixed(1)}s</div>`);
  if(invertT>0)tags.push(`<div class="fxtag bad">⚠ Invertido ${invertT.toFixed(1)}s</div>`);
  if(overT>0)tags.push(`<div class="fxtag bad">🔥 Atascado ${overT.toFixed(1)}s</div>`);
  if(fogT>0)tags.push(`<div class="fxtag bad">🌫 Niebla ${fogT.toFixed(1)}s</div>`);
  fxEl.innerHTML=tags.join('');
}
function applyPickup(type){
  if(type==='shield'){shieldT=3.5;SND.good();popText('¡Escudo!','good');flash(whiteflash,150);}
  else if(type==='heal'){hp=Math.min(3,hp+1);updateHearts();bruise=Math.max(0,bruise-1);drawMirror();SND.good();popText('+1 vida','good');flash(whiteflash,150);}
  else if(type==='x2'){x2T=6;SND.good();popText('Puntos ×2','gold');flash(whiteflash,120);}
  else if(type==='coin'){score+=300;SND.coin();popText('+300','gold');}
  else if(type==='magnet'){magnetT=5;SND.good();popText('¡Imán!','good');}
  else if(type==='slow'){slowT=3;SND.good();popText('Cámara lenta','good');}
  else if(type==='oil'){invertT=3;shake=Math.max(shake,.5);SND.bad();popText('¡Aceite!','bad');flash(redflash,220);}
  else if(type==='overdrive'){overT=4;SND.bad();popText('¡Atascado!','bad');flash(redflash,150);}
  else if(type==='fog'){fogT=4.5;SND.bad();popText('¡Niebla!','bad');}
  updateFx();
}
function updateHearts(){ui.hp.forEach((el,i)=>el.classList.toggle('off',i>=hp));}
function breakCombo(){combo=0;comboTimer=0;ui.combo.classList.remove('show');}

// ─── SPAWNS ──────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
// MECÁNICAS NUEVAS: obstáculos, policía, calor, eventos, derrape
// ════════════════════════════════════════════════════════════════════

// ─── OBSTÁCULOS ESTÁTICOS (conos, vallas, cabinas de peaje) ──────────
// Todos viven en el mismo pool con coordenadas (s, lat) como los demás.
const OBSTACLES=[];
const obstaclePool={cone:[], barrier:[], booth:[]};

function makeCone(){
  const g=new THREE.Group();
  const orange=new THREE.MeshStandardMaterial({color:0xff7a18,roughness:.7,emissive:0x5a2200,emissiveIntensity:.1});
  const white=new THREE.MeshStandardMaterial({color:0xeeeae0,roughness:.7});
  const dark=new THREE.MeshStandardMaterial({color:0x1a1c20,roughness:.8});
  const base=new THREE.Mesh(new THREE.BoxGeometry(.7,.06,.7),dark);base.position.y=.03;g.add(base);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(.32,.95,8),orange);cone.position.y=.55;cone.castShadow=true;g.add(cone);
  const band=new THREE.Mesh(new THREE.ConeGeometry(.28,.1,8),white);band.position.y=.7;g.add(band);
  return g;
}
function makeBarrier(){
  // valla a rayas amarillas y negras
  const g=new THREE.Group();
  const yel=new THREE.MeshStandardMaterial({color:0xffd23f,roughness:.65,emissive:0x442f00,emissiveIntensity:.15});
  const blk=new THREE.MeshStandardMaterial({color:0x1d1f24,roughness:.7});
  for(let i=0;i<4;i++){
    const m=new THREE.Mesh(new THREE.BoxGeometry(.55,.7,.18),i%2?yel:blk);
    m.position.set(-1.2+i*.55,.45,0); m.castShadow=true; g.add(m);
  }
  const support=new THREE.Mesh(new THREE.BoxGeometry(2.6,.12,.6),blk); support.position.y=.06; g.add(support);
  return g;
}
function makeBooth(){
  // cabina de peaje
  const g=new THREE.Group();
  const wall=new THREE.MeshStandardMaterial({color:0xd0c8b4,roughness:.7});
  const roof=new THREE.MeshStandardMaterial({color:0xc1121f,roughness:.6,metalness:.3});
  const glass=new THREE.MeshStandardMaterial({color:0x6c8aaa,roughness:.1,metalness:.7,transparent:true,opacity:.7});
  const box=new THREE.Mesh(new THREE.BoxGeometry(2.6,3.3,2.6),wall); box.position.y=1.65; box.castShadow=true; g.add(box);
  const win=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1),glass); win.position.set(0,1.9,1.31); g.add(win);
  const top=new THREE.Mesh(new THREE.BoxGeometry(3.4,.4,3.4),roof); top.position.y=3.5; top.castShadow=true; g.add(top);
  // luz superior
  const light=new THREE.Mesh(new THREE.BoxGeometry(.6,.18,.4),new THREE.MeshStandardMaterial({color:0xfff3cf,emissive:0xffe9a8,emissiveIntensity:.8}));
  light.position.y=3.85; g.add(light);
  return g;
}

const N_CONES=24, N_BARR=4, N_BOOTH=3;
for(let i=0;i<N_CONES;i++){const o=makeCone();o.visible=false;o.userData={type:'cone',active:false,s:0,lat:0,halfLen:.4};scene.add(o);OBSTACLES.push(o);obstaclePool.cone.push(o);}
for(let i=0;i<N_BARR;i++){const o=makeBarrier();o.visible=false;o.userData={type:'barrier',active:false,s:0,lat:0,halfLen:.4};scene.add(o);OBSTACLES.push(o);obstaclePool.barrier.push(o);}
for(let i=0;i<N_BOOTH;i++){const o=makeBooth();o.visible=false;o.userData={type:'booth',active:false,s:0,lat:0,halfLen:1.6};scene.add(o);OBSTACLES.push(o);obstaclePool.booth.push(o);}

// Tramos especiales activos (qué hay entre s0 y s1)
// 'works' = obras (conos diagonales que estrechan), 'toll' = peaje, 'rest' = curva pronunciada
const specialSections=[];
let specialCooldown=400; // metros entre tramos especiales

function placeObstacle(pool, s, lat){
  const free=pool.find(o=>!o.userData.active);
  if(!free)return null;
  free.userData.active=true; free.userData.s=s; free.userData.lat=lat; free.visible=true;
  return free;
}

// Tramo de obras: 4-6 pares de conos que estrechan progresivamente desde el carril derecho.
function startWorks(s0){
  const len=80, lanes=[6,2,-2,-6];
  const closedFrom=Math.random()<.5?6:-6;
  const dir=Math.sign(closedFrom);
  for(let i=0;i<10;i++){
    const s=s0+i*7+Math.random()*1.5;
    if(s>splineLen-80)break;
    const lat=closedFrom-dir*Math.min(8,i*0.85);
    if(!placeObstacle(obstaclePool.cone, s, lat))break;
    if(i%2===0){placeObstacle(obstaclePool.cone, s, lat-dir*1.2);}
  }
  specialSections.push({type:'works',s0,s1:s0+len,closedLane:dir>0?3:0});
  showBanner('OBRAS');
}

// Tramo de peaje: una barrera por carril menos el que está abierto
function startToll(s0){
  const open=Math.floor(Math.random()*4);
  for(let i=0;i<4;i++){
    if(i===open)continue;
    placeObstacle(obstaclePool.booth, s0, LANES_FULL[i]);
  }
  // barrera bajada en los carriles cerrados para que sea claramente impasable
  for(let i=0;i<4;i++){
    if(i===open)continue;
    placeObstacle(obstaclePool.barrier, s0+3, LANES_FULL[i]);
  }
  specialSections.push({type:'toll',s0:s0-4,s1:s0+8,openLane:open});
  showBanner('PEAJE');
}

// Tramo de descanso: nada, solo una curva más cerrada (cosmético).
// En la práctica esto solo añade más decoración (vallas amarillas a los lados).
function startRest(s0){
  for(let i=0;i<6;i++){
    const s=s0+i*10;
    if(s>splineLen-80)break;
    placeObstacle(obstaclePool.barrier, s, 9);   // a la derecha del arcén
    placeObstacle(obstaclePool.barrier, s, -9);
  }
  specialSections.push({type:'rest',s0,s1:s0+60});
  showBanner('ÁREA DE SERVICIO');
}

function tryStartSpecial(){
  if(specialCooldown>0)return;
  if(specialSections.length>0){
    const last=specialSections[specialSections.length-1];
    if(playerS<last.s1+200)return;   // separar tramos
  }
  const s0=playerS+220+Math.random()*80;
  if(s0>splineLen-200)return;
  const r=Math.random();
  if(r<.4)startWorks(s0);
  else if(r<.75)startToll(s0);
  else startRest(s0);
  specialCooldown=900+Math.random()*500;
}

// ─── POLICÍA Y SISTEMA DE CALOR ─────────────────────────────────────
// "heat" sube cuando atropellas peatones o esquivas demasiado cerca a un coche policía.
// Cuando heat >= umbrales, aparecen 1, 2, 3 coches policía detrás persiguiéndote.

let heat=0;        // 0..1
let sirenLoop=0;   // contador para repetir sirena mientras hay policía
const policeCars=[];
function makePoliceCar(){
  const car=new THREE.Group();
  const body=new THREE.MeshStandardMaterial({color:0x0e2960,roughness:.4,metalness:.5});
  const white=new THREE.MeshStandardMaterial({color:0xeef0f4,roughness:.45,metalness:.4});
  // mitad blanco mitad azul (typical police)
  const b=new THREE.Mesh(new THREE.BoxGeometry(2,.62,4.1),body); b.position.y=.66; b.castShadow=true; car.add(b);
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(2.02,.62,2),white); stripe.position.set(0,.66,.3); car.add(stripe);
  const hood=new THREE.Mesh(new THREE.BoxGeometry(1.9,.3,1.2),body); hood.position.set(0,.95,-1.35); car.add(hood);
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.72,.58,1.9),glassMat); cabin.position.set(0,1.25,.25); car.add(cabin);
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.8,.1,2),body); top.position.set(0,1.58,.25); car.add(top);
  const bf=new THREE.Mesh(new THREE.BoxGeometry(2.04,.3,.25),chromeMat); bf.position.set(0,.42,-2.1); car.add(bf);
  // Barra de luces en el techo (más grande para que se vea bien)
  const lightBar=new THREE.Group();
  const bar=new THREE.Mesh(new THREE.BoxGeometry(1.5,.16,.45),new THREE.MeshStandardMaterial({color:0x14161c,roughness:.6}));
  bar.position.y=.08; lightBar.add(bar);
  // Cajas emisivas más grandes y brillantes
  const lblueMat=new THREE.MeshStandardMaterial({color:0x4d8aff,emissive:0x4d8aff,emissiveIntensity:3.5,roughness:.2});
  const lredMat=new THREE.MeshStandardMaterial({color:0xff5566,emissive:0xff5566,emissiveIntensity:3.5,roughness:.2});
  const lblue=new THREE.Mesh(new THREE.BoxGeometry(.65,.22,.42),lblueMat);
  lblue.position.set(-.38,.12,0); lightBar.add(lblue);
  const lred=new THREE.Mesh(new THREE.BoxGeometry(.65,.22,.42),lredMat);
  lred.position.set(.38,.12,0); lightBar.add(lred);
  // HALOS de luz (sprites que brillan a todo color) — esto es lo que hace que se vea de lejos
  const haloCv=document.createElement('canvas');haloCv.width=64;haloCv.height=64;
  {const c=haloCv.getContext('2d');const g=c.createRadialGradient(32,32,4,32,32,30);
    g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.4,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g;c.fillRect(0,0,64,64);}
  const haloTex=new THREE.CanvasTexture(haloCv);
  const blueHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTex,color:0x4d8aff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  blueHalo.scale.set(2.5,2.5,1); blueHalo.position.set(-.38,.12,0); lightBar.add(blueHalo);
  const redHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTex,color:0xff5566,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  redHalo.scale.set(2.5,2.5,1); redHalo.position.set(.38,.12,0); lightBar.add(redHalo);
  // Luces puntuales que iluminan el coche por debajo (efecto noche)
  const bluePoint=new THREE.PointLight(0x4d8aff,2,12,2); bluePoint.position.set(-.38,.12,0); lightBar.add(bluePoint);
  const redPoint=new THREE.PointLight(0xff5566,2,12,2); redPoint.position.set(.38,.12,0); lightBar.add(redPoint);
  lightBar.position.set(0,1.7,.25); car.add(lightBar);
  car.userData.lblue=lblueMat;
  car.userData.lred=lredMat;
  car.userData.blueHalo=blueHalo.material;
  car.userData.redHalo=redHalo.material;
  car.userData.bluePoint=bluePoint;
  car.userData.redPoint=redPoint;
  addWheels(car,[[-1.02,1.32],[1.02,1.32],[-1.02,-1.32],[1.02,-1.32]],.42);
  addLights(car,.62,-2.06,2.06,.72);
  car.userData.halfLen=2.05;
  car.userData.active=false;
  car.userData.s=0; car.userData.lane=0;
  car.visible=false;
  scene.add(car);
  return car;
}
for(let i=0;i<3;i++)policeCars.push(makePoliceCar());

function spawnPolice(){
  const free=policeCars.find(c=>!c.userData.active);
  if(!free)return;
  free.userData.active=true;
  // SPAWN AL LADO del jugador, ligeramente por delante (visible al instante)
  // Aparece 25-40m por DELANTE para que entre en pantalla
  free.userData.s=playerS+25+Math.random()*15;
  // En un carril distinto al del jugador para no chocar nada más entrar
  const localLanes=lanesAtS(free.userData.s);
  // Filtrar los carriles que no son el del jugador
  const candidateLanes=localLanes.filter(l=>Math.abs(l-laneOffset)>2.5);
  const lane=candidateLanes.length
    ? candidateLanes[Math.floor(Math.random()*candidateLanes.length)]
    : localLanes[Math.floor(Math.random()*localLanes.length)];
  free.userData.lane=lane;
  free.userData.targetLane=null;
  free.userData.aggro=2.0+Math.random()*1.0;  // tiempo antes de empezar a atacar (s)
  free.visible=true;
  SND.siren();
  popText('¡POLICÍA!','bad');
  showBanner('🚔 ¡POLICÍA!');
}

function setHeat(h){
  heat=Math.max(0,Math.min(1,h));
  // umbrales: 1 coche con heat>0.25 (era .35), 2 con >0.55, 3 con >0.85
  const want=heat>.85?3:heat>.55?2:heat>.25?1:0;
  const have=policeCars.filter(c=>c.userData.active).length;
  for(let i=have;i<want;i++)spawnPolice();
  // si heat baja del umbral, los coches se "rinden"
  if(heat<.20){
    policeCars.forEach(c=>{if(c.userData.active && Math.random()<.02){c.userData.giveUp=true;}});
  }
}

// ─── EVENTOS ALEATORIOS ─────────────────────────────────────────────
let eventTimer=25;          // tiempo hasta el próximo evento
let activeEvent=null;       // {type, t (tiempo restante), data}
const EVENT_TYPES=['coinrain','rush','wrongway','copchase'];

function startEvent(){
  if(activeEvent)return;
  // no encadenar policía sobre policía
  const choices=heat>.4?['coinrain','rush','wrongway']:EVENT_TYPES;
  const type=choices[Math.floor(Math.random()*choices.length)];
  if(type==='coinrain'){
    activeEvent={type,t:6};
    showBanner('¡LLUVIA DE MONEDAS!');
  } else if(type==='rush'){
    activeEvent={type,t:8};
    showBanner('¡ESTAMPIDA!');
  } else if(type==='wrongway'){
    activeEvent={type,t:8};
    showBanner('¡TRÁFICO EN SENTIDO CONTRARIO!');
  } else if(type==='copchase'){
    activeEvent={type,t:15};
    heat=Math.max(heat,.55);
    setHeat(heat);
    showBanner('¡PERSECUCIÓN!');
  }
}

function spawnWrongWayCar(){
  // un coche que viene de FRENTE: spawn delante y velocidad NEGATIVA grande
  const free=traffic.filter(c=>!c.userData.active);
  if(!free.length)return;
  // CONTAR cuántos ya hay activos en sentido contrario para no abusar
  const wrongActive=traffic.filter(c=>c.userData.active&&c.userData.wrongWay);
  if(wrongActive.length>=2)return;   // máximo 2 simultáneos
  const c=free[Math.floor(Math.random()*free.length)];
  c.userData.active=true;c.userData.passed=true;   // no cuenta para combo
  c.userData.s=playerS+200+Math.random()*60;
  // Carriles disponibles MENOS los que ya están ocupados por wrongway → garantiza al menos uno libre
  const _wl=lanesAtS(c.userData.s);
  const usedLanes=wrongActive.map(o=>o.userData.lane);
  const freeLanes=_wl.filter(l=>!usedLanes.some(u=>Math.abs(u-l)<2.5));
  if(freeLanes.length<=1)return;   // siempre dejar al menos un carril libre
  c.userData.lane=freeLanes[Math.floor(Math.random()*freeLanes.length)];
  c.userData.speed=-(50+Math.random()*30);   // viene hacia ti
  c.userData.targetLane=null;
  c.userData.wrongWay=true;
  c.visible=true;
}

function spawnCoin(){
  const free=PICKUPS.filter(p=>!p.userData.active && p.userData.type==='coin');
  if(!free.length){
    // si no hay monedas libres, reutilizamos una cualquiera convirtiéndola en moneda visualmente
    return;
  }
  const p=free[0];
  p.userData.active=true; p.visible=true;
  p.userData.s=playerS+120+Math.random()*80;
  const _cl=lanesAtS(p.userData.s); p.userData.lat=_cl[Math.floor(Math.random()*_cl.length)]+(Math.random()-.5)*1.5;
}

// ─── DERRAPE ────────────────────────────────────────────────────────
let driftAmount=0;        // 0..1 — cuánto está derrapando ahora
let driftFactor=0;        // visual: rotación lateral del coche y manchas
const tireMarks=[];       // marcas en el suelo (planos en la carretera)
const MAX_TIRE_MARKS=120;
const tireMat=new THREE.MeshBasicMaterial({color:0x14161c,transparent:true,opacity:.5,depthWrite:false});
for(let i=0;i<MAX_TIRE_MARKS;i++){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(.18,1.2),tireMat);
  m.rotation.x=-Math.PI/2; m.visible=false; m.userData.t=0;
  scene.add(m); tireMarks.push(m);
}
let tireIdx=0;
function dropTireMark(s, lat, off){
  const m=tireMarks[tireIdx]; tireIdx=(tireIdx+1)%MAX_TIRE_MARKS;
  m.visible=true; m.userData.t=8;   // dura 8 segundos
  frameAt(s,F2);
  m.position.copy(F2.pos).add(F2.right.clone().multiplyScalar(lat+off));
  m.position.y=F2.pos.y+.03;
  m.material=tireMat.clone(); m.material.opacity=.55;
  // alinear con la tangente
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),F2.up);
}
function updateTireMarks(dt){
  tireMarks.forEach(m=>{
    if(!m.visible)return;
    m.userData.t-=dt;
    m.material.opacity=Math.max(0,m.userData.t/8)*.55;
    if(m.userData.t<=0)m.visible=false;
  });
}


function spawnCar(){
  const free=traffic.filter(c=>!c.userData.active);
  if(!free.length)return;
  const c=free[Math.floor(Math.random()*free.length)];
  const sSpawn=playerS+140+Math.random()*120;
  if(sSpawn>splineLen-80)return;
  // Carriles disponibles en el punto de spawn (2 o 4 según ancho local)
  const localLanes=lanesAtS(sSpawn);
  const occupied=traffic.filter(x=>x.userData.active&&Math.abs(x.userData.s-sSpawn)<22).map(x=>x.userData.lane);
  const freeLanes=localLanes.filter(l=>!occupied.some(o=>Math.abs(o-l)<1.5));
  if(freeLanes.length<=1)return;
  const laneVal=freeLanes[Math.floor(Math.random()*freeLanes.length)];
  c.userData.active=true;c.userData.passed=false;
  c.userData.s=sSpawn;
  c.userData.lane=laneVal;
  const isBig=c.userData.halfLen>2.5;
  c.userData.speed=speed*diff.ratio*(isBig?.8:1)+Math.random()*6;
  if(!isBig&&Math.random()<diff.lane&&localLanes.length>1){
    const idx=localLanes.indexOf(laneVal);
    const to=localLanes[Math.max(0,Math.min(localLanes.length-1,idx+(Math.random()<.5?-1:1)))];
    c.userData.targetLane=to;
  } else c.userData.targetLane=null;
  c.visible=true;
}
function spawnPed(){
  const free=PEDS.filter(p=>!p.userData.ped.active);
  if(!free.length)return;
  const p=free[Math.floor(Math.random()*free.length)];
  const pd=p.userData.ped;
  pd.active=true;pd.fly=null;pd.scared=false;
  const side=Math.random()<.5?-1:1;
  pd.s=playerS+150+Math.random()*40;
  if(pd.s>splineLen-80){pd.active=false;return;}
  const localHW=halfWidthAtS(pd.s);
  pd.lat=side*(localHW+1.4);
  pd.vlat=-side*(1.2+Math.random()*1.1+speed*.006);
  p.rotation.set(0,0,0);p.visible=true;
}
function knockPed(p){
  const pd=p.userData.ped;
  pd.fly={vx:(Math.random()<.5?-1:1)*(5+Math.random()*4),vy:6+Math.random()*3,vz:-4-Math.random()*4,spin:6+Math.random()*5,t:0};
}
function spawnPickup(){
  const free=PICKUPS.filter(p=>!p.userData.active);
  if(!free.length)return;
  const p=free[Math.floor(Math.random()*free.length)];
  p.userData.s=playerS+150+Math.random()*70;
  if(p.userData.s>splineLen-80)return;
  const localLanes=lanesAtS(p.userData.s);
  p.userData.lat=localLanes[Math.floor(Math.random()*localLanes.length)];
  p.userData.active=true;p.visible=true;
}

// ─── RESET / ARRANQUE ────────────────────────────────────────────────
const BIOMES=['mixto','bosque','costa','desierto','montana'];
const BIOME_FOG_COLORS={mixto:0xd9cdb0,bosque:0xc8d4c0,costa:0xd0e0e8,desierto:0xe8dab0,montana:0xc0c8d0};
const BIOME_GRASS_TINT={mixto:0x4e6e38,bosque:0x3a5f30,costa:0x5e7a4a,desierto:0xb8a070,montana:0x4a5a3e};

function pickBiome(){
  // 60% mixto, resto repartido
  if(Math.random()<.5)return 'mixto';
  return BIOMES[1+Math.floor(Math.random()*(BIOMES.length-1))];
}

function applyBiome(b){
  currentBiome=b;
  if(grassMat&&grassMat.color)grassMat.color.setHex(BIOME_GRASS_TINT[b]);
  // Tonos de niebla y de hierba; el cielo seguirá su ciclo día/noche normal
}

function newTrack(){
  curvePts=[new THREE.Vector3(0,0,0)];
  curvePts=curvePts.concat(genCPT(curvePts[0],CPT_COUNT*2));
  rebuildSpline();
  applyBiome(pickBiome());
  // Reconstruir árboles del pool con el nuevo bioma (los del pool ya están creados;
  // los borramos y rehacemos con el tipo correcto)
  treePool.forEach(t=>scene.remove(t)); treePool.length=0;
  for(let i=0;i<30;i++){const t=makeTree();scene.add(t);treePool.push(t);}
  roadMesh.geometry.dispose();roadMesh.geometry=buildRibbon(halfWidthFn,.02,60,3);
  grassMesh.geometry.dispose();grassMesh.geometry=buildRibbon(halfWidthFn,-.06,40,55);
  populateDeco();
  repositionBgTrees();
  repositionMedian();
  playerS=60;
}
function extendTrack(){
  // recorta la mitad inicial y añade tramo nuevo
  const removedPts=curvePts.slice(0,CPT_COUNT+1);
  const removedCurve=new THREE.CatmullRomCurve3(removedPts,false,'catmullrom',0.4);
  const removedLen=removedCurve.getLength();
  const last=curvePts[curvePts.length-1];
  curvePts=curvePts.slice(CPT_COUNT).concat(genCPT(last,CPT_COUNT));
  rebuildSpline();
  roadMesh.geometry.dispose();roadMesh.geometry=buildRibbon(halfWidthFn,.02,60,3);
  grassMesh.geometry.dispose();grassMesh.geometry=buildRibbon(halfWidthFn,-.06,40,55);
  populateDeco();
  repositionBgTrees();
  repositionMedian();
  // desplazar todas las s
  playerS-=removedLen;
  traffic.forEach(c=>{if(c.userData.active)c.userData.s-=removedLen;});
  PICKUPS.forEach(p=>{if(p.userData.active)p.userData.s-=removedLen;});
  PEDS.forEach(p=>{if(p.userData.ped.active)p.userData.ped.s-=removedLen;});
}
function resetGame(){
  score=0;speed=diff.start;spawnTimer=.5;shake=0;steer=0;laneOffset=0;
  hp=3;invuln=0;level=1;turbo=1;turboActive=false;combo=0;comboTimer=0;
  // Reset stats de partida
  gameStats={km:0,peds:0,maxComboReached:0,startNight:false,kmSinceCrash:0,strikesInRow:0};
  unlockedThisSession=new Set();
  nightStartTime=0;
  nightSurvived=false;
  achievementTimer=2;
  gpsTimer=15;
  splats=[];bruise=0;deadEyes=false;glassBroken=false;shards=[];
  gctx.clearRect(0,0,glassCv.width,glassCv.height);
  redflash.style.opacity=0;whiteflash.style.opacity=0;
  miguel.visible=false;crashCar=null;
  deathT=0;punchCount=0;punchAnimT=-1;punchesStarted=false;
  shieldT=0;x2T=0;invertT=0;overT=0;magnetT=0;slowT=0;fogT=0;jumpT=0;jumpCd=0;
  pickupTimer=2;pedTimer=3;
  PICKUPS.forEach(p=>{p.userData.active=false;p.visible=false;});
  PEDS.forEach(p=>{p.userData.ped.active=false;p.visible=false;});
  traffic.forEach(c=>{c.userData.active=false;c.visible=false;c.userData.wrongWay=false;});
  // Resetear todo lo nuevo
  OBSTACLES.forEach(o=>{o.userData.active=false;o.visible=false;});
  specialSections.length=0;specialCooldown=300;
  heat=0;policeCars.forEach(c=>{c.userData.active=false;c.visible=false;c.userData.giveUp=false;});
  sirenLoop=0;
  eventTimer=22;activeEvent=null;
  driftAmount=0;driftFactor=0;
  tireMarks.forEach(m=>{m.visible=false;m.userData.t=0;});
  newTrack();
  hoodMat.color.set(selectedChar.shirt||0xc7a13a);
  sleeveMat.color.set(selectedChar.shirt||0xc7a13a);
  drawMirror();
  ui.combo.classList.remove('show');
  updateHearts();updateFx();ui.level.textContent=1;
}
function startGame(){
  initAudio();
  if(actx&&actx.state==='suspended')actx.resume();
  mirrorImg=new Image();mirrorImg.src=selectedChar.mirror;mirrorImg.onload=drawMirror;
  document.getElementById('playerCardImg').src=selectedChar.face;
  document.getElementById('playerCardName').textContent=selectedChar.name;
  buildPeds();resetGame();
  state='playing';paused=false;
  ui.menu.classList.add('hidden');ui.over.classList.add('hidden');ui.pause.classList.add('hidden');
  // Audio inmersivo
  startMusic(); startWind(); setupTunnelReverb();
  // GPS bienvenida
  setTimeout(()=>{if(state==='playing')gpsSpeak();},2500);
}

// ─── CONTROLES ───────────────────────────────────────────────────────
function hornBlast(){
  if(state!=='playing'||paused)return;
  initAudio();SND.horn();
  PEDS.forEach(p=>{const pd=p.userData.ped;if(pd.active&&!pd.fly&&!pd.scared){pd.scared=true;pd.vlat*=2.2;}});
}
function jumpAction(){
  if(state!=='playing'||paused)return;
  if(jumpT>0||jumpCd>0)return;   // ya saltando o en cooldown
  jumpT=JUMP_DUR;
  jumpCd=JUMP_COOLDOWN;
  if(SND.jump)SND.jump();
  popText('¡SALTO!','gold');
}
window.addEventListener('keydown',e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA')input.left=true;
  if(e.code==='ArrowRight'||e.code==='KeyD')input.right=true;
  if(e.code==='ArrowUp'||e.code==='KeyW')input.turbo=true;
  if(e.code==='KeyM'&&!e.repeat){initAudio();setMuted(!muted);}
  if((e.code==='KeyP'||e.code==='Escape')&&!e.repeat&&state==='playing'){paused=!paused;ui.pause.classList.toggle('hidden',!paused);}
  // ESPACIO: en menú/over arranca partida; jugando, SALTAR
  if(e.code==='Space'&&!e.repeat){
    if(state==='menu'||state==='over')startGame();
    else if(state==='playing')jumpAction();
  }
  if(e.code==='Enter'&&!e.repeat&&(state==='menu'||state==='over'))startGame();
  // BOCINA: ahora con H o B
  if((e.code==='KeyH'||e.code==='KeyB')&&!e.repeat)hornBlast();
  // SALTO también con J o Shift como alternativa
  if((e.code==='KeyJ'||e.code==='ShiftLeft'||e.code==='ShiftRight')&&!e.repeat)jumpAction();
});
window.addEventListener('keyup',e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA')input.left=false;
  if(e.code==='ArrowRight'||e.code==='KeyD')input.right=false;
  if(e.code==='ArrowUp'||e.code==='KeyW')input.turbo=false;
});
document.getElementById('btnStart').addEventListener('click',startGame);
document.getElementById('btnRetry').addEventListener('click',startGame);
document.getElementById('btnMenu').addEventListener('click',()=>{
  state='menu';paused=false;
  ui.over.classList.add('hidden');
  ui.pause.classList.add('hidden');
  ui.menu.classList.remove('hidden');
  stopMusic();
  if(windCtx)windCtx.gain.gain.setTargetAtTime(0,actx.currentTime,.4);
});
document.getElementById('btnResume').addEventListener('click',()=>{paused=false;ui.pause.classList.add('hidden');});
document.getElementById('btnStats').addEventListener('click',()=>{
  renderStats();
  ui.menu.classList.add('hidden');
  document.getElementById('stats').classList.remove('hidden');
});

// Toggle de calidad
const btnQuality=document.getElementById('btnQuality');
function refreshQualityBtn(){btnQuality.textContent=QUALITY==='alta'?'🟢 Alta':'⚪ Baja';}
refreshQualityBtn();
btnQuality.addEventListener('click',()=>{
  QUALITY=QUALITY==='alta'?'baja':'alta';
  localStorage.setItem(QUALITY_KEY,QUALITY);
  applyQuality();
  // ajustar sombras al cambio
  sun.shadow.mapSize.set(QUALITY==='alta'?4096:1024, QUALITY==='alta'?4096:1024);
  sun.shadow.map=null;   // forzar regeneración
  refreshQualityBtn();
});
document.getElementById('btnStatsBack').addEventListener('click',()=>{
  document.getElementById('stats').classList.add('hidden');
  ui.menu.classList.remove('hidden');
});

function renderStats(){
  const grid=document.getElementById('statsGrid');
  const list=document.getElementById('achList');
  const km=STATS.totalKm.toFixed(1);
  const charName=Object.entries(STATS.pedsByChar||{}).sort((a,b)=>b[1]-a[1])[0];
  const favorito=charName?(CHARS[charName[0]]?.name||charName[0])+' ('+charName[1]+')':'—';
  grid.innerHTML=`
    <div class="stat-item"><div class="stat-lbl">Mejor puntuación</div><div class="stat-val">${STATS.bestScore}</div></div>
    <div class="stat-item"><div class="stat-lbl">Partidas jugadas</div><div class="stat-val">${STATS.totalGames}</div></div>
    <div class="stat-item"><div class="stat-lbl">Km totales</div><div class="stat-val">${km}</div></div>
    <div class="stat-item"><div class="stat-lbl">Peatones</div><div class="stat-val">${STATS.totalPeds}</div></div>
    <div class="stat-item"><div class="stat-lbl">Mejor combo</div><div class="stat-val">×${STATS.bestCombo}</div></div>
    <div class="stat-item"><div class="stat-lbl">Víctima favorita</div><div class="stat-val" style="font-size:14px;line-height:2.2">${favorito}</div></div>
  `;
  const unlockedCount=Object.keys(STATS.achievements||{}).length;
  list.innerHTML=ACHIEVEMENTS.map(a=>{
    const ok=STATS.achievements&&STATS.achievements[a.id];
    return `<div class="ach-row${ok?' unlocked':''}">
      <div class="ach-icon">${ok?'🏆':'🔒'}</div>
      <div><div class="ach-n">${a.name}</div><div class="ach-d">${a.desc}</div></div>
    </div>`;
  }).join('')+`<div style="grid-column:1/-1;text-align:center;font-size:11px;opacity:.7;margin-top:8px">${unlockedCount}/${ACHIEVEMENTS.length} desbloqueados</div>`;
}
const hold=(el,key)=>{el.addEventListener('pointerdown',e=>{e.preventDefault();input[key]=true;});['pointerup','pointercancel','pointerleave'].forEach(ev=>el.addEventListener(ev,()=>input[key]=false));};
hold(document.getElementById('btnL'),'left');
hold(document.getElementById('btnR'),'right');
hold(document.getElementById('btnTurbo'),'turbo');
document.getElementById('btnHorn').addEventListener('pointerdown',e=>{e.preventDefault();hornBlast();});
document.getElementById('btnJump').addEventListener('pointerdown',e=>{e.preventDefault();jumpAction();});

// ─── DAÑO / CINEMÁTICA ───────────────────────────────────────────────
function damage(x,y,z){
  hp--;updateHearts();shake=1;addBlood(2);bruise++;drawMirror();breakCombo();
  SND.crash();sparks(x,y,z);
  flash(redflash,260);addCrack(glassCv.width*(.3+Math.random()*.4),glassCv.height*(.25+Math.random()*.3),75);
  // resetear contadores de "sin chocar"
  gameStats.strikesInRow=0;
  gameStats.kmSinceCrash=0;
}
function hit(car){
  if(invuln>0||jumpT>0)return;
  damage(car.position.x,car.position.y+1,car.position.z);
  if(hp<=0)startDeath(car);
  else{invuln=1.3;speed=Math.max(diff.start*.9,speed*.74);car.userData.active=false;car.visible=false;}
}
function pedHit(p){
  // ATROPELLO: ahora suma puntos en vez de quitar vida.
  // El peatón sale volando como un bolo y cuanto más rápido vayas, más puntos.
  knockPed(p);
  const base=100;
  const speedBonus=Math.floor(speed*1.5);
  const pts=base+speedBonus;
  score+=pts;
  popText('¡STRIKE! +'+pts,'gold');
  SND.coin();
  // grito sintetizado del peatón
  if(SND.scream)SND.scream();
  // pequeña sacudida y motita de sangre como efecto, pero NO daño
  shake=Math.max(shake,.5);
  addBlood(1, true);    // splat pequeño, en bordes — no tapa el centro
  flash(whiteflash,140);
  // Subir el calor (cuanto más atropellas, más policía)
  setHeat(heat+.15);
  // Stats
  gameStats.peds++;
  gameStats.strikesInRow++;
  // Atropellar al piloto seleccionado (mismo personaje): cuenta para "casting completo"
  const charKey=Object.keys(CHARS).find(k=>CHARS[k]===selectedChar);
  if(charKey){STATS.pedsByChar[charKey]=(STATS.pedsByChar[charKey]||0)+1;}
}
function startDeath(car){
  state='death';deathT=0;punchCount=0;punchAnimT=-1;punchesStarted=false;
  shieldT=0;x2T=0;invertT=0;overT=0;magnetT=0;slowT=0;fogT=0;jumpT=0;jumpCd=0;updateFx();
  PICKUPS.forEach(p=>{p.userData.active=false;p.visible=false;});
  PEDS.forEach(p=>{p.userData.ped.active=false;p.visible=false;});
  addBlood(3);shake=1.2;crashCar=car;
  car.userData.active=false;
  // colocarlo delante en la carretera, girado
  placeOnRoad(car,playerS+9,Math.max(-6,Math.min(6,laneOffset+(laneOffset<0?2.5:-2.5))),0);
  car.rotateY(.4);
  attackerPool.forEach(a=>{a.visible=false;});
  const avail=attackerPool.filter((_,i)=>ATTACKERS_DEF[i].face!==selectedChar.face);
  miguel=avail.length>0?avail[Math.floor(Math.random()*avail.length)]:attackerPool[Math.floor(Math.random()*attackerPool.length)];
}
function endDeath(){
  state='over';deadEyes=true;drawMirror();
  // Parar audio inmersivo
  stopMusic();
  if(windCtx)windCtx.gain.gain.setTargetAtTime(0,actx.currentTime,.4);
  setTunnelReverb(false);
  if(window.speechSynthesis)window.speechSynthesis.cancel();
  // Acumular en stats globales
  STATS.totalKm+=gameStats.km;
  STATS.totalGames++;
  STATS.totalPeds+=gameStats.peds;
  if(gameStats.maxComboReached>STATS.bestCombo)STATS.bestCombo=gameStats.maxComboReached;
  const sScore=Math.floor(score);
  const isNewRecord=sScore>STATS.bestScore;
  if(isNewRecord)STATS.bestScore=sScore;
  if(sScore>best)best=sScore;
  saveStats();
  checkAchievements();
  ui.finalScore.textContent=sScore;
  ui.recordTxt.innerHTML=isNewRecord
    ?'🏆 <b>¡NUEVO RÉCORD!</b> Récord anterior: '+best
    :'Récord: '+STATS.bestScore;
  setTimeout(()=>ui.over.classList.remove('hidden'),700);
}
function easeInOut(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
function updateDeath(dt){
  deathT+=dt;speed=Math.max(0,speed-dt*45);
  const md=miguel.userData;
  if(crashCar)updateSmoke(dt,true,crashCar.position.x,crashCar.position.y,crashCar.position.z-1.6);
  // definir la ruta de Miguel una vez que el mundo está quieto
  if(deathT>=WALK_START&&!miguel.visible){
    const sideSign=crashCar.position.x>=camera.position.x?1:-1;
    miguelFrom.set(crashCar.position.x+sideSign*1.9,crashCar.position.y,crashCar.position.z+1.2);
    // punto delante del parabrisas
    frameAt(playerS+3.1,F2);
    miguelTo.copy(F2.pos).add(F2.right.clone().multiplyScalar(laneOffset));
    miguel.visible=true;
  }
  if(miguel.visible){
    const wt=Math.min(1,(deathT-WALK_START)/WALK_DUR),k=easeInOut(wt);
    miguel.position.lerpVectors(miguelFrom,miguelTo,k);
    if(wt<1){
      const dx=miguelTo.x-miguelFrom.x,dz=miguelTo.z-miguelFrom.z;
      miguel.rotation.set(0,Math.atan2(dx,dz),0);
      const sw=Math.sin(deathT*9)*.6;md.legL.rotation.x=sw;md.legR.rotation.x=-sw;md.armL.rotation.x=-sw*.5;md.armR.rotation.x=sw*.5;
    } else {
      const dx=camera.position.x-miguel.position.x,dz=camera.position.z-miguel.position.z;
      miguel.rotation.set(0,Math.atan2(dx,dz),0);
      md.legL.rotation.x=0;md.legR.rotation.x=0;md.armL.rotation.x=-.15;
      if(!punchesStarted){punchesStarted=true;nextPunchAt=deathT+.35;}
      if(punchAnimT<0&&punchCount<5&&deathT>=nextPunchAt)punchAnimT=0;
    }
  }
  if(punchAnimT>=0){
    punchAnimT+=dt;const p=punchAnimT/PUNCH_PERIOD;
    let theta;if(p<.3)theta=-0.8*(p/.3);else if(p<.62)theta=-0.8+2.9*((p-.3)/.32);else theta=2.1*(1-(p-.62)/.38);
    md.armR.rotation.x=theta;md.head.rotation.x=-theta*.06;
    if(punchAnimT-dt<PUNCH_IMPACT&&punchAnimT>=PUNCH_IMPACT){
      punchCount++;shake=.85;SND.punch();flash(whiteflash,90);
      if(punchCount<5)addCrack(glassCv.width*(.32+Math.random()*.36),glassCv.height*(.28+Math.random()*.3),130+punchCount*40);
      else{shake=1.5;SND.glass();flash(whiteflash,220);shatterGlass();}
    }
    if(punchAnimT>=PUNCH_PERIOD){
      punchAnimT=-1;md.armR.rotation.x=0;
      if(punchCount<5)nextPunchAt=deathT+.12;
      else setTimeout(()=>{if(state==='death')endDeath();},900);
    }
  }
}

// ─── BUCLE PRINCIPAL ─────────────────────────────────────────────────
const clock=new THREE.Clock();
let fovTarget=68;

function animate(){
  requestAnimationFrame(animate);
  const rawDt=Math.min(clock.getDelta(),.05);
  if(paused){renderer.render(scene,camera);return;}
  const now=performance.now()*.001;
  const wdt=rawDt*(slowT>0?.55:1);
  // Altura del salto (visible también para la cámara, fuera del bloque playing)
  const jumpProgress=jumpT>0 ? 1-(jumpT/JUMP_DUR) : 0;
  const jumpY=jumpT>0 ? JUMP_HEIGHT*4*jumpProgress*(1-jumpProgress) : 0;

  // ── Día/noche ──
  if(state!=='menu')dayPhase=(dayPhase+rawDt/DAY_LEN)%1;
  const[skyTop,skyHor]=skyColors(dayPhase);
  const night=nightness(dayPhase);
  {const g=skyCtx.createLinearGradient(0,0,0,256);g.addColorStop(0,'#'+skyTop.getHexString());g.addColorStop(1,'#'+skyHor.getHexString());skyCtx.fillStyle=g;skyCtx.fillRect(0,0,2,256);skyTex.needsUpdate=true;}
  const fogNear=fogT>0?18:90,fogFar=fogT>0?80:(280-night*70);
  scene.fog.near+=(fogNear-scene.fog.near)*Math.min(1,rawDt*1.6);
  scene.fog.far+=(fogFar-scene.fog.far)*Math.min(1,rawDt*1.6);
  scene.fog.color.copy(skyHor);
  starMat.opacity=night*.9;
  const dayP=Math.min(1,dayPhase/.55);
  const elev=dayPhase<.55?Math.sin(Math.PI*dayP):0;
  sunSprite.position.set(-180+dayP*130,-30+elev*160,-420);
  sunSprite.material.opacity=elev>.02?.95:0;
  sunSprite.material.color.setRGB(1,.82+elev*.18,.55+elev*.4);
  flareSprite.position.copy(sunSprite.position);
  flareSprite.material.opacity=elev>.05?.45:0;
  sun.color.setHex(night>.5?0x9db4ff:(elev<.3?0xffb070:0xffe9c4));
  sun.intensity=Math.max(.12,elev*1.45);
  hemi.intensity=.18+(1-night)*.55;
  moonLight.intensity=night*.35;
  renderer.toneMappingExposure=.85+(1-night)*.2;
  lampGlowMat.emissiveIntensity=.2+night*3.8;
  headMat.emissiveIntensity=.6+night*2.6;tailMat.emissiveIntensity=.8+night*2.2;
  headlights.forEach(h=>h.intensity=night*2.6);
  signMats.forEach(m=>m.emissiveIntensity=night*.55);
  cityWindows.forEach(m=>m.emissiveIntensity=night*.6);
  clouds.forEach(c=>{c.position.x+=c.userData.v*rawDt;if(c.position.x>350)c.position.x=-350;c.material.opacity=.75*(1-night*.85);});
  // Pájaros (vuelan despacio cruzando el cielo con un ligero balanceo)
  birds.forEach(b=>{
    b.position.x+=b.userData.vx*rawDt;
    b.position.y+=Math.sin(now*1.5+b.userData.sway)*.04;
    if(b.position.x>250){b.position.x=-250;b.position.y=40+Math.random()*30;b.position.z=-180-Math.random()*120;}
    b.material.opacity=Math.max(.2,1-night*.6);
  });

  if(state==='playing'){
    // turbo
    turboActive=input.turbo&&turbo>0;
    if(turboActive)turbo=Math.max(0,turbo-rawDt*.34);
    else turbo=Math.min(1,turbo+rawDt*.11);
    const turboBonus=turboActive?26:0;
    ui.turbofill.style.width=(turbo*100)+'%';
    ui.turbobar.classList.toggle('on',turboActive);

    speed=Math.min(diff.cap,speed+wdt*diff.accel);
    if(overT>0)speed=Math.min(diff.cap+20,speed+wdt*18);
    const worldSpeed=speed+turboBonus;

    // avanzar (¡en metros reales!)
    playerS+=worldSpeed*wdt;
    if(playerS>splineLen*.80)extendTrack();

    score+=wdt*worldSpeed*.45*(x2T>0?2:1)*(turboActive?1.5:1);
    // Stats de partida (km en miles de metros del spline)
    const kmAdv=worldSpeed*wdt/1000;
    gameStats.km+=kmAdv;
    gameStats.kmSinceCrash+=kmAdv;
    if(invuln>0)invuln-=rawDt;

    const newLevel=Math.floor(score/1500)+1;
    if(newLevel!==level){level=newLevel;ui.level.textContent=level;showBanner('NIVEL '+level);SND.levelup();}
    const levelMult=Math.max(.7,1-(level-1)*.05);

    if(shieldT>0||x2T>0||invertT>0||overT>0||magnetT>0||slowT>0||fogT>0){
      shieldT=Math.max(0,shieldT-rawDt);x2T=Math.max(0,x2T-rawDt);
      invertT=Math.max(0,invertT-rawDt);overT=Math.max(0,overT-rawDt);
      magnetT=Math.max(0,magnetT-rawDt);slowT=Math.max(0,slowT-rawDt);fogT=Math.max(0,fogT-rawDt);updateFx();
    }
    if(comboTimer>0){comboTimer-=rawDt;if(comboTimer<=0)breakCombo();}

    // dirección
    let tgt=(input.right?1:0)-(input.left?1:0);
    if(invertT>0)tgt=-tgt+Math.sin(now*13)*.35;
    steer+=(tgt-steer)*Math.min(1,rawDt*9);
    const prevLane=laneOffset;
    laneOffset-=steer*rawDt*(9+worldSpeed*.10);
    // Clamp dinámico: el coche no debe salirse del ancho local (deja un margen pequeño)
    const localHW=halfWidthAtS(playerS);
    const maxLat=localHW-1.0;
    laneOffset=Math.max(-maxLat,Math.min(maxLat,laneOffset));
    // Click de intermitente al cruzar una línea divisoria de carril (-4, 0, 4)
    [-4,0,4].forEach(line=>{
      if((prevLane-line)*(laneOffset-line)<0&&Math.abs(steer)>.2){SND.click();}
    });

    // ── Salto: actualizar timers ──
    if(jumpT>0)jumpT=Math.max(0,jumpT-rawDt);
    if(jumpCd>0)jumpCd=Math.max(0,jumpCd-rawDt);

    // ── Coche del jugador en el spline (con altura de salto) ──
    placeOnRoad(playerCar,playerS,laneOffset,jumpY);
    if(driftAmount>0)playerCar.rotateY(-driftFactor*.18);
    // Ligero ángulo de morro arriba/abajo durante el salto
    if(jumpT>0){
      const nose=(jumpProgress<.5?.18:-.18)*(1-Math.abs(.5-jumpProgress)*2);
      playerCar.rotateX(nose);
    }

    traffic.forEach(c=>{
      if(!c.userData.active)return;
      c.userData.s+=c.userData.speed*wdt;
      if(c.userData.targetLane!==null){
        const dl=c.userData.targetLane-c.userData.lane;
        if(Math.abs(dl)>.06)c.userData.lane+=Math.sign(dl)*Math.min(Math.abs(dl),3*wdt);
        else{c.userData.lane=c.userData.targetLane;c.userData.targetLane=null;}
      }
      placeOnRoad(c,c.userData.s,c.userData.lane,0);
      if(c.userData.wrongWay){c.rotateY(Math.PI);}
      if(!c.userData.passed&&playerS>c.userData.s+c.userData.halfLen+2){
        c.userData.passed=true;
        if(Math.abs(c.userData.lane-laneOffset)<3.2){
          combo++;comboTimer=4;const pts=25*combo;score+=pts;
          if(combo>gameStats.maxComboReached)gameStats.maxComboReached=combo;
          SND.ding(combo);popText('¡Cerca! +'+pts,'gold');
          ui.combo.textContent='×'+combo;ui.combo.classList.add('show');
        }
      }
      // eliminar si queda muy atrás
      if(c.userData.s<playerS-35){c.userData.active=false;c.visible=false;}
    });

    spawnTimer-=wdt;
    if(spawnTimer<=0){spawnCar();spawnTimer=Math.max(.28*diff.spawnMult,(1.1-speed*.008)*diff.spawnMult*levelMult);}

    // ── Boosts (estáticos en la carretera) ──
    pickupTimer-=wdt;
    if(pickupTimer<=0){spawnPickup();pickupTimer=2.2+Math.random()*2.4;}
    PICKUPS.forEach(p=>{
      if(!p.userData.active)return;
      // imán: los buenos se acercan a ti
      if(magnetT>0&&GOOD_TYPES.has(p.userData.type)&&p.userData.s-playerS<60&&p.userData.s>playerS){
        p.userData.s-=14*rawDt;
        p.userData.lat+=(laneOffset-p.userData.lat)*Math.min(1,rawDt*2.4);
      }
      const yF=p.userData.type==='oil'?.05:.95+Math.sin(now*3+p.userData.s)*0.15;
      placeOnRoad(p,p.userData.s,p.userData.lat,yF);
      if(p.userData.type!=='oil')p.rotateY(now*.5);
      if(p.userData.s<playerS-12){p.userData.active=false;p.visible=false;return;}
      if(Math.abs(p.userData.s-playerS)<2.6&&Math.abs(p.userData.lat-laneOffset)<1.8){
        applyPickup(p.userData.type);p.userData.active=false;p.visible=false;
      }
    });

    // ── Peatones (estáticos en s, cruzan en lat) ──
    pedTimer-=wdt;
    if(pedTimer<=0){spawnPed();pedTimer=diff.pedMin+Math.random()*diff.pedRng;}
    PEDS.forEach(p=>{
      const pd=p.userData.ped;if(!pd.active)return;
      if(pd.fly){
        pd.fly.t+=rawDt;pd.fly.vy-=16*rawDt;
        p.position.x+=pd.fly.vx*rawDt;p.position.y+=pd.fly.vy*rawDt;p.position.z+=pd.fly.vz*rawDt;
        p.rotation.z+=pd.fly.spin*rawDt;p.rotation.x+=pd.fly.spin*.6*rawDt;
        if(pd.fly.t>2.2||p.position.y<-4){pd.active=false;p.visible=false;}
        return;
      }
      pd.lat+=pd.vlat*wdt;
      frameAt(pd.s,F2);
      p.position.copy(F2.pos).add(F2.right.clone().multiplyScalar(pd.lat));
      // mirar en la dirección de cruce
      const dir=F2.right.clone().multiplyScalar(Math.sign(pd.vlat));
      p.rotation.set(0,Math.atan2(dir.x,dir.z),0);
      p.userData.head.rotation.y=Math.atan2(camera.position.x-p.position.x,camera.position.z-p.position.z)-p.rotation.y;
      const wf=pd.scared?16:10;
      const sw=Math.sin(now*wf+pd.s)*(pd.scared?.9:.65);
      p.userData.legL.rotation.x=sw;p.userData.legR.rotation.x=-sw;
      if(pd.scared){p.userData.armL.rotation.x=Math.PI-.3;p.userData.armR.rotation.x=Math.PI-.3;}
      else{p.userData.armL.rotation.x=-sw*.55;p.userData.armR.rotation.x=sw*.55;}
      p.position.y+=Math.abs(Math.sin(now*wf+pd.s))*.05;
      if(Math.abs(pd.lat)>ROAD_W*.5+12||pd.s<playerS-15){pd.active=false;p.visible=false;}
      else if(Math.abs(pd.s-playerS)<2.2&&Math.abs(pd.lat-laneOffset)<1.5&&jumpT<=0){
        if(shieldT>0){knockPed(p);score+=80;popText('+80','good');shake=Math.max(shake,.4);flash(whiteflash,100);}
        else pedHit(p);
      }
    });

    // ── Colisiones tráfico ──
    if(shieldT>0){
      for(const c of traffic){
        if(!c.userData.active)continue;
        if(Math.abs(c.userData.s-playerS)<c.userData.halfLen+2&&Math.abs(c.userData.lane-laneOffset)<2.0){
          c.userData.active=false;c.visible=false;score+=60;popText('+60','good');
          sparks(c.position.x,c.position.y+1,c.position.z);shake=Math.max(shake,.45);flash(whiteflash,100);
        }
      }
    } else if(invuln<=0){
      for(const c of traffic){
        if(!c.userData.active)continue;
        if(Math.abs(c.userData.s-playerS)<c.userData.halfLen+1.9&&Math.abs(c.userData.lane-laneOffset)<2.0){hit(c);break;}
      }
    }

    // ── Tramos especiales (peajes/obras/áreas de descanso) ──
    specialCooldown-=worldSpeed*wdt;
    tryStartSpecial();
    // Limpiar tramos que ya hemos pasado
    for(let i=specialSections.length-1;i>=0;i--){
      if(specialSections[i].s1<playerS-50)specialSections.splice(i,1);
    }
    // Actualizar visibilidad/posición de obstáculos y comprobar colisión
    OBSTACLES.forEach(o=>{
      if(!o.userData.active)return;
      if(o.userData.s<playerS-30){o.userData.active=false;o.visible=false;return;}
      placeOnRoad(o,o.userData.s,o.userData.lat,0);
      // Colisión con jugador
      const dlat=Math.abs(o.userData.lat-laneOffset);
      const ds=Math.abs(o.userData.s-playerS);
      if(ds<o.userData.halfLen+1.6&&dlat<1.5){
        if(o.userData.type==='cone'){
          // los conos son leves: solo penalización mínima y los apartas
          if(invuln<=0&&shieldT<=0&&jumpT<=0){
            shake=Math.max(shake,.35);speed=Math.max(diff.start*.6,speed*.9);
            score=Math.max(0,score-20);popText('-20','bad');
          }
          o.userData.active=false;o.visible=false;
          sparks(o.position.x,o.position.y+.5,o.position.z);
        } else if(o.userData.type==='barrier'){
          // las vallas hacen daño normal
          if(invuln<=0&&shieldT<=0&&jumpT<=0){
            damage(o.position.x,o.position.y+.7,o.position.z);
            if(hp<=0){
              const c=traffic.find(t=>!t.userData.active)||traffic[0];
              c.userData.active=false;c.visible=true;
              placeOnRoad(c,playerS+9,laneOffset+1.5,0);
              startDeath(c);
            } else{invuln=1.2;speed=Math.max(diff.start*.7,speed*.55);}
            o.userData.active=false;o.visible=false;
          }
        } else if(o.userData.type==='booth'){
          // CABINA DE PEAJE: letal, mata directamente
          if(invuln<=0&&shieldT<=0&&jumpT<=0){
            damage(o.position.x,o.position.y+1.5,o.position.z);
            hp=0;updateHearts();
            const c=traffic.find(t=>!t.userData.active)||traffic[0];
            c.userData.active=false;c.visible=true;
            placeOnRoad(c,playerS+9,laneOffset+1.5,0);
            startDeath(c);
          }
        }
      }
    });

    // ── Eventos aleatorios ──
    eventTimer-=rawDt;
    if(eventTimer<=0&&!activeEvent){startEvent();eventTimer=22+Math.random()*15;}
    if(activeEvent){
      activeEvent.t-=rawDt;
      if(activeEvent.type==='coinrain'){
        if(Math.random()<.5)spawnCoin();
      } else if(activeEvent.type==='rush'){
        // estampida: muchos peatones a la vez
        if(Math.random()<.4)spawnPed();
      } else if(activeEvent.type==='wrongway'){
        if(Math.random()<.08)spawnWrongWayCar();
      }
      if(activeEvent.t<=0){activeEvent=null;}
    }

    // ── Sistema de calor: decae con el tiempo ──
    if(heat>0){setHeat(heat-rawDt*0.018);}
    // HUD calor: estrellas
    {
      const stars=document.querySelectorAll('#heatHud .star');
      const lvl=heat>.85?3:heat>.55?2:heat>.25?1:0;
      stars.forEach((s,i)=>{s.style.color=i<lvl?'#ffd23f':'#3a4252';});
      document.getElementById('heatHud').style.opacity=heat>.05?1:0;
    }

    // ── Coches policía: persiguen al jugador AL LADO (visible siempre) ──
    let anyPoliceActive=false;
    policeCars.forEach(c=>{
      if(!c.userData.active)return;
      anyPoliceActive=true;
      // si se rinde, queda atrás
      if(c.userData.giveUp){
        c.userData.s-=20*rawDt;
        if(c.userData.s<playerS-120){c.userData.active=false;c.visible=false;c.userData.giveUp=false;}
      } else {
        // 1) MANTENERSE AL LADO: el policía intenta estar entre -8m y +20m respecto al jugador
        const ds=playerS-c.userData.s;   // positivo = policía detrás
        let policeSpeed;
        if(ds>20){
          // muy detrás → acelerar fuerte para alcanzar
          policeSpeed=worldSpeed*1.35;
        } else if(ds<-25){
          // muy delante → frenar para que te alcance
          policeSpeed=worldSpeed*.65;
        } else if(ds>0){
          // ligeramente detrás → ir a la par
          policeSpeed=worldSpeed*1.05;
        } else {
          // ligeramente delante → mantenerse
          policeSpeed=worldSpeed*0.95;
        }
        c.userData.s+=policeSpeed*rawDt;
        // 2) ATAQUE: pasados X segundos, busca tu carril para embestirte
        c.userData.aggro-=rawDt;
        if(c.userData.aggro<=0){
          // Apuntar a tu carril
          const dl=laneOffset-c.userData.lane;
          c.userData.lane+=Math.sign(dl)*Math.min(Math.abs(dl),3.5*rawDt);
        } else {
          // Aún no ataca: mantiene un carril paralelo
          const dl=laneOffset-c.userData.lane;
          // Se desplaza hacia ti pero a una distancia segura (3-4 metros)
          const targetLane=laneOffset+(c.userData.lane>laneOffset?3.5:-3.5);
          const dl2=targetLane-c.userData.lane;
          c.userData.lane+=Math.sign(dl2)*Math.min(Math.abs(dl2),1.5*rawDt);
        }
        // Asegurarse de que no se sale del ancho local
        const localHW=halfWidthAtS(c.userData.s);
        c.userData.lane=Math.max(-localHW+1, Math.min(localHW-1, c.userData.lane));
      }
      placeOnRoad(c,c.userData.s,c.userData.lane,0);
      // Luces parpadeando intensamente (cajas + halos + point lights)
      const phase=Math.sin(now*10);
      const blueOn=phase>0;
      c.userData.lblue.emissiveIntensity=blueOn?4.5:.3;
      c.userData.lred.emissiveIntensity=!blueOn?4.5:.3;
      c.userData.blueHalo.opacity=blueOn?1.0:.15;
      c.userData.redHalo.opacity=!blueOn?1.0:.15;
      c.userData.bluePoint.intensity=blueOn?3:.3;
      c.userData.redPoint.intensity=!blueOn?3:.3;
      // colisión con jugador
      if(invuln<=0&&shieldT<=0&&jumpT<=0&&Math.abs(c.userData.s-playerS)<c.userData.halfLen+1.9&&Math.abs(c.userData.lane-laneOffset)<2.0){
        damage(c.position.x,c.position.y+1,c.position.z);
        if(hp<=0)startDeath(c);
        else{invuln=1.3;speed=Math.max(diff.start*.7,speed*.55);}
        c.userData.active=false;c.visible=false;
      }
    });
    // Sirena en bucle mientras hay policía activa
    sirenLoop-=rawDt;
    if(anyPoliceActive&&sirenLoop<=0){SND.siren();sirenLoop=.95;}
    else if(!anyPoliceActive)sirenLoop=0;

    // ── Derrape: al girar fuerte a alta velocidad ──
    const driftTrigger=Math.abs(steer)>0.55&&worldSpeed>55;
    if(driftTrigger){
      driftAmount=Math.min(1,driftAmount+rawDt*2.2);
      // las marcas se generan en las ruedas traseras (un poco detrás del coche)
      dropTireMark(playerS-1.3, laneOffset, -0.7);
      dropTireMark(playerS-1.3, laneOffset, +0.7);
      if(Math.random()<.18)SND.skid();
    } else {
      driftAmount=Math.max(0,driftAmount-rawDt*1.4);
    }
    driftFactor=driftAmount*Math.sign(steer);
    updateTireMarks(rawDt);


    inTunnel=tunnelZone&&playerS>=tunnelZone.s0&&playerS<=tunnelZone.s1;
    const tOvTgt=inTunnel?.85:0;
    const tOvCur=parseFloat(tunnelOverlay.style.opacity)||0;
    tunnelOverlay.style.opacity=tOvCur+(tOvTgt-tOvCur)*.08;

    ui.score.textContent=Math.floor(score);
    if(ui.bestHud)ui.bestHud.textContent=STATS.bestScore>0?'🏆 '+STATS.bestScore:'';
    // Indicador del salto: disponible (verde), saltando (azul), cooldown (gris)
    if(ui.jumpIcon){
      if(jumpT>0){ui.jumpIcon.style.opacity='1';ui.jumpIcon.style.filter='hue-rotate(180deg) brightness(1.4)';ui.jumpHint.textContent='¡saltando!';}
      else if(jumpCd>0){ui.jumpIcon.style.opacity='.35';ui.jumpIcon.style.filter='grayscale(1)';ui.jumpHint.textContent=jumpCd.toFixed(1)+'s';}
      else{ui.jumpIcon.style.opacity='1';ui.jumpIcon.style.filter='hue-rotate(80deg) brightness(1.2) saturate(1.5)';ui.jumpHint.textContent='Esp';}
    }
    const kmh=Math.floor(worldSpeed*3.4);
    ui.speed.textContent=kmh;ui.speed.classList.toggle('fast',kmh>260);
    fovTarget=66+worldSpeed*.085+(turboActive?6:0)+(inTunnel?-4:0);

    // Detección "noche sobrevivida" (entrar de noche, salir a día)
    if(!nightStartTime && night>.6)nightStartTime=now;
    if(nightStartTime && night<.2 && now-nightStartTime>30){nightSurvived=true;}

    // Check de logros (cada ~1 segundo, no cada frame)
    achievementTimer-=rawDt;
    if(achievementTimer<=0){achievementTimer=1;checkAchievements();}

    // Audio inmersivo
    updateMusic(rawDt);
    setMusicIntensity(heat);                // música más intensa con calor alto
    setWindIntensity(worldSpeed*3.4);       // viento sube con km/h
    setTunnelReverb(inTunnel);              // reverb en túneles

    // GPS voz cada ~25-40s
    gpsTimer-=rawDt;
    if(gpsTimer<=0){gpsTimer=25+Math.random()*15;gpsSpeak();}

    if(actx&&engOsc){engOsc.frequency.value=38+worldSpeed*1.5+(turboActive?20:0);engFilter.frequency.value=240+worldSpeed*5+(inTunnel?800:0);engGain.gain.value=.05+worldSpeed*.0007;}
  }
  else if(state==='death'){
    steer*=(1-rawDt*4);
    playerS+=speed*rawDt;
    placeOnRoad(playerCar,playerS,laneOffset,0);
    updateDeath(rawDt);
    if(actx&&engOsc){engOsc.frequency.value=38+speed*1.5;engGain.gain.value=Math.max(.02,.05+speed*.0007);}
    fovTarget=66;
  } else {
    if(actx&&engGain)engGain.gain.value=0;fovTarget=68;
  }

  // ── Cámara desde el asiento ──
  camera.fov+=(fovTarget-camera.fov)*Math.min(1,rawDt*4);
  camera.updateProjectionMatrix();
  if(state==='playing'||state==='death'){
    frameAt(playerS,F);
    camera.position.copy(F.pos)
      .add(F.right.clone().multiplyScalar(laneOffset))
      .add(F.up.clone().multiplyScalar(1.42+jumpY));
    frameAt(playerS+14,F2);
    const look=F2.pos.clone().add(F2.right.clone().multiplyScalar(laneOffset*.7)).add(F2.up.clone().multiplyScalar(1.1+jumpY*.7));
    camera.up.copy(F.up);
    camera.lookAt(look);
    camera.rotateZ(-steer*.045);
    const vib=(state==='playing'?(speed+(turboActive?26:0))*.00022:0);
    camera.position.y+=(Math.random()-.5)*vib*2;
    camera.position.x+=(Math.random()-.5)*vib;
    if(shake>0){shake=Math.max(0,shake-rawDt*1.7);camera.position.x+=(Math.random()-.5)*shake*.5;camera.position.y+=(Math.random()-.5)*shake*.4;camera.rotateZ((Math.random()-.5)*shake*.06);}
    // fondo y luces siguen al jugador
    bgGroup.position.set(camera.position.x,0,camera.position.z);
    sun.position.set(camera.position.x-25,40,camera.position.z+20);
    sun.target.position.set(camera.position.x,0,camera.position.z-30);
    moonLight.position.set(camera.position.x+30,60,camera.position.z+40);
    moonLight.target.position.copy(sun.target.position);
  }

  wheel.rotation.z=-steer*1.4;
  // las manos siguen el aro del volante girando alrededor del centro
  const wAng=-steer*1.4;
  const WR=.22;   // radio del nuevo volante
  const WY=-.70, WZ=-.78;
  handL.position.set(Math.cos(Math.PI+wAng)*WR, WY+Math.sin(Math.PI+wAng)*WR, WZ);
  handL.rotation.z=wAng;
  handR.position.set(Math.cos(wAng)*WR, WY+Math.sin(wAng)*WR, WZ);
  handR.rotation.z=wAng;
  const blink=invuln<=0||Math.floor(invuln*12)%2===0;
  ownHood.visible=blink;hoodTip.visible=blink;

  updateSparks(rawDt);
  if(state!=='death')updateSmoke(rawDt,false,0,0,0);
  drawBlood(rawDt);drawGlass(rawDt);
  renderer.render(scene,camera);
}
animate();

window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
  sizeOverlays();
});

// En móvil: pausar si se gira a vertical (el aviso de rotación cubre la
// pantalla; al volver a horizontal queda la pantalla de pausa para reanudar).
if(IS_TOUCH){
  const portraitMQ=window.matchMedia('(orientation:portrait)');
  const onOrient=()=>{
    if(portraitMQ.matches&&state==='playing'&&!paused){
      paused=true;ui.pause.classList.remove('hidden');
    }
  };
  if(portraitMQ.addEventListener)portraitMQ.addEventListener('change',onOrient);
  else if(portraitMQ.addListener)portraitMQ.addListener(onOrient);
}
})();
