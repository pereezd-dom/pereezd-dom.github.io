// Переезд.Дом — 3D-глобус на главной: низкополигональная Земля (горы, пустыни, мелководье, облака, атмосфера)
// и флажки стран, где ищет бот. Шар рисует three.js (MIT, /vendor); флажки — обычные ссылки поверх холста,
// у соседей древки разной высоты, чтобы флажки не налезали друг на друга. Без WebGL — синий круг из CSS.
import * as THREE from './vendor/three.module.min.js';

const host = document.querySelector('[data-globe]');
const stage = host && host.querySelector('.globe-stage');
const dataTag = document.getElementById('globe-data');

const DEG = Math.PI / 180;
// Большинство стран бота — Европа, Кавказ, Турция: на первом экране глобус покачивается вокруг этой точки.
// При прокрутке списка стран он поворачивается к региону, который сейчас читают (регионы идут с запада
// на восток, поэтому вниз — значит дальше на восток), между регионами плавно переходит от одного к другому.
const HOME = { lon: 30, lat: 34 };
const SWAY = 22;           // градусов в каждую сторону на первом экране
const SWAY_LIST = 7;       // и пока читают список стран
const SWAY_SECONDS = 28;   // полный цикл покачивания
const READ_LINE = 0.45;    // «строка чтения» — доля высоты окна
const SPRING = 1.9;        // мягкость поворота: меньше — плавнее и медленнее
const SPRING_FOCUS = 2.8;  // к стране под курсором — чуть быстрее
const FIT = 1.27;          // радиус, который должен влезть в холст (суша, облака, атмосфера)
const FOV = 26;

// Горные хребты: ломаные (широта, долгота), ширина и высота — поднимают сушу и красят склоны и снег
const RIDGES = [
  { w: 3.2, h: 1.0, pts: [[27.5, 73], [29.5, 81], [28, 87], [27.8, 92], [29, 96]] },           // Гималаи
  { w: 6.5, h: 0.75, pts: [[33, 79], [33.5, 88], [32.5, 96]] },                                   // Тибет
  { w: 3, h: 0.7, pts: [[38.5, 70], [41.5, 77], [43, 85]] },                                      // Памир, Тянь-Шань
  { w: 2.6, h: 0.95, pts: [[9, -73], [0, -78], [-10, -76], [-18, -69], [-26, -68], [-33, -70], [-41, -71.5], [-50, -73.5]] }, // Анды
  { w: 3.4, h: 0.7, pts: [[61, -130], [53, -119], [46, -112], [40, -106], [35, -106]] },          // Скалистые горы
  { w: 1.6, h: 0.8, pts: [[45.6, 6.6], [46.5, 10], [47.1, 13.5]] },                                // Альпы
  { w: 1.5, h: 0.8, pts: [[43.4, 40], [42.8, 44.5], [41.5, 48.2]] },                               // Кавказ
  { w: 1.8, h: 0.45, pts: [[67, 65], [60, 59.6], [54, 58.6], [51.5, 58]] },                        // Урал
  { w: 2, h: 0.5, pts: [[30.8, -8.5], [33, -3], [35.8, 3]] },                                     // Атлас
  { w: 2.6, h: 0.55, pts: [[37.2, 44.5], [33, 48], [29, 53.5]] },                                  // Загрос
  { w: 2.6, h: 0.55, pts: [[13, 38.5], [6, 38.5], [-3, 36.5]] },                                   // Эфиопия, Килиманджаро
  { w: 2, h: 0.45, pts: [[68.5, 17], [63, 11], [60, 7]] },                                         // Скандинавские горы
  { w: 1.6, h: 0.45, pts: [[-17, 145.5], [-27, 152], [-37, 148]] },                                // Большой Водораздельный
  { w: 1.4, h: 0.5, pts: [[42.8, -1.5], [42.6, 2.5]] },                                            // Пиренеи
  { w: 1.6, h: 0.45, pts: [[47.8, 22.5], [45.6, 25.5], [44.6, 22.5]] },                            // Карпаты
];
// Пустыни: прямоугольники широт и долгот с мягким краем
const DESERTS = [
  [16, 31, -15, 32], [15, 31, 36, 57], [25, 35, 55, 71], [38, 47, 52, 66], [39, 46, 92, 112],
  [36, 41, 77, 90], [-31, -19, 117, 142], [-28, -19, 16, 25], [31, 38, -117, -107],
];

if (stage && dataTag) start().catch(() => {});

async function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return; // без WebGL остаётся заглушка
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const countries = JSON.parse(dataTag.textContent);
  const detail = stage.clientWidth >= 520 ? 56 : 40;

  const mask = await loadMask('/globe/land.png');
  await idle();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.set(0, 0, FIT / Math.sin((FOV / 2) * DEG));

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3d5fae, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-2.6, 3.2, 4);
  scene.add(sun);
  scene.add(buildAtmosphere());

  const tilt = new THREE.Group();   // наклон по широте
  const spin = new THREE.Group();   // поворот по долготе
  tilt.add(spin);
  scene.add(tilt);
  spin.add(await buildEarth(mask, detail));
  const clouds = buildClouds();
  spin.add(clouds);

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.appendChild(renderer.domElement);
  const flags = buildFlags(countries);

  let width = 0, height = 0;
  const resize = () => {
    width = stage.clientWidth;
    height = stage.clientHeight;
    const img = flags[0] && flags[0].el.querySelector('img'); // размер флажка задаёт CSS (на телефоне меньше)
    flagW = (img && img.offsetWidth) || 30;
    flagH = (img && img.offsetHeight) || 22;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // Поворот — пружина без рывков: цель = покачивание + регион у строки чтения + перетаскивание (с инерцией)
  const rot = { lon: HOME.lon, lat: HOME.lat, vlon: 0, vlat: 0 };
  let dragLon = 0, dragLat = 0, dragVel = 0, focus = null;
  const regions = regionStops(countries);
  // где регионы на странице, меряем только когда меняется раскладка (шрифты, картинки, размер окна), а не каждый кадр
  let regionTops = [];
  const measure = () => { regionTops = regions.map((r) => r.el.getBoundingClientRect().top + scrollY); };
  measure();
  new ResizeObserver(measure).observe(document.body);
  const scrollView = () => {
    if (!regions.length || reduce) return { lon: HOME.lon, lat: HOME.lat, list: 0 };
    const line = innerHeight * READ_LINE;
    const tops = regionTops.map((top) => top - scrollY - line);
    if (tops[0] > 0) {
      const part = Math.max(0, 1 - tops[0] / Math.max(1, tops[0] + scrollY));
      return mix(HOME, regions[0], smooth(part), part);
    }
    let i = 0;
    while (i < tops.length - 1 && tops[i + 1] <= 0) i++;
    if (i === tops.length - 1) return { lon: regions[i].lon, lat: regions[i].lat, list: 1 };
    const part = Math.min(1, -tops[i] / Math.max(1, tops[i + 1] - tops[i]));
    return mix(regions[i], regions[i + 1], smooth((part - 0.45) / 0.55), 1); // держим регион, пока его читают
  };
  const target = (t) => {
    if (focus) return { lon: focus.lon, lat: Math.max(-35, Math.min(45, focus.lat)) };
    const view = scrollView();
    const amp = reduce ? 0 : SWAY + (SWAY_LIST - SWAY) * view.list;
    const sway = amp * Math.sin((t / SWAY_SECONDS) * Math.PI * 2);
    return { lon: view.lon + sway + dragLon, lat: Math.max(-50, Math.min(60, view.lat + dragLat)) };
  };

  const canvas = renderer.domElement;
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, lon: dragLon, lat: dragLat, t: performance.now(), px: e.clientX };
    dragVel = 0;
    canvas.setPointerCapture(e.pointerId);
    host.classList.add('grab');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const now = performance.now();
    const step = Math.max(1, now - drag.t) / 1000;
    dragVel = 0.7 * dragVel + 0.3 * ((-(e.clientX - drag.px) * 0.3) / step);
    drag.t = now;
    drag.px = e.clientX;
    dragLon = drag.lon - (e.clientX - drag.x) * 0.3;
    dragLat = Math.max(-40, Math.min(40, drag.lat + (e.clientY - drag.y) * 0.2));
  });
  // жест прервался (браузер забрал его под прокрутку, потерялся захват, окно ушло в фон) — отпускаем глобус
  const release = () => { drag = null; host.classList.remove('grab'); };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  window.addEventListener('blur', release);

  document.addEventListener('globe:focus', (e) => {
    const code = e.detail;
    focus = code ? countries.find((c) => c.code === code) || null : null;
    flags.forEach((f) => f.el.classList.toggle('on', f.c.code === code));
  });

  let visible = true, running = false, last = performance.now();
  const t0 = last;
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) loop();
  }).observe(host);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });

  const v = new THREE.Vector3();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!drag && Math.abs(dragVel) > 0.05) { // инерция после броска
      dragLon += dragVel * dt;
      dragVel *= Math.exp(-dt * 2.5);
    }
    const want = target((now - t0) / 1000);
    if (reduce) {
      rot.lon = want.lon;
      rot.lat = want.lat;
    } else {
      const w = focus ? SPRING_FOCUS : SPRING;
      rot.vlon += (w * w * shortest(want.lon - rot.lon) - 2 * w * rot.vlon) * dt;
      rot.vlat += (w * w * (want.lat - rot.lat) - 2 * w * rot.vlat) * dt;
      rot.lon += rot.vlon * dt;
      rot.lat += rot.vlat * dt;
      clouds.rotation.y += dt * 0.016;
    }
    spin.rotation.y = -rot.lon * DEG;
    tilt.rotation.x = rot.lat * DEG;
    renderer.render(scene, camera);
    placeFlags(flags, v, spin, camera, width, height, dt);
  }
  function loop() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    const tick = (now) => {
      if (!visible || document.hidden) { running = false; return; }
      frame(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  frame(performance.now());
  host.classList.add('ready');
  loop();
}

function idle() {
  return new Promise((r) => ('requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 600 }) : setTimeout(r, 30)));
}

// отдать управление браузеру между тяжёлыми шагами сборки — страница не замирает на сотни миллисекунд
function breathe() {
  return new Promise((r) => setTimeout(r, 0));
}

function smooth(x) {
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
}

// Точки поворота для регионов списка стран: средняя широта и долгота их флажков
function regionStops(countries) {
  const byCode = new Map(countries.map((c) => [c.code, c]));
  return [...document.querySelectorAll('.countries .region')].map((el) => {
    const pts = [...el.querySelectorAll('[data-code]')].map((row) => byCode.get(row.dataset.code)).filter(Boolean);
    if (!pts.length) return null;
    const x = pts.reduce((a, c) => a + Math.cos(c.lon * DEG), 0), y = pts.reduce((a, c) => a + Math.sin(c.lon * DEG), 0);
    return { el, lon: Math.atan2(y, x) / DEG, lat: pts.reduce((a, c) => a + c.lat, 0) / pts.length };
  }).filter(Boolean);
}

function mix(a, b, k, list) {
  return { lon: a.lon + shortest(b.lon - a.lon) * k, lat: a.lat + (b.lat - a.lat) * k, list };
}

function shortest(delta) {
  return ((((delta + 180) % 360) + 360) % 360) - 180;
}

function hash(n) {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function toVec(lat, lon, r) {
  const la = lat * DEG, lo = lon * DEG;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}

async function loadMask(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  return (lat, lon) => {
    const x = Math.min(c.width - 1, Math.floor(((lon + 180) / 360) * c.width));
    const y = Math.min(c.height - 1, Math.floor(((90 - lat) / 180) * c.height));
    return px[(y * c.width + x) * 4] > 127;
  };
}

// Высота гор в точке: ближайший хребет, гладкий спад к краю (0…1)
function mountain(lat, lon) {
  let best = 0;
  const cl = Math.cos(lat * DEG);
  for (const r of RIDGES) {
    for (let k = 0; k < r.pts.length - 1; k++) {
      const [a1, o1] = r.pts[k], [a2, o2] = r.pts[k + 1];
      const ax = o1 * cl, ay = a1, dx = o2 * cl - ax, dy = a2 - ay, px = lon * cl, py = lat;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d < r.w) best = Math.max(best, r.h * smooth(1 - d / r.w));
    }
  }
  return best;
}

function desert(lat, lon) {
  let best = 0;
  for (const [a1, a2, o1, o2] of DESERTS) {
    const d = Math.min(lat - a1, a2 - lat, lon - o1, o2 - lon);
    if (d > 0) best = Math.max(best, smooth(d / 3.5));
  }
  return best;
}

// Земля: икосфера; грани над сушей подняты (рельеф, горы), по берегу — стенки; море — отдельная сфера
// с более светлым мелководьем у берегов. У каждой грани свой оттенок — «низкополигональный» вид.
async function buildEarth(isLand, detail) {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  const p = ico.attributes.position;
  const ids = new Map(), verts = [], faces = [];
  const key = (i) => (Math.round(p.getX(i) * 1e4) + 10001) * 4.0009e8 + (Math.round(p.getY(i) * 1e4) + 10001) * 20003 + (Math.round(p.getZ(i) * 1e4) + 10001);
  const index = new Int32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    let id = ids.get(k);
    if (id === undefined) {
      id = verts.length;
      ids.set(k, id);
      verts.push(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize());
    }
    index[i] = id;
  }
  for (let i = 0; i < p.count; i += 3) faces.push([index[i], index[i + 1], index[i + 2]]);
  ico.dispose();
  await breathe();

  const latOf = (vec) => Math.asin(Math.max(-1, Math.min(1, vec.y))) / DEG;
  const lonOf = (vec) => Math.atan2(vec.x, vec.z) / DEG;
  const centre = faces.map((f) => verts[f[0]].clone().add(verts[f[1]]).add(verts[f[2]]).normalize());
  const land = centre.map((c) => isLand(latOf(c), lonOf(c)));
  const peak = verts.map((vec) => mountain(latOf(vec), lonOf(vec)));
  const lift = verts.map((_, i) => 1.02 + 0.007 * hash(i) + 0.045 * peak[i]);
  await breathe();

  const edges = new Map();
  const edgeKey = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a);
  faces.forEach((f, fi) => {
    for (let k = 0; k < 3; k++) {
      const e = edgeKey(f[k], f[(k + 1) % 3]);
      const list = edges.get(e);
      if (list) list.push(fi); else edges.set(e, [fi]);
    }
  });
  const neighbours = (fi) => {
    const f = faces[fi], out = [];
    for (let k = 0; k < 3; k++) for (const x of edges.get(edgeKey(f[k], f[(k + 1) % 3]))) if (x !== fi) out.push(x);
    return out;
  };
  // мелководье: два кольца морских граней вокруг суши
  const shelf = new Uint8Array(faces.length);
  faces.forEach((_, fi) => { if (!land[fi] && neighbours(fi).some((x) => land[x])) shelf[fi] = 2; });
  faces.forEach((_, fi) => { if (!land[fi] && !shelf[fi] && neighbours(fi).some((x) => shelf[x] === 2)) shelf[fi] = 1; });
  await breathe();

  const lp = [], lc = [], op = [], oc = [];
  const col = new THREE.Color(), wall = new THREE.Color();
  const put = (arr, vec) => arr.push(vec.x, vec.y, vec.z);
  const paint = (arr, c, n) => { for (let k = 0; k < n; k++) arr.push(c.r, c.g, c.b); };
  const at = (i, r) => verts[i].clone().multiplyScalar(r);
  const GREEN = new THREE.Color(0x8ad152), TROPIC = new THREE.Color(0x5fbb4c), TUNDRA = new THREE.Color(0xb3d488);
  const SAND = new THREE.Color(0xead38f), ROCK = new THREE.Color(0xa88b68), SNOW = new THREE.Color(0xf3f7fc);

  faces.forEach((f, fi) => {
    const la = latOf(centre[fi]), lo = lonOf(centre[fi]);
    if (!land[fi]) {
      f.forEach((i) => put(op, at(i, 1 + 0.004 * (hash(i + 17) - 0.5))));
      col.setHex(shelf[fi] === 2 ? 0x63a0fa : shelf[fi] === 1 ? 0x4787f6 : 0x2f6ff2).offsetHSL(0, 0, (hash(fi + 3) - 0.5) * 0.035);
      paint(oc, col, 3);
      return;
    }
    f.forEach((i) => put(lp, at(i, lift[i])));
    const alt = (peak[f[0]] + peak[f[1]] + peak[f[2]]) / 3;
    if (Math.abs(la) > 66 || (la > 59 && lo < -15 && lo > -75)) {
      col.copy(SNOW); // полярные шапки и Гренландия
    } else {
      const a = Math.abs(la);
      col.copy(a < 18 ? TROPIC : GREEN).lerp(TUNDRA, smooth((a - 52) / 12));
      col.lerp(SAND, desert(la, lo) * 0.95);
      col.lerp(ROCK, smooth((alt - 0.25) / 0.35));
      col.lerp(SNOW, smooth((alt - 0.62) / 0.2));
    }
    col.offsetHSL(0, 0, (hash(fi) - 0.5) * 0.06);
    paint(lc, col, 3);
    wall.copy(col).multiplyScalar(0.72);
    for (let k = 0; k < 3; k++) {
      const i = f[k], j = f[(k + 1) % 3];
      const other = edges.get(edgeKey(i, j)).find((x) => x !== fi);
      if (other !== undefined && land[other]) continue;
      put(lp, at(j, lift[j])); put(lp, at(i, lift[i])); put(lp, at(i, 0.99));
      put(lp, at(j, lift[j])); put(lp, at(i, 0.99)); put(lp, at(j, 0.99));
      paint(lc, wall, 6);
    }
  });

  const mesh = (pos, colour, opts) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3));
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: 0, ...opts }));
  };
  const earth = new THREE.Group();
  earth.add(mesh(op, oc, { roughness: 0.4 }));
  earth.add(mesh(lp, lc, { roughness: 0.9, side: THREE.DoubleSide }));
  return earth;
}

// Атмосфера: светло-голубой ободок по краю шара (светится сильнее к краю)
function buildAtmosphere() {
  const material = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vN; void main() { float k = pow(max(0.0, 0.74 - dot(vN, vec3(0.0, 0.0, 1.0))), 2.4); gl_FragColor = vec4(0.62, 0.82, 1.0, 1.0) * k; }',
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1.13, 64, 48), material);
}

// Облака: комки из нескольких граненых шариков над поверхностью, медленно плывут
function buildClouds() {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95 });
  for (let n = 0; n < 34; n++) {
    const cloud = new THREE.Group();
    const lat = (hash(n * 7 + 1) * 2 - 1) * 64;
    const lon = hash(n * 7 + 2) * 360 - 180;
    cloud.position.copy(toVec(lat, lon, 1.1 + hash(n * 7 + 3) * 0.07));
    cloud.lookAt(0, 0, 0);
    cloud.rotateZ(hash(n * 7 + 5) * Math.PI);
    const puffs = 4 + Math.floor(hash(n * 7 + 4) * 4);
    const size = 0.7 + hash(n * 7 + 6) * 0.7;
    for (let j = 0; j < puffs; j++) {
      const m = new THREE.Mesh(geo, mat);
      const mid = 1 - Math.abs(j - (puffs - 1) / 2) / puffs; // в середине комки крупнее
      const s = (0.016 + hash(n * 31 + j) * 0.014) * (0.7 + mid * 0.6) * size;
      m.scale.set(s * 1.3, s, s * 1.1);
      m.position.set((j - (puffs - 1) / 2) * 0.026 * size, (hash(n * 13 + j) - 0.5) * 0.018 * size, -s * 0.4);
      m.rotation.set(hash(j + n) * 3, hash(j * 3 + n) * 3, 0);
      cloud.add(m);
    }
    group.add(cloud);
  }
  return group;
}

// Флажки: ссылки на страницы стран поверх холста
function buildFlags(countries) {
  const layer = document.createElement('div');
  layer.className = 'gflags';
  stage.appendChild(layer);
  return countries.map((c) => {
    const el = document.createElement('a');
    el.className = 'gflag';
    el.href = c.url;
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<span class="gf-stem"></span><span class="gf-dot"></span><span class="gf-hit"></span><img src="${c.flag}" width="30" height="22" alt=""><span class="gf-name">${c.name}${c.from ? ` · от ${c.from}` : ''}</span>`;
    el.addEventListener('pointerenter', () => document.dispatchEvent(new CustomEvent('globe:focus', { detail: c.code })));
    el.addEventListener('pointerleave', () => document.dispatchEvent(new CustomEvent('globe:focus', { detail: null })));
    layer.appendChild(el);
    return { c, el, base: toVec(c.lat, c.lon, 1.04), stem: 14, st: 14, fy: -14, side: 1, dir: 1, x: 0, y: 0, fx: 0, lastSide: 1, lastDir: 1, lastZ: '', lastAlpha: '' };
  });
}

// Каждый кадр: где на экране основание флажка, виден ли он, какой длины древко и куда стоит флажок —
// вверх или вниз от точки (когда сверху тесно, как в Европе на телефоне), вправо или влево.
// Место меняется, только если там древко короче хотя бы на две ступени, — флажки не прыгают.
// Вокруг флажка — невидимая рамка нажатия (PAD); рамки соседей не перекрываются, поэтому нажимается каждый.
const STEM_MIN = 14, STEM_STEP = 11, STEM_MAX = 124;
const PLACES = [[1, 1], [-1, 1], [1, -1], [-1, -1]]; // [сторона, направление]: сначала вверх, потом вниз
let flagW = 30, flagH = 22;
function placeFlags(flags, v, spin, camera, width, height, dt) {
  const fw = flagW, fh = flagH, pad = fw < 30 ? 5 : 3;
  const shown = [];
  for (const f of flags) {
    v.copy(f.base).applyMatrix4(spin.matrixWorld);
    const facing = v.z / v.length();
    v.project(camera);
    f.x = (v.x * 0.5 + 0.5) * width;
    f.y = (-v.y * 0.5 + 0.5) * height;
    f.alpha = Math.max(0, Math.min(1, (facing - 0.18) / 0.22));
    if (f.alpha > 0) shown.push(f);
  }
  shown.sort((a, b) => b.y - a.y);
  const boxes = [];
  // рамка нажатия флажка с древком stem на стороне side и в направлении dir (1 — вверх, −1 — вниз)
  const box = (f, side, dir, stem) => {
    const x1 = side > 0 ? f.x + 1 : f.x - fw - 1;
    const y1 = dir > 0 ? f.y - stem - fh : f.y + stem;
    return { x1: x1 - pad, x2: x1 + fw + pad, y1: y1 - pad, y2: y1 + fh + pad };
  };
  // не выше и не ниже квадрата глобуса — иначе флажок ляжет на кнопки над ним (на телефоне)
  const inside = (a) => a.y1 >= 0 && a.y2 <= height;
  const free = (a) => inside(a) && !boxes.some((b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1);
  const lowest = (f, side, dir) => {
    for (let stem = STEM_MIN; stem <= STEM_MAX; stem += STEM_STEP) {
      if (free(box(f, side, dir, stem))) return stem;
    }
    return STEM_MAX + STEM_STEP;
  };
  const ease = 1 - Math.exp(-dt * 9);
  for (const f of shown) {
    let stem = lowest(f, f.side, f.dir);
    for (const [side, dir] of PLACES) {
      if (side === f.side && dir === f.dir) continue;
      const other = lowest(f, side, dir);
      if (other + 2 * STEM_STEP <= stem) {
        f.side = side;
        f.dir = dir;
        stem = other;
      }
    }
    // свободного места нет — самое длинное древко, которое ещё в квадрате глобуса
    const room = f.dir > 0 ? f.y - fh - pad : height - f.y - fh - pad;
    stem = Math.max(0, Math.min(STEM_MAX, stem, room));
    f.stem = stem;
    boxes.push(box(f, f.side, f.dir, stem));
  }
  // в DOM пишем только то, что сдвигает слои (transform, свои переменные для transform), и только когда изменилось:
  // ничего из этого не меняет раскладку страницы
  for (const f of flags) {
    const s = f.el.style;
    const a = f.alpha.toFixed(2);
    if (a !== f.lastAlpha) {
      s.opacity = a;
      s.visibility = f.alpha > 0 ? 'visible' : 'hidden';
      f.lastAlpha = a;
    }
    if (f.alpha <= 0) continue;
    s.transform = `translate3d(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px, 0)`;
    // --st — древко со знаком (минус — вниз от точки), --fy — сдвиг нижнего края флажка от точки
    f.fx += ((f.side > 0 ? 0 : -(fw + 2)) - f.fx) * ease;
    f.st += (f.dir * f.stem - f.st) * ease;
    f.fy += ((f.dir > 0 ? -f.stem : f.stem + fh) - f.fy) * ease;
    s.setProperty('--st', f.st.toFixed(1));
    s.setProperty('--fy', f.fy.toFixed(1));
    s.setProperty('--fx', f.fx.toFixed(1));
    if (f.side !== f.lastSide) {
      f.el.classList.toggle('left', f.side < 0);
      f.lastSide = f.side;
    }
    if (f.dir !== f.lastDir) {
      f.el.classList.toggle('down', f.dir < 0);
      f.lastDir = f.dir;
    }
    const z = String(1000 - Math.round(f.y));
    if (z !== f.lastZ) {
      s.zIndex = z;
      f.lastZ = z;
    }
  }
}
