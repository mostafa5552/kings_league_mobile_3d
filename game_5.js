/* KING'S LEAGUE 3D — game_5.js (جزء 5 من 6) */
/* ===== netmatch.js ===== */
/* ============================================================
   KING'S LEAGUE 3D — netmatch.js
   مباراة أونلاين: المضيف (host) يشغّل المحاكاة كاملة،
   والضيف (guest) يرسل أزرار التحكم فقط ويعرض لقطات حالة (MirrorMatch).
   الضيف يرى الملعب مقلوباً 180° كي يكون فريقه دائماً "الفريق 0" ويهاجم نحو اليمين،
   فتعمل الواجهة والكاميرا بدون أي تعديل.
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const r2 = v => Math.round(v * 100) / 100;
const swapId = id => id == null || id < 0 ? id : (1 - Math.floor(id / 100)) * 100 + id % 100;
const swapT = t => t == null || t < 0 ? t : 1 - t;
const isP = v => v && typeof v === 'object' && typeof v.tackleT === 'number';
const NOINP = { mx: 0, mz: 0, A: false, Adown: false, Aup: false, B: false, Bdown: false, Bup: false, C: false, Cdown: false, Cup: false, D: false };
const EDGE = ['Adown', 'Aup', 'Bdown', 'Bup', 'Cdown', 'Cup'];

/* ---------- فريق أونلاين: يُولَّد تلقائياً وبشكل حتمي من الملف الشخصي ---------- */
const FN = ['Omar', 'Ali', 'Youssef', 'Karim', 'Hassan', 'Mostafa', 'Adam', 'Zaid', 'Khaled', 'Tarek', 'Sami', 'Nabil', 'Rami', 'Fares', 'Hamza', 'Ibrahim', 'Mahmoud', 'Said', 'Walid', 'Bilal', 'Yassin', 'Amir', 'Nour', 'Jad', 'Malik', 'Rayan', 'Anas', 'Layth', 'Majed', 'Sherif'];
const LN = ['Salem', 'Haddad', 'Nasser', 'Farouk', 'Mansour', 'Khalil', 'Saleh', 'Darwish', 'Rahman', 'Sabry', 'Amin', 'Jaber', 'Fathy', 'Hakim', 'Aziz', 'Mahdi', 'Bashir', 'Zaki', 'Taha', 'Samir', 'Gamal', 'Rashed', 'Qasim', 'Shaheen', 'Ramzy', 'Tawfik', 'Younes', 'Idris', 'Fadel', 'Karam'];
KL.onlineTeam = function (p) {
  const seed = KL.hash('ol' + p.id + p.username), used = new Set(); let s = seed;
  const next = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s >>> 8; };
  const nm = () => { let n, g = 0; do { n = FN[next() % FN.length] + ' ' + LN[next() % LN.length]; } while (used.has(n) && g++ < 50); used.add(n); return n; };
  const list = []; [['GK', 2], ['DEF', 4], ['MID', 4], ['FW', 4]].forEach(([pos, n]) => { for (let i = 0; i < n; i++) list.push({ name: nm(), pos, star: false, num: null }); });
  const c1 = /^#[0-9a-f]{6}$/i.test(p.c1) ? p.c1 : '#19c3e6', c2 = /^#[0-9a-f]{6}$/i.test(p.c2) ? p.c2 : '#0b1b3a';
  const short = String(p.team_name).replace(/[^A-Za-z0-9؀-ۿ]/g, '').slice(0, 3).toUpperCase() || 'TEM';
  const t = { id: 'u_' + String(p.id).replace(/-/g, '').slice(0, 10), type: 'club', name: p.team_name, ar: p.team_name, short, logo: p.logo || null, ovr: 74, user: p.username, kits: { home: KL.kit(c1, c2, c1), away: KL.kit('#f2f2f2', c1, c1) } };
  KL.finishTeam(t, list); KL.ALL[t.id] = t; return t;
};

/* ---------- ترميز الأحداث/اللقطات ---------- */
function encEvent(e) {
  const o = {};
  for (const k of Object.keys(e)) {
    const v = e[k];
    if (isP(v)) o[k] = { __p: v.id };
    else if (k === 'pso' && v && !Array.isArray(v)) o[k] = { shots: v.shots, goals: v.goals, turn: v.turn, idx: v.idx, winner: v.winner };
    else if (v && typeof v === 'object' && !Array.isArray(v)) { o[k] = {}; for (const kk of Object.keys(v)) o[k][kk] = isP(v[kk]) ? { __p: v[kk].id } : v[kk]; }
    else o[k] = v;
  }
  return o;
}
function decEvent(e, byId, flip) {
  const o = {};
  for (const k of Object.keys(e)) {
    const v = e[k];
    if (v && typeof v === 'object' && v.__p != null) o[k] = byId[flip ? swapId(v.__p) : v.__p];
    else o[k] = v;
  }
  if (!flip) return o;
  for (const k of ['team', 'ti', 'to']) if (typeof o[k] === 'number') o[k] = swapT(o[k]);
  if (o.type === 'goal' || o.type === 'cardUse') { /* team already swapped */ }
  if (o.score) o.score = [o.score[1], o.score[0]];
  if (o.type === 'end') { o.score = [e.score[1], e.score[0]]; if (e.pso) o.pso = [e.pso[1], e.pso[0]]; o.winner = swapT(e.winner); }
  if (o.pso && o.pso.shots) o.pso = { shots: [o.pso.shots[1], o.pso.shots[0]], goals: [o.pso.goals[1], o.pso.goals[0]], turn: 1 - o.pso.turn, idx: [o.pso.idx[1], o.pso.idx[0]], winner: swapT(o.pso.winner) };
  return o;
}
KL._enc = { encEvent, decEvent, swapId, swapT };

/* ---------- المضيف: Match عادي بلاعبين بشريين + بث لقطات ---------- */
class HostMatch extends KL.Match {
  constructor(o, net) {
    super(Object.assign({}, o, { humans: [true, true], user: 0 }));
    this.net = net; this.remote = Object.assign({}, NOINP); this.out = []; this.acc = 0; this.seq = 0; this.lastIn = performance.now ? performance.now() : Date.now();
    this.hostInp = null;
  }
  emit(type, d) {
    const e = Object.assign({ type }, d || {});
    this.out.push(encEvent(e)); // كل الأحداث تُرسل؛ الضيف يتجاهل ما ليس له (newCard / jokerPrompt بحقل team/to)
    super.emit(type, d);
  }
  onRemote(m) { // m: رسالة 'inp' من الضيف (بعد قلب 180°)
    const r = this.remote; r.mx = -(+m.mx || 0); r.mz = -(+m.mz || 0); r.A = !!m.A; r.B = !!m.B; r.C = !!m.C; r.D = !!m.D;
    for (const k of EDGE) if (m[k]) r[k] = true;
    this.lastIn = Date.now();
  }
  onAct(a) {
    if (!a) return;
    if (a.t === 'card') this.useCard(1, a.card || null, a.target == null ? null : swapId(a.target));
    else if (a.t === 'joker' && this.pendJ && this.pendJ.ti === 0 && ['cancel', 'steal', 'allow'].includes(a.choice)) this.jokerResponse(a.choice);
  }
  update(dt, inp) {
    const r = Object.assign({}, this.remote); for (const k of EDGE) this.remote[k] = false;
    super.update(dt, [inp || NOINP, r]);
    this.acc += dt; if (this.acc >= 1 / 15 || this.mode === 'ended') { this.acc = 0; this.sendSnap(); }
  }
  snap() {
    const b = this.ball;
    return {
      n: ++this.seq, md: this.mode, clk: r2(this.clock), h: this.half, sc: this.score, col: this.colored, mb: this.mb, dice: this.dice,
      b: [r2(b.x), r2(b.y), r2(b.z), r2(b.vx), r2(b.vy), r2(b.vz), b.owner ? b.owner.id : -1, b.lastTeam],
      p: this.players.map(P => [P.id, r2(P.x), r2(P.z), r2(P.vx), r2(P.vz), r2(P.fx), r2(P.fz), P.on ? 1 : 0, P.leaving ? 1 : 0, P.isGK ? 1 : 0, P.out ? 1 : 0, r2(P.tackleT), r2(P.kickT), r2(P.skillT), r2(P.stun), r2(P.celeb), r2(P.diveT), r2(P.diveZ), r2(P.stam)]),
      t: this.t.map(t => ({ card: t.card, ctrl: t.ctrl ? t.ctrl.id : -1, star: t.star == null ? null : t.star, dir: t.dir, du: t.doubleUntil, su: t.susp.length })),
      sp: this.sp ? { kind: this.sp.kind, sub: this.sp.sub, team: this.sp.team, sh: this.sp.shooter ? this.sp.shooter.id : -1, gk: this.sp.gk ? this.sp.gk.id : -1, aimZ: r2(this.sp.aimZ || 0), live: r2(this.sp.live || 0), kicked: !!this.sp.kicked, t: r2(this.sp.t) } : null,
      pso: this.pso ? { shots: this.pso.shots, goals: this.pso.goals, turn: this.pso.turn, idx: this.pso.idx, winner: this.pso.winner } : null,
      st: this.stats.map(s => [s.shots, s.fouls, s.goals, s.cards]), fk: this.mode === 'freekick' ? [this.fkTeam, this.fkTaker ? this.fkTaker.id : -1] : null,
      pj: this.pendJ ? 1 : 0, ch: [r2(this._ch[0]), r2(this._ch[1])], res: this.result
    };
  }
  sendSnap() { const s = this.snap(); s.ev = this.out; this.out = []; this.net.send('snap', s); }
}

/* ---------- الضيف: يعرض فقط ---------- */
class MirrorMatch extends KL.Match {
  constructor(o, net) {
    super(Object.assign({}, o, { humans: [true, false], user: 0 }));
    this.net = net; this.snapQ = null; this.recvAt = 0; this.evQ = []; this.byId = {}; this.players.forEach(P => this.byId[P.id] = P);
    this.accIn = Object.assign({}, NOINP); this.inT = 0; this.have = false;
    this.mode = 'intro'; this.modeT = 99; this.pendJ = null;
  }
  onSnap(s) { // لقطة من المضيف: نقلبها 180° لتصبح من منظور الضيف
    if (this.snapQ && s.n <= this.snapQ.n) return;
    this.snapQ = s; this.recvAt = Date.now();
    for (const e of (s.ev || [])) this.evQ.push(decEvent(e, this.byId, true));
  }
  update(dt, inp) {
    inp = inp || NOINP; this.time += dt;
    // أرسل التحكم 20 مرة/ث (الحواف تُجمَّع حتى لا تضيع)
    const a = this.accIn; a.mx = inp.mx; a.mz = inp.mz; a.A = !!inp.A; a.B = !!inp.B; a.C = !!inp.C; a.D = !!inp.D; for (const k of EDGE) if (inp[k]) a[k] = true;
    this.inT += dt; if (this.inT >= 0.05) { this.inT = 0; this.net.send('inp', Object.assign({}, a)); for (const k of EDGE) a[k] = false; }
    this.charge = inp.A ? Math.min(1, this.charge + dt / 0.85) : 0;
    const s = this.snapQ; if (!s) return;
    const age = clamp((Date.now() - this.recvAt) / 1000, 0, 0.12), k = Math.min(1, dt * 16);
    this.mode = s.md; this.clock = s.clk; this.half = s.h; this.score = [s.sc[1], s.sc[0]]; this.colored = !!s.col; this.mb = !!s.mb; this.dice = s.dice;
    const b = this.ball, bb = s.b, first = !this.have; this.have = true;
    const bx = -bb[0] - bb[3] * 0 + (-bb[3]) * age, bz = -bb[2] + (-bb[5]) * age;
    if (first || Math.hypot(bx - b.x, bz - b.z) > 7) { b.x = bx; b.z = bz; } else { b.x += (bx - b.x) * k; b.z += (bz - b.z) * k; }
    b.y = bb[1] + bb[4] * age; if (b.y < 0) b.y = 0; b.vx = -bb[3]; b.vy = bb[4]; b.vz = -bb[5];
    b.owner = bb[6] >= 0 ? this.byId[swapId(bb[6])] : null; b.lastTeam = swapT(bb[7]);
    for (const e of s.p) {
      const P = this.byId[swapId(e[0])]; if (!P) continue;
      const x = -e[1] + (-e[3]) * age, z = -e[2] + (-e[4]) * age;
      if (first || Math.hypot(x - P.x, z - P.z) > 6) { P.x = x; P.z = z; } else { P.x += (x - P.x) * k; P.z += (z - P.z) * k; }
      P.vx = -e[3]; P.vz = -e[4]; P.fx += (-e[5] - P.fx) * Math.min(1, dt * 14); P.fz += (-e[6] - P.fz) * Math.min(1, dt * 14);
      P.on = !!e[7]; P.leaving = !!e[8]; P.isGK = !!e[9]; P.out = !!e[10]; P.tackleT = e[11]; P.kickT = e[12]; P.skillT = e[13]; P.stun = e[14]; P.celeb = e[15]; P.diveT = e[16]; P.diveZ = -e[17]; P.stam = e[18];
      P.anim += Math.hypot(P.vx, P.vz) * dt * 1.9; P.idle = false;
    }
    for (let i = 0; i < 2; i++) { // t[i] عندي = t[1-i] عند المضيف
      const h = s.t[1 - i], t = this.t[i]; t.card = h.card; t.ctrl = h.ctrl >= 0 ? this.byId[swapId(h.ctrl)] : null; t.star = h.star == null ? null : swapId(h.star); t.dir = -h.dir; t.doubleUntil = h.du; t.susp = new Array(h.su).fill({ until: 99 });
    }
    this.sp = s.sp ? { kind: s.sp.kind, sub: s.sp.sub, team: swapT(s.sp.team), shooter: this.byId[swapId(s.sp.sh)], gk: this.byId[swapId(s.sp.gk)], aimZ: -s.sp.aimZ, live: s.sp.live, kicked: s.sp.kicked, t: s.sp.t } : null;
    this.pso = s.pso ? { shots: [s.pso.shots[1], s.pso.shots[0]], goals: [s.pso.goals[1], s.pso.goals[0]], turn: 1 - s.pso.turn, idx: [s.pso.idx[1], s.pso.idx[0]], winner: swapT(s.pso.winner) } : null;
    this.stats = [s.st[1], s.st[0]].map(a => ({ shots: a[0], fouls: a[1], goals: a[2], cards: a[3] }));
    this.fkTeam = s.fk ? swapT(s.fk[0]) : -1; this.fkTaker = s.fk && s.fk[1] >= 0 ? this.byId[swapId(s.fk[1])] : null; this.pendJ = s.pj ? { guest: true } : null;
    this.result = s.res ? { score: [s.res.score[1], s.res.score[0]], pso: s.res.pso ? [s.res.pso[1], s.res.pso[0]] : null, winner: swapT(s.res.winner), reason: s.res.reason } : null;
    if (this.evQ.length) { const q = this.evQ; this.evQ = []; for (const e of q) this.emit(e.type, e); }
  }
  emit(type, d) { const e = Object.assign({ type }, d || {}); delete e.type; super.emit(type, e); }
  useCard(ti, cardId, target) {
    if (!this.canUseCard(0)) return false; const t = this.t[0];
    if (t.card === 'joker' && (!cardId || cardId === 'joker')) return false;
    let tg = target; if (['suspend', 'reverse', 'star'].includes(t.card === 'joker' ? cardId : t.card) && tg == null) tg = this.autoTarget(0, t.card === 'joker' ? cardId : t.card);
    this.net.send('act', { t: 'card', card: cardId || null, target: tg == null ? null : swapId(tg) }); return true;
  }
  jokerResponse(choice) { this.net.send('act', { t: 'joker', choice }); this.pendJ = null; }
}
KL.HostMatch = HostMatch; KL.MirrorMatch = MirrorMatch;
})();

;
/* ===== online_db.js ===== */
/* ============================================================
   KING'S LEAGUE 3D — online_db.js
   طبقة قاعدة البيانات (Supabase): حسابات، ملفات شخصية، بطولات.
   بدون واجهة — تُختبر في Node بواسطة MockSupabase.
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';
const AR_ERR = [
  [/Invalid login credentials/i, 'البريد أو كلمة المرور غير صحيحة'],
  [/User already registered/i, 'هذا البريد مسجّل بالفعل — سجّل الدخول'],
  [/Password should be at least/i, 'كلمة المرور قصيرة (6 أحرف على الأقل)'],
  [/Unable to validate email|invalid format|valid email/i, 'البريد الإلكتروني غير صالح'],
  [/Email not confirmed/i, 'أكّد بريدك الإلكتروني من الرسالة التي وصلتك ثم سجّل الدخول'],
  [/rate limit|too many/i, 'محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة'],
  [/Failed to fetch|NetworkError|network/i, 'تعذّر الاتصال بالإنترنت'],
  [/profiles_username_ci|duplicate key.*username/i, 'اسم المستخدم مستخدم من قبل'],
  [/row-level security/i, 'غير مسموح بهذه العملية']
];
function nice(e) { const m = (e && (e.message || e.error_description || e.details)) || String(e); for (const [r, t] of AR_ERR) if (r.test(m)) return t; return m; }
function fail(e) { const x = new Error(nice(e)); x.code = e && e.code; x.raw = e; throw x; }
const chk = ({ data, error }) => { if (error) fail(error); return data; };
KL.dbErr = nice;

class OnlineDB {
  constructor(sb) { this.sb = sb; this.me = null; this.profile = null; }
  /* ---- الحساب ---- */
  async session() { const { data, error } = await this.sb.auth.getSession(); if (error) fail(error); this.me = data && data.session ? data.session.user : null; return this.me; }
  async signUp(email, password) {
    const { data, error } = await this.sb.auth.signUp({ email: String(email).trim(), password });
    if (error) fail(error);
    this.me = data.session ? data.user : null; // بلا جلسة = يلزم تأكيد البريد
    return { needsConfirm: !data.session, user: data.user };
  }
  async signIn(email, password) { const { data, error } = await this.sb.auth.signInWithPassword({ email: String(email).trim(), password }); if (error) fail(error); this.me = data.user; this.profile = null; return data.user; }
  async signOut() { await this.sb.auth.signOut(); this.me = null; this.profile = null; }
  /* ---- الملف الشخصي ---- */
  static validUsername(u) { return /^[\p{L}\p{N}_]{3,16}$/u.test(u); }
  async usernameFree(u) { if (!OnlineDB.validUsername(u)) return false; return chk(await this.sb.rpc('username_available', { u })) === true; }
  async myProfile(force) {
    if (this.profile && !force) return this.profile; if (!this.me) return null;
    const d = chk(await this.sb.from('profiles').select('*').eq('id', this.me.id).maybeSingle()); this.profile = d || null; return this.profile;
  }
  async createProfile(p) {
    if (!this.me) fail({ message: 'سجّل الدخول أولاً' });
    if (!OnlineDB.validUsername(p.username)) fail({ message: 'اسم المستخدم: 3–16 حرفاً (حروف وأرقام و _ فقط)' });
    if (!p.team_name || p.team_name.trim().length < 2) fail({ message: 'اسم الفريق قصير' });
    const row = { id: this.me.id, username: p.username.trim(), team_name: p.team_name.trim().slice(0, 24), logo: p.logo || null, c1: p.c1, c2: p.c2 };
    const { data, error } = await this.sb.from('profiles').insert(row).select().single();
    if (error) { if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) fail({ message: 'اسم المستخدم مستخدم من قبل — اختر اسماً آخر' }); fail(error); }
    this.profile = data; return data;
  }
  async updateProfile(f) { const d = chk(await this.sb.from('profiles').update(f).eq('id', this.me.id).select().single()); this.profile = d; return d; }
  async profilesByIds(ids) { if (!ids.length) return {}; const d = chk(await this.sb.from('profiles').select('*').in('id', ids)); const o = {}; d.forEach(p => o[p.id] = p); return o; }
  async search(q) {
    q = String(q || '').trim().replace(/[%_,()]/g, ''); if (!q) return [];
    return chk(await this.sb.from('profiles').select('*').or('username.ilike.%' + q + '%,team_name.ilike.%' + q + '%').neq('id', this.me.id).limit(20));
  }
  async bumpStats(win) { try { await this.sb.rpc('bump_stats', { p_win: !!win }); } catch (e) { } }
  /* ---- البطولات ---- */
  async createTournament(name, size, format) { return chk(await this.sb.rpc('create_tournament', { p_name: name, p_size: size, p_format: format })); }
  async joinTournament(code) { return chk(await this.sb.rpc('join_tournament', { p_code: String(code).trim().toUpperCase() })); }
  async myTournaments() {
    const tp = chk(await this.sb.from('tournament_players').select('tournament_id').eq('user_id', this.me.id));
    const ids = tp.map(x => x.tournament_id); if (!ids.length) return [];
    return chk(await this.sb.from('tournaments').select('*').in('id', ids).order('created_at', { ascending: false }));
  }
  async tournamentFull(id) {
    const t = chk(await this.sb.from('tournaments').select('*').eq('id', id).single());
    const tp = chk(await this.sb.from('tournament_players').select('user_id').eq('tournament_id', id));
    const prof = await this.profilesByIds(tp.map(x => x.user_id));
    const matches = chk(await this.sb.from('tmatches').select('*').eq('tournament_id', id));
    return { t, players: tp.map(x => prof[x.user_id]).filter(Boolean), matches };
  }
  /* المنشئ يبدأ البطولة بعد اكتمال العدد */
  async startTournament(t, players) {
    if (t.owner !== this.me.id) fail({ message: 'المنشئ فقط يبدأ البطولة' });
    if (players.length !== t.size) fail({ message: 'لم يكتمل العدد بعد (' + players.length + '/' + t.size + ')' });
    const rows = KL.Bracket.initial(t.format, t.size, players.map(p => p.id)).map(r => Object.assign({ tournament_id: t.id }, r));
    const { error } = await this.sb.from('tmatches').insert(rows); if (error && error.code !== '23505') fail(error);
    chk(await this.sb.from('tournaments').update({ status: 'running' }).eq('id', t.id).select());
  }
  /* تسجيل نتيجة مباراة (يستدعيها مضيف المباراة = اللاعب a) */
  async reportResult(m, r) {
    const aWon = r.winner === 0, row = { sa: r.score[0], sb: r.score[1], pa: r.pso ? r.pso[0] : null, pb: r.pso ? r.pso[1] : null, winner: aWon ? m.a : m.b, status: 'done' };
    const d = chk(await this.sb.from('tmatches').update(row).eq('id', m.id).eq('status', 'pending').select()); return d;
  }
  /* التقدّم للمرحلة التالية — آمن للتكرار ويمكن لأي مشارك استدعاؤه */
  async advance(tid) {
    const { t, players, matches } = await this.tournamentFull(tid); if (t.status === 'done') return { done: true };
    const res = KL.Bracket.next(t.format, t.size, players.map(p => p.id), matches);
    if (res.rows && res.rows.length) {
      const exists = r => matches.some(m => m.stage === r.stage && m.round === r.round && m.slot === r.slot && (m.grp == null ? -1 : m.grp) === (r.grp == null ? -1 : r.grp));
      const rows = res.rows.filter(r => !exists(r)).map(r => Object.assign({ tournament_id: tid }, r));
      if (rows.length) { const { error } = await this.sb.from('tmatches').insert(rows); if (error && error.code !== '23505') fail(error); }
    }
    if (res.done) { chk(await this.sb.from('tournaments').update({ status: 'done', champion: res.champion }).eq('id', tid).select()); }
    return res;
  }
}
KL.OnlineDB = OnlineDB;
})();

;
/* ===== online.js ===== */
/* ============================================================
   KING'S LEAGUE 3D — online.js
   واجهة الأونلاين: تسجيل، ملف شخصي، بحث، تحدّي، بطولات، غرف المباريات
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';
let api = null, db = null, sb = null, lobby = null, inbox = null, online = {}, curRoom = null;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const okLogo = s => typeof s === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(s) && s.length < 150000;
const logoImg = (p, cls) => '<img class="' + (cls || 'ol-lg') + '" src="' + (okLogo(p.logo) ? p.logo : KL.badge(KL.onlineTeam(p), 96)) + '" alt="">';
const FORMAT_AR = { groups: 'مجموعات', league: 'دوري', knockout: 'خروج المغلوب' };
const STATUS_AR = { open: 'مفتوحة للانضمام', running: 'جارية', done: 'انتهت' };
const SCR = 'scrOnline';
const view = html => { KL.ui.screen(SCR, html); api.show(SCR); };
const back = (fn, label) => '<div class="topbar"><button class="btn sm" id="olBack">→ ' + (label || 'رجوع') + '</button><h2 id="olTitle"></h2><span id="olChip" class="chip"></span></div>';
function bindBack(fn) { const b = $('olBack'); if (b) b.onclick = fn; }
function title(t, chip) { $('olTitle').textContent = t; if (chip != null) $('olChip').innerHTML = chip; }
/* مهلة زمنية لأي طلب شبكة حتى لا تبقى رسالة "لحظة" عالقة */
const TMO = (p, ms, msg) => { let t; return Promise.race([Promise.resolve(p), new Promise((_, rj) => { t = setTimeout(() => rj(new Error(msg || 'انتهت مهلة الاتصال — تحقق من الإنترنت ومن تشغيل supabase.sql في مشروعك')), ms || 20000); })]).finally(() => clearTimeout(t)); };
const wrap = async (fn, busyTxt) => { try { if (busyTxt) api.busy(true, busyTxt); return await TMO(fn(), 25000); } catch (e) { api.toast('⚠ ' + (e.message || e), 4000); return undefined; } finally { if (busyTxt) api.busy(false); } };

/* ---------------- تحميل Supabase ---------------- */
function loadScript(urls) {
  return new Promise((ok, bad) => { let i = 0; (function n() { if (window.supabase && window.supabase.createClient) return ok(); if (i >= urls.length) return bad(new Error('تعذّر تحميل مكتبة Supabase — تحقق من الإنترنت')); const s = document.createElement('script'); let done = false; const nx = () => { if (done) return; done = true; n(); }; s.src = urls[i++]; s.onload = () => { if (done) return; done = true; ok(); }; s.onerror = nx; setTimeout(nx, 9000); document.head.appendChild(s); })(); });
}
async function ensureClient() {
  if (sb) return true; const c = window.KL_CONFIG || {};
  if (!c.SUPABASE_URL || !c.SUPABASE_ANON_KEY) { setupScreen(); return false; }
  if (!window.KL_SB_FACTORY) await loadScript(['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js', 'https://unpkg.com/@supabase/supabase-js@2.57.4/dist/umd/supabase.js', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.55.0/dist/umd/supabase.js', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js', 'https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js', 'supabase.js']);
  sb = window.KL_SB_FACTORY ? window.KL_SB_FACTORY() : window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, { realtime: { params: { eventsPerSecond: 40 } }, auth: { persistSession: true, autoRefreshToken: true, lock: (n, t, fn) => fn() } });
  db = new KL.OnlineDB(sb); KL.db = db; return true;
}
function setupScreen() {
  view(back() + '<div class="ol-box"><h3>⚙️ إعداد الأونلاين (مرة واحدة)</h3><ol class="ol-steps"><li>أنشئ مشروعاً مجانياً في <b>supabase.com</b>.</li><li>افتح <b>SQL Editor</b> والصق محتوى ملف <b>supabase.sql</b> ثم اضغط Run.</li><li>من <b>Authentication ← Providers ← Email</b> أوقف خيار <b>Confirm email</b> (ليدخل اللاعب فوراً).</li><li>من <b>Project Settings ← API</b> انسخ <b>Project URL</b> و <b>anon public key</b> والصقهما داخل ملف <b>config.js</b>.</li><li>ارفع الملفات على استضافة (HTTPS) وافتح اللعبة.</li></ol></div>');
  title('أونلاين'); bindBack(() => api.show('scrHome'));
}

/* ---------------- الدخول ---------------- */
let hubKind = null;
async function openOnline(kind) {
  hubKind = kind || null;
  const ok = await wrap(ensureClient, 'جاري التحميل…'); if (!ok) return;
  const me = await wrap(() => db.session()); if (!me) return authScreen();
  const p = await wrap(() => db.myProfile(), 'جاري التحميل…'); if (!p) return profileScreen(false);
  startPresence(p); hub();
}
function authScreen(mode) {
  mode = mode || 'in';
  view(back() + '<div class="ol-box"><div class="cr-pos" id="auTabs"><button data-m="in" class="' + (mode === 'in' ? 'on' : '') + '">تسجيل الدخول</button><button data-m="up" class="' + (mode === 'up' ? 'on' : '') + '">حساب جديد</button></div>' +
    '<label>البريد الإلكتروني<input id="auMail" type="email" autocomplete="email" dir="ltr" placeholder="name@example.com"></label>' +
    '<label>كلمة المرور<input id="auPass" type="password" autocomplete="' + (mode === 'in' ? 'current-password' : 'new-password') + '" dir="ltr" placeholder="6 أحرف على الأقل"></label>' +
    '<button class="btn big gold" id="auGo">' + (mode === 'in' ? 'دخول' : 'إنشاء الحساب') + '</button><p class="small" id="auMsg"></p></div>');
  title('🌐 أونلاين'); bindBack(() => api.show('scrHome'));
  document.querySelectorAll('#auTabs button').forEach(b => b.onclick = () => authScreen(b.dataset.m));
  $('auGo').onclick = async () => {
    const mail = $('auMail').value, pass = $('auPass').value; if (!mail || pass.length < 6) { $('auMsg').textContent = 'اكتب البريد وكلمة مرور من 6 أحرف على الأقل'; return; }
    try {
      api.busy(true, 'لحظة…');
      if (mode === 'up') { const r = await TMO(db.signUp(mail, pass), 25000); if (r.needsConfirm) { api.busy(false); $('auMsg').textContent = '✅ أُنشئ الحساب. أكّد بريدك من الرسالة ثم سجّل الدخول.'; return; } }
      else await TMO(db.signIn(mail, pass), 25000);
      api.busy(false); openOnline();
    } catch (e) { api.busy(false); $('auMsg').textContent = '⚠ ' + e.message; }
  };
}

/* ---------------- الملف الشخصي ---------------- */
function resizeLogo(file) {
  return new Promise((ok, bad) => {
    if (!file || !/^image\//.test(file.type)) return bad(new Error('اختر صورة'));
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), s = Math.min(im.width, im.height);
      x.clearRect(0, 0, 128, 128); x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 128, 128); URL.revokeObjectURL(url);
      let d = c.toDataURL('image/webp', 0.85); if (!/^data:image\/webp/.test(d)) d = c.toDataURL('image/png');
      if (d.length > 120000) d = c.toDataURL('image/jpeg', 0.7); ok(d);
    };
    im.onerror = () => { URL.revokeObjectURL(url); bad(new Error('تعذّر قراءة الصورة')); }; im.src = url;
  });
}
function profileScreen(edit) {
  const P = edit ? db.profile : {}; let logo = P.logo || null, free = !!edit, tm = null;
  view(back() + '<div class="ol-box"><h3>' + (edit ? 'تعديل الفريق' : 'أنشئ فريقك') + '</h3>' +
    (edit ? '<p class="small">اسم المستخدم: <b>' + esc(P.username) + '</b> (لا يتغيّر)</p>' : '<label>اسم المستخدم (فريد — لا يتكرر)<input id="pfUser" maxlength="16" dir="ltr" placeholder="مثال: omar_10" autocomplete="off"><small id="pfUserMsg" class="small"></small></label>') +
    '<label>اسم الفريق<input id="pfTeam" maxlength="24" value="' + esc(P.team_name || '') + '"></label>' +
    '<label>شعار الفريق (من معرض الصور)<div class="pf-logo"><img id="pfLogo" alt=""><button class="btn sm" id="pfPick" type="button">📷 اختيار صورة</button><input id="pfFile" type="file" accept="image/*" hidden></div></label>' +
    '<div class="pf-cols"><label>لون القميص<input id="pfC1" type="color" value="' + (P.c1 || '#19c3e6') + '"></label><label>لون الشورت<input id="pfC2" type="color" value="' + (P.c2 || '#0b1b3a') + '"></label></div>' +
    '<button class="btn big gold" id="pfSave">💾 حفظ</button><p class="small" id="pfMsg"></p></div>');
  title(edit ? 'فريقي' : 'ملف اللاعب'); bindBack(() => edit ? hub() : api.show('scrHome'), edit ? 'رجوع' : 'القائمة');
  const showLogo = () => { $('pfLogo').src = logo || KL.badge({ id: 'x', name: $('pfTeam').value || 'T', short: ($('pfTeam').value || 'T').slice(0, 3), kits: { home: KL.kit($('pfC1').value, $('pfC2').value) } }, 96); };
  showLogo(); $('pfC1').oninput = $('pfC2').oninput = $('pfTeam').oninput = () => { if (!logo) showLogo(); };
  $('pfPick').onclick = () => $('pfFile').click();
  $('pfFile').onchange = async () => { try { logo = await resizeLogo($('pfFile').files[0]); showLogo(); } catch (e) { $('pfMsg').textContent = '⚠ ' + e.message; } };
  if (!edit) $('pfUser').oninput = () => {
    const v = $('pfUser').value.trim(), m = $('pfUserMsg'); clearTimeout(tm); free = false;
    if (!KL.OnlineDB.validUsername(v)) { m.textContent = '3–16 حرفاً: حروف وأرقام و _ فقط'; m.style.color = ''; return; }
    m.textContent = 'جاري التحقق…'; tm = setTimeout(async () => { try { free = await db.usernameFree(v); } catch (e) { free = false; } if ($('pfUser').value.trim() !== v) return; m.textContent = free ? '✅ متاح' : '❌ مستخدم — جرّب اسماً آخر'; m.style.color = free ? '#7dffb0' : '#ff7a7a'; }, 350);
  };
  $('pfSave').onclick = async () => {
    try {
      api.busy(true, 'جاري الحفظ…');
      const f = { team_name: $('pfTeam').value.trim(), logo, c1: $('pfC1').value, c2: $('pfC2').value };
      if (edit) await TMO(db.updateProfile(f), 25000); else await TMO(db.createProfile(Object.assign({ username: $('pfUser').value.trim() }, f)), 25000);
      api.busy(false); const p = db.profile; startPresence(p); hub();
    } catch (e) { api.busy(false); $('pfMsg').textContent = '⚠ ' + e.message; }
  };
}

/* ---------------- المركز ---------------- */
function hub() {
  const p = db.profile; if (!p) return profileScreen(false);
  const on = Object.keys(online).filter(k => k !== p.id).length;
  view(back() + '<div class="ol-me">' + logoImg(p, 'ol-lg big') + '<div><h1>' + esc(p.team_name) + '</h1><p>@' + esc(p.username) + ' · ' + p.played + ' مباراة · ' + p.wins + ' فوز</p></div></div>' +
    '<div class="ol-grid">' + (hubKind === 'tour' ? '' : '<button class="btn big gold" id="hSearch"><b>🔍 ابحث عن لاعب</b><small>' + on + ' متصل الآن</small></button>' +
    '<button class="btn big purple" id="hRandom"><b>🎲 مباراة عشوائية</b><small>تحدَّ لاعباً متصلاً</small></button>') + (hubKind === 'match' ? '' : '<button class="btn big" id="hCreate"><b>🏆 إنشاء بطولة</b><small>2 / 4 / 8 / 16 مشارك</small></button>' +
    '<button class="btn big" id="hJoin"><b>🎟 الانضمام ببطولة</b><small>أدخل كود البطولة</small></button>' +
    '<button class="btn big" id="hMine"><b>📋 بطولاتي</b><small>عرض بطولاتي الجارية</small></button>') + '<button class="btn big" id="hEdit"><b>✏️ تعديل فريقي</b><small>الاسم والشعار والألوان</small></button></div>' +
    '<div class="dv-actions"><button class="btn red" id="hOut">تسجيل الخروج</button></div>');
  title('🌐 أونلاين', '@' + esc(p.username)); bindBack(() => api.show('scrHome'), 'القائمة');
  if ($('hSearch')) $('hSearch').onclick = searchScreen; if ($('hCreate')) { $('hCreate').onclick = createScreen; $('hJoin').onclick = joinScreen; $('hMine').onclick = mineScreen; } $('hEdit').onclick = () => profileScreen(true);
  if ($('hRandom')) $('hRandom').onclick = () => { const ids = Object.keys(online).filter(k => k !== p.id && !online[k].busy); if (!ids.length) { api.toast('لا يوجد لاعبون متصلون الآن — جرّب البحث بالاسم', 3500); return; } challenge(online[ids[Math.floor(Math.random() * ids.length)]]); };
  $('hOut').onclick = async () => { stopPresence(); await db.signOut(); api.show('scrHome'); };
}

/* ---------------- الحضور + الدعوات ---------------- */
function startPresence(p) {
  if (lobby) return;
  const me = { id: p.id, username: p.username, team_name: p.team_name };
  lobby = sb.channel('kl-lobby', { config: { presence: { key: p.id } } });
  lobby.on('presence', { event: 'sync' }, () => { const st = lobby.presenceState(), o = {}; Object.keys(st).forEach(k => { const v = st[k][st[k].length - 1]; if (v) o[k] = v; }); online = o; });
  lobby.subscribe(s => { if (s === 'SUBSCRIBED') lobby.track(me); });
  inbox = sb.channel('inbox:' + p.id);
  inbox.on('broadcast', { event: 'invite' }, ({ payload }) => onInvite(payload));
  inbox.on('broadcast', { event: 'decline' }, ({ payload }) => { if (curRoom && curRoom.id === payload.room) { api.toast('الخصم رفض التحدّي', 3000); abortRoom(); } });
  inbox.subscribe();
}
function stopPresence() { try { if (lobby) sb.removeChannel(lobby); if (inbox) sb.removeChannel(inbox); } catch (e) { } lobby = inbox = null; online = {}; }
async function sendTo(uid, event, payload) {
  const ch = sb.channel('inbox:' + uid); await new Promise(ok => { ch.subscribe(s => { if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') ok(); }); setTimeout(ok, 4000); });
  try { await ch.send({ type: 'broadcast', event, payload }); } catch (e) { } setTimeout(() => sb.removeChannel(ch), 1500);
}
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'r' + Date.now() + Math.random().toString(16).slice(2));
async function challenge(target) {
  if (curRoom) return; const me = db.profile, room = uuid();
  const opp = (await db.profilesByIds([target.id]))[target.id]; if (!opp) { api.toast('اللاعب غير موجود'); return; }
  api.toast('📨 أُرسل التحدّي إلى ' + opp.username + '…', 3000);
  sendTo(opp.id, 'invite', { from: { id: me.id, username: me.username, team_name: me.team_name }, room });
  playRoom({ room, role: 'host', opp, ctx: { kind: 'friendly' }, wait: 60 });
}
function onInvite(inv) {
  if (!inv || !inv.from || curRoom) { if (inv && inv.from) sendTo(inv.from.id, 'decline', { room: inv.room }); return; }
  api.dialog('⚔️ تحدّي من ' + esc(inv.from.username), 'فريق «' + esc(inv.from.team_name) + '» يتحداك لمباراة ودية.', [
    { t: 'قبول', cls: 'gold', f: async () => { const opp = (await db.profilesByIds([inv.from.id]))[inv.from.id]; if (opp) playRoom({ room: inv.room, role: 'guest', opp, ctx: { kind: 'friendly' }, wait: 40 }); } },
    { t: 'رفض', f: () => sendTo(inv.from.id, 'decline', { room: inv.room }) }]);
}

/* ---------------- البحث ---------------- */
function searchScreen() {
  view(back() + '<div class="ol-box"><label>ابحث باسم المستخدم أو الفريق<input id="seQ" placeholder="اكتب حرفين على الأقل"></label><div id="seList" class="ol-list"></div></div>');
  title('🔍 البحث عن لاعب'); bindBack(hub);
  let tm; const run = async () => {
    const q = $('seQ').value; if (q.trim().length < 2) { $('seList').innerHTML = '<p class="small">اكتب جزءاً من اسم اللاعب أو فريقه</p>'; return; }
    const r = await wrap(() => db.search(q)) || []; $('seList').innerHTML = r.length ? r.map(p => '<div class="ol-row">' + logoImg(p) + '<div class="ol-n"><b>' + esc(p.team_name) + '</b><small>@' + esc(p.username) + ' · ' + p.wins + ' فوز</small></div>' + (online[p.id] ? '<em class="on">🟢 متصل</em><button class="btn sm gold" data-id="' + p.id + '">⚔️ تحدَّه</button>' : '<em>⚫ غير متصل</em>') + '</div>').join('') : '<p class="small">لا نتائج</p>';
    document.querySelectorAll('#seList [data-id]').forEach(b => b.onclick = () => challenge(online[b.dataset.id]));
  };
  $('seQ').oninput = () => { clearTimeout(tm); tm = setTimeout(run, 350); }; run();
}

/* ---------------- البطولات ---------------- */
function createScreen() {
  view(back() + '<div class="ol-box"><label>اسم البطولة<input id="crName" maxlength="40" placeholder="مثال: كأس الأصدقاء"></label>' +
    '<label>عدد المشاركين<div class="cr-pos" id="crSize"><button data-v="2">2</button><button data-v="4" class="on">4</button><button data-v="8">8</button><button data-v="16">16</button></div></label>' +
    '<label>نظام البطولة<div class="cr-pos" id="crFmt"><button data-v="groups" class="on">مجموعات</button><button data-v="league">دوري</button><button data-v="knockout">خروج المغلوب</button></div></label>' +
    '<p class="small" id="crHelp"></p><button class="btn big gold" id="crGo">✅ إنشاء البطولة</button></div>');
  title('🏆 إنشاء بطولة'); bindBack(hub);
  let size = 4, fmt = 'groups';
  const help = () => { const g = KL.groupCount(size); $('crHelp').textContent = fmt === 'groups' ? (size === 2 ? 'مباراة نهائية واحدة' : g === 1 ? 'مجموعة واحدة؛ الأول والثاني إلى النهائي' : g === 2 ? 'مجموعتان؛ الأول والثاني من كل مجموعة إلى نصف النهائي ثم النهائي' : 'أربع مجموعات؛ الأول والثاني من كل مجموعة إلى ربع النهائي ثم نصف النهائي ثم النهائي') : fmt === 'league' ? 'كل فريق يلعب ضد كل فريق مرة واحدة، والأول في الترتيب بطل' : 'من يخسر يخرج حتى النهائي'; };
  const bind = (id, set) => document.querySelectorAll('#' + id + ' button').forEach(b => b.onclick = () => { document.querySelectorAll('#' + id + ' button').forEach(x => x.classList.toggle('on', x === b)); set(b.dataset.v); help(); });
  bind('crSize', v => size = +v); bind('crFmt', v => fmt = v); help();
  $('crGo').onclick = async () => {
    const name = $('crName').value.trim(); if (name.length < 2) { api.toast('اكتب اسماً للبطولة'); return; }
    const t = await wrap(() => db.createTournament(name, size, fmt), 'جاري الإنشاء…'); if (t) tourScreen(t.id);
  };
}
function joinScreen() {
  view(back() + '<div class="ol-box"><label>كود البطولة<input id="jnCode" maxlength="6" dir="ltr" style="text-transform:uppercase;letter-spacing:6px;text-align:center;font-size:24px" placeholder="ABC123"></label><button class="btn big gold" id="jnGo">🎟 انضمام</button></div>');
  title('🎟 الانضمام ببطولة'); bindBack(hub);
  $('jnGo').onclick = async () => { const c = $('jnCode').value.trim(); if (c.length < 6) { api.toast('الكود 6 أحرف'); return; } const t = await wrap(() => db.joinTournament(c), 'جاري الانضمام…'); if (t) tourScreen(t.id); };
}
async function mineScreen() {
  view(back() + '<div class="ol-box"><div id="mnList" class="ol-list"><p class="small">جاري التحميل…</p></div></div>'); title('📋 بطولاتي'); bindBack(hub);
  const l = await wrap(() => db.myTournaments()) || [];
  $('mnList').innerHTML = l.length ? l.map(t => '<div class="ol-row" data-id="' + t.id + '"><div class="ol-n"><b>' + esc(t.name) + '</b><small>' + FORMAT_AR[t.format] + ' · ' + t.size + ' · ' + STATUS_AR[t.status] + ' · ' + esc(t.code) + '</small></div><button class="btn sm gold">فتح</button></div>').join('') : '<p class="small">لا بطولات بعد</p>';
  document.querySelectorAll('#mnList [data-id]').forEach(r => r.onclick = () => tourScreen(r.dataset.id));
}
let tourCh = null, tourTimer = null;
function leaveTour() { clearInterval(tourTimer); tourTimer = null; if (tourCh) { try { sb.removeChannel(tourCh); } catch (e) { } tourCh = null; } }
async function tourScreen(id) {
  leaveTour(); view(back() + '<div class="ol-box" id="trBody"><p class="small">جاري التحميل…</p></div>'); title('🏆 البطولة'); bindBack(() => { leaveTour(); hub(); });
  const draw = async () => {
    if (api.S.screen !== SCR || !$('trBody')) return;
    const f = await wrap(() => db.tournamentFull(id)); if (!f) return; renderTour(f);
  };
  await draw(); tourTimer = setInterval(draw, 6000);
  try { tourCh = sb.channel('t:' + id); ['tmatches', 'tournament_players', 'tournaments'].forEach(tb => tourCh.on('postgres_changes', { event: '*', schema: 'public', table: tb }, () => draw())); tourCh.subscribe(); } catch (e) { }
}
function renderTour(f) {
  const { t, players, matches } = f, me = db.profile, P = {}; players.forEach(p => P[p.id] = p);
  const nm = id => P[id] ? esc(P[id].team_name) : '؟';
  let h = '<div class="tr-head"><div><h2>' + esc(t.name) + '</h2><p class="small">' + FORMAT_AR[t.format] + ' · ' + t.size + ' مشاركين · ' + STATUS_AR[t.status] + '</p></div><div class="tr-code" id="trCode">' + esc(t.code) + '<small>اضغط للنسخ</small></div></div>';
  if (t.status === 'open') {
    h += '<h3>المشاركون (' + players.length + '/' + t.size + ')</h3><div class="ol-list">' + players.map(p => '<div class="ol-row">' + logoImg(p) + '<div class="ol-n"><b>' + esc(p.team_name) + '</b><small>@' + esc(p.username) + (p.id === t.owner ? ' · 👑 المنشئ' : '') + '</small></div></div>').join('') + '</div>';
    h += t.owner === me.id ? '<button class="btn big gold" id="trStart"' + (players.length === t.size ? '' : ' disabled') + '>▶ ابدأ البطولة</button><p class="small">أرسل الكود <b>' + esc(t.code) + '</b> لأصدقائك. يبدأ المنشئ البطولة عند اكتمال العدد.</p>' : '<p class="small">بانتظار اكتمال العدد وبدء المنشئ للبطولة…</p>';
  } else {
    const ids = players.map(p => p.id), tables = [];
    if (t.format === 'league') tables.push(['الترتيب', KL.Bracket.standings(matches, ids, 'league', null)]);
    else if (t.format === 'groups') { const g = KL.groupCount(t.size); for (let k = 0; k < g; k++) { const gi = KL.Bracket.groupIds(matches, k); if (gi.length) tables.push(['المجموعة ' + 'ABCD'[k], KL.Bracket.standings(matches, gi, 'group', k)]); } }
    h += tables.map(([n, tb]) => '<h3>' + n + '</h3><table class="ol-tb"><tr><th>#</th><th>الفريق</th><th>لعب</th><th>+/-</th><th>نقاط</th></tr>' + tb.map((r, i) => '<tr class="' + (r.id === me.id ? 'me' : '') + '"><td>' + (i + 1) + '</td><td>' + nm(r.id) + '</td><td>' + r.p + '</td><td>' + r.gd + '</td><td><b>' + r.pts + '</b></td></tr>').join('') + '</table>').join('');
    if (t.status === 'done') h += '<div class="tr-champ">🏆 البطل: <b>' + nm(t.champion) + '</b></div>';
    const order = ['group', 'league', 'r16', 'qf', 'sf', 'final'];
    h += order.filter(s => matches.some(m => m.stage === s)).map(s => '<h3>' + KL.Bracket.stageName(s) + '</h3><div class="ol-list">' + matches.filter(m => m.stage === s).sort((a, b) => a.round - b.round || a.slot - b.slot).map(m => {
      const mine = m.status === 'pending' && (m.a === me.id || m.b === me.id), score = m.status === 'done' ? '<b class="sc">' + m.sa + ' - ' + m.sb + (m.pa != null && m.sa === m.sb ? ' (' + m.pa + '-' + m.pb + ')' : '') + '</b>' : '<em>' + (m.grp != null ? 'م' + 'ABCD'[m.grp] : '') + '</em>';
      return '<div class="ol-row ' + (mine ? 'mine' : '') + '"><div class="ol-n"><b>' + nm(m.a) + '</b> × <b>' + nm(m.b) + '</b></div>' + score + (mine ? '<button class="btn sm gold" data-m="' + m.id + '">▶ ادخل المباراة</button>' : '') + '</div>';
    }).join('') + '</div>').join('');
  }
  $('trBody').innerHTML = h;
  $('trCode').onclick = () => { try { navigator.clipboard.writeText(t.code); api.toast('نُسخ الكود ' + t.code); } catch (e) { api.toast('الكود: ' + t.code); } };
  const st = $('trStart'); if (st) st.onclick = async () => { await wrap(() => db.startTournament(t, players), 'جاري البدء…'); tourScreen(t.id); };
  document.querySelectorAll('#trBody [data-m]').forEach(b => b.onclick = () => { const m = matches.find(x => x.id === b.dataset.m), oppId = m.a === me.id ? m.b : m.a; leaveTour(); playRoom({ room: m.id, role: m.a === me.id ? 'host' : 'guest', opp: P[oppId], ctx: { kind: 'tour', tid: t.id, match: m }, wait: 180 }); });
}

/* ---------------- غرفة المباراة ---------------- */
function abortRoom() { if (!curRoom) return; const r = curRoom; curRoom = null; clearInterval(r.wd); clearTimeout(r.to); try { sb.removeChannel(r.ch); } catch (e) { } api.busy(false); }
function playRoom(o) {
  if (curRoom) return; const me = db.profile, opp = o.opp, role = o.role;
  const myT = KL.onlineTeam(me), opT = KL.onlineTeam(opp);
  const R = curRoom = { id: o.room, role, ch: null, ready: {}, started: false, lastMsg: Date.now(), peer: false };
  const ch = R.ch = sb.channel('room:' + o.room, { config: { broadcast: { self: false, ack: false }, presence: { key: me.id } } });
  const send = (e, p) => { try { ch.send({ type: 'broadcast', event: e, payload: p }); } catch (x) { } };
  R.send = send;
  api.busy(true, role === 'host' ? 'بانتظار ' + opp.username + '…' : 'جاري الاتصال بالمباراة…');
  const bz = $('busy'); const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn red'; cancelBtn.textContent = 'إلغاء'; cancelBtn.id = 'busyCancel'; bz.querySelector('.modal').appendChild(cancelBtn);
  const cleanupBtn = () => { const c = $('busyCancel'); if (c) c.remove(); };
  cancelBtn.onclick = () => { cleanupBtn(); abortRoom(); if (o.ctx.kind === 'tour') tourScreen(o.ctx.tid); else hub(); };
  R.to = setTimeout(() => { if (curRoom === R && !R.started) { cleanupBtn(); abortRoom(); api.toast('انتهت مهلة الانتظار', 3500); hub(); } }, (o.wait || 60) * 1000);
  const peers = () => { const st = ch.presenceState(); return Object.keys(st).filter(k => k !== me.id); };
  const maybeStart = () => {
    if (R.started || !R.lu || !R.ready.lu) return;
    if (role !== 'host') return;
    R.started = true; const kits = KL.pickKits(myT, opT);
    send('start', { kits, lus: [R.lu, R.ready.lu] });
    launch(kits, [R.lu, R.ready.lu]);
  };
  const launch = (kits, lus) => {
    cleanupBtn(); api.busy(false); clearTimeout(R.to);
    const hostSide = role === 'host';
    const A = hostSide ? myT : opT, B = hostSide ? opT : myT; // A = المضيف دائماً
    const ctx = { online: true, kits: hostSide ? kits : [kits[1], kits[0]], onEnd: r => endMatch(r), onQuit: () => forfeit(), build: (kk, lu) => hostSide ? new KL.HostMatch({ teams: [A, B], kits: kk, lineups: [lus[0], lus[1]], secPerMin: +api.S.cfg.spm, diff: 0.7 }, { send }) : new KL.MirrorMatch({ teams: [myT, opT], kits: kk, lineups: [lus[1], lus[0]] }, { send }) };
    ctx.match = null;
    R.hm = null;
    api.startRaw(hostSide ? A : myT, hostSide ? B : opT, ctx, hostSide ? lus[0] : lus[1]);
    // اربط الأحداث الواردة بالـ Match بعد إنشائه
    setTimeout(() => { R.m = api.S.match; }, 0);
    R.wd = setInterval(() => { if (Date.now() - R.lastMsg > 15000 && api.S.match && api.S.match.mode !== 'ended') lost(); }, 2000);
  };
  const lost = () => { if (R.lostShown) return; R.lostShown = true; api.dialog('انقطع الاتصال', 'لم تصل بيانات من الخصم منذ 15 ثانية.', role === 'host' ? [{ t: 'اعتبار الفوز لي', cls: 'gold', f: () => { endMatch({ score: [1, 0], winner: 0, pso: null, forfeit: true }, true); } }, { t: 'انتظار', f: () => { R.lostShown = false; R.lastMsg = Date.now(); } }] : [{ t: 'خروج', cls: 'red', f: () => { api.cleanupMatch(); closeRoom(); hub(); } }]); };
  const closeRoom = () => { clearInterval(R.wd); setTimeout(() => { try { sb.removeChannel(ch); } catch (e) { } }, 1200); if (curRoom === R) curRoom = null; };
  const forfeit = () => { send('bye', { forfeit: true }); if (role === 'host' && o.ctx.kind === 'tour') endMatch({ score: [0, 1], winner: 1, pso: null, forfeit: true }, true); else { db.bumpStats(false); closeRoom(); if (o.ctx.kind === 'tour') tourScreen(o.ctx.tid); else hub(); } };
  const endMatch = async (r, noScreen) => {
    // r من منظور هذا اللاعب (الفريق 0 = أنا) ما لم يكن انسحاباً مصطنعاً للمضيف
    const hostSide = role === 'host', win = r.winner === 0;
    db.bumpStats(win);
    if (hostSide && o.ctx.kind === 'tour') { try { await db.reportResult(o.ctx.match, r); await db.advance(o.ctx.tid); } catch (e) { api.toast('⚠ ' + e.message, 4000); } }
    if (noScreen) api.cleanupMatch();
    closeRoom(); if (o.ctx.kind === 'tour') tourScreen(o.ctx.tid); else hub();
  };
  ch.on('presence', { event: 'sync' }, () => { R.peer = peers().length > 0; });
  ['ready', 'start', 'bye'].forEach(e => ch.on('broadcast', { event: e }, ({ payload }) => {
    R.lastMsg = Date.now();
    if (e === 'ready') { R.ready.lu = payload.lu; maybeStart(); }
    else if (e === 'start' && role === 'guest' && !R.started) { R.started = true; launch(payload.kits, payload.lus); }
    else if (e === 'bye' && R.m && R.m.mode !== 'ended') { if (role === 'host') { endMatch({ score: [1, 0], winner: 0, pso: null, forfeit: true }, true); } else { api.cleanupMatch(); closeRoom(); api.toast('الخصم انسحب', 3000); hub(); } }
  }));
  ch.on('broadcast', { event: 'snap' }, ({ payload }) => { R.lastMsg = Date.now(); const m = api.S.match; if (m && m.onSnap) m.onSnap(payload); });
  ch.on('broadcast', { event: 'inp' }, ({ payload }) => { R.lastMsg = Date.now(); const m = api.S.match; if (m && m.onRemote) m.onRemote(payload); });
  ch.on('broadcast', { event: 'act' }, ({ payload }) => { R.lastMsg = Date.now(); const m = api.S.match; if (m && m.onAct) m.onAct(payload); });
  let lineupShown = false;
  const pickLineup = () => {
    if (lineupShown) return; lineupShown = true; api.busy(false); cleanupBtn();
    KL.openLineup(myT, { cam: +api.S.cfg.cam, names: !!+api.S.cfg.names }, r => {
      api.S.cfg.cam = r.cam; api.S.cfg.names = r.names ? 1 : 0; api.store.set('kl_cfg', api.S.cfg);
      R.lu = r.lu; send('ready', { lu: r.lu });
      if (role === 'host') maybeStart(); else api.busy(true, 'بانتظار المضيف لبدء المباراة…');
    });
  };
  ch.subscribe(async s => {
    if (s === 'SUBSCRIBED') { await ch.track({ id: me.id }); send('hello', {}); }
  });
  // انتقل لاختيار التشكيلة عندما يتواجد الطرفان في الغرفة
  const iv = setInterval(() => { if (curRoom !== R) { clearInterval(iv); return; } if (R.peer && !lineupShown) { clearInterval(iv); pickLineup(); } }, 300);
}

KL.initModes = (function (prev) {
  return function (a) {
    api = a; KL.ui.addHome('', '', '', () => openOnline('match'), 'olm'); KL.ui.addHome('', '', '', () => openOnline('tour'), 'ont');
    if (prev) prev(a);
  };
})(KL.initModes);
KL._online = { get db() { return db; }, playRoom, renderTour };
})();

;
/* ===== divisions.js ===== */
/* ============================================================
   KING'S LEAGUE 3D — divisions.js
   بوابة الوضع الأفقي + نظام الدفيجنات الخمسة (مباريات مصنّفة)
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';
KL.ui = KL.ui || {};
/* إنشاء شاشة ديناميكية */
KL.ui.screen = function (id, html) { let e = document.getElementById(id); if (!e) { e = document.createElement('div'); e.id = id; e.className = 'screen'; document.body.appendChild(e); } if (html != null) e.innerHTML = html; return e; };
KL.ui.acts = KL.ui.acts || {};
KL.ui.addHome = function (label, sub, cls, fn, key) { if (key) KL.ui.acts[key] = fn; };

/* ---------------- بوابة الوضع الأفقي ---------------- */
function initGate() {
  const g = document.createElement('div'); g.id = 'gate';
  g.innerHTML = '<div class="gate-in"><div class="gate-ico">📱↻</div><h2>أدر هاتفك للوضع الأفقي</h2><p>اللعبة مصممة للشاشة العرضية فقط</p><button class="btn gold" id="gateBtn">⛶ ملء الشاشة + قفل الوضع الأفقي</button></div>';
  document.body.appendChild(g);
  const lock = () => { try { const el = document.documentElement; const fr = (el.requestFullscreen || el.webkitRequestFullscreen || function () { return Promise.resolve(); }).call(el); if (fr && fr.catch) fr.catch(() => { }); } catch (e) { } try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } };
  document.getElementById('gateBtn').onclick = lock;
  const upd = () => { g.classList.toggle('on', window.innerHeight > window.innerWidth * 1.02); };
  window.addEventListener('resize', upd); window.addEventListener('orientationchange', upd); upd();
}

/* ---------------- الدفيجنات ---------------- */
// الترتيب من الأدنى إلى الأعلى: هاوي (5) ← محترف (4) ← عالمي (3) ← أسطوري (2) ← أيقوني (1)
KL.DIVS = [
  { id: 'amateur', ar: 'هاوي', en: 'AMATEUR', rank: 5, need: 15, diff: 0.35, col: '#7fd6a2', logo: 'https://i.ibb.co/679PTtgh/Picsart-26-10-28-18-17-26-436.webp' },
  { id: 'pro', ar: 'محترف', en: 'PRO', rank: 4, need: 20, diff: 0.6, col: '#5aa9ff', logo: 'https://i.ibb.co/XrkFs6nH/Picsart-26-10-28-18-17-57-235.webp' },
  { id: 'world', ar: 'عالمي', en: 'WORLD CLASS', rank: 3, need: 20, diff: 0.8, col: '#b57bff', logo: 'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/59d15c9c-4686-4959-95e5-a12dc9cdac40.jpg' },
  { id: 'legend', ar: 'أسطوري', en: 'LEGENDARY', rank: 2, need: 20, diff: 0.95, col: '#ff9f3a', logo: 'https://i.ibb.co/7txWQyfp/Picsart-26-10-28-18-35-19-595.webp' },
  { id: 'iconic', ar: 'أيقوني', en: 'ICONIC', rank: 1, need: 25, diff: 1.08, col: '#ffdf00', logo: 'https://i.ibb.co/KcbHvtMP/Picsart-26-10-28-18-35-55-284.webp' }
];
KL.divBadge = function (d, size) { // شعار بديل مولّد إن تعذّر تحميل الصورة
  const c = document.createElement('canvas'); c.width = c.height = size || 128; const x = c.getContext('2d'), s = c.width;
  x.fillStyle = d.col; x.beginPath(); x.moveTo(s * .5, s * .04); x.lineTo(s * .92, s * .22); x.lineTo(s * .82, s * .78); x.lineTo(s * .5, s * .96); x.lineTo(s * .18, s * .78); x.lineTo(s * .08, s * .22); x.closePath(); x.fill();
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(s * .5, s * .48, s * .26, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.font = '900 ' + (s * .3) + 'px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(d.rank), s * .5, s * .5);
  return c.toDataURL();
};
const DIV_FILE = { amateur: 'be_button', pro: 'mh_button', world: 'wr_button', legend: 'le_button', iconic: 'ic_button' };
KL.divErr = (im, id) => { const d = KL.DIVS.find(x => x.id === id); if (d && !im.dataset.f && im.src.indexOf('assets/') >= 0) { im.dataset.f = 1; im.src = d.logo; } else { im.onerror = null; im.src = KL.divBadge(d); } };
const dimg = (d, cls) => '<img class="' + (cls || 'dv-logo') + '" src="assets/' + DIV_FILE[d.id] + '.png" alt="" onerror="KL.divErr(this,\'' + d.id + '\')">';
let api = null, st = null;
const load = () => { const s = api.store.get('kl_div', null); return s && s.tier >= 0 && s.tier < 5 ? s : { tier: 0, wins: 0, played: 0, lost: 0, team: null, done: false }; };
const save = () => api.store.set('kl_div', st);

function render() {
  const E = KL.ui.screen('scrDiv'), cur = KL.DIVS[st.tier], pct = Math.min(100, Math.round(st.wins / cur.need * 100));
  let list = KL.DIVS.map((d, i) => '<div class="dv-item ' + (i < st.tier || st.done ? 'done' : i === st.tier ? 'cur' : 'lock') + '" style="--c:' + d.col + '">' + dimg(d, 'dv-mini') + '<b>' + d.ar + '</b><small>' + d.need + ' فوز</small><em>' + (i < st.tier || st.done ? '✔' : i === st.tier ? '▶' : '🔒') + '</em></div>').join('');
  E.innerHTML = '<div class="topbar"><button class="btn sm" id="dvBack">→ القائمة</button><h2>🏅 الدفيجنات</h2><span class="chip">' + st.played + ' مباراة</span></div>' +
    '<div class="dv-hero" style="--c:' + cur.col + '">' + dimg(cur) + '<div class="dv-txt"><small>دفيجن ' + cur.rank + '</small><h1>' + cur.ar + '</h1><span>' + cur.en + '</span></div></div>' +
    '<div class="dv-bar"><i style="width:' + pct + '%"></i><b>🏆 ' + st.wins + ' / ' + cur.need + '</b></div>' +
    '<p class="small" style="text-align:center">اربح ' + cur.need + ' مباراة في هذا الدفيجن لتصعد للتالي — الخصوم أقوى كلما صعدت.</p>' +
    '<div class="dv-actions"><button class="btn big gold" id="dvPlay">⚽ ' + (st.done ? 'العب مباراة (أيقوني)' : 'العب مباراة مصنّفة') + '</button><button class="btn" id="dvTeam">🔁 فريقي: ' + (st.team ? api.esc(api.nm(st.team)) : 'اختر') + '</button><button class="btn red" id="dvReset">إعادة الدفيجنات</button></div>' +
    '<div class="dv-list">' + list + '</div>';
  document.getElementById('dvBack').onclick = () => api.show('scrHome');
  document.getElementById('dvPlay').onclick = play;
  document.getElementById('dvTeam').onclick = pickMine;
  document.getElementById('dvReset').onclick = () => api.dialog('إعادة الدفيجنات؟', 'سيعود تقدمك إلى دفيجن هاوي.', [{ t: 'نعم', cls: 'red', f: () => { st = { tier: 0, wins: 0, played: 0, lost: 0, team: st.team, done: false }; save(); render(); } }, { t: 'إلغاء' }]);
}
function pickMine(then) {
  const all = KL.CLUBS.concat(KL.NATIONS);
  api.pickTeam(all, 'اختر فريقك للدفيجنات', id => { st.team = id; save(); render(); api.show('scrDiv'); if (typeof then === 'function') then(); });
}
function opponent() {
  const pool = KL.CLUBS.concat(KL.NATIONS).filter(t => t.id !== st.team).sort((a, b) => a.ovr - b.ovr);
  const f = st.tier / 4, lo = Math.floor(f * (pool.length - 12)), band = pool.slice(lo, lo + 12);
  return band[Math.floor(Math.random() * band.length)];
}
function play() {
  if (!st.team) { pickMine(play); return; }
  const cur = KL.DIVS[st.tier], opp = opponent(), prev = +api.S.cfg.diff;
  api.S.cfg.diff = cur.diff; // الصعوبة حسب الدفيجن
  api.startMatch(KL.ALL[st.team], opp, { onEnd: r => { api.S.cfg.diff = prev; result(r, opp, cur); }, onQuit: () => { api.S.cfg.diff = prev; render(); api.show('scrDiv'); } });
}
function result(r, opp, cur) {
  st.played++; let msg, title;
  if (r.winner === 0) { st.wins++; title = '🏆 فوز! (' + st.wins + '/' + cur.need + ')'; msg = 'ضد ' + api.nm(opp.id) + ' — ' + r.score.join(' - '); }
  else { st.lost++; title = '😔 خسارة'; msg = 'ضد ' + api.nm(opp.id) + ' — ' + r.score.join(' - ') + ' (لا تُخصم انتصاراتك)'; }
  let promo = null;
  if (st.wins >= cur.need) { if (st.tier < 4) { st.tier++; st.wins = 0; promo = KL.DIVS[st.tier]; } else { st.done = true; st.wins = cur.need; promo = cur; } }
  save(); render(); api.show('scrDiv');
  if (promo) { const last = promo === cur; api.dialog(last ? '👑 أنت بطل الدفيجن الأيقوني!' : '⬆ ترقية إلى دفيجن ' + promo.ar + '!', last ? 'أنهيت كل الدفيجنات. يمكنك مواصلة اللعب للتحدي.' : 'مبروك! الخصوم الآن أقوى.', [{ t: 'متابعة', cls: 'gold' }]); }
  else api.toast(title + ' — ' + msg, 3200);
}
KL.initModes = (function (prev) {
  return function (a) {
    api = a; initGate(); st = load();
    KL.ui.addHome('🏅 الدفيجنات', 'هاوي ← محترف ← عالمي ← أسطوري ← أيقوني', 'purple', () => { st = load(); render(); api.show('scrDiv'); }, 'div');
    if (prev) prev(a);
  };
})(KL.initModes);
})();

;
