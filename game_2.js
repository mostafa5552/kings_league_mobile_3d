/* KING'S LEAGUE 3D — game_2.js (جزء 2 من 6) */
/* ===== match.js ===== */
/* ============================================================
   KING'S LEAGUE MENA 3D — match.js
   (2/4) منطق المباراة: الفيزياء، الذكاء الاصطناعي، القواعد، البطاقات
   لا يعتمد على THREE (يمكن اختباره بدون شاشة)
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';
const F = KL.F = { L: 72, W: 40, hx: 36, hz: 20, gw: 4, gh: 2.7, gd: 2.4, pad: 2.5, penD: 15, penW: 30, penSpot: 10, R: 0.24 };
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const rr = Math.random, hyp = Math.hypot, sgn = v => v < 0 ? -1 : 1;
const FORM = {
  1: [[.45, 0]], 2: [[.3, 0], [.62, 0]], 3: [[.25, 0], [.5, -.5], [.65, .5]],
  4: [[.25, -.5], [.25, .5], [.62, -.4], [.62, .4]],
  5: [[.22, -.5], [.22, .5], [.45, 0], [.68, -.45], [.68, .45]],
  6: [[.2, -.5], [.2, .5], [.45, -.45], [.45, .45], [.7, -.35], [.7, .35]]
};
/* التشكيلات: كل مركز [u نحو مرمى الخصم, v عرض الملعب, الدور] و ramp = ترتيب نزول اللاعبين عند بداية المباراة (1 ضد 1 ثم 2...) */
const FORMS = KL.FORMS = {
  '2-2-2': { ar: '2-2-2 متوازن', slots: [[.2, -.5, 'DEF'], [.2, .5, 'DEF'], [.45, -.45, 'MID'], [.45, .45, 'MID'], [.7, -.35, 'FW'], [.7, .35, 'FW']], ramp: [4, 2, 0, 5, 3, 1] },
  '3-2-1': { ar: '3-2-1 دفاعي', slots: [[.2, -.58, 'DEF'], [.2, 0, 'DEF'], [.2, .58, 'DEF'], [.45, -.4, 'MID'], [.45, .4, 'MID'], [.72, 0, 'FW']], ramp: [5, 3, 1, 4, 0, 2] },
  '2-3-1': { ar: '2-3-1 وسط قوي', slots: [[.2, -.45, 'DEF'], [.2, .45, 'DEF'], [.45, -.62, 'MID'], [.45, 0, 'MID'], [.45, .62, 'MID'], [.72, 0, 'FW']], ramp: [5, 3, 0, 2, 1, 4] },
  '1-3-2': { ar: '1-3-2 هجومي', slots: [[.2, 0, 'DEF'], [.45, -.6, 'MID'], [.45, 0, 'MID'], [.45, .6, 'MID'], [.7, -.35, 'FW'], [.7, .35, 'FW']], ramp: [4, 2, 0, 5, 1, 3] },
  '3-1-2': { ar: '3-1-2 ضغط', slots: [[.2, -.58, 'DEF'], [.2, 0, 'DEF'], [.2, .58, 'DEF'], [.45, 0, 'MID'], [.7, -.35, 'FW'], [.7, .35, 'FW']], ramp: [4, 3, 1, 5, 0, 2] }
};
KL.FORM_IDS = Object.keys(FORMS);
KL.STYLES = { bal: 'متوازن', att: 'هجومي', def: 'دفاعي' }; KL.PRESS = { low: 'ضغط منخفض', mid: 'ضغط متوسط', high: 'ضغط عالٍ' };
const ovrOf = p => (p.a.shoot + p.a.pass + p.a.def + p.a.drb) / 4 + (p.a.pace - 1);
KL.autoLineup = function (d, form) {
  form = FORMS[form] ? form : '2-2-2'; const P = d.players, idx = P.map((p, i) => i);
  const gk = idx.filter(i => P[i].pos === 'GK').sort((a, b) => P[b].a.gk - P[a].a.gk)[0];
  const used = new Set([gk]), field = [], F6 = FORMS[form].slots;
  const order = [0, 1, 2, 3, 4, 5].sort((a, b) => ({ FW: 0, MID: 1, DEF: 2 }[F6[a][2]] - { FW: 0, MID: 1, DEF: 2 }[F6[b][2]]));
  for (const s of order) {
    const best = idx.filter(i => !used.has(i) && P[i].pos === F6[s][2]).sort((a, b) => ovrOf(P[b]) - ovrOf(P[a]))[0];
    const pick = best != null ? best : idx.filter(i => !used.has(i) && P[i].pos !== 'GK').sort((a, b) => ovrOf(P[b]) - ovrOf(P[a]))[0];
    used.add(pick); field[s] = pick;
  }
  return { gk, field, form };
};
const RANK = { DEF: 0, MID: 1, FW: 2 };
const CARD_IDS = ['penalty', 'shootout', 'double', 'suspend', 'star', 'reverse', 'joker'];
const NOINP = { mx: 0, mz: 0, A: false, Adown: false, Aup: false, B: false, Bdown: false, Bup: false, C: false, Cdown: false, Cup: false, D: false };

class Match {
  constructor(o) {
    this.o = o; this.spm = o.secPerMin || 7.5; this.diff = o.diff == null ? 0.7 : o.diff;
    this.humans = o.humans ? [!!o.humans[0], !!o.humans[1]] : [o.user === 0, o.user === 1]; // لاعبان بشريان محتملان (أونلاين)
    this.user = o.user != null ? o.user : (this.humans[0] ? 0 : (this.humans[1] ? 1 : -1)); this.kits = o.kits || null;
    this._ch = [0, 0]; this.cur = Math.max(0, this.user); this.inps = [NOINP, NOINP]; this.jokerT = 0;
    this.ev = []; this.onEvent = null; this.time = 0;
    this.t = [this.makeTeam(0, o.teams[0], o.lineups && o.lineups[0]), this.makeTeam(1, o.teams[1], o.lineups && o.lineups[1])];
    this.players = this.t[0].players.concat(this.t[1].players);
    this.ball = { x: 0, y: 9, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTeam: -1, last: null, cd: 0, shotT: 0, shotBy: null, net: false };
    this.score = [0, 0]; this.clock = 0; this.half = 1; this.mode = 'intro'; this.modeT = 2.2;
    this.colored = false; this.mb = false; this.dice = 0; this.sp = null; this.pso = null; this.result = null;
    this.lastMi = -1; this.cards2 = false; this.charge = 0; this.pendJ = null; this.goalInfo = null; this.pendPSO = false;
    this.race = 0; this.protect = 0; this.protectTeam = -1; this.fkWait = 0; this.fkTeam = -1; this.possChanged = false; this.dirty = false; this.spawnSide = 1; this.psoWait = 0;
    this.stats = [{ shots: 0, fouls: 0, goals: 0, cards: 0 }, { shots: 0, fouls: 0, goals: 0, cards: 0 }];
    if (o.career) o.career.forEach((k, ti) => { // وضع الكارير: اللاعب يتحكم بلاعبه فقط ويدخل الملعب أولاً
      const t = this.t[ti], P = k != null ? t.players[k] : null; if (!P || P.isGK) return;
      t.career = P; t.queue = [P].concat(t.queue.filter(q => q !== P));
    });
    for (const t of this.t) { t.card = this.pickCard(); t.aiCardAt = [rnd(6, 15), rnd(24, 34)]; /* بطاقة واحدة فقط لكل فريق في المباراة */ t.jokerHold = rr() < 0.6; }
    this.reconcile(); this.placeKickoff();
  }
  emit(type, d) { const e = Object.assign({ type }, d || {}); this.ev.push(e); if (this.ev.length > 60) this.ev.shift(); if (this.onEvent) this.onEvent(e); }
  pickCard() {
    // كيس بطاقات مخلوط ومحفوظ بين المباريات: كل البطاقات السبع تظهر قبل أن تتكرر أي واحدة
    let bag = [];
    try { bag = JSON.parse(localStorage.getItem('kl_cardbag') || '[]').filter(c => CARD_IDS.indexOf(c) >= 0); } catch (e) { bag = this._bag || []; }
    if (!bag.length) { bag = CARD_IDS.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); const x = bag[i]; bag[i] = bag[j]; bag[j] = x; } }
    const c = bag.pop(); this._bag = bag;
    try { localStorage.setItem('kl_cardbag', JSON.stringify(bag)); } catch (e) { }
    return c;
  }

  /* ---------------- بناء الفرق ---------------- */
  makeTeam(i, d, lu) {
    const dir = i === 0 ? 1 : -1;
    const t = { idx: i, dir, d, name: d.name, short: d.short, players: [], queue: [], gk: null, card: null, doubleUntil: -1, star: null, susp: [], ctrl: null, aiCardAt: [0, 0], jokerHold: false, chase1: null, chase2: null };
    const all = d.players.map((p, k) => ({
      id: i * 100 + k, t: i, name: p.name, num: p.num, pos: p.pos, a: p.a, starTag: !!p.star, isGK: false, x: 0, z: 0, vx: 0, vz: 0, fx: dir, fz: 0,
      on: false, out: false, leaving: false, idle: false, tackleT: 0, tackleCd: 0, tdx: 0, tdz: 0, thit: false, skillT: 0, skillCd: 0, kickT: 0, stun: 0, noPick: 0,
      thinkT: rnd(0, .4), anim: rr() * 6, celeb: 0, receiving: 0, hold: 0, diveT: 0, diveZ: 0, reacting: false, reactT: 0, saveCd: 0, stam: 1, goals: 0, yellow: 0, au: .5, av: 0,
      spd: 4.9 * p.a.pace, ovr: 0, exitZ: 0
    }));
    t.players = all;
    const okLu = l => l && l.field && l.field.length === 6 && l.gk != null && all[l.gk] && l.field.every(k => all[k]) && new Set([l.gk].concat(l.field)).size === 7 && all[l.gk].pos === 'GK';
    const h = KL.hash ? KL.hash(String(d.id)) : i;
    const formId = FORMS[lu && lu.form] ? lu.form : (lu ? '2-2-2' : KL.FORM_IDS[h % KL.FORM_IDS.length]);
    const L = okLu(lu) ? lu : KL.autoLineup(d, formId);
    t.form = FORMS[L.form || formId] ? (L.form || formId) : formId;
    t.tact = { style: (lu && lu.style) || (lu ? 'bal' : ['bal', 'att', 'def', 'bal'][(h >> 3) % 4]), press: (lu && lu.press) || (lu ? 'mid' : ['mid', 'high', 'low', 'mid'][(h >> 5) % 4]) };
    t.gk = all[L.gk]; t.gk.isGK = true;
    const fld = L.field.map(k => all[k]); fld.forEach((p, k) => { p.slot = k; p.role = FORMS[t.form].slots[k][2]; });
    const ramp = FORMS[t.form].ramp.map(k => fld[k]);
    t.queue = ramp.concat(all.filter(p => !p.isGK && !ramp.includes(p)).sort((a, b) => ovrOf(b) - ovrOf(a)));
    return t;
  }

  /* ---------------- أدوات ---------------- */
  hu(ti) { return this.humans[ti] === true; }
  get charge() { return this._ch[this.cur]; }
  set charge(v) { this._ch[this.cur] = v; }
  possTeam() { const b = this.ball; return b.owner ? b.owner.t : b.lastTeam; }
  fieldOut(t) { return t.players.filter(p => p.on && !p.leaving && !p.isGK); }
  inPlayers() { return this.players.filter(p => p.on); }
  timeText() { const m = Math.min(this.clock, 40), mm = Math.floor(m), ss = Math.floor((m - mm) * 60); return (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss; }
  winOpen() { const m = this.clock; return !this.mb && ((m >= 5 && m < 17) || (m >= 23 && m < 36)); }
  userAttack() { const o = this.ball.owner; return !!(o && this.hu(o.t) && !o.isGK) || !!(this.sp && this.hu(this.sp.team)); }
  minOpp(ti, x, z) { let d = 99; for (const p of this.players) { if (p.on && p.t !== ti && !p.leaving) { const k = hyp(p.x - x, p.z - z); if (k < d) d = k; } } return d; }
  baseCount() {
    const m = this.clock;
    if (this.mb) return Math.max(1, 4 - (Math.floor(m) - 36));
    if (this.half === 1) return Math.min(6, Math.floor(m) + 1);
    if (m < 23) return Math.min(6, this.dice + Math.floor(m) - 20);
    return 6;
  }
  gx(t) { return -t.dir * F.hx; } // مرمى الفريق نفسه

  reconcile() {
    for (const t of this.t) {
      t.gk.on = true; t.gk.leaving = false;
      t.susp = t.susp.filter(s => { if (s.until <= this.clock) { if (!s.perm) s.P.out = false; return false; } return true; });
      const want = Math.max(0, this.baseCount() - t.susp.length);
      let cur = this.fieldOut(t);
      while (cur.length < want) { const P = t.queue.find(p => !p.on && !p.out && !p.leaving); if (!P) break; this.spawn(P); cur.push(P); }
      while (cur.length > want) {
        const cand = cur.filter(p => this.ball.owner !== p && p !== t.ctrl), arr = cand.length ? cand : cur;
        arr.sort((a, b) => t.queue.indexOf(b) - t.queue.indexOf(a));
        const P = arr[0]; this.sendOff(P); cur = cur.filter(p => p !== P);
      }
      this.assignAnchors(t);
    }
  }
  spawn(P) {
    const t = this.t[P.t]; P.on = true; P.leaving = false; P.idle = false; this.spawnSide = -this.spawnSide;
    P.x = -t.dir * (F.hx + 1.3); P.z = this.spawnSide * (F.gw + 2.2 + rnd(0, 1.5)); P.vx = P.vz = 0; P.fx = t.dir; P.fz = 0;
    P.tackleT = 0; P.skillT = 0; P.stun = 0;
  }
  sendOff(P) {
    P.leaving = true; P.exitZ = sgn(P.z || 1) * (F.hz + 1.7);
    if (this.ball.owner === P) { this.ball.owner = null; this.ball.cd = 0.2; }
    const t = this.t[P.t]; if (t.ctrl === P) t.ctrl = null;
  }
  assignAnchors(t) {
    const list = this.fieldOut(t); if (!list.length) return; const sl = FORMS[t.form].slots;
    list.forEach(p => { const k = p.slot != null ? p.slot : 0, q = sl[k]; p.au = q[0]; p.av = list.length === 1 ? 0 : q[1]; p.role = q[2]; });
  }
  /* ---- التمركز الجماعي: كتلة دفاعية متراصّة، وهجوم بتمركز ومساندة وركض خلف الدفاع ---- */
  computeShape(t) {
    const b = this.ball, own = -t.dir * F.hx, o = b.owner, att = this.possTeam() === t.idx, list = this.fieldOut(t), res = new Map();
    const bu = clamp(((b.x - own) / t.dir) / F.L, 0, 1), sty = t.tact.style === 'att' ? 0.06 : (t.tact.style === 'def' ? -0.06 : 0), pr = t.tact.press === 'high' ? 0.12 : (t.tact.press === 'low' ? -0.1 : 0);
    const pts = [];
    for (const P of list) {
      const u0 = P.au, role = P.role || P.pos; let u;
      if (att) {
        if (role === 'DEF') u = clamp(u0 + 0.10 + 0.30 * (bu - 0.4) + sty, 0.14, 0.58);
        else if (role === 'MID') u = clamp(u0 + 0.13 + 0.38 * (bu - 0.5) + sty, 0.25, 0.84);
        else u = clamp(Math.max(u0 + 0.08, bu + 0.14) + sty, 0.5, 0.92);
      } else {
        const uF = clamp(0.72 * bu - 0.04 + pr + sty * 0.5, 0.12, 0.66);
        u = role === 'DEF' ? uF - 0.04 : (role === 'MID' ? uF + 0.10 : uF + 0.2); u = clamp(u, 0.1, 0.85);
      }
      let z = P.av * (F.hz - 2.5); z += (b.z - z) * (att ? 0.3 : 0.55); z = clamp(z, -(F.hz - 1.5), F.hz - 1.5);
      pts.push({ P, x: own + t.dir * u * F.L, z });
    }
    // مساندة الحامل + ركض خلف الدفاع
    if (att && o && o.t === t.idx && !o.isGK) {
      const cands = pts.filter(q => q.P !== o).sort((a, c) => hyp(a.x - o.x, a.z - o.z) - hyp(c.x - o.x, c.z - o.z));
      const gx = t.dir * F.hx, side = o.z > 0 ? -1 : 1;
      if (cands[0] && hyp(cands[0].P.x - o.x, cands[0].P.z - o.z) < 24) { const q = cands[0]; q.x = clamp(o.x + t.dir * 5.5, -F.hx + 3, F.hx - 3); q.z = clamp(o.z + side * 5.5, -(F.hz - 2), F.hz - 2); q.fix = true; }
      const q2 = cands[1]; if (q2 && hyp(q2.P.x - o.x, q2.P.z - o.z) < 28) { q2.x = clamp(o.x - t.dir * 2.5, -F.hx + 3, F.hx - 3); q2.z = clamp(o.z - side * 6.5, -(F.hz - 2), F.hz - 2); q2.fix = true; }
      const run = pts.filter(q => !q.fix && q.P !== o && (q.P.role === 'FW' || q.P.role === 'MID')).sort((a, c) => (c.x - a.x) * t.dir)[0];
      if (run && (o.x - own) * t.dir > F.L * 0.3) { run.x = clamp(o.x + t.dir * 14, -F.hx + 2, F.hx - 4); run.z = clamp(-o.z * 0.6 + side * 2, -(F.hz - 2), F.hz - 2); run.fix = true; }
    }
    // تباعد: لا يقل البعد بين زميلين عن 5 أمتار
    for (let it = 0; it < 3; it++) for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], c = pts[j]; let dx = a.x - c.x, dz = a.z - c.z, d = hyp(dx, dz);
      if (d < 5) { if (d < 0.01) { dx = 1; dz = 0.3; d = 1.04; } const pu = (5 - d) / 2, nx = dx / d, nz = dz / d; if (!a.fix) { a.x += nx * pu; a.z += nz * pu; } if (!c.fix) { c.x -= nx * pu; c.z -= nz * pu; } }
    }
    for (const q of pts) res.set(q.P.id, [clamp(q.x, -F.hx + 1.5, F.hx - 1.5), clamp(q.z, -(F.hz - 1.2), F.hz - 1.2)]);
    t.shape = res;
    // توزيع المراقبة: كل مدافع على مهاجم مختلف (الأخطر أولاً)
    t.marks = new Map();
    if (!att) {
      const ownGx = this.gx(t), opp = this.fieldOut(this.t[1 - t.idx]).filter(q => q !== o).sort((a, c) => Math.abs(a.x - ownGx) - Math.abs(c.x - ownGx));
      const free = list.filter(p => p !== t.chase1 && p !== t.chase2), taken = new Set();
      for (const q of opp) {
        if (Math.abs(q.x - ownGx) > F.L * 0.7) continue; let best = null, bd = 1e9;
        for (const p of free) { if (t.marks.has(p.id)) continue; const sh = res.get(p.id) || [p.x, p.z], d = hyp(sh[0] - q.x, sh[1] - q.z); if (d < bd) { bd = d; best = p; } }
        if (best && bd < 13) t.marks.set(best.id, q);
      }
    }
  }
  anchor(P) {
    const t = this.t[P.t], s = t.shape && t.shape.get(P.id); if (s) return s;
    const own = -t.dir * F.hx; return [own + t.dir * P.au * F.L, P.av * (F.hz - 2.5)];
  }
  placeKickoff() {
    const b = this.ball;
    Object.assign(b, { x: 0, y: 9, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTeam: -1, last: null, cd: 0, shotT: 0, shotBy: null, net: false });
    for (const t of this.t) {
      const g = t.gk; g.on = true; g.x = this.gx(t) + t.dir * 1.0; g.z = 0; g.vx = g.vz = 0; g.fx = t.dir; g.fz = 0; g.idle = false; g.diveT = 0; g.reacting = false;
      for (const P of this.fieldOut(t)) this.spawn(P);
      t.ctrl = null;
    }
    this.race = 6; this.sp = null; this.dirty = false;
  }

  /* ---------------- التحديث الرئيسي ---------------- */
  update(dt, inp) {
    let arr; if (Array.isArray(inp)) arr = [inp[0] || NOINP, inp[1] || NOINP]; else { arr = [NOINP, NOINP]; if (this.user >= 0) arr[this.user] = inp || NOINP; }
    this.inps = arr; inp = arr[this.user >= 0 ? this.user : 0]; if (!Array.isArray(arguments[1]) && !arguments[1]) inp = NOINP;
    dt = Math.min(dt, 0.05); this.time += dt;
    for (const P of this.players) { if (P.tackleCd > 0) P.tackleCd -= dt; if (P.skillCd > 0) P.skillCd -= dt; if (P.kickT > 0) P.kickT -= dt; if (P.noPick > 0) P.noPick -= dt; if (P.receiving > 0) P.receiving -= dt; if (P.stun > 0) P.stun -= dt; if (P.saveCd > 0) P.saveCd -= dt; if (P.celeb > 0) P.celeb -= dt; }
    const b = this.ball; if (b.cd > 0) b.cd -= dt; if (b.shotT > 0) b.shotT -= dt;
    switch (this.mode) {
      case 'intro':
        this.modeT -= dt; this.stepPlayers(dt, NOINP); this.stepBall(dt);
        if (this.modeT <= 0) { this.mode = 'play'; this.emit('whistle'); this.emit('banner', { text: 'انطلقت المباراة!', sub: this.t[0].name + ' × ' + this.t[1].name }); }
        break;
      case 'play': this.stepPlay(dt, inp); break;
      case 'goal': this.stepGoal(dt); break;
      case 'freekick': this.stepFreekick(dt, inp); break;
      case 'special': this.stepSpecial(dt, inp); break;
      case 'halftime': this.stepHalftime(dt); break;
      case 'psoWait': this.modeT -= dt; this.stepPlayers(dt, NOINP); this.stepBall(dt); if (this.modeT <= 0) this.psoNext(); break;
      case 'jokerReact': this.stepPlayers(dt, NOINP); this.jokerT += dt; if (this.jokerT > 10 && this.pendJ) this.jokerResponse('allow'); break;
      case 'ended': this.stepPlayers(dt, NOINP); this.stepBall(dt); break;
    }
    this.cur = Math.max(0, this.user);
  }

  stepPlay(dt, inp) {
    this.clock += dt / this.spm;
    this.minuteEvents(dt);
    if (this.mode !== 'play') return;
    if (this.dirty) { this.dirty = false; this.reconcile(); }
    if (this.protect > 0) this.protect -= dt;
    if (this.race > 0) { this.race -= dt; if (this.ball.owner) this.race = 0; }
    this.updateCtrl();
    this.handleUser(inp, dt);
    this.stepPlayers(dt, inp);
    this.stepBall(dt);
    this.aiCards(dt);
  }

  minuteEvents(dt) {
    const m = this.clock, mi = Math.floor(m);
    if (mi !== this.lastMi) { this.lastMi = mi; this.dirty = true; this.emit('minute', { m: mi }); }
    for (const t of this.t) { if (t.susp.some(s => s.until <= m)) this.dirty = true; }
    if (this.half === 1 && !this.colored && m >= 17 && m < 20) { this.colored = true; this.emit('coloredBall'); this.emit('banner', { text: '🔮 الكرة الملونة', sub: 'كل هدف بها يُحتسب بهدفين!' }); }
    if (this.half === 1 && m >= 20) { this.endHalf(); return; }
    if (this.half === 2 && m >= 23 && !this.cards2) {
      this.cards2 = true;
      this.emit('banner', { text: '🃏 البطاقات السرية متاحة', sub: 'العودة الكاملة 7 ضد 7' });
    }
    if (this.half === 2 && !this.mb && m >= 36) { this.startMatchBall(); return; }
    if (m >= 40) { this.clock = 40; this.endMatch('time'); return; }
  }

  /* ---------------- نصف الوقت والنرد ---------------- */
  endHalf() {
    this.clock = 20; this.mode = 'halftime'; this.modeT = 5.0; this.colored = false;
    this.dice = 1 + Math.floor(rr() * 6);
    this.ball.owner = null; this.emit('whistle'); this.emit('halftime', { dice: this.dice, score: this.score.slice() });
  }
  stepHalftime(dt) {
    this.stepPlayers(dt, NOINP); this.modeT -= dt;
    if (this.modeT <= 0) {
      this.half = 2; for (const t of this.t) { t.dir = -t.dir; t.players.forEach(p => { if (!p.isGK) { p.on = false; p.leaving = false; } }); t.ctrl = null; }
      this.lastMi = -1; this.reconcile(); this.placeKickoff(); this.mode = 'intro'; this.modeT = 1.6;
      this.emit('banner', { text: 'الشوط الثاني', sub: '🎲 يبدأ بـ ' + this.dice + ' لاعبين' });
    }
  }

  /* ---------------- كرة المباراة والنهاية ---------------- */
  startMatchBall() {
    if (this.score[0] === this.score[1]) { this.emit('banner', { text: 'تعادل!', sub: 'ركلات الترجيح (شووت آوت)' }); this.startPSO(); return; }
    this.mb = true; this.dirty = true; this.emit('whistle');
    this.emit('banner', { text: '⚔️ كرة المباراة (Match Ball)', sub: '5 ضد 5 — أي هدف للمتقدم يُنهي اللقاء' });
  }
  endMatch(reason) {
    if (this.mode === 'ended') return;
    let winner = this.score[0] > this.score[1] ? 0 : (this.score[1] > this.score[0] ? 1 : -1), pso = null;
    if (this.pso) { pso = this.pso.goals.slice(); if (winner < 0) winner = this.pso.winner; }
    if (winner < 0) winner = rr() < 0.5 ? 0 : 1;
    this.result = { score: this.score.slice(), pso, winner, reason };
    this.mode = 'ended'; this.sp = null; this.emit('whistle'); this.emit('end', this.result);
  }

  /* ---------------- ركلات الترجيح ---------------- */
  startPSO() {
    this.mb = false;
    this.pso = { shots: [[], []], goals: [0, 0], turn: rr() < 0.5 ? 0 : 1, idx: [0, 0], winner: -1 };
    for (const p of this.players) { if (!p.isGK) { p.on = false; p.leaving = false; } }
    for (const t of this.t) t.ctrl = null;
    this.mode = 'psoWait'; this.modeT = 2.6; this.ball.owner = null; this.ball.net = false;
    this.emit('pso', { pso: this.pso });
  }
  psoNext() {
    const p = this.pso, ti = p.turn, t = this.t[ti];
    const list = t.queue.filter(q => !q.out || true);
    const shooter = list[p.idx[ti] % list.length]; p.idx[ti]++;
    this.startShootout(ti, shooter, { ctx: 'pso' });
  }
  psoRecord(ti, ok) {
    const p = this.pso; p.shots[ti].push(ok); if (ok) p.goals[ti]++;
    this.emit('psoShot', { team: ti, ok, pso: p });
    this.emit('banner', { text: ok ? '⚽ هدف!' : '❌ أُهدرت', sub: 'ركلات الترجيح ' + p.goals[0] + ' - ' + p.goals[1] });
    const a = p.shots[0].length, b = p.shots[1].length, ga = p.goals[0], gb = p.goals[1]; let w = -1;
    if (a <= 5 && b <= 5) { if (ga > gb + (5 - b)) w = 0; else if (gb > ga + (5 - a)) w = 1; }
    else if (a === b && ga !== gb) w = ga > gb ? 0 : 1;
    if (w < 0 && a === b && a >= 10) w = rr() < 0.5 ? 0 : 1; // حماية: لا ركلات ترجيح بلا نهاية إن غاب اللاعبان
    if (w >= 0) { p.winner = w; this.sp = null; for (const q of this.players) q.idle = false; this.ball.owner = null; this.endMatch('pso'); return; }
    p.turn = 1 - p.turn; this.mode = 'psoWait'; this.modeT = 2.0; this.sp = null; this.ball.owner = null;
    for (const q of this.players) { if (!q.isGK) q.on = false; }
  }

  /* ---------------- تسجيل الأهداف ---------------- */
  registerGoal(ti, scorer, info) {
    info = info || {};
    const t = this.t[ti]; let v = 1;
    if (this.colored) v = 2;
    if (t.doubleUntil > this.clock) v = 2;
    if (scorer && !info.og && t.star === scorer.id && this.clock < 39) v = 2;
    this.addScore(ti, v, scorer, info);
  }
  addScore(ti, v, scorer, info) {
    info = info || {}; this.score[ti] += v; this.stats[ti].goals += v;
    if (scorer && !info.og) scorer.goals++;
    this.goalInfo = { team: ti, scorer: scorer || null, t: 0, v, og: !!info.og, free: !!info.free };
    this.emit('goal', { team: ti, scorer, value: v, og: !!info.og, free: !!info.free, min: this.timeText() });
    this.emit('banner', { text: (v > 1 ? '🔥 هدف مضاعف! ' : '⚽ جـــوووول! ') + this.t[ti].name, sub: (scorer ? scorer.name + ' ' : '') + this.timeText() + (v > 1 ? '  (+2)' : ''), goal: true });
    this.ball.owner = null;
    if (this.mb) {
      if (this.score[ti] > this.score[1 - ti]) { this.mode = 'goal'; this.modeT = 2.4; this.pendEnd = true; return; }
      if (this.score[0] === this.score[1]) this.pendPSO = true;
    }
    this.mode = 'goal'; this.modeT = 3.2;
  }
  stepGoal(dt) {
    this.modeT -= dt; this.stepPlayers(dt, NOINP); this.stepBall(dt);
    if (this.modeT > 0) return;
    if (this.pendEnd) { this.pendEnd = false; this.endMatch('mbgoal'); return; }
    if (this.pendPSO) { this.pendPSO = false; this.startPSO(); return; }
    this.restartPlay(1 - this.goalInfo.team);
  }
  restartPlay(ownerTeam) {
    this.sp = null; this.mode = 'play'; this.race = 0; this.pendJ = null;
    const b = this.ball; b.net = false; b.vx = b.vy = b.vz = 0;
    for (const p of this.players) { p.idle = false; p.vx = p.vz = 0; p.tackleT = 0; p.diveT = 0; p.reacting = false; p.celeb = 0; }
    this.reconcile();
    for (const t of this.t) {
      for (const P of this.fieldOut(t)) {
        let [x, z] = this.anchor(P);
        if (t.idx !== ownerTeam) { const own = -t.dir * F.hx; const u = ((x - own) / t.dir) / F.L; if (u > 0.46) x = own + t.dir * 0.46 * F.L; }
        P.x = x; P.z = z; P.fx = t.dir; P.fz = 0;
      }
      const g = t.gk; g.x = this.gx(t) + t.dir * 1.0; g.z = 0; g.fx = t.dir; g.fz = 0;
    }
    const gk = this.t[ownerTeam].gk; b.x = gk.x + gk.fx * 0.3; b.z = gk.z; b.y = 1.1; b.owner = gk; b.lastTeam = ownerTeam; b.last = gk; gk.hold = 0;
    this.emit('whistle');
  }

  /* ---------------- التحكم ---------------- */
  nearestToBall(t, excl) {
    const b = this.ball, tx = b.owner ? b.owner.x : b.x + b.vx * 0.25, tz = b.owner ? b.owner.z : b.z + b.vz * 0.25;
    let best = null, bd = 1e9;
    for (const p of this.fieldOut(t)) { if (p === excl || p.idle) continue; const d = hyp(p.x - tx, p.z - tz); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  updateCtrl() {
    for (const ti of [0, 1]) if (this.hu(ti)) this.updateCtrlFor(ti);
    this.possChanged = false;
  }
  updateCtrlFor(ti) {
    const t = this.t[ti]; if (!t) return; const b = this.ball;
    if (t.career) { if (t.career.on && !t.career.leaving) { t.ctrl = t.career; return; } t.ctrl = null; return; }
    if (b.owner && b.owner.t === ti && !b.owner.isGK) { t.ctrl = b.owner; return; }
    const c = t.ctrl;
    if (!c || !c.on || c.leaving || c.isGK) { t.ctrl = this.nearestToBall(t); return; }
    if (this.possChanged) { t.ctrl = this.nearestToBall(t); }
  }
  handleUser(inp, dt) {
    for (const ti of [0, 1]) if (this.hu(ti)) this.handleUserFor(ti, this.inps[ti], dt);
    this.cur = Math.max(0, this.user);
  }
  handleUserFor(ti, inp, dt) {
    this.cur = ti; const t = this.t[ti]; if (!t) return; const P = t.ctrl; const b = this.ball;
    if (!P) return;
    if (this.sp && !(this.sp.kind === 'shootout' && this.sp.sub === 'live' && this.sp.team === ti && P === this.sp.shooter)) return;
    if (b.owner === P) {
      if (inp.Adown) this.charge = 0;
      if (inp.A) this.charge = Math.min(1, this.charge + dt / 0.85);
      if (inp.Aup) {
        const pw = 0.4 + 0.6 * this.charge; this.charge = 0;
        const hasDir = hyp(inp.mx, inp.mz) > 0.3;
        this.doShoot(P, pw, hasDir ? inp.mz * (F.gw - 0.5) : rnd(-1.4, 1.4));
      }
      else if (inp.Bdown && !this.sp) this.userPass(P, inp);
      else if (inp.Cdown) this.skill(P, inp);
    } else if (!this.sp) {
      this.charge = 0;
      if (inp.Adown) this.userTackle(P, inp);
      if (inp.Bdown) { const q = this.nearestToBall(t, P); if (q) { t.ctrl = q; } }
    }
  }
  userPass(P, inp) {
    const t = this.t[P.t], hasDir = hyp(inp.mx, inp.mz) > 0.25;
    const dx = hasDir ? inp.mx : t.dir, dz = hasDir ? inp.mz : 0;
    const Q = this.bestPass(P, dx, dz, hasDir, false);
    if (Q) { this.doPass(P, Q); t.ctrl = Q; }
    else { const n = hyp(dx, dz) || 1; this.kickBall(P, dx / n * 13, 0.3, dz / n * 13); }
  }
  userTackle(P, inp) {
    if (P.tackleCd > 0) return; const b = this.ball;
    let dx = inp.mx, dz = inp.mz;
    if (hyp(dx, dz) < 0.25) { const tg = b.owner && b.owner.t !== P.t ? b.owner : b; dx = tg.x - P.x; dz = tg.z - P.z; }
    this.startTackle(P, dx, dz);
  }
  skill(P, inp) {
    if (P.skillCd > 0) return;
    const hasDir = hyp(inp.mx, inp.mz) > 0.3; let nx = hasDir ? inp.mx : P.fx, nz = hasDir ? inp.mz : P.fz; const n = hyp(nx, nz) || 1; nx /= n; nz /= n;
    const s = rr() < 0.5 ? 1 : -1;
    P.skillT = 0.6; P.skillCd = 2.0; P.vx = nx * 7.2 + (-nz) * 3.6 * s; P.vz = nz * 7.2 + nx * 3.6 * s; this.emit('skill', { P });
  }
  startTackle(P, dx, dz) {
    if (P.tackleCd > 0 || P.stun > 0) return; const n = hyp(dx, dz) || 1;
    P.tackleT = 0.38; P.tackleCd = 1.15; P.tdx = dx / n; P.tdz = dz / n; P.thit = false; P.fx = P.tdx; P.fz = P.tdz;
  }
  resolveTackle(P, C) {
    const b = this.ball; this.emit('tackle', { P, C });
    if (C.skillT > 0) { this.emit('msg', { text: 'مراوغة رائعة!' }); P.stun = 0.5; return; }
    const dot = P.tdx * C.fx + P.tdz * C.fz;
    const foulP = dot > 0.35 ? 0.14 : (dot > -0.2 ? 0.05 : 0.02);
    const aiF = this.hu(P.t) ? 1.1 : (0.95 + 0.3 * this.diff);
    if (rr() < foulP * (this.hu(P.t) ? 1 : 0.8) * (1 - 0.5 * clamp(P.a.def, 0, 1))) { this.foul(P, C); return; }
    // من الخلف: الكرة أمام الحامل فيصعب قطعها جداً
    const rx = P.x - C.x, rz = P.z - C.z, rd = hyp(rx, rz) || 1, behind = (rx * C.fx + rz * C.fz) / rd;
    const side = behind < -0.35 ? 0.16 : (behind < 0.15 ? 0.6 : 1);
    const win = clamp(0.5 + (P.a.def - C.a.drb) * 0.55, 0.3, 0.8) * (this.hu(P.t) ? 1 : (0.78 + 0.22 * this.diff)) * side;
    if (rr() < win) {
      b.owner = null; b.vx = P.tdx * 6 + rnd(-2, 2); b.vz = P.tdz * 6 + rnd(-2, 2); b.vy = 1; b.cd = 0.15; C.noPick = 0.5; b.lastTeam = P.t; b.last = P;
      if (rr() < 0.4) this.takeBall(P);
    } else P.stun = 0.5;
  }

  /* ---------------- الأخطاء والكروت ---------------- */
  foul(P, V) {
    this.stats[P.t].fouls++; this.emit('whistle');
    const r = rr(); const card = r < 0.08 ? 'red' : (r < 0.3 ? 'yellow' : null);
    this.emit('banner', { text: '🚩 خطأ على ' + V.name, sub: card ? (card === 'red' ? '🟥 كارت أحمر — ' : '🟨 كارت أصفر — ') + P.name : P.name });
    if (card) this.giveCard(P, card);
    const spotX = clamp(V.x, -F.hx + 1, F.hx - 1), spotZ = clamp(V.z, -F.hz + 1, F.hz - 1);
    const defT = this.t[P.t], inArea = Math.abs(spotX - this.gx(defT)) < F.penD && Math.abs(spotZ) < F.penW / 2;
    if (this.mb && card) this.startShootout(V.t, this.bestRunner(V.t), { ctx: 'card' });
    else if (inArea) this.startPenalty(V.t, this.bestShooter(V.t), {});
    else this.startFreekick(V.t, spotX, spotZ);
  }
  giveCard(P, card) {
    this.stats[P.t].cards++; this.emit('card', { P, card });
    const t = this.t[P.t];
    if (this.mb) { P.out = true; if (card === 'red') P.out = true; this.sendOff(P); this.dirty = true; return; }
    P.out = true; this.sendOff(P);
    t.susp.push({ P, until: this.clock + (card === 'red' ? 5 : 2), perm: card === 'red' });
    this.dirty = true;
  }
  startFreekick(ti, x, z) {
    const t = this.t[ti], b = this.ball;
    this.mode = 'freekick'; this.fkTeam = ti; this.fkWait = 0; this.charge = 0; b.owner = null; b.x = x; b.z = z; b.y = F.R; b.vx = b.vy = b.vz = 0; b.net = false; b.lastTeam = ti;
    let taker = this.nearestToBall(t); if (!taker) taker = this.fieldOut(t)[0] || t.gk;
    this.fkTaker = taker; taker.x = clamp(x - t.dir * 0.9, -(F.hx + 1), F.hx + 1); taker.z = z; taker.fx = t.dir; taker.fz = 0; taker.vx = taker.vz = 0;
    const R = 10.5; // الخصم يبتعد عن الكرة 10.5 متر على الأقل
    for (const p of this.players) {
      if (!p.on) continue; p.vx = p.vz = 0; p.tackleT = 0;
      if (p.t !== ti && !p.isGK) {
        let dx = p.x - x, dz = p.z - z, d = hyp(dx, dz);
        if (d < R) { if (d < 0.3) { dx = -t.dir; dz = 0; d = 1; } p.x = x + dx / d * R; p.z = z + dz / d * R; }
        p.x = clamp(p.x, -(F.hx - 0.8), F.hx - 0.8); p.z = clamp(p.z, -(F.hz - 0.8), F.hz - 0.8);
        if (hyp(p.x - x, p.z - z) < R - 2) { p.x = clamp(x - t.dir * R, -(F.hx - 0.8), F.hx - 0.8); p.z = clamp(z + (z > 0 ? -R : R) * 0.4, -(F.hz - 0.8), F.hz - 0.8); }
        p.fx = t.dir; p.fz = 0;
      }
    }
    if (this.hu(ti)) t.ctrl = taker;
  }
  fkRelease(kind, inp) {
    const taker = this.fkTaker, t = this.t[this.fkTeam]; this.mode = 'play'; this.protect = 2.6; this.protectTeam = 1 - this.fkTeam;
    this.takeBall(taker); t.ctrl = this.hu(this.fkTeam) ? taker : t.ctrl; this.emit('whistle');
    this.cur = this.fkTeam;
    if (kind === 'shoot') { const hasDir = hyp(inp.mx, inp.mz) > 0.3; const pw = 0.4 + 0.6 * this.charge; this.charge = 0; this.doShoot(taker, pw, hasDir ? inp.mz * (F.gw - 0.5) : rnd(-1.5, 1.5)); }
    else if (kind === 'pass') this.userPass(taker, inp);
    this.charge = 0;
  }
  stepFreekick(dt, inp0) {
    this.stepPlayers(dt, NOINP); this.fkWait += dt; this.cur = this.fkTeam; const inp = this.inps[this.fkTeam] || NOINP;
    if (!this.hu(this.fkTeam)) { if (this.fkWait > 2.0) this.fkRelease(null, NOINP); return; }
    this.t[this.fkTeam].ctrl = this.fkTaker;
    if (inp.Adown) this.charge = 0; if (inp.A) this.charge = Math.min(1, this.charge + dt / 0.85);
    if (inp.Aup && this.fkWait > 0.4) this.fkRelease('shoot', inp);
    else if ((inp.Bdown || inp.Cdown) && this.fkWait > 0.4) this.fkRelease('pass', inp);
    else if (this.fkWait > 12) this.fkRelease('pass', NOINP);
  }

  /* ---------------- اللاعبون ---------------- */
  stepPlayers(dt, inp) {
    const b = this.ball, mode = this.mode;
    for (const t of this.t) {
      t.chase1 = t.chase2 = null;
      const o = b.owner;
      if (mode === 'play' && !(o && o.t === t.idx)) {
        const tx = o ? o.x : b.x + b.vx * 0.25, tz = o ? o.z : b.z + b.vz * 0.25;
        const c = this.fieldOut(t).filter(p => p !== t.ctrl || !this.hu(t.idx)).filter(p => !p.idle).map(p => [hyp(p.x - tx, p.z - tz), p]).sort((a, b2) => a[0] - b2[0]);
        if (c[0]) t.chase1 = c[0][1]; if (c[1] && o && c[1][0] < 16) t.chase2 = c[1][1];
      }
    }
    for (const t of this.t) this.computeShape(t);
    for (const P of this.players) {
      if (!P.on) continue;
      if (P.leaving) {
        this.steer(P, P.x, P.exitZ, 5, dt);
        if (Math.abs(P.z) > F.hz + 1.2) { P.on = false; P.leaving = false; P.vx = P.vz = 0; }
        else { P.x += P.vx * dt; P.z += P.vz * dt; P.anim += hyp(P.vx, P.vz) * dt * 1.9; }
        continue;
      }
      const t = this.t[P.t];
      if (P.tackleT > 0) { this.tickTackle(P, dt); }
      if (P.skillT > 0) P.skillT -= dt;
      if (P.diveT > 0) P.diveT -= dt;
      if (mode === 'goal') { this.celebrate(P, dt); }
      else if (P.idle || mode === 'intro' || mode === 'freekick' || mode === 'halftime' || mode === 'psoWait' || mode === 'jokerReact' || mode === 'ended') { if (P.isGK && mode !== 'freekick' && mode !== 'jokerReact') this.gkAI(P, dt); else this.steer(P, P.x, P.z, 0, dt); }
      else if (this.sp && P === this.sp.shooter && (this.sp.kind === 'penalty' || this.sp.sub !== 'live') && !(this.sp.kind === 'shootout' && this.sp.kicked)) this.steer(P, P.x, P.z, 0, dt);
      else if (this.hu(P.t) && t.ctrl === P && !(this.sp && this.sp.kind === 'penalty')) this.userMove(P, inp === NOINP ? NOINP : this.inps[P.t], dt);
      else if (P.isGK) this.gkAI(P, dt);
      else this.outfieldAI(P, dt);
      this.integrate(P, dt);
    }
    this.separate();
  }
  celebrate(P, dt) {
    const gi = this.goalInfo; if (!gi) { this.steer(P, P.x, P.z, 0, dt); return; }
    const t = this.t[P.t];
    if (gi.scorer === P) { P.celeb = 1; this.steer(P, P.x + t.dir * 3, -(F.hz - 2), 6.2, dt); }
    else if (P.t === gi.team && !P.isGK && gi.scorer && hyp(P.x - gi.scorer.x, P.z - gi.scorer.z) > 2.2) this.steer(P, gi.scorer.x, gi.scorer.z, 4.2, dt);
    else this.steer(P, P.x, P.z, 0, dt);
  }
  steer(P, tx, tz, sp, dt) {
    let dx = tx - P.x, dz = tz - P.z; const d = hyp(dx, dz); let vx = 0, vz = 0;
    if (d > 0.12 && sp > 0) { const s = Math.min(sp, d * 4.5); vx = dx / d * s; vz = dz / d * s; }
    if (P.tackleT > 0) return;
    const k = Math.min(1, dt * 5.5); P.vx += (vx - P.vx) * k; P.vz += (vz - P.vz) * k;
  }
  integrate(P, dt) {
    if (P.tackleT > 0) { const f = 0.35 + P.tackleT / 0.38; P.vx = P.tdx * 8.2 * f; P.vz = P.tdz * 8.2 * f; }
    P.x += P.vx * dt; P.z += P.vz * dt;
    const s = hyp(P.vx, P.vz);
    const bb = this.ball;
    if (bb.owner !== P && !(P.tackleT > 0) && !P.celeb && this.mode !== 'goal' && (s < 3.4 || P.isGK)) {
      // اللاعبون بلا كرة ينظرون نحو الكرة وهم يتمركزون
      let tx = bb.x - P.x, tz = bb.z - P.z; const td = hyp(tx, tz) || 1; tx /= td; tz /= td;
      if (s > 0.6) { const w = clamp((s - 0.6) / 2.8, 0, 1) * 0.55; tx = tx * (1 - w) + P.vx / s * w; tz = tz * (1 - w) + P.vz / s * w; }
      const k = Math.min(1, dt * 6); P.fx += (tx - P.fx) * k; P.fz += (tz - P.fz) * k; const n = hyp(P.fx, P.fz) || 1; P.fx /= n; P.fz /= n;
    } else if (s > 0.6) { const k = Math.min(1, dt * 9); P.fx += (P.vx / s - P.fx) * k; P.fz += (P.vz / s - P.fz) * k; const n = hyp(P.fx, P.fz) || 1; P.fx /= n; P.fz /= n; }
    P.anim += s * dt * 1.9;
    P.x = clamp(P.x, -(F.hx + 2.1), F.hx + 2.1); P.z = clamp(P.z, -(F.hz - 0.45), F.hz - 0.45);
    if (!P.isGK && Math.abs(P.x) > F.hx - 0.15 && Math.abs(P.z) < F.gw + 0.3) P.z = sgn(P.z) * (F.gw + 0.3);
    if (P.isGK) { const gx = this.gx(this.t[P.t]), inw = this.t[P.t].dir; const lo = Math.min(gx, gx + inw * 6), hi = Math.max(gx, gx + inw * 6); P.x = clamp(P.x, lo + 0.3, hi); P.z = clamp(P.z, -(F.penW / 2), F.penW / 2); }
  }
  separate() {
    const ps = this.players.filter(p => p.on && !p.leaving);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], c = ps[j]; const d = hyp(a.x - c.x, a.z - c.z);
      if (d < 0.75 && d > 0.001) { const push = (0.75 - d) * 0.5, nx = (a.x - c.x) / d, nz = (a.z - c.z) / d; if (!a.idle) { a.x += nx * push; a.z += nz * push; } if (!c.idle) { c.x -= nx * push; c.z -= nz * push; } }
    }
  }
  userMove(P, inp, dt) {
    const b = this.ball, m = hyp(inp.mx, inp.mz); let sp = P.spd;
    const sprint = inp.D && P.stam > 0.04 && m > 0.3;
    if (sprint) { sp *= 1.38; P.stam = Math.max(0, P.stam - 0.32 * dt); } else P.stam = Math.min(1, P.stam + 0.2 * dt);
    if (b.owner === P) sp *= 0.94;
    if (P.stun > 0) sp *= 0.4;
    let tx = 0, tz = 0;
    if (m > 0.1) { const k = Math.min(1, m * 1.15); tx = inp.mx / m * k * sp; tz = inp.mz / m * k * sp; }
    if (inp.C && !(b.owner && b.owner.t === P.t)) {
      const tg = b.owner || b; const dx = tg.x - P.x, dz = tg.z - P.z, d = hyp(dx, dz) || 1;
      if (m < 0.2) { tx = dx / d * sp * 0.9; tz = dz / d * sp * 0.9; } else { tx += dx / d * sp * 0.35; tz += dz / d * sp * 0.35; }
      this.t[P.t].pressing = true;
      if (b.owner && d < 1.4 && P.tackleCd <= 0 && rr() < dt * 1.4) this.startTackle(P, dx, dz);
    } else this.t[P.t].pressing = false;
    if (P.tackleT > 0) return;
    const k = Math.min(1, dt * 10); P.vx += (tx - P.vx) * k; P.vz += (tz - P.vz) * k;
  }
  tickTackle(P, dt) {
    P.tackleT -= dt; const b = this.ball;
    if (!P.thit) {
      const o = b.owner;
      if (o && o.t !== P.t && hyp(o.x - P.x, o.z - P.z) < 1.15) { P.thit = true; this.resolveTackle(P, o); }
      else if (!o && b.y < 0.8 && hyp(b.x - P.x, b.z - P.z) < 1.0 && b.cd <= 0) { P.thit = true; this.takeBall(P); }
    }
  }

  stepBall(dt) {
    const b = this.ball, R = F.R;
    if (b.owner) {
      const P = b.owner; if (!P.on || P.leaving) { b.owner = null; return; }
      const sp = hyp(P.vx, P.vz), touch = sp > 1.2 && !P.isGK ? Math.max(0, Math.sin(P.anim * 1.35)) : 0;
      const off = 0.55 + Math.min(0.3, sp * 0.04) + touch * Math.min(0.55, sp * 0.07);   // الكرة أمام اللاعب وتُدفع مع كل خطوة
      const tx = P.x + P.fx * off, tz = P.z + P.fz * off, k = Math.min(1, dt * 16);
      b.x += (tx - b.x) * k; b.z += (tz - b.z) * k; b.y = P.isGK ? 1.1 : R; b.vx = P.vx; b.vz = P.vz; b.vy = 0; return;
    }
    const n = 2, h = dt / n;
    for (let s = 0; s < n; s++) {
      const px = b.x; b.vy -= 18 * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      if (b.y < R) { b.y = R; if (b.vy < -1.2) b.vy = -b.vy * 0.55; else b.vy = 0; }
      if (b.y <= R + 0.02) { const f = Math.exp(-h * 1.0); b.vx *= f; b.vz *= f; } else { const f = Math.exp(-h * 0.08); b.vx *= f; b.vz *= f; }
      if (b.y > 10) { b.y = 10; b.vy = -Math.abs(b.vy) * 0.5; }
      if (b.net) {
        const e = sgn(b.x), lim = F.hx + F.gd - R;
        if (e * b.x > lim) { b.x = e * lim; b.vx *= -0.15; } if (e * b.x < F.hx + R) { b.x = e * (F.hx + R); b.vx = Math.abs(b.vx) * -e * 0.2; }
        if (Math.abs(b.z) > F.gw - R) { b.z = sgn(b.z) * (F.gw - R); b.vz *= -0.2; } if (b.y > F.gh - R) { b.y = F.gh - R; b.vy = -Math.abs(b.vy) * 0.2; }
        b.vx *= 0.97; b.vz *= 0.97;
      } else {
        if (Math.abs(b.z) > F.hz - R) { b.z = sgn(b.z) * (F.hz - R); if (Math.abs(b.vz) > 6) this.emit('wall'); b.vz = -b.vz * 0.75; b.vx *= 0.93; }
        const lx = F.hx + F.pad - R; if (Math.abs(b.x) > lx) { b.x = sgn(b.x) * lx; b.vx = -b.vx * 0.6; }
        for (const e of [1, -1]) {
          const dx = b.x - e * F.hx;
          if (Math.abs(dx) < 0.2 + R && b.y < F.gh + 0.1) {
            for (const sz of [1, -1]) { if (Math.hypot(dx, b.z - sz * F.gw) < 0.07 + R + 0.04) { b.vz = (b.z - sz * F.gw >= 0 ? 1 : -1) * Math.abs(b.vz) * 0.6; b.vx = -e * Math.abs(b.vx) * 0.55; b.x += -e * 0.1; this.emit('post'); } }
            if (Math.abs(b.z) < F.gw && Math.abs(b.y - F.gh) < 0.07 + R) { b.vy = -Math.abs(b.vy) * 0.5 - 0.5; b.vx = -e * Math.abs(b.vx) * 0.5; b.y = F.gh + (b.y > F.gh ? 1 : -1) * (0.09 + R); this.emit('post'); }
          }
        }
        for (const e of [1, -1]) {
          if (e * b.x > F.hx && e * px <= F.hx && Math.abs(b.z) < F.gw - 0.02 && b.y < F.gh - 0.02) { this.goalCrossed(e); break; }
        }
      }
      if (!b.net) for (const t of this.t) {
        const G = t.gk; if (!G.on || b.owner || G.saveCd > 0 || b.lastTeam === G.t || this.mode === 'goal') continue;
        const rb = this.hu(G.t) ? 0.2 : 0, reach = (G.diveT > 0 ? 2.6 : 1.45) + rb, hgt = G.diveT > 0 ? 2.9 : 2.3;
        if (Math.abs(b.x - G.x) < 0.9 && Math.abs(b.z - G.z) < reach && b.y < hgt && hyp(b.vx, b.vz) > 4) this.saveAttempt(G);
      }
      this.tryPickup();
      if (b.owner) break;
    }
    if (this.mode === 'play' || (this.mode === 'special')) {
      if (b.x !== b.x || b.z !== b.z) { b.x = 0; b.z = 0; b.vx = b.vz = 0; }
    }
  }
  goalCrossed(e) {
    const b = this.ball; const t = this.t.find(q => q.dir === e); b.net = true;
    this.emit('netHit');
    if (this.sp) { if (!this.sp.outcome) { this.sp.outcome = 'goal'; this.sp.t = 0; } return; }
    if (this.mode !== 'play') return;
    const og = !(b.last && b.last.t === t.idx);
    this.registerGoal(t.idx, b.last, { og });
  }

  /* ---------------- حالات خاصة: ركلة جزاء / شووت آوت ---------------- */
  bestShooter(ti) { const l = this.fieldOut(this.t[ti]); const L2 = l.length ? l : this.t[ti].queue.filter(p => !p.out); return L2.slice().sort((a, b) => b.a.shoot - a.a.shoot)[0]; }
  bestRunner(ti) { const l = this.fieldOut(this.t[ti]); const L2 = l.length ? l : this.t[ti].queue.filter(p => !p.out); return L2.slice().sort((a, b) => (b.spd * b.a.drb + b.a.shoot) - (a.spd * a.a.drb + a.a.shoot))[0]; }
  sideline(excl) {
    let k0 = 0, k1 = 0;
    for (const p of this.players) {
      if (!p.on || p.leaving || excl.includes(p)) continue; p.idle = true; p.vx = p.vz = 0; p.tackleT = 0;
      const k = p.t === 0 ? k0++ : k1++; p.x = (k - 3) * 3.2 + (p.t ? 1.6 : 0); p.z = -(F.hz - 1.3); p.fx = 0; p.fz = 1;
    }
  }
  startPenalty(si, shooter, opts) {
    opts = opts || {}; const t = this.t[si], gk = this.t[1 - si].gk, b = this.ball;
    this.mode = 'special'; this.charge = 0; b.owner = null; b.net = false;
    this.sp = { kind: 'penalty', team: si, shooter, gk, sub: 'setup', t: 0, opts, kicked: false, outcome: null, aimZ: 0, ctx: opts.ctx || 'play' };
    this.sideline([shooter, gk]);
    b.x = t.dir * F.hx - t.dir * F.penSpot; b.z = 0; b.y = F.R; b.vx = b.vy = b.vz = 0; b.lastTeam = si; b.last = shooter;
    shooter.on = true; shooter.idle = false; shooter.x = b.x - t.dir * 2.4; shooter.z = 0; shooter.fx = t.dir; shooter.fz = 0; shooter.vx = shooter.vz = 0;
    gk.x = this.gx(this.t[1 - si]) + this.t[1 - si].dir * 0.5; gk.z = 0; gk.vx = gk.vz = 0; gk.idle = false; gk.diveT = 0; gk.reacting = false;
    this.emit('whistle'); this.emit('banner', { text: opts.reverse ? '🔁 عقوبة عكسية' : '🎯 ركلة جزاء', sub: shooter.name });
  }
  startShootout(si, shooter, opts) {
    opts = opts || {}; const t = this.t[si], gk = this.t[1 - si].gk, b = this.ball;
    this.mode = 'special'; this.charge = 0; b.net = false;
    shooter.on = true; shooter.leaving = false;
    if (opts.ctx === 'pso') { for (const p of this.players) { if (p !== shooter && !p.isGK) { p.on = false; p.leaving = false; } } this.sideline([shooter, gk]); }
    else this.sideline([shooter, gk]);
    this.sp = { kind: 'shootout', team: si, shooter, gk, sub: 'ready', t: 0, live: 0, opts, kicked: false, kt: 0, outcome: null, ctx: opts.ctx || 'play' };
    shooter.idle = false; shooter.x = 0; shooter.z = 0; shooter.fx = t.dir; shooter.fz = 0; shooter.vx = shooter.vz = 0; shooter.soShot = 0;
    gk.idle = false; gk.x = this.gx(this.t[1 - si]) + this.t[1 - si].dir * 1.0; gk.z = 0; gk.vx = gk.vz = 0; gk.diveT = 0; gk.reacting = false; gk.hold = 0;
    b.owner = null; b.x = t.dir * 0.55; b.z = 0; b.y = F.R; b.vx = b.vy = b.vz = 0; this.takeBall(shooter); b.lastTeam = si;
    for (const tt of this.t) tt.ctrl = null; if (this.hu(si)) this.t[si].ctrl = shooter;
    this.emit('whistle'); this.emit('banner', { text: '🏃 شووت آوت', sub: shooter.name + ' — 5 ثوانٍ فقط!' });
  }
  stepSpecial(dt, inp0) {
    const s = this.sp; if (!s) { this.mode = 'play'; return; }
    s.t += dt; const b = this.ball, P = s.shooter, t = this.t[s.team], user = this.hu(s.team);
    this.cur = s.team; const inp = user ? (this.inps[s.team] || NOINP) : NOINP;
    if (s.kind === 'shootout' && s.sub === 'live' && user) this.handleUserFor(s.team, inp, dt);
    this.stepPlayers(dt, inp);
    if (s.kind === 'penalty') {
      if (s.sub === 'setup') { if (s.t > 1.6) { s.sub = 'aim'; s.t = 0; s.aimZ = user ? 0 : sgn(rr() - 0.5) * rnd(1.4, 3.2); } }
      else if (s.sub === 'aim') {
        let fire = false, pw = 0.75;
        if (user) {
          s.aimZ = clamp(s.aimZ + inp.mz * dt * 5, -(F.gw - 0.35), F.gw - 0.35);
          if (inp.Adown) this.charge = 0; if (inp.A) this.charge = Math.min(1, this.charge + dt / 0.9);
          if (inp.Aup) { fire = true; pw = 0.35 + 0.65 * this.charge; }
          if (s.t > 9) { fire = true; pw = 0.7; }
        } else if (s.t > rnd(1.0, 1.8)) { fire = true; pw = rnd(0.55, 0.9); }
        if (fire) this.penaltyKick(s, pw);
      } else if (s.sub === 'live') {
        s.kt += dt;
        if (!s.outcome) { if (b.owner === s.gk) s.outcome = 'saved'; else if (s.kt > 0.7 && hyp(b.vx, b.vz) < 1.2) s.outcome = 'miss'; else if (s.kt > 2.8) s.outcome = 'miss'; if (s.outcome) s.t = 0; }
        else { s.sub = 'done'; s.t = 0; }
      } else if (s.sub === 'done') { }
    } else {
      if (s.sub === 'ready') { if (s.t > 1.6) { s.sub = 'live'; s.t = 0; s.live = 0; this.emit('whistle'); } }
      else if (s.sub === 'live') {
        s.live += dt; if (s.kicked) s.kt += dt;
        if (!s.outcome) {
          if (b.owner === s.gk) { s.outcome = 'saved'; }
          else if (!s.kicked && s.live >= 5) { s.outcome = 'miss'; s.timeout = true; }
          else if (s.kicked && (s.kt > 2.6 || (s.kt > 0.7 && hyp(b.vx, b.vz) < 1.2))) { s.outcome = 'miss'; }
          if (s.outcome) { s.t = 0; s.sub = 'done'; }
        }
      }
    }
    if (s.outcome === 'goal' && s.sub !== 'done') { s.sub = 'done'; s.t = 0; }
    if (s.sub === 'done') { s.wait = (s.wait || 0) + dt; if (s.wait > 1.6) this.finishSpecial(s.outcome || 'miss'); }
    this.stepBall(dt);
  }
  penaltyKick(s, pw) {
    const P = s.shooter, t = this.t[P.t], b = this.ball, gx = t.dir * F.hx; const tz = s.aimZ; this.charge = 0;
    const err = (1.1 - P.a.shoot) * 0.04 + Math.max(0, pw - 0.7) * 0.06;
    const ang = Math.atan2(tz - b.z, gx + t.dir * 0.3 - b.x) + rnd(-err, err), sp = 17 + 11 * pw;
    b.owner = null; b.vx = Math.cos(ang) * sp; b.vz = Math.sin(ang) * sp; b.vy = 0.5 + rnd(0, 1.5) * pw; b.cd = 0.1; b.lastTeam = P.t; b.last = P; b.shotBy = P; P.kickT = 0.35;
    this.stats[P.t].shots++; s.kicked = true; s.sub = 'live'; s.kt = 0; this.emit('kick', { P, power: pw, shot: true });
    const G = s.gk, skill = 0.55 + 0.45 * G.a.gk; const good = rr() < 0.22 + 0.2 * skill * (this.hu(G.t) ? 0.9 : (0.8 + 0.3 * this.diff));
    let side = good ? sgn(tz) : (rr() < 0.5 ? -1 : 1); if (Math.abs(tz) < 0.6 && rr() < 0.4) side = 0;
    G.reacting = false; G.diveT = 0.9; G.diveZ = side * rnd(1.8, 3.2);
  }
  finishSpecial(outcome) {
    const s = this.sp; this.sp = null;
    for (const p of this.players) { p.idle = false; }
    if (s.opts.reverse) {
      if (outcome !== 'goal') { this.addScore(s.opts.reverse.ben, 1, null, { free: true }); return; }
    } else if (s.ctx === 'pso') { this.psoRecord(s.team, outcome === 'goal'); return; }
    else if (outcome === 'goal') { this.registerGoal(s.team, s.shooter); return; }
    this.restartPlay(1 - s.team);
  }

  /* ---------------- البطاقات السرية ---------------- */
  canUseCard(ti) { const t = this.t[ti]; return this.mode === 'play' && this.winOpen() && !!t.card && !this.pendJ; }
  getTargets(ti, card) {
    const me = this.t[ti], op = this.t[1 - ti];
    const pack = l => l.map(p => ({ id: p.id, name: p.name, num: p.num, pos: p.pos }));
    if (card === 'suspend' || card === 'reverse') return pack(this.fieldOut(op));
    if (card === 'star') return pack(this.fieldOut(me));
    return [];
  }
  autoTarget(ti, card) {
    const l = this.getTargets(ti, card).map(x => this.players.find(p => p.id === x.id)); if (!l.length) return null;
    if (card === 'reverse') l.sort((a, b) => a.a.shoot - b.a.shoot); else l.sort((a, b) => b.a.shoot - a.a.shoot);
    return l[0].id;
  }
  useCard(ti, cardId, target) {
    const t = this.t[ti]; if (!this.canUseCard(ti)) return false;
    let real = t.card; if (t.card === 'joker') { if (!cardId || cardId === 'joker') return false; real = cardId; }
    if (['suspend', 'reverse', 'star'].includes(real) && target == null) target = this.autoTarget(ti, real);
    if (['suspend', 'reverse', 'star'].includes(real) && target == null) return false;
    this.announceCard(ti, real, target, t.card === 'joker'); return true;
  }
  announceCard(ti, card, target, viaJoker) {
    const o = this.t[1 - ti];
    this.emit('cardUse', { team: ti, card, viaJoker });
    this.emit('banner', { text: '🃏 ' + this.t[ti].name + ' فعّل: ' + KL.CARDS[card].ar, sub: viaJoker ? 'عبر الجوكر' : '' });
    if (o.card === 'joker') {
      if (this.hu(1 - ti)) { this.pendJ = { ti, card, target, viaJoker }; this.mode = 'jokerReact'; this.jokerT = 0; this.emit('jokerPrompt', { ti, card, to: 1 - ti }); return; }
      if (rr() < 0.55) { this.pendJ = { ti, card, target, viaJoker }; this.jokerResponse(rr() < 0.5 ? 'cancel' : 'steal'); return; }
    }
    this.applyCard(ti, card, target);
  }
  jokerResponse(choice) {
    const pj = this.pendJ; if (!pj) return; this.pendJ = null; if (this.mode === 'jokerReact') this.mode = 'play';
    const t = this.t[pj.ti], o = this.t[1 - pj.ti]; t.card = null;
    if (choice === 'cancel') { o.card = null; this.emit('banner', { text: '🃏 الجوكر يُلغي البطاقة!', sub: this.t[1 - pj.ti].name }); return; }
    if (choice === 'steal') { o.card = null; this.emit('banner', { text: '🃏 الجوكر يسرق البطاقة!', sub: this.t[1 - pj.ti].name }); this.applyCard(1 - pj.ti, pj.card, this.autoTarget(1 - pj.ti, pj.card)); return; }
    this.applyCard(pj.ti, pj.card, pj.target);
  }
  applyCard(ti, card, target) {
    const t = this.t[ti], o = this.t[1 - ti]; t.card = null;
    const pl = id => this.players.find(p => p.id === id);
    switch (card) {
      case 'penalty': this.startPenalty(ti, this.bestShooter(ti), {}); break;
      case 'shootout': this.startShootout(ti, this.bestRunner(ti), { ctx: 'card' }); break;
      case 'double': t.doubleUntil = this.clock + 4; this.emit('banner', { text: '✖️2 الهدف المضاعف', sub: t.name + ' — 4 دقائق' }); break;
      case 'suspend': { const P = pl(target); if (P && P.on) { P.out = true; this.sendOff(P); o.susp.push({ P, until: this.clock + 4, perm: false }); this.dirty = true; this.emit('banner', { text: '🚫 إيقاف زمني', sub: P.name + ' — 4 دقائق' }); } break; }
      case 'star': { const P = pl(target); if (P) { t.star = P.id; this.emit('banner', { text: '⭐ اللاعب النجم', sub: P.name + ' — أهدافه بهدفين' }); } break; }
      case 'reverse': { const P = pl(target); if (P) this.startPenalty(1 - ti, P, { reverse: { ben: ti } }); break; }
    }
  }
  aiCards(dt) {
    for (const t of this.t) {
      if (this.hu(t.idx) || !t.card || !this.winOpen() || this.mode !== 'play') continue;
      const w = this.half === 1 ? 0 : 1, at = t.aiCardAt[w], winEnd = w === 0 ? 17 : 36;
      if (t.card === 'joker' && t.jokerHold && this.clock < winEnd - 1.2) continue;
      if (this.clock >= at && rr() < dt * 0.8) {
        let c = t.card; if (c === 'joker') { const ids = ['penalty', 'shootout', 'double', 'suspend', 'star', 'reverse']; c = ids[Math.floor(rr() * ids.length)]; }
        let tg = null; if (['suspend', 'reverse', 'star'].includes(c)) tg = this.autoTarget(t.idx, c);
        if (['suspend', 'reverse', 'star'].includes(c) && tg == null) continue;
        this.announceCard(t.idx, c, tg, t.card === 'joker');
        return;
      }
    }
  }
}
KL._m = { F, clamp, rnd, rr, hyp, sgn };
KL.Match = Match;
})();

;


