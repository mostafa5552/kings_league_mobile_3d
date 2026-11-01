/* KING'S LEAGUE 3D — game_4.js (جزء 4 من 6) */
/* ===== engine.js ===== */
/* ============================================================
   KING'S LEAGUE MENA 3D — engine.js
   (3/4) المحرك ثلاثي الأبعاد (Three.js) + الصوت + المؤثرات
   يعتمد على THREE (r128) و KL.F من match.js
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';
const F = KL.F, clamp = (v, a, b) => v < a ? a : (v > b ? b : v), hyp = Math.hypot;
const lerp = (a, b, k) => a + (b - a) * k;
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/* ---------------- الصوت (WebAudio مولَّد بالكود) ---------------- */
class Sound {
  constructor() { this.ctx = null; this.on = true; this.master = null; this.crowd = null; this.level = 0.25; this.target = 0.25; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC(); this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0; this.master.connect(c.destination);
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 3.2; }
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.4;
      this.crowd = c.createGain(); this.crowd.gain.value = 0.2; src.connect(f); f.connect(this.crowd); this.crowd.connect(this.master); src.start();
    } catch (e) { this.ctx = null; }
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 0.8 : 0; }
  tone(freq, dur, type, vol, slide, delay) {
    if (!this.ctx || !this.on) return; const c = this.ctx, t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noise(dur, vol, freq) {
    if (!this.ctx || !this.on) return; const c = this.ctx, n = c.sampleRate * dur, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1500; const g = c.createGain(); g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
  }
  play(n, p) {
    if (!this.ctx) return;
    switch (n) {
      case 'kick': this.tone(150 + (p || 0.5) * 60, 0.09, 'sine', 0.35 + (p || 0) * 0.3, 60); this.noise(0.05, 0.12, 2500); break;
      case 'whistle': this.tone(2900, 0.5, 'square', 0.12); this.tone(3100, 0.5, 'square', 0.1, 0, 0.0); break;
      case 'goal': this.tone(220, 1.0, 'sawtooth', 0.18, 330); this.tone(330, 1.0, 'sawtooth', 0.12, 495); this.target = 1; break;
      case 'post': this.tone(900, 0.35, 'triangle', 0.3, 500); break;
      case 'wall': this.tone(120, 0.1, 'square', 0.12, 80); break;
      case 'save': this.noise(0.12, 0.35, 900); break;
      case 'tackle': this.noise(0.1, 0.25, 700); break;
      case 'net': this.noise(0.25, 0.25, 2500); break;
      case 'card': this.tone(600, 0.2, 'square', 0.15); this.tone(450, 0.3, 'square', 0.15, 0, 0.18); break;
      case 'ui': this.tone(700, 0.06, 'sine', 0.15, 900); break;
      case 'powerup': this.tone(300, 0.5, 'sawtooth', 0.18, 900); break;
      case 'dice': this.noise(0.08, 0.3, 1800); break;
      case 'end': this.tone(2900, 0.4, 'square', 0.12); this.tone(2900, 0.4, 'square', 0.12, 0, 0.5); this.tone(2900, 0.8, 'square', 0.12, 0, 1.0); this.target = 0.9; break;
    }
  }
  tick(dt) {
    if (!this.ctx || !this.crowd) return;
    this.level += (this.target - this.level) * Math.min(1, dt * 1.5); this.target = lerp(this.target, 0.22, Math.min(1, dt * 0.45));
    this.crowd.gain.value = this.level * 0.5;
  }
}

/* ---------------- المحرك ---------------- */
class Engine {
  constructor(canvas) {
    const T = THREE; this.T = T; this.canvas = canvas; this.sound = new Sound();
    const r = this.r = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.setClearColor(0x04060c);
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    this.scene = new T.Scene(); this.scene.fog = new T.Fog(0x04060c, 55, 120);
    this.cam = new T.PerspectiveCamera(46, 1, 0.1, 300);
    this.camMode = 0; this.camPos = new T.Vector3(0, 20, 26); this.camLook = new T.Vector3(0, 0, 0);
    this.time = 0; this.match = null; this.pm = []; this.shake = 0; this.parts = []; this.mats = {}; this.netKick = [0, 0];
    this.screenT = 0; this.lastScoreKey = '';
    this.buildLights(); this.buildArena(); this.buildBall(); this.buildFX();
    this.resize(); this.cam.position.copy(this.camPos);
  }
  mat(color, opts) { const k = color + (opts ? JSON.stringify(opts) : ''); if (!this.mats[k]) this.mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(color), roughness: 0.72, metalness: 0.02 }, opts || {})); return this.mats[k]; }
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.fov = w / h < 1.2 ? 62 : 46; this.cam.updateProjectionMatrix();
  }
  buildLights() {
    const T = THREE, s = this.scene;
    s.add(new T.HemisphereLight(0xcfe0ff, 0x1a2a1a, 0.62));
    const d = new T.DirectionalLight(0xffffff, 0.75); d.position.set(-10, 30, 14); d.castShadow = true;
    const mp = (window.innerWidth < 900 ? 1024 : 2048); d.shadow.mapSize.set(mp, mp); const sc = d.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 24; sc.bottom = -24; sc.near = 5; sc.far = 80; d.shadow.bias = -0.0006; s.add(d);
    const d2 = new T.DirectionalLight(0xaaccff, 0.2); d2.position.set(14, 20, -16); s.add(d2);
  }
  buildArena() {
    const T = THREE, S = this.scene, W = F.W, L = F.L, pad = F.pad;
    /* الأرضية: رصاصي غامق + شعار الدوري بشفافية في المنتصف */
    this.floorPx = 22; this.floorW = L + pad * 2 + 6;
    this.floorC = cv(Math.round(this.floorW * this.floorPx), Math.round(W * this.floorPx));
    this.floorTex = new T.CanvasTexture(this.floorC); this.floorTex.anisotropy = 4;
    this.drawFloor(null);
    const pl = new T.Mesh(new T.PlaneGeometry(this.floorW, W), new T.MeshStandardMaterial({ map: this.floorTex, roughness: 0.55, metalness: 0.05 })); pl.rotation.x = -Math.PI / 2; pl.receiveShadow = true; S.add(pl);
    const out = new T.Mesh(new T.PlaneGeometry(300, 300), new T.MeshBasicMaterial({ color: 0x07090f })); out.rotation.x = -Math.PI / 2; out.position.y = -0.05; S.add(out);
    this.loadImg([KL.ASSETS.league, 'kl-logo.png', KL.LEAGUE_LOGO], im => this.drawFloor(im));
    /* الحواجز الشفافة */
    const gm = new T.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false });
    const frame = new T.MeshBasicMaterial({ color: 0x2a6bff });
    const hz = F.hz, ex = F.hx + pad;
    const wall = (w, h, x, z, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), gm); m.position.set(x, h / 2, z); m.rotation.y = ry; S.add(m); const f2 = new T.Mesh(new T.BoxGeometry(w, 0.08, 0.08), frame); f2.position.set(x, h, z); f2.rotation.y = ry; S.add(f2); };
    wall(L + pad * 2, 1.35, 0, hz + 0.05, 0); wall(L + pad * 2, 1.35, 0, -hz - 0.05, 0); wall(W, 1.35, ex + 0.05, 0, Math.PI / 2); wall(W, 1.35, -ex - 0.05, 0, Math.PI / 2);
    /* لوحات LED حول الملعب: شعارات الفريقين + اسم الدوري */
    this.ledC = cv(2048, 64); this.ledTex = new T.CanvasTexture(this.ledC); this.ledTex.wrapS = T.RepeatWrapping; this.ledTex.repeat.set(3, 1);
    this.logoCache = {}; this.ledTeams = null; this.drawLed();
    const lm = new T.MeshBasicMaterial({ map: this.ledTex });
    const led = (w, x, z, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, 1.5), lm); m.position.set(x, 0.85, z); m.rotation.y = ry; S.add(m); };
    led(L + pad * 2, 0, hz + 0.9, Math.PI); led(L + pad * 2, 0, -hz - 0.9, 0); led(W, ex + 0.9, 0, -Math.PI / 2); led(W, -ex - 0.9, 0, Math.PI / 2);
    /* شاشات ليد كبيرة خلف المرميين وعلى الجانب البعيد: شعار الفريقين + النتيجة + الوقت */
    this.scrC2 = cv(1024, 292); this.scrTex2 = new T.CanvasTexture(this.scrC2);
    { const x = this.scrC2.getContext('2d'); x.fillStyle = '#050b22'; x.fillRect(0, 0, 1024, 292); x.fillStyle = '#ffdf00'; x.font = '900 70px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText("KING'S LEAGUE", 512, 146); this.scrTex2.needsUpdate = true; }
    const bm = new T.MeshBasicMaterial({ map: this.scrTex2 });
    const big = (x, y, z, ry) => { const m = new T.Mesh(new T.PlaneGeometry(14, 4), bm); m.position.set(x, y, z); m.rotation.y = ry; S.add(m); const fr = new T.Mesh(new T.BoxGeometry(14.3, 4.3, 0.15), new T.MeshBasicMaterial({ color: 0x1a2a6a })); fr.position.set(x, y, z); fr.rotation.y = ry; fr.translateZ(-0.12); S.add(fr); };
    big(-11, 3.6, -(hz + 3.4), 0); big(11, 3.6, -(hz + 3.4), 0); big(ex + 3.6, 3.6, 0, -Math.PI / 2); big(-ex - 3.6, 3.6, 0, Math.PI / 2);
    /* المدرجات */
    const cc = cv(512, 256), cx = cc.getContext('2d'); cx.fillStyle = '#10131c'; cx.fillRect(0, 0, 512, 256);
    const cols = ['#e11d1d', '#ffdf00', '#1a47e0', '#ffffff', '#ff7f11', '#7e2fd0', '#13b5c9', '#d6ff00', '#222']; let sd = 7; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let y = 6; y < 256; y += 9) for (let x = 4; x < 512; x += 8) { cx.fillStyle = '#e3b48a'; cx.fillRect(x + 1, y - 4, 4, 4); cx.fillStyle = cols[Math.floor(rn() * cols.length)]; cx.fillRect(x, y, 6, 6); }
    const ct = new T.CanvasTexture(cc); ct.wrapS = ct.wrapT = T.RepeatWrapping; this.crowdTex = ct;
    const cm = new T.MeshBasicMaterial({ map: ct, color: 0xb0b0b0 });
    const stand = (w, x, z, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, 9), cm.clone()); m.material.map = ct.clone(); m.material.map.needsUpdate = true; m.material.map.repeat.set(w / 12, 1.1); m.position.set(x, 5.5, z); m.rotation.set(-0.5, ry, 0, 'YXZ'); S.add(m); return m; };
    this.stands = [stand(L + pad * 2 + 14, 0, hz + 6, Math.PI), stand(L + pad * 2 + 14, 0, -hz - 6, 0), stand(W + 14, ex + 6, 0, -Math.PI / 2), stand(W + 14, -ex - 6, 0, Math.PI / 2)];
    /* المرميان */
    this.nets = [];
    for (const e of [1, -1]) {
      const g2 = new T.Group(); g2.position.x = e * F.hx; S.add(g2);
      const pm = new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x333333 });
      for (const sz of [-1, 1]) { const p = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, F.gh, 8), pm); p.position.set(0, F.gh / 2, sz * F.gw); g2.add(p); const back = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, F.gh, 6), pm); back.position.set(e * F.gd, F.gh / 2, sz * F.gw); g2.add(back); const top = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, F.gd, 6), pm); top.rotation.z = Math.PI / 2; top.position.set(e * F.gd / 2, F.gh, sz * F.gw); g2.add(top); }
      const bar = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, F.gw * 2, 8), pm); bar.rotation.x = Math.PI / 2; bar.position.set(0, F.gh, 0); g2.add(bar);
      const nc = cv(128, 128), nx = nc.getContext('2d'); nx.strokeStyle = 'rgba(255,255,255,.9)'; nx.lineWidth = 3; for (let i = 0; i <= 128; i += 16) { nx.beginPath(); nx.moveTo(i, 0); nx.lineTo(i, 128); nx.stroke(); nx.beginPath(); nx.moveTo(0, i); nx.lineTo(128, i); nx.stroke(); }
      const nt = new T.CanvasTexture(nc); nt.wrapS = nt.wrapT = T.RepeatWrapping; const nm = new T.MeshBasicMaterial({ map: nt, transparent: true, side: T.DoubleSide, depthWrite: false });
      const net = new T.Group(); g2.add(net);
      const backN = new T.Mesh(new T.PlaneGeometry(F.gw * 2, F.gh), nm.clone()); backN.material.map = nt.clone(); backN.material.map.repeat.set(5, 3); backN.material.map.needsUpdate = true; backN.rotation.y = Math.PI / 2; backN.position.set(e * F.gd, F.gh / 2, 0); net.add(backN);
      const topN = new T.Mesh(new T.PlaneGeometry(F.gd, F.gw * 2), nm.clone()); topN.material.map = nt.clone(); topN.material.map.repeat.set(2, 5); topN.material.map.needsUpdate = true; topN.rotation.x = Math.PI / 2; topN.position.set(e * F.gd / 2, F.gh, 0); net.add(topN);
      for (const sz of [-1, 1]) { const sN = new T.Mesh(new T.PlaneGeometry(F.gd, F.gh), nm.clone()); sN.material.map = nt.clone(); sN.material.map.repeat.set(2, 3); sN.material.map.needsUpdate = true; sN.position.set(e * F.gd / 2, F.gh / 2, sz * F.gw); net.add(sN); }
      this.nets.push({ g: net, e, k: 0 });
    }
    /* قفص الكرة المعلّق والشاشة المركزية */
    this.cage = new T.Group(); this.cage.position.set(0, 9, 0);
    const cb = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.4, 1.4, 1.4)), new T.LineBasicMaterial({ color: 0xffdf00 })); this.cage.add(cb);
    const rope = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 12, 4), new T.MeshBasicMaterial({ color: 0x888888 })); rope.position.y = 6.7; this.cage.add(rope); S.add(this.cage);
    this.scrC = cv(512, 256); this.scrTex = new T.CanvasTexture(this.scrC);
    const sm = new T.Mesh(new T.BoxGeometry(8, 4, 8), [0, 1, 2, 3].map(() => new T.MeshBasicMaterial({ map: this.scrTex })).concat([new T.MeshBasicMaterial({ color: 0x111111 }), new T.MeshBasicMaterial({ color: 0x111111 })]));
    sm.position.set(0, 15.5, 0); this.screen = sm; S.add(sm);
    /* أضواء سقف */
    for (const [x, z] of [[-18, -10], [18, -10], [-18, 10], [18, 10], [0, 0]]) { const lm2 = new T.Mesh(new T.CylinderGeometry(0.4, 0.8, 0.6, 10), new T.MeshBasicMaterial({ color: 0xffffee })); lm2.position.set(x, 20, z); S.add(lm2); }
  }
  loadImg(srcs, cb) {
    let i = 0; const next = () => { if (i >= srcs.length) return; const src = srcs[i++]; if (!src) return next(); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => cb(im); im.onerror = next; im.src = src; }; next();
  }
  drawFloor(logo) {
    const c = this.floorC, g = c.getContext('2d'), px = this.floorPx, FW = this.floorW, W = F.W; const CX = x => (x + FW / 2) * px, CZ = z => (z + W / 2) * px;
    for (let i = 0; i < 26; i++) { g.fillStyle = i % 2 ? '#22262c' : '#2a2f36'; g.fillRect(i * c.width / 26, 0, c.width / 26 + 1, c.height); }
    g.fillStyle = '#12151a'; g.fillRect(0, 0, CX(-F.hx), c.height); g.fillRect(CX(F.hx), 0, c.width - CX(F.hx), c.height);
    g.fillStyle = 'rgba(25,195,230,.08)'; for (const e of [-1, 1]) g.fillRect(e > 0 ? CX(F.hx - F.penD) : CX(-F.hx), CZ(-F.penW / 2), F.penD * px, F.penW * px);
    if (logo) { const w = 11 * px, h = w * (logo.naturalHeight || logo.height) / (logo.naturalWidth || logo.width); g.save(); g.globalAlpha = 0.3; g.drawImage(logo, CX(0) - w / 2, CZ(0) - h / 2, w, h); g.restore(); }
    else { g.save(); g.globalAlpha = 0.22; g.fillStyle = '#fff'; g.font = '900 ' + (px * 2.4) + 'px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText("KING'S", CX(0), CZ(-1.6)); g.fillText('LEAGUE', CX(0), CZ(1.6)); g.restore(); }
    g.strokeStyle = '#fff'; g.lineWidth = 0.13 * px; g.lineCap = 'round';
    g.strokeRect(CX(-F.hx), CZ(-F.hz) + 2, F.L * px, W * px - 4);
    g.beginPath(); g.moveTo(CX(0), CZ(-F.hz)); g.lineTo(CX(0), CZ(F.hz)); g.stroke();
    g.beginPath(); g.arc(CX(0), CZ(0), 4 * px, 0, 7); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(CX(0), CZ(0), 0.2 * px, 0, 7); g.fill();
    for (const e of [-1, 1]) {
      g.strokeRect(e > 0 ? CX(F.hx - F.penD) : CX(-F.hx), CZ(-F.penW / 2), F.penD * px, F.penW * px);
      g.beginPath(); g.arc(CX(e * (F.hx - F.penSpot)), CZ(0), 0.2 * px, 0, 7); g.fill();
      g.beginPath(); g.arc(CX(e * (F.hx - F.penSpot)), CZ(0), 4.2 * px, e > 0 ? Math.PI * 0.62 : -Math.PI * 0.38, e > 0 ? Math.PI * 1.38 : Math.PI * 0.38); g.stroke();
    }
    this.floorTex.needsUpdate = true;
  }
  setTeams(A, B) {
    this.ledTeams = [A, B]; this.logoCache = {};
    [A, B].forEach(t => {
      const fb = new Image(); fb.onload = () => { if (!this.logoCache[t.id]) { this.logoCache[t.id] = fb; this.drawLed(); this.lastScoreKey = ''; } }; fb.src = KL.logoFallback(t.id);
      this.loadImg(KL.logoChain(t), im => { this.logoCache[t.id] = im; this.drawLed(); this.lastScoreKey = ''; });
    });
    this.drawLed();
  }
  drawLed() {
    const c = this.ledC, x = c.getContext('2d'); const grd = x.createLinearGradient(0, 0, 2048, 0); grd.addColorStop(0, '#0b2a8f'); grd.addColorStop(0.5, '#5a1bb0'); grd.addColorStop(1, '#0b2a8f'); x.fillStyle = grd; x.fillRect(0, 0, 2048, 64);
    x.textBaseline = 'middle'; x.textAlign = 'left'; let xx = 16; const tm = this.ledTeams;
    const star = () => { x.fillStyle = '#ffdf00'; x.font = '900 34px Arial'; x.fillText('★', xx, 34); xx += 54; };
    const league = () => { x.fillStyle = '#ffdf00'; x.font = '900 40px Arial'; const t = "KING'S LEAGUE MENA"; x.fillText(t, xx, 34); xx += x.measureText(t).width + 40; };
    const team = t => { const im = this.logoCache[t.id]; if (im) { const h = 52, w = (im.width || 52) * h / (im.height || 52); x.drawImage(im, xx, 6, w, h); xx += w + 14; } x.fillStyle = '#fff'; x.font = '900 40px Arial'; const nm = String(t.name).toUpperCase(); x.fillText(nm, xx, 34); xx += x.measureText(nm).width + 44; };
    for (let n = 0; n < 12 && xx < 2048; n++) { if (tm) { team(tm[0]); star(); league(); star(); team(tm[1]); star(); league(); star(); } else { league(); star(); } }
    this.ledTex.needsUpdate = true;
  }
  drawBoard(c) {
    const x = c.getContext('2d'), w = c.width, h = c.height, m = this.match; const grd = x.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#0a1440'); grd.addColorStop(0.5, '#1a0f4a'); grd.addColorStop(1, '#0a1440'); x.fillStyle = grd; x.fillRect(0, 0, w, h);
    const A = m.t[0].d, B = m.t[1].d; x.textAlign = 'center'; x.textBaseline = 'middle';
    const logo = (t, cx) => { const im = this.logoCache[t.id], hh = h * 0.5; if (im) { const ww = (im.width || 1) * hh / (im.height || 1); x.drawImage(im, cx - ww / 2, h * 0.14, ww, hh); } x.fillStyle = '#fff'; x.font = '900 ' + (h * 0.12) + 'px Arial'; x.fillText(String(t.name).toUpperCase(), cx, h * 0.8); };
    logo(A, w * 0.17); logo(B, w * 0.83);
    x.fillStyle = '#fff'; x.font = '900 ' + (h * 0.46) + 'px Arial'; x.fillText(m.score[0] + ' - ' + m.score[1], w / 2, h * 0.42);
    x.fillStyle = '#ffdf00'; x.font = '700 ' + (h * 0.14) + 'px Arial'; x.fillText(m.timeText(), w / 2, h * 0.78); x.font = '900 ' + (h * 0.09) + 'px Arial'; x.fillStyle = '#9fd8ff'; x.fillText("KING'S LEAGUE", w / 2, h * 0.93);
  }
  buildBall() {
    const T = THREE, W = 512, H = 256, c = cv(W, H), x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#e9ebef'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#dfe2e8'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // رؤوس المجسم العشريني: 12 مضلعاً خماسياً أسود كالكرة الحقيقية
    const V = [[0, 90], [0, -90]]; for (let i = 0; i < 5; i++) { V.push([i * 72, 26.565]); V.push([i * 72 + 36, -26.565]); }
    const px = lon => ((lon % 360 + 360) % 360) / 360 * W, py = lat => (90 - lat) / 180 * H;
    x.strokeStyle = 'rgba(120,125,135,.55)'; x.lineWidth = 2;
    for (let i = 2; i < V.length; i++) for (let j = i + 1; j < V.length; j++) { const dl = Math.abs(((V[i][0] - V[j][0] + 540) % 360) - 180); if (V[i][1] === V[j][1] ? false : dl < 40 || (180 - dl) < 1) { const a = px(V[i][0]), b2 = px(V[j][0]); if (Math.abs(a - b2) < W / 2) { x.beginPath(); x.moveTo(a, py(V[i][1])); x.lineTo(b2, py(V[j][1])); x.stroke(); } } }
    x.fillStyle = '#14161a';
    for (const [lon, lat] of V) {
      if (Math.abs(lat) === 90) { x.fillRect(0, lat > 0 ? 0 : H - 22, W, 22); continue; }
      const sx = 1 / Math.max(0.35, Math.cos(lat * Math.PI / 180)), cx = px(lon), cy = py(lat);
      for (const off of [-W, 0, W]) { x.beginPath(); for (let k = 0; k < 5; k++) { const an = k * Math.PI * 2 / 5 - Math.PI / 2; const X = cx + off + Math.cos(an) * 30 * sx, Y = cy + Math.sin(an) * 30; k ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.closePath(); x.fill(); }
    }
    const tex = new T.CanvasTexture(c); tex.anisotropy = 4;
    this.ballMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0.03 });
    this.colMat = new T.MeshStandardMaterial({ color: 0xff2fd0, emissive: 0xaa1090, roughness: 0.35 });
    this.ball = new T.Mesh(new T.SphereGeometry(F.R, 32, 24), this.ballMat); this.ball.castShadow = true; this.scene.add(this.ball);
    this.ballShadow = new T.Mesh(new T.CircleGeometry(0.28, 12), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false })); this.ballShadow.rotation.x = -Math.PI / 2; this.scene.add(this.ballShadow);
    this.glow = new T.PointLight(0xff2fd0, 0, 9); this.scene.add(this.glow);
  }
  buildFX() {
    const T = THREE, n = 260; this.cGeo = new T.BufferGeometry(); this.cPos = new Float32Array(n * 3); this.cCol = new Float32Array(n * 3); this.cVel = new Float32Array(n * 3); this.cLife = new Float32Array(n);
    this.cGeo.setAttribute('position', new T.BufferAttribute(this.cPos, 3)); this.cGeo.setAttribute('color', new T.BufferAttribute(this.cCol, 3));
    this.confetti = new T.Points(this.cGeo, new T.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true })); this.confetti.frustumCulled = false; this.scene.add(this.confetti);
    this.ring = new T.Mesh(new T.RingGeometry(0.55, 0.7, 24), new T.MeshBasicMaterial({ color: 0xffdf00, side: T.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false })); this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.04; this.scene.add(this.ring);
    this.arrow = new T.Mesh(new T.ConeGeometry(0.22, 0.45, 8), new T.MeshBasicMaterial({ color: 0xffdf00 })); this.arrow.rotation.x = Math.PI; this.scene.add(this.arrow);
    this.aim = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), new T.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.85 })); this.aim.visible = false; this.scene.add(this.aim);
  }
  burst(x, z, cols) {
    const n = this.cLife.length; for (let i = 0; i < n; i++) {
      this.cPos[i * 3] = x + (Math.random() - 0.5) * 4; this.cPos[i * 3 + 1] = 2 + Math.random() * 3; this.cPos[i * 3 + 2] = z + (Math.random() - 0.5) * 4;
      this.cVel[i * 3] = (Math.random() - 0.5) * 10; this.cVel[i * 3 + 1] = 4 + Math.random() * 9; this.cVel[i * 3 + 2] = (Math.random() - 0.5) * 10; this.cLife[i] = 2 + Math.random() * 1.6;
      const c = new THREE.Color(cols[i % cols.length]); this.cCol[i * 3] = c.r; this.cCol[i * 3 + 1] = c.g; this.cCol[i * 3 + 2] = c.b;
    }
  }

  /* ---------------- اللاعبون ---------------- */
  numTex(num, col) {
    const c = cv(64, 64), x = c.getContext('2d'); x.fillStyle = col; x.font = '900 46px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 5; x.strokeText(String(num), 32, 34); x.fillText(String(num), 32, 34);
    return new THREE.CanvasTexture(c);
  }
  shade(hex, f) { const h = String(hex).replace('#', ''), n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16) || 0, ch = v => ('0' + Math.max(0, Math.min(255, Math.round(v * f))).toString(16)).slice(-2); return '#' + ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255); }
  /* قماش القميص: نمط حسب الفريق + ياقة وحافة */
  shirtTex(col, trim, variant) {
    const k = 'st' + col + trim + variant; this.texC = this.texC || {}; if (this.texC[k]) return this.texC[k];
    const c = cv(256, 256), g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 256, 256);
    if (variant === 1) { g.fillStyle = this.shade(col, 0.72); for (let i = 0; i < 16; i++) g.fillRect(i * 16 + 6, 0, 4, 256); }
    else if (variant === 2) { g.fillStyle = this.shade(col, 0.8); for (let i = 0; i < 8; i++) g.fillRect(0, i * 32 + 8, 256, 14); }
    else { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(1, 'rgba(0,0,0,.14)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
    g.fillStyle = trim; g.fillRect(0, 0, 256, 24); g.fillRect(0, 248, 256, 8);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 24, 256, 3);
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return (this.texC[k] = t);
  }
  /* الوجه: عينان وحاجبان وفم وظلال على الرأس */
  faceTex(skin, hair, beard) {
    const k = 'ft' + skin + hair + beard; this.texC = this.texC || {}; if (this.texC[k]) return this.texC[k];
    const c = cv(512, 256), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, this.shade(skin, 1.0)); gr.addColorStop(1, this.shade(skin, 0.9)); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    const X = 128; // مركز الوجه (u = 0.25)
    g.fillStyle = 'rgba(0,0,0,.10)'; g.beginPath(); g.ellipse(X, 150, 20, 30, 0, 0, 7); g.fill();
    for (const s of [-1, 1]) {
      const ex = X + s * 26, ey = 112;
      g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.ellipse(ex, ey + 2, 15, 9, 0, 0, 7); g.fill();
      g.fillStyle = '#f4f1ec'; g.beginPath(); g.ellipse(ex, ey, 11, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#3a2a1c'; g.beginPath(); g.arc(ex, ey, 4.6, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(ex, ey, 2.2, 0, 7); g.fill();
      g.strokeStyle = hair; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - s * 12, ey - 15 + s * 0); g.quadraticCurveTo(ex, ey - 22, ex + s * 12, ey - 14); g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(X, 118); g.lineTo(X - 3, 142); g.lineTo(X + 4, 143); g.stroke();
    g.strokeStyle = '#6e2f29'; g.lineWidth = 4; g.beginPath(); g.moveTo(X - 14, 166); g.quadraticCurveTo(X, 172, X + 14, 166); g.stroke();
    if (beard) { g.fillStyle = hair; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(X, 188, 36, 26, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
    return (this.texC[k] = new THREE.CanvasTexture(c));
  }
  makePlayer(P, kit) {
    const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
    const isGK = P.isGK, shirt = isGK ? kit.gk : kit.shirt, shorts = isGK ? kit.gkShorts : kit.shorts, sock = isGK ? kit.gkShorts : kit.shirt;
    const h = hash(P.name), skins = ['#f3d2b3', '#e6b98f', '#d19a6c', '#b27a4f', '#8a5a38', '#5e3b24'], skin = skins[h % skins.length];
    const hairs = ['#15110e', '#2b1a0f', '#4a2f1b', '#8a6a3c', '#0c0c0c', '#5a3a22'], hair = hairs[(h >> 3) % hairs.length], style = (h >> 6) % 6, beard = ((h >> 9) % 4) === 0;
    const M = c => this.mat(c), S = (r, ws, hs, col, sx, sy, sz) => { const m = new T.Mesh(new T.SphereGeometry(r, ws, hs), M(col)); m.scale.set(sx || 1, sy || 1, sz || 1); return m; };
    const cyl = (rt, rb, hh, col, seg) => new T.Mesh(new T.CylinderGeometry(rt, rb, hh, seg || 16), M(col));
    const V2 = T.Vector2, PI2 = Math.PI / 2;
    // كبسولة متدرجة ناعمة (أسطوانة بنهايات نصف كروية) — مبدؤها عند المفصل وتمتد للأسفل
    const capsule = (rA, rB, len, col, bulge) => {
      const pts = [], n = 6, k = 7; bulge = bulge || 0;
      for (let i = 0; i <= n; i++) { const a = i / n * PI2; pts.push(new V2(Math.max(rB * Math.sin(a), 0.0001), -len - rB * Math.cos(a))); }
      for (let i = 1; i < k; i++) { const t = i / k; pts.push(new V2(rB + (rA - rB) * t + bulge * Math.sin(Math.PI * t), -len + len * t)); }
      for (let i = 0; i <= n; i++) { const a = i / n * PI2; pts.push(new V2(Math.max(rA * Math.cos(a), 0.0001), rA * Math.sin(a))); }
      return new T.Mesh(new T.LatheGeometry(pts, 20), M(col));
    };
    // جسم دوراني من نقاط [نصف القطر, الارتفاع] بملف متصل
    const lathe = (prof, col, seg, dbl) => {
      const m = M(col); if (dbl) { m.side = T.DoubleSide; }
      return new T.Mesh(new T.LatheGeometry(prof.map(p => new V2(p[0], p[1])), seg || 24), m);
    };
    const legs = [], knees = [], arms = [], elbows = [];
    for (const s of [-1, 1]) {
      const hip = new T.Group(); hip.position.set(s * 0.1, 0.95, 0);
      const thigh = capsule(0.108, 0.07, 0.45, skin, 0.022); hip.add(thigh);
      const sh = lathe([[0.112, 0.06], [0.122, -0.02], [0.128, -0.16], [0.134, -0.28], [0.12, -0.285]], shorts, 20, true); hip.add(sh);
      const knee = new T.Group(); knee.position.y = -0.45; hip.add(knee);
      const shin = capsule(0.068, 0.042, 0.4, skin, 0.026); knee.add(shin);
      const sk = lathe([[0.058, -0.06], [0.068, -0.1], [0.07, -0.18], [0.058, -0.3], [0.05, -0.4], [0.054, -0.405]], sock, 18, true); knee.add(sk);
      const boot = new T.Mesh(new T.SphereGeometry(1, 16, 12), M('#141414')); boot.scale.set(0.056, 0.05, 0.14); boot.position.set(0, -0.44, 0.045); knee.add(boot);
      const toe = new T.Mesh(new T.SphereGeometry(1, 12, 10), M(P.t === 0 ? '#ffdf00' : '#19c3e6')); toe.scale.set(0.028, 0.014, 0.07); toe.position.set(0, -0.405, 0.06); knee.add(toe);
      body.add(hip); legs.push(hip); knees.push(knee);
    }
    // الجذع قطعة واحدة: حوض ← خصر ← صدر ← كتفان ← رقبة
    const pel = lathe([[0.0001, 0.88], [0.15, 0.9], [0.185, 0.97], [0.18, 1.04], [0.0001, 1.06]], shorts, 24); pel.scale.z = 0.74; body.add(pel);
    const trim = this.shade(shirt, parseInt(shirt.substr(1, 2), 16) + parseInt(shirt.substr(3, 2), 16) + parseInt(shirt.substr(5, 2), 16) > 380 ? 0.55 : 1.8), vr = hash(String(shirt)) % 3;
    const torso = lathe([[0.0001, 0.98], [0.165, 0.99], [0.15, 1.1], [0.168, 1.22], [0.218, 1.36], [0.238, 1.46], [0.214, 1.54], [0.1, 1.6], [0.052, 1.64], [0.0001, 1.64]], shirt, 32);
    torso.material = new T.MeshStandardMaterial({ map: this.shirtTex(shirt, trim, vr), roughness: 0.82, metalness: 0.0 }); torso.scale.z = 0.66; body.add(torso);
    for (const s of [-1, 1]) {
      const sh = new T.Group(); sh.position.set(s * 0.272, 1.48, 0);
      const ball = new T.Mesh(new T.SphereGeometry(0.084, 16, 12), M(shirt)); sh.add(ball);
      const sleeve = capsule(0.078, 0.07, 0.1, shirt, 0.004); sh.add(sleeve);
      const up = capsule(0.056, 0.042, 0.3, skin, 0.006); up.position.y = -0.02; sh.add(up);
      const sl2 = capsule(0.077, 0.069, 0.1, shirt, 0.004); sl2.position.y = -0.0; sh.add(sl2);
      const el = new T.Group(); el.position.y = -0.33; sh.add(el);
      const fore = capsule(0.044, 0.03, 0.26, skin, 0.006); el.add(fore);
      const hand = new T.Mesh(new T.SphereGeometry(1, 12, 10), M(isGK ? '#f2f2f2' : skin)); hand.scale.set(isGK ? 0.066 : 0.043, isGK ? 0.08 : 0.055, isGK ? 0.05 : 0.036); hand.position.y = -0.33; el.add(hand);
      body.add(sh); arms.push(sh); elbows.push(el);
    }
    const neck = capsule(0.052, 0.052, 0.07, skin, 0); neck.position.y = 1.68; body.add(neck);
    const head = new T.Group(); head.position.y = 1.78; body.add(head);
    const skull = S(1, 28, 20, skin, 0.1, 0.125, 0.11); skull.material = new T.MeshStandardMaterial({ map: this.faceTex(skin, hair, beard), roughness: 0.7 }); head.add(skull);
    const jaw = S(1, 14, 10, skin, 0.082, 0.085, 0.092); jaw.position.set(0, -0.06, 0.01); head.add(jaw);
    const nose = S(0.017, 8, 6, skin, 1, 1.4, 1.5); nose.position.set(0, -0.01, 0.112); head.add(nose);
    for (const s of [-1, 1]) {
      const ear = S(0.024, 8, 6, skin, 0.5, 1.2, 1); ear.position.set(s * 0.102, -0.005, 0); head.add(ear);
    }
    if (style !== 4) {
      const capH = style === 1 ? 0.36 : 0.42, cap = new T.Mesh(new T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * capH), M(hair));
      cap.scale.set(0.108, 0.132 + (style === 2 ? 0.02 : 0), 0.118); cap.position.set(0, 0.006, -0.022); cap.rotation.x = -0.3; head.add(cap);
      if (style === 3) { const bun = S(0.04, 10, 8, hair); bun.position.set(0, 0.125, -0.04); head.add(bun); }
      if (style === 5) { const fro = S(1, 14, 10, hair, 0.12, 0.1, 0.125); fro.position.set(0, 0.05, -0.015); head.add(fro); }
    }
    const dark = parseInt(shirt.substr(1, 2), 16) < 0x70 && parseInt(shirt.substr(3, 2), 16) < 0x90;
    const nm = new T.MeshBasicMaterial({ map: this.numTex(P.num, dark ? '#fff' : '#111'), transparent: true, depthWrite: false });
    const np = new T.Mesh(new T.PlaneGeometry(0.32, 0.32), nm); np.position.set(0, 1.3, -0.16); np.rotation.y = Math.PI; body.add(np);
    const nf = new T.Mesh(new T.PlaneGeometry(0.1, 0.1), nm); nf.position.set(0.1, 1.45, 0.165); body.add(nf);
    const band = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.05, 12), new T.MeshBasicMaterial({ color: 0xffd400 })); band.position.y = -0.12; band.visible = false; arms[1].add(band);
    const shd = new T.Mesh(new T.CircleGeometry(0.5, 14), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.22, depthWrite: false })); shd.rotation.x = -Math.PI / 2; shd.position.y = 0.02; g.add(shd);
    g.scale.setScalar(1.22); g.traverse(o => { if (o.isMesh && o !== shd) o.castShadow = true; }); this.scene.add(g);
    return { g, body, legs, knees, arms, elbows, head, band, P, shirtCol: shirt };
  }
  loadMatch(match, kits) {
    this.clearMatch(); this.match = match; this.kits = kits;
    this.setTeams(match.t[0].d, match.t[1].d);
    this.pm = match.players.map(P => this.makePlayer(P, kits[P.t]));
    for (const pm of this.pm) pm.g.visible = false;
    this.buildNames();
    this.lastScoreKey = ''; this.cage.visible = true;
  }
  buildNames() {
    if (!this.nameBox) { const d = document.createElement('div'); d.id = 'names'; d.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:3'; this.canvas.parentNode.insertBefore(d, this.canvas.nextSibling); this.nameBox = d; }
    this.nameBox.innerHTML = ''; this.namesOn = this.namesOn !== false; this.tmpV = new THREE.Vector3();
    for (const pm of this.pm) {
      const P = pm.P, e = document.createElement('div'), parts = String(P.name).trim().split(/\s+/), short = parts.length > 1 ? parts.slice(-1)[0] : parts[0];
      const k = this.kits[P.t], col = P.isGK ? k.gk : k.shirt;
      e.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;font:800 11px/1 system-ui,Arial,sans-serif;color:#fff;background:rgba(5,8,20,.62);border-bottom:2px solid ' + col + ';padding:2px 5px;border-radius:5px;text-shadow:0 1px 2px #000;display:none;will-change:transform';
      e.textContent = P.num + ' ' + short; this.nameBox.appendChild(e); pm.label = e;
    }
  }
  setNames(on) { this.namesOn = !!on; if (this.nameBox) this.nameBox.style.display = on ? '' : 'none'; }
  updateNames() {
    if (!this.nameBox || !this.namesOn) return;
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight, v = this.tmpV, m = this.match, ctrl = m && m.user >= 0 ? m.t[m.user].ctrl : null;
    for (const pm of this.pm) {
      const e = pm.label; if (!e) continue;
      if (!pm.P.on) { if (e.style.display !== 'none') e.style.display = 'none'; continue; }
      v.set(pm.g.position.x, 2.55 + pm.body.position.y * 1.2, pm.g.position.z).project(this.cam);
      if (v.z > 1 || v.z < -1) { e.style.display = 'none'; continue; }
      e.style.display = 'block'; e.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px) translate(-50%,-100%)';
      const me = pm.P === ctrl; if (pm._me !== me) { pm._me = me; e.style.background = me ? 'rgba(255,205,0,.92)' : 'rgba(5,8,20,.62)'; e.style.color = me ? '#111' : '#fff'; e.style.textShadow = me ? 'none' : '0 1px 2px #000'; }
    }
  }
  clearMatch() {
    if (this.nameBox) this.nameBox.innerHTML = '';
    for (const pm of this.pm) this.scene.remove(pm.g);
    this.pm = []; this.match = null;
  }

  /* ---------------- الأحداث ---------------- */
  handleEvent(e) {
    const S = this.sound;
    switch (e.type) {
      case 'kick': S.play('kick', e.power); break;
      case 'whistle': S.play('whistle'); break;
      case 'goal': S.play('goal'); this.shake = 0.6; { const k = this.kits[e.team]; const side = e.team === 0 ? 1 : -1; this.burst(this.match.t[e.team].dir * F.hx, 0, [k.shirt, k.shorts, '#ffdf00', '#ffffff']); } break;
      case 'post': S.play('post'); this.shake = 0.2; break;
      case 'wall': S.play('wall'); break;
      case 'save': S.play('save'); S.target = Math.max(S.target, 0.55); break;
      case 'tackle': S.play('tackle'); break;
      case 'netHit': S.play('net'); { const n = this.nets.find(q => q.e === Math.sign(this.match.ball.x)); if (n) n.k = 1; } break;
      case 'card': S.play('card'); break;
      case 'cardUse': S.play('powerup'); break;
      case 'end': S.play('end'); break;
      case 'coloredBall': S.play('powerup'); break;
    }
  }

  /* ---------------- التحديث والرسم ---------------- */
  render(dt) {
    const m = this.match; dt = Math.min(dt, 0.05); this.time += dt; this.sound.tick(dt);
    this.ledTex.offset.x = (this.ledTex.offset.x + dt * 0.03) % 1;
    for (let i = 0; i < this.stands.length; i++) { const t = this.stands[i].material.map; t.offset.y = Math.sin(this.time * (2.4 + i * 0.3) + i) * 0.012 * (0.4 + this.sound.level); t.offset.x = Math.sin(this.time * 0.6 + i) * 0.004; }
    if (m) { this.syncPlayers(dt); this.syncBall(dt); this.updateCamera(dt); this.updateScreen(dt); }
    else { const a = this.time * 0.14; this.camPos.set(Math.sin(a) * 36, 15, Math.cos(a) * 28); this.camLook.set(0, 1, 0); this.cam.position.copy(this.camPos); this.cam.lookAt(this.camLook); this.ring.visible = this.arrow.visible = this.aim.visible = false; this.ball.position.set(0, F.R, 0); this.ballShadow.position.set(0, 0.03, 0); }
    this.updateFX(dt);
    for (const n of this.nets) { n.k = Math.max(0, n.k - dt * 2.2); n.g.position.x = n.e * Math.sin(n.k * 9) * n.k * 0.35; }
    this.r.render(this.scene, this.cam); this.updateNames();
  }
  syncPlayers(dt) {
    const m = this.match, ctrl = m.user >= 0 ? m.t[m.user].ctrl : null;
    for (const pm of this.pm) {
      const P = pm.P, g = pm.g, on = P.on; g.visible = on; if (!on) continue;
      g.position.set(P.x, 0, P.z); const ty = Math.atan2(P.fx, P.fz); let dy = ty - g.rotation.y; while (dy > Math.PI) dy -= 6.2832; while (dy < -Math.PI) dy += 6.2832; g.rotation.y += dy * Math.min(1, dt * 14);
      const sp = hyp(P.vx, P.vz), run = clamp(sp / 5.5, 0, 1.3), ph = P.anim * 2.3;
      let l0 = Math.sin(ph) * run * 0.85, l1 = -l0, a0 = -l0 * 0.8, a1 = -a0, by = 0, bx = 0, bz = 0, bounce = Math.abs(Math.sin(ph)) * run * 0.05, eb = -(0.3 + run * 0.7);
      let k0 = clamp(l0 * 1.4, 0, 1.5) + run * 0.1, k1 = clamp(l1 * 1.4, 0, 1.5) + run * 0.1;
      if (P.kickT > 0) { l0 = -1.2 * Math.min(1, P.kickT / 0.2); k0 = 0.15; a0 = 0.6; }
      if (P.tackleT > 0) { bx = -1.1; l0 = 1.3; l1 = 0.2; k0 = 0.2; k1 = 1.0; a0 = -1.4; a1 = 1.2; by = -0.55; }
      else if (P.diveT > 0 && P.isGK) {
        const side = Math.sign(P.diveZ - P.z) || 0, sy = Math.sign(Math.sin(g.rotation.y)) || 1; bz = side * sy * 1.2; a0 = a1 = Math.PI; eb = 0; by = 0.3 * Math.min(1, P.diveT * 5); l0 = 0.3; l1 = -0.3; k0 = k1 = 0.2;
      } else if (P.skillT > 0) { bz = Math.sin(this.time * 24) * 0.3; bounce = 0.1; a0 = 0.8; a1 = -0.8; }
      if (P.celeb > 0) { a0 = a1 = Math.PI * 0.85 + Math.sin(this.time * 14) * 0.3; eb = 0; bounce = Math.abs(Math.sin(this.time * 9)) * 0.4; l0 = l1 = 0; k0 = k1 = 0.1; }
      if (P.isGK && !(P.diveT > 0) && !(P.celeb > 0)) { const ready = Math.sin(this.time * 5 + P.id) * 0.1; a0 = -0.5 + ready; a1 = -0.5 - ready; eb = -0.7; k0 = k1 = 0.35; l0 = l1 = -0.1; by = -0.05; }
      if (P.stun > 0) { bx = 0.2; }
      pm.legs[0].rotation.x = l0; pm.legs[1].rotation.x = l1; pm.knees[0].rotation.x = k0; pm.knees[1].rotation.x = k1;
      pm.arms[0].rotation.x = a0; pm.arms[1].rotation.x = a1; pm.arms[0].rotation.z = P.celeb > 0 ? 0.5 : 0.07; pm.arms[1].rotation.z = P.celeb > 0 ? -0.5 : -0.07;
      pm.elbows[0].rotation.x = eb; pm.elbows[1].rotation.x = eb;
      pm.body.rotation.x = lerp(pm.body.rotation.x, bx || (run * 0.14), Math.min(1, dt * 16)); pm.body.rotation.z = lerp(pm.body.rotation.z, bz, Math.min(1, dt * 14));
      pm.body.position.y = lerp(pm.body.position.y, bounce + by, Math.min(1, dt * 20));
      pm.band.visible = m.t[P.t].star === P.id;
    }
    const showRing = ctrl && ctrl.on && !ctrl.leaving && m.mode !== 'ended';
    this.ring.visible = this.arrow.visible = !!showRing;
    if (showRing) { this.ring.position.set(ctrl.x, 0.05, ctrl.z); this.ring.scale.setScalar(1 + Math.sin(this.time * 6) * 0.06); this.arrow.position.set(ctrl.x, 2.6 + Math.sin(this.time * 6) * 0.12, ctrl.z); this.arrow.rotation.y = this.time * 3; }
  }
  syncBall(dt) {
    const m = this.match, b = m.ball; this.ball.position.set(b.x, b.y, b.z);
    const sp = hyp(b.vx, b.vz); if (!b.owner) { this.ball.rotation.z -= b.vx * dt / F.R; this.ball.rotation.x += b.vz * dt / F.R; }
    const col = m.colored; this.ball.material = col ? this.colMat : this.ballMat; this.glow.intensity = col ? 1.4 : 0; this.glow.position.set(b.x, 1.5, b.z);
    this.ballShadow.position.set(b.x, 0.03, b.z); const sc = clamp(1 - b.y * 0.12, 0.35, 1); this.ballShadow.scale.setScalar(sc);
    this.cage.visible = m.mode === 'intro' && b.y > 3; if (this.cage.visible) this.cage.position.set(0, b.y + 1.4, 0);
    this.aim.visible = false;
    const s = m.sp;
    if (s && s.kind === 'penalty' && s.sub === 'aim') { this.aim.visible = true; this.aim.position.set(s.shooter.t === 0 ? F.hx : -F.hx, 1.1, s.aimZ); this.aim.scale.setScalar(1 + Math.sin(this.time * 9) * 0.15); if (m.user !== s.team) this.aim.visible = false; }
  }
  updateCamera(dt) {
    const m = this.match, b = m.ball, cam = this.cam, s = m.sp; let tp, tl; const T = THREE;
    const asp = cam.aspect, wide = asp > 1.45 ? 1 : (asp > 1.1 ? 1.18 : 1.5);
    if (s && (s.kind === 'penalty' || s.kind === 'shootout') && !(s.kind === 'shootout' && s.sub === 'live')) {
      const d = m.t[s.team].dir; tp = new T.Vector3(d * (F.hx - (s.kind === 'penalty' ? 20 : 14)), 5.5, s.kind === 'penalty' ? 8 : 10); tl = new T.Vector3(d * (F.hx - 1), 1.0, 0);
    } else if (s && s.kind === 'shootout') { const d = m.t[s.team].dir; tp = new T.Vector3(clamp(b.x - d * 6, -F.hx, F.hx), 7, 15 * wide); tl = new T.Vector3(clamp(b.x + d * 5, -F.hx, F.hx), 0.5, 0); }
    else if (m.mode === 'halftime' || m.mode === 'psoWait') { tp = new T.Vector3(0, 14, 20 * wide); tl = new T.Vector3(0, 0, 0); }
    else if (this.camMode === 0) { const fx = clamp(b.x * 0.82, -(F.hx - 8), F.hx - 8); tp = new T.Vector3(fx, 16.5 * wide, 21 * wide + 1); tl = new T.Vector3(fx, 0, 0.5); }
    else if (this.camMode === 1) { const fx = clamp(b.x * 0.9, -(F.hx - 5), F.hx - 5); tp = new T.Vector3(fx, 10 * wide, 13.5 * wide); tl = new T.Vector3(fx + (b.x > 0 ? 1 : -1) * 1.5, 0, 0); }
    else if (this.camMode === 3) { // ديناميكية: تدور وتتبع الكرة من الداخل
      const t = this.time, sp = hyp(b.vx, b.vz), ang = t * 0.22, fx = clamp(b.x, -(F.hx + 2), F.hx + 2);
      tp = new T.Vector3(fx - Math.sign(b.vx || 1) * (6 + Math.min(sp, 12) * 0.4) + Math.sin(ang) * 5, 4.2 + Math.sin(t * 0.5) * 1.1 + Math.min(sp, 14) * 0.12, clamp(b.z, -11, 11) * 0.7 + 8.5 * wide + Math.cos(ang) * 3);
      tl = new T.Vector3(b.x + b.vx * 0.25, 0.9, b.z + b.vz * 0.2);
    }
    else if (this.camMode === 4) { const fx = clamp(b.x * 0.8, -(F.hx - 10), F.hx - 10); tp = new T.Vector3(fx, 34 * (wide > 1.2 ? 1.25 : 1), 5.5); tl = new T.Vector3(fx, 0, 0); } // من أعلى
    else if (this.camMode === 5) { const fx = clamp(b.x * 0.95, -(F.hx - 6), F.hx - 6); tp = new T.Vector3(fx, 5.8 * wide, 23 * wide); tl = new T.Vector3(fx, 1.1, 0); } // عرضية من خط التماس
    else { const o = b.owner || (m.user >= 0 ? m.t[m.user].ctrl : null); const d = m.user >= 0 ? m.t[m.user].dir : 1; tp = new T.Vector3(clamp(b.x - d * 9, -(F.hx + 8), F.hx + 8), 7.5, clamp(b.z * 0.4, -8, 8) + 4 * wide); tl = new T.Vector3(clamp(b.x + d * 7, -(F.hx + 4), F.hx + 4), 0.5, b.z * 0.3); }
    const k = Math.min(1, dt * (s ? 3 : 4.2)); this.camPos.lerp(tp, k); this.camLook.lerp(tl, k * 1.2);
    cam.position.copy(this.camPos);
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 1.6); cam.position.x += (Math.random() - 0.5) * this.shake * 0.6; cam.position.y += (Math.random() - 0.5) * this.shake * 0.5; }
    cam.lookAt(this.camLook);
  }
  updateScreen(dt) {
    const m = this.match; this.screenT -= dt; if (this.screenT > 0) return; this.screenT = 0.4;
    const key = m.score.join('-') + '|' + Math.floor(m.clock); if (key === this.lastScoreKey) return; this.lastScoreKey = key;
    this.drawBoard(this.scrC); this.scrTex.needsUpdate = true; this.drawBoard(this.scrC2); this.scrTex2.needsUpdate = true;
  }
  updateFX(dt) {
    const n = this.cLife.length; let any = false;
    for (let i = 0; i < n; i++) {
      if (this.cLife[i] <= 0) { this.cPos[i * 3 + 1] = -50; continue; } any = true;
      this.cLife[i] -= dt; this.cVel[i * 3 + 1] -= 11 * dt;
      this.cPos[i * 3] += this.cVel[i * 3] * dt; this.cPos[i * 3 + 1] += this.cVel[i * 3 + 1] * dt; this.cPos[i * 3 + 2] += this.cVel[i * 3 + 2] * dt;
      if (this.cPos[i * 3 + 1] < 0.05) { this.cPos[i * 3 + 1] = 0.05; this.cVel[i * 3 + 1] = 0; this.cVel[i * 3] *= 0.9; this.cVel[i * 3 + 2] *= 0.9; }
    }
    if (any) this.cGeo.attributes.position.needsUpdate = true;
    if (any) this.cGeo.attributes.color.needsUpdate = true;
  }
  setCam(i) { this.camMode = (+i || 0) % 6; return this.camMode; }
  cycleCam() { return this.setCam(this.camMode + 1); }
}
KL.Engine = Engine;
KL.Sound = Sound;
})();

;
/* ===== bracket.js ===== */
/* ============================================================
   KING'S LEAGUE 3D — bracket.js
   منطق البطولات الأونلاين (بدون واجهة): مجموعات / دوري / خروج مغلوب
   حجم 2 أو 4 أو 8 أو 16 — ويعمل في Node للاختبار
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
const KO_ORDER = ['r16', 'qf', 'sf', 'final'];
const KO_AR = { r16: 'دور الـ16', qf: 'ربع النهائي', sf: 'نصف النهائي', final: 'النهائي', group: 'دور المجموعات', league: 'الدوري' };
const row = (stage, round, slot, grp, a, b) => ({ stage, round, slot, grp: grp == null ? null : grp, a, b, sa: null, sb: null, pa: null, pb: null, winner: null, status: 'pending' });

function roundRobin(ids) {
  const t = ids.slice(); if (t.length % 2) t.push(null); const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(pairs); t.splice(1, 0, t.pop());
  }
  return rounds;
}
function rrRows(stage, ids, grp) { const out = []; roundRobin(ids).forEach((pairs, r) => pairs.forEach((p, s) => out.push(row(stage, r, s, grp, p[0], p[1])))); return out; }
const firstKo = n => n === 2 ? 'final' : n === 4 ? 'sf' : n === 8 ? 'qf' : 'r16';
KL.koStageFor = firstKo;

/* عدد المجموعات: أقصى 4 فرق في المجموعة */
KL.groupCount = size => size <= 4 ? 1 : size / 4;

/* المباريات الأولية عند بدء البطولة */
KL.Bracket = {
  stageName: s => KO_AR[s] || s,
  initial(format, size, ids) {
    if (ids.length !== size) throw new Error('عدد المشاركين لا يساوي حجم البطولة');
    const sh = shuffle(ids);
    if (format === 'league') return rrRows('league', sh, null);
    if (format === 'knockout') { const st = firstKo(size), out = []; for (let i = 0; i < size; i += 2) out.push(row(st, 0, i / 2, null, sh[i], sh[i + 1])); return out; }
    // groups
    if (size === 2) return [row('final', 0, 0, null, sh[0], sh[1])];
    const g = KL.groupCount(size), out = [];
    for (let k = 0; k < g; k++) out.push.apply(out, rrRows('group', sh.slice(k * 4, k * 4 + 4), k));
    return out;
  },
  /* جدول الترتيب لمجموعة (أو الدوري كله grp=null) */
  standings(rows, ids, stage, grp) {
    const T = {}; ids.forEach(id => T[id] = { id, p: 0, w: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
    const ms = rows.filter(r => r.stage === stage && (grp == null || r.grp === grp) && r.status === 'done');
    for (const m of ms) {
      if (!T[m.a] || !T[m.b]) continue; const A = T[m.a], B = T[m.b];
      A.p++; B.p++; A.gf += m.sa; A.ga += m.sb; B.gf += m.sb; B.ga += m.sa;
      if (m.winner === m.a) { A.w++; B.l++; A.pts += 3; } else if (m.winner === m.b) { B.w++; A.l++; B.pts += 3; }
    }
    const list = Object.values(T); list.forEach(t => t.gd = t.gf - t.ga);
    const h2h = (x, y) => { const m = ms.find(q => (q.a === x.id && q.b === y.id) || (q.a === y.id && q.b === x.id)); return m ? (m.winner === x.id ? -1 : m.winner === y.id ? 1 : 0) : 0; };
    list.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || h2h(x, y) || (x.id < y.id ? -1 : 1));
    return list;
  },
  groupIds(rows, grp) { const s = new Set(); rows.filter(r => r.stage === 'group' && r.grp === grp).forEach(r => { s.add(r.a); s.add(r.b); }); return Array.from(s); },
  /* الخطوة التالية: تُرجع {rows:[مباريات جديدة], done, champion, stage} — آمنة للتكرار */
  next(format, size, ids, rows) {
    const has = st => rows.some(r => r.stage === st), allDone = st => rows.filter(r => r.stage === st).every(r => r.status === 'done');
    if (format === 'league') {
      if (!rows.every(r => r.status === 'done')) return { rows: [], done: false };
      return { rows: [], done: true, champion: this.standings(rows, ids, 'league', null)[0].id };
    }
    if (format === 'groups' && size > 2 && has('group') && allDone('group') && !KO_ORDER.some(has)) {
      const g = KL.groupCount(size), top = []; for (let k = 0; k < g; k++) { const t = this.standings(rows, this.groupIds(rows, k), 'group', k); top.push([t[0].id, t[1].id]); }
      const out = []; let st;
      if (g === 1) { st = 'final'; out.push(row('final', 0, 0, null, top[0][0], top[0][1])); }
      else if (g === 2) { st = 'sf'; out.push(row('sf', 0, 0, null, top[0][0], top[1][1]), row('sf', 0, 1, null, top[1][0], top[0][1])); }
      else { st = 'qf'; out.push(row('qf', 0, 0, null, top[0][0], top[1][1]), row('qf', 0, 1, null, top[2][0], top[3][1]), row('qf', 0, 2, null, top[1][0], top[0][1]), row('qf', 0, 3, null, top[3][0], top[2][1])); }
      return { rows: out, done: false, stage: st };
    }
    // الأدوار الإقصائية
    const cur = KO_ORDER.filter(has).pop(); if (!cur) return { rows: [], done: false };
    if (!allDone(cur)) return { rows: [], done: false, stage: cur };
    const ms = rows.filter(r => r.stage === cur).sort((a, b) => a.slot - b.slot);
    if (cur === 'final') return { rows: [], done: true, champion: ms[0].winner };
    const nxt = KO_ORDER[KO_ORDER.indexOf(cur) + 1], out = [];
    for (let i = 0; i < ms.length; i += 2) out.push(row(nxt, 0, i / 2, null, ms[i].winner, ms[i + 1].winner));
    return { rows: out, done: false, stage: nxt };
  }
};
KL.genCode = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
})();

;
