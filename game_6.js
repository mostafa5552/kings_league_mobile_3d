/* KING'S LEAGUE 3D — game_6.js (جزء 6 من 6) */
/* ===== career.js ===== */
/* ============================================================
   KING'S LEAGUE 3D — career.js
   وضع الكارير: أنشئ لاعبك (اسم، جنسية، نادٍ، مركز، رقم) والعب به
   في كينجز ليج MENA (بنادي لاعبك) أو كأس العالم للمنتخبات (بمنتخب جنسيته)
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';
let api = null, C = null;
const KEY = 'kl_career', POSAR = { FW: 'مهاجم', MID: 'وسط', DEF: 'مدافع' };
const orig = {}; // نسخ الفرق الأصلية قبل إضافة لاعب الكارير
const need = lv => 100 + 50 * lv;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

KL.careerAttrs = function (c) {
  const a = Object.assign({}, KL.attrs('CAREER' + c.name, c.pos, false, 60)), up = c.level - 1;
  const main = c.pos === 'FW' ? ['shoot', 'drb'] : c.pos === 'MID' ? ['pass', 'drb'] : ['def', 'pass'];
  for (const k of ['shoot', 'pass', 'def', 'drb']) a[k] = clamp(a[k] + up * (main.includes(k) ? 0.018 : 0.008), 0.3, 0.99);
  a.pace = clamp(a.pace + up * 0.004, 0.9, 1.14);
  return a;
};
KL.careerOvr = c => { const a = KL.careerAttrs(c); return Math.round(((a.shoot + a.pass + a.def + a.drb) / 4 + (a.pace - 1)) * 60 + 25); };
function playerObj(c) { return { name: c.name, num: c.num, pos: c.pos, star: false, career: true, a: KL.careerAttrs(c) }; }

/* إدخال لاعب الكارير في النادي والمنتخب (نسخة معدّلة في KL.ALL) */
function apply() {
  for (const id of Object.keys(orig)) { KL.ALL[id] = orig[id]; delete orig[id]; }
  if (!C) return;
  for (const id of [C.club, C.nat]) {
    const t = KL.ALL[id]; if (!t) continue;
    orig[id] = t; KL.ALL[id] = Object.assign({}, t, { players: [playerObj(C)].concat(t.players.filter(p => p.num !== C.num || true)) });
  }
}
KL.careerIdx = function (team) { const t = KL.ALL[team.id] || team; const i = t.players.findIndex(p => p.career); return i >= 0 ? i : null; };

function freeNumber(c) {
  const used = new Set(); for (const id of [c.club, c.nat]) { const t = KL.ALL[id]; if (t) t.players.forEach(p => { if (!p.career) used.add(p.num); }); }
  if (c.num && !used.has(c.num)) return c.num; for (let n = 1; n < 100; n++) if (!used.has(n)) return n; return c.num || 99;
}

function form() {
  const E = KL.ui.screen('scrCareer');
  const nat = KL.NATIONS.map(t => '<option value="' + t.id + '">' + (KL.FLAG[t.id] || '') + ' ' + api.esc(t.ar) + '</option>').join('');
  const club = KL.CLUBS.map(t => '<option value="' + t.id + '">' + api.esc(t.name) + '</option>').join('');
  E.innerHTML = '<div class="topbar"><button class="btn sm" id="cBack">→ القائمة</button><h2>🎓 إنشاء لاعب الكارير</h2><span></span></div>' +
    '<div class="cr-form"><label>اسم اللاعب<input id="cName" maxlength="18" placeholder="مثال: Omar Salah"></label>' +
    '<label>الجنسية (منتخبك في كأس العالم)<select id="cNat">' + nat + '</select></label>' +
    '<label>الفريق (في كينجز ليج MENA)<select id="cClub">' + club + '</select></label>' +
    '<label>المركز<div class="cr-pos" id="cPos"><button data-p="FW" class="on">مهاجم</button><button data-p="MID">وسط</button><button data-p="DEF">مدافع</button></div></label>' +
    '<label>رقم القميص<input id="cNum" type="number" min="1" max="99" value="10"></label>' +
    '<button class="btn big gold" id="cCreate">✅ إنشاء اللاعب</button><p class="small">تبدأ بتقييم متواضع، وتكبر مهاراتك بالأهداف والانتصارات.</p></div>';
  let pos = 'FW';
  document.querySelectorAll('#cPos button').forEach(b => b.onclick = () => { pos = b.dataset.p; document.querySelectorAll('#cPos button').forEach(x => x.classList.toggle('on', x === b)); });
  document.getElementById('cBack').onclick = () => api.show('scrHome');
  document.getElementById('cCreate').onclick = () => {
    const name = document.getElementById('cName').value.trim().replace(/[<>&"]/g, '');
    if (name.length < 2) { api.toast('اكتب اسماً من حرفين على الأقل'); return; }
    C = { name, nat: document.getElementById('cNat').value, club: document.getElementById('cClub').value, pos, num: Math.max(1, Math.min(99, +document.getElementById('cNum').value || 10)), level: 1, xp: 0, goals: 0, apps: 0, wins: 0, created: Date.now() };
    apply(); C.num = freeNumber(C); apply(); api.store.set(KEY, C); hub();
  };
}
function bar(p) { return '<div class="dv-bar"><i style="width:' + p + '%"></i><b>' + p + '%</b></div>'; }
function hub() {
  if (!C) { form(); api.show('scrCareer'); return; }
  const E = KL.ui.screen('scrCareer'), a = KL.careerAttrs(C), ov = KL.careerOvr(C), pct = Math.min(100, Math.round(C.xp / need(C.level) * 100));
  const stat = (n, v) => '<div class="cr-st"><span>' + n + '</span><div><i style="width:' + Math.round(v * 100) + '%"></i></div><b>' + Math.round(v * 99) + '</b></div>';
  E.innerHTML = '<div class="topbar"><button class="btn sm" id="cBack">→ القائمة</button><h2>🎓 الكارير</h2><span class="chip">المستوى ' + C.level + '</span></div>' +
    '<div class="cr-card"><div class="cr-ovr">' + ov + '<small>التقييم</small></div><div class="cr-info"><h1>' + api.esc(C.name) + ' <em>#' + C.num + '</em></h1><p>' + POSAR[C.pos] + ' · ' + (KL.FLAG[C.nat] || '') + ' ' + api.esc(KL.ALL[C.nat].ar) + ' · ' + api.esc(KL.ALL[C.club].name) + '</p>' +
    '<p class="small">مباريات ' + C.apps + ' · انتصارات ' + C.wins + ' · أهداف ' + C.goals + '</p>' + bar(pct) + '<small>' + C.xp + ' / ' + need(C.level) + ' خبرة</small></div></div>' +
    '<div class="cr-stats">' + stat('تسديد', a.shoot) + stat('تمرير', a.pass) + stat('دفاع', a.def) + stat('مراوغة', a.drb) + stat('سرعة', clamp((a.pace - 0.9) / 0.24, 0, 1)) + '</div>' +
    '<div class="dv-actions"><button class="btn big gold" id="cMena">⚽ كينجز ليج MENA<br><small>مع ' + api.esc(KL.ALL[C.club].name) + '</small></button><button class="btn big purple" id="cNat2">🌍 كأس العالم للمنتخبات<br><small>مع ' + api.esc(KL.ALL[C.nat].ar) + '</small></button><button class="btn red" id="cDel">🗑 حذف اللاعب</button></div>' +
    '<p class="small" style="text-align:center">في مبارياتك تتحكم بلاعبك أنت فقط، وزملاؤك يلعبون تلقائياً.</p>';
  document.getElementById('cBack').onclick = () => api.show('scrHome');
  document.getElementById('cMena').onclick = () => startComp('mena', C.club);
  document.getElementById('cNat2').onclick = () => startComp('nations', C.nat);
  document.getElementById('cDel').onclick = () => api.dialog('حذف اللاعب؟', 'سيُحذف لاعبك وتقدمه وبطولاته.', [{ t: 'نعم، احذف', cls: 'red', f: () => { api.store.del(KEY); api.store.del('kl_ctour_mena'); api.store.del('kl_ctour_nations'); C = null; apply(); api.show('scrHome'); } }, { t: 'إلغاء' }]);
  api.show('scrCareer');
}
function startComp(mode, teamId) {
  const key = 'kl_ctour_' + mode, saved = api.store.get(key, null);
  const fresh = () => { const T = new KL.Tournament(mode, teamId); T.key = key; T.career = true; api.S.tour = T; api.store.set(key, T.toJSON()); KL.openHub(); };
  if (saved && saved.userId === teamId) {
    const T = KL.Tournament.fromJSON(saved);
    api.dialog('بطولة كارير محفوظة', T.stageName, [{ t: '▶ متابعة', cls: 'gold', f: () => { api.S.tour = T; KL.openHub(); } }, { t: 'بطولة جديدة', f: fresh }, { t: 'إلغاء' }]);
  } else fresh();
}
KL.careerOpen = hub;
KL.careerAfter = function (r, goals) {
  if (!C) return; const g = goals.filter(x => x.team === 0 && !x.og && x.name === C.name).length;
  const old = C.level; C.apps++; C.goals += g; if (r.winner === 0) C.wins++;
  C.xp += 10 + (r.winner === 0 ? 25 : r.winner < 0 ? 8 : 0) + g * 30;
  while (C.xp >= need(C.level)) { C.xp -= need(C.level); C.level++; }
  api.store.set(KEY, C); apply();
  api.toast('🎓 +' + (10 + g * 30) + ' خبرة' + (g ? ' · ⚽ ' + g : '') + (C.level > old ? ' · ⬆ المستوى ' + C.level + '!' : ''), 3500);
};
KL.initModes = (function (prev) {
  return function (a) {
    api = a; C = api.store.get(KEY, null); if (C && KL.ALL[C.club] && KL.ALL[C.nat]) apply(); else C = null;
    KL.ui.addHome('🎓 الكارير', 'أنشئ لاعبك والعب به في MENA أو كأس العالم', 'gold', () => { hub(); }, 'career');
    if (prev) prev(a);
  };
})(KL.initModes);
})();

;
/* ===== app.js ===== */
/* ============================================================
   KING'S LEAGUE MENA 3D — app.js
   (6/6) الواجهة: القوائم، البطولات، التحكم، HUD، البطاقات، النتائج
   ============================================================ */
(function () {
'use strict';
const KL = window.KL, $ = id => document.getElementById(id), $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const FLAG = KL.FLAG;
const POS_AR = { GK: 'حارس', DEF: 'مدافع', MID: 'وسط', FW: 'مهاجم' };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };
const S = { cfg: Object.assign({ diff: 0.7, spm: 7.5, snd: 1, cam: 0, names: 1 }, store.get('kl_cfg', {})), eng: null, match: null, paused: false, tour: null, ctx: null, screen: 'home', goals: [], tagKey: '', jk: 0, endT: 0 };
const IN = { mx: 0, mz: 0, A: false, Adown: false, Aup: false, B: false, Bdown: false, Bup: false, C: false, Cdown: false, Cup: false, D: false };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- مساعدات العرض ---------------- */
function lg(t, cls) {
  if (typeof t === 'string') t = KL.ALL[t];
  return '<img ' + (cls ? 'class="' + cls + '" ' : '') + 'src="' + KL.logoSrc(t) + '" alt="" onerror="KL.imgErr(this,\'' + t.id + '\')">';
}
function setLogo(el, t) {
  el.textContent = ''; el.style.backgroundImage = 'none'; const im = new Image();
  im.onload = () => { el.style.backgroundImage = 'url(' + im.src + ')'; }; const ch = KL.logoChain(t); let ci = 0; const nx = () => { if (ci >= ch.length) { el.style.backgroundImage = 'url(' + KL.logoFallback(t.id) + ')'; return; } im.src = ch[ci++]; }; im.onerror = nx; nx();
}
const nm = id => KL.ALL[id].type === 'nation' ? KL.ALL[id].ar : KL.ALL[id].name;
function show(id) { document.querySelectorAll('.screen').forEach(s => { if (s.id !== 'boot') s.classList.toggle('show', s.id === id); }); $('hud').classList.toggle('hide', id !== 'hud'); S.screen = id; checkRotate(); }
function checkRotate() { $('rotate').classList.toggle('hide', !(S.screen === 'hud' && window.innerHeight > window.innerWidth * 1.05)); }
function overlay(id, on) { $(id).classList.toggle('hide', !on); }
function snd(n) { if (S.eng) S.eng.sound.play(n); }
function dialog(title, msg, btns) {
  const o = document.createElement('div'); o.className = 'overlay'; o.style.zIndex = 70;
  const m = document.createElement('div'); m.className = 'modal'; const h = document.createElement('h3'); h.textContent = title; m.appendChild(h);
  if (msg) { const p = document.createElement('p'); p.textContent = msg; m.appendChild(p); }
  const l = document.createElement('div'); l.className = 'plist'; m.appendChild(l);
  btns.forEach(b => { const x = document.createElement('button'); x.className = 'btn ' + (b.cls || ''); x.textContent = b.t; x.onclick = () => { o.remove(); snd('ui'); b.f && b.f(); }; l.appendChild(x); });
  o.appendChild(m); document.body.appendChild(o);
}
let toastT = 0;
function toast(t, ms) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), ms || 2200); }
function banner(text, sub, goal) {
  const b = $('banner'); b.className = ''; void b.offsetWidth; b.textContent = '';
  const x = document.createElement('b'); x.textContent = text; if (sub) { const s = document.createElement('small'); s.textContent = sub; x.appendChild(s); } b.appendChild(x); b.className = 'on' + (goal ? ' goal' : '');
}
function busy(on, txt) { overlay('busy', on); if (txt) $('busyTxt').textContent = txt; }

/* ---------------- الإعدادات ---------------- */
function applyCfg() {
  $('setDiff').value = String(S.cfg.diff); $('setSpm').value = String(S.cfg.spm); $('setSnd').value = String(S.cfg.snd); $('setCam').value = String(S.cfg.cam); $('setNames').value = String(S.cfg.names);
  if (S.eng) { S.eng.sound.setOn(!!+S.cfg.snd); S.eng.setCam(+S.cfg.cam); S.eng.setNames(!!+S.cfg.names); }
  $('bSnd').textContent = +S.cfg.snd ? '🔊' : '🔇';
}
function saveCfg() { S.cfg.diff = +$('setDiff').value; S.cfg.spm = +$('setSpm').value; S.cfg.snd = +$('setSnd').value; S.cfg.cam = +$('setCam').value; S.cfg.names = +$('setNames').value; store.set('kl_cfg', S.cfg); applyCfg(); }

const HOW = `<h4>🎮 التحكم</h4><ul><li><b>العصا (يسار):</b> تحريك اللاعب في كل الاتجاهات.</li><li><b>هجوم:</b> تسديد (اضغط مطولاً لقوة أكبر) · تمرير (يتجه حسب العصا) · مهارة (مراوغة سريعة) · جري (سبرنت).</li><li><b>دفاع:</b> قطع الكرة (انزلاق) · تبديل اللاعب الأقرب للكرة · ضغط متواصل على حامل الكرة · جري.</li><li>الكيبورد: WASD/الأسهم للحركة، J تسديد/قطع، K تمرير/تبديل، L مهارة/ضغط، Shift جري.</li></ul>
<h4>⏱️ زمن المباراة (40 دقيقة)</h4><ul><li>الدقيقة 0: 1 ضد 1 مع الحراس، والكرة تسقط من قفص معلّق. كل دقيقة يدخل لاعب جديد لكل فريق حتى 7 ضد 7 في الدقيقة 5.</li><li>الدقيقة 17: <b>الكرة الملونة</b> — أي هدف بها بهدفين حتى نهاية الشوط.</li><li>الدقيقة 20: <b>النرد</b> يحدد عدد لاعبي بداية الشوط الثاني، والعودة الكاملة 7 ضد 7 في الدقيقة 23.</li><li>الدقيقة 36: التعادل ← ركلات ترجيح (شووت آوت). المتقدم ← <b>كرة المباراة</b> 5 ضد 5، يُستبعد لاعب كل دقيقة، وهدف المتقدم يُنهي اللقاء.</li></ul>
<h4>🃏 البطاقات السرية</h4><ul><li>تحصل على بطاقة عشوائية. تُفعَّل من الدقيقة 5 إلى 17 ومن 23 إلى 36 بالضغط على زر البطاقة أعلى اليسار.</li><li>🎯 ركلة جزاء · 🏃 شووت آوت (5 ثوانٍ) · ✖️2 هدف مضاعف 4 دقائق · 🚫 إيقاف لاعب خصم 4 دقائق · ⭐ لاعب نجم (أهدافه بهدفين) · 🔁 عقوبة عكسية · 🃏 الجوكر (قلّد أي بطاقة أو ألغِ/اسرق بطاقة الخصم).</li></ul>
<h4>🟨 الكروت</h4><ul><li>الأصفر: طرد دقيقتين. الأحمر: طرد نهائي ونقص 5 دقائق. في كرة المباراة: الكارت يمنح الخصم شووت آوت مباشراً.</li></ul>
<h4>🏆 النقاط</h4><ul><li>فوز عادي 3 نقاط · فوز بالترجيح 2 · خسارة بالترجيح 1.</li></ul>`;

/* ---------------- اختيار الفرق ---------------- */
function teamGrid(list, onPick, extra) {
  const g = $('teamGrid'); g.innerHTML = '';
  if (extra) { const c = document.createElement('div'); c.className = 'tcard'; c.innerHTML = '<div class="lg"><span class="flag">🎲</span></div><b>عشوائي</b>'; c.onclick = () => { snd('ui'); onPick(list[Math.floor(Math.random() * list.length)].id); }; g.appendChild(c); }
  list.forEach(t => {
    const c = document.createElement('div'); c.className = 'tcard';
    const stars = Math.round((t.ovr - 60) / 5); const k = t.kits.home;
    c.innerHTML = '<div class="lg">' + lg(t) + '</div><b>' + esc(t.type === 'nation' ? t.ar : t.name) + '</b><div class="st">' + '★'.repeat(Math.max(1, Math.min(5, stars))) + '</div><div class="kits"><i style="background:' + k.shirt + '"></i><i style="background:' + k.shorts + '"></i></div>';
    c.onclick = () => { snd('ui'); onPick(t.id); }; g.appendChild(c);
  });
}
function pickTeam(list, title, cb, extra) { $('teamsTitle').textContent = title; teamGrid(list, cb, extra); show('scrTeams'); $('scrTeams').scrollTop = 0; S.backTo = 'home'; }

function menuGo(mode) {
  if (mode === 'friendly') {
    const all = KL.CLUBS.concat(KL.NATIONS);
    pickTeam(all, 'اختر فريقك', uid => { const rest = all.filter(t => t.id !== uid); pickTeam(rest, 'اختر الخصم', oid => playFriendly(uid, oid), true); });
    return;
  }
  const key = 'kl_tour_' + mode, saved = store.get(key, null);
  const fresh = () => pickTeam(mode === 'mena' ? KL.CLUBS : KL.NATIONS, mode === 'mena' ? 'اختر فريقك في الدوري' : 'اختر منتخبك', uid => { S.tour = new KL.Tournament(mode, uid); saveTour(); renderHub(); show('scrHub'); });
  if (saved && saved.userId && KL.ALL[saved.userId]) {
    const t = KL.Tournament.fromJSON(saved);
    dialog('بطولة محفوظة', nm(t.userId) + ' — ' + t.stageName, [
      { t: '▶ متابعة', cls: 'gold', f: () => { S.tour = t; renderHub(); show('scrHub'); } },
      { t: 'بطولة جديدة', f: () => { store.del(key); fresh(); } }, { t: 'إلغاء' }]);
  } else fresh();
}
function saveTour() { if (S.tour) store.set(S.tour.key || ('kl_tour_' + S.tour.mode), S.tour.toJSON()); }

/* ---------------- مركز البطولة ---------------- */
let hubTab = 'table';
function mrow(m) {
  const T = S.tour, me = m.a === T.userId || m.b === T.userId; let sc = '—', sm = '';
  if (m.done) { sc = m.sa + ' - ' + m.sb; if (m.pso && m.sa === m.sb) sm = '<small>ترجيح ' + m.pso[0] + '-' + m.pso[1] + '</small>'; }
  return '<div class="mrow' + (me ? ' me' : '') + '"><div class="t">' + lg(m.a) + '<span class="n">' + esc(nm(m.a)) + '</span></div><div class="s">' + sc + sm + (m.label ? '<small>' + esc(m.label) + '</small>' : '') + '</div><div class="t b">' + lg(m.b) + '<span class="n">' + esc(nm(m.b)) + '</span></div></div>';
}
function tableHTML(rows, q1, q2) {
  const T = S.tour; let h = '<table class="tbl"><tr><th>#</th><th style="text-align:right">الفريق</th><th>لعب</th><th>ف</th><th>خ</th><th>له</th><th>عليه</th><th>+/-</th><th>نقاط</th></tr>';
  rows.forEach((r, i) => { const cls = (r.id === T.userId ? 'me ' : '') + (i < q1 ? 'q' : (i < q2 ? 'q2' : '')); h += '<tr class="' + cls + '"><td>' + (i + 1) + '</td><td class="nm">' + lg(r.id) + esc(nm(r.id)) + '</td><td>' + r.p + '</td><td>' + r.w + '</td><td>' + r.l + '</td><td>' + r.gf + '</td><td>' + r.ga + '</td><td>' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td class="pts">' + r.pts + '</td></tr>'; });
  return h + '</table>';
}
function userStatus() {
  const T = S.tour; if (T.stage === 'done') return '';
  if (T.stage === 'league' || T.stage === 'groups') return '';
  if (T.userMatch()) return '';
  if (T.matches.some(m => m.a === T.userId || m.b === T.userId)) return '';
  if (T.stage === 'playoff' && T.direct === T.userId) return 'تأهلت مباشرة لنصف النهائي 🎉';
  if (T.stage === 'playoff6' && T.winners.indexOf(T.userId) >= 0) return 'تأهلت مباشرة لربع النهائي 🎉';
  return 'خرجت من البطولة 😔 — يمكنك متابعة المحاكاة حتى النهاية';
}
function renderHub() {
  const T = S.tour, mode = T.mode; $('hubTitle').textContent = (mode === 'mena' ? "KING'S LEAGUE MENA" : "KING'S LEAGUE NATIONS");
  $('hubUser').innerHTML = lg(T.userId) + '<span>' + esc(nm(T.userId)) + '</span>'; const chipImg = $('hubUser').querySelector('img'); if (chipImg) chipImg.style.height = '20px';
  const A = $('hubActions'); A.innerHTML = ''; const add = (t, cls, f) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.innerHTML = t; b.onclick = () => { snd('ui'); f(); }; A.appendChild(b); };
  const um = T.userMatch(), st = userStatus();
  if (T.stage === 'done') add('🏆 بطولة جديدة', 'gold', () => { store.del(T.key || ('kl_tour_' + mode)); const car = T.career; S.tour = null; show(car ? 'scrCareer' : 'scrHome'); if (car && KL.careerOpen) KL.careerOpen(); });
  else {
    if (um) { add('▶ العب مباراتك<br><small>' + esc(nm(um.a)) + ' × ' + esc(nm(um.b)) + '</small>', 'gold', playUser); add('⏩ حاكِ مباراتي', '', () => { busy(true, 'جاري محاكاة مباراتك…'); T.simUserMatch(() => afterUser()); }); }
    else add('⏭ ' + (T.pending().length ? 'حاكِ باقي مباريات الجولة' : 'الجولة التالية'), 'gold', () => { busy(true, 'جاري المحاكاة…'); T.simPending(prog, () => { if (T.roundDone()) T.advance(); saveTour(); busy(false); renderHub(); }); });
    add('⏩⏩ حاكِ البطولة حتى النهاية', 'purple', () => dialog('محاكاة كاملة؟', 'ستُحاكى كل المباريات المتبقية بما فيها مبارياتك.', [{ t: 'نعم، حاكِ', cls: 'gold', f: () => { busy(true, 'جاري محاكاة البطولة…'); T.simAll(s => $('busyTxt').textContent = 'جاري المحاكاة — ' + s, () => { saveTour(); busy(false); renderHub(); }); } }, { t: 'إلغاء' }]));
  }
  const body = $('hubBody'); let h = '';
  if (T.stage === 'done') { const win = T.champion === T.userId; h += '<div class="trophy"><div class="big">' + (win ? '🏆' : '🥇') + '</div><h3>' + (win ? 'أنت بطل البطولة!' : 'بطل البطولة: ' + esc(nm(T.champion))) + '</h3><div style="font-size:42px">' + lg(T.champion) + '</div></div>'; }
  else h += '<div class="chip" style="margin-bottom:8px">' + esc(T.stageName) + '</div>' + (st ? '<div class="trophy" style="padding:10px;font-weight:700">' + st + '</div>' : '');
  if (hubTab === 'table') {
    if (mode === 'mena') h += tableHTML(T.leagueTable(), 1, 7) + '<div class="small">🟢 صعود مباشر لنصف النهائي · 🔵 المراكز 2–7 تصفيات إقصائية</div>';
    else T.groups.forEach((g, i) => { h += '<div class="gt">المجموعة ' + 'ABCDE'[i] + '</div>' + tableHTML(T.groupTable(i), 1, 2); }), h += '<div class="small">🟢 الأول يتأهل لربع النهائي · 🔵 الثاني + أفضل ثالث إلى التصفيات</div>';
  } else if (hubTab === 'round') {
    h += T.matches.length ? T.matches.map(mrow).join('') : '<p class="small">لا مباريات حالياً.</p>';
  } else {
    const hist = T.history.slice().reverse(); if (!hist.length) h += '<p class="small">لم تُلعب أي مباراة بعد.</p>'; let last = '';
    hist.forEach(m => { const k = m.stage; if (k !== last) { h += '<div class="lbl">' + esc(KL.Tournament.STAGE_AR[k] || k) + '</div>'; last = k; } h += mrow(m); });
  }
  body.innerHTML = h; $$('#hubTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === hubTab));
}
function prog(i, n) { $('busyTxt').textContent = 'جاري محاكاة مباريات الجولة… ' + i + '/' + n; }
function afterUser() { const T = S.tour; busy(true, 'جاري محاكاة بقية الجولة…'); T.simPending(prog, () => { if (T.roundDone()) T.advance(); saveTour(); busy(false); renderHub(); show('scrHub'); }); }

/* ---------------- بدء المباراة ---------------- */
function playUser() { const T = S.tour, m = T.userMatch(); if (!m) return; const ua = m.a === T.userId; startMatch(KL.ALL[ua ? m.a : m.b], KL.ALL[ua ? m.b : m.a], { tour: true, mref: m, userIsA: ua, career: !!T.career }); }
function playFriendly(u, o) { startMatch(KL.ALL[u], KL.ALL[o], { tour: false }); }
function startMatch(A, B, ctx) {
  // شاشة التشكيلة قبل كل مباراة (للفريق الذي يقوده اللاعب)
  KL.openLineup(A, { cam: +S.cfg.cam, names: !!+S.cfg.names, must: ctx && ctx.career && KL.careerIdx ? KL.careerIdx(A) : null }, r => { S.cfg.cam = r.cam; S.cfg.names = r.names ? 1 : 0; store.set('kl_cfg', S.cfg); realStart(A, B, ctx, r.lu); });
}
function realStart(A, B, ctx, lu) {
  S.ctx = ctx; S.goals = []; S.tagKey = ''; const kits = (ctx && ctx.kits) || KL.pickKits(A, B); S.kits = kits; S.online = !!(ctx && ctx.online); $('bPause').textContent = S.online ? '🚪' : '⏸';
  const m = (ctx && ctx.build) ? ctx.build(kits, lu) : new KL.Match({ teams: [A, B], user: 0, secPerMin: +S.cfg.spm, diff: +S.cfg.diff, kits, lineups: [lu, null], career: ctx && ctx.career && KL.careerIdx ? [KL.careerIdx(A), null] : null });
  m.onEvent = onEvent; S.eng.loadMatch(m, kits); S.eng.setCam(+S.cfg.cam); S.eng.setNames(!!+S.cfg.names); S.match = m; S.paused = true; S.endT = 0;
  setLogo($('sAl'), A); setLogo($('sBl'), B); $('sAn').textContent = A.short; $('sBn').textContent = B.short; $('psoBox').classList.add('hide');
  const dots = k => '<div class="kt"><i style="background:' + k.shirt + '"></i><i style="background:' + k.shorts + '"></i><i style="background:' + k.gk + '"></i></div>';
  $('vs').innerHTML = '<div class="vs-in"><div class="vs-t"><div class="lg">' + lg(A) + '</div><b>' + esc(A.type === 'nation' ? A.ar : A.name) + '</b>' + dots(kits[0]) + '</div><div class="vs-x">VS</div><div class="vs-t"><div class="lg">' + lg(B) + '</div><b>' + esc(B.type === 'nation' ? B.ar : B.name) + '</b>' + dots(kits[1]) + '</div></div>';
  show('hud'); overlay('vs', true); S.eng.sound.init();
  setTimeout(() => { overlay('vs', false); S.paused = false; const c = m.t[0].card; if (c) toast('بطاقتك السرية: ' + KL.CARDS[c].ico + ' ' + KL.CARDS[c].ar, 3200); }, 2200);
}

/* ---------------- الأحداث ---------------- */
function onEvent(e) {
  const m = S.match; if (!m) return; S.eng.handleEvent(e);
  switch (e.type) {
    case 'banner': banner(e.text, e.sub, e.goal); break;
    case 'goal': S.goals.push({ team: e.team, name: e.scorer ? e.scorer.name : '', min: e.min, v: e.value, og: e.og }); break;
    case 'card': toast((e.card === 'red' ? '🟥 كارت أحمر — ' : '🟨 كارت أصفر — ') + e.P.name, 2600); break;
    case 'halftime': showDice(e.dice); break;
    case 'pso': case 'psoShot': renderPSO(); break;
    case 'newCard': if (e.team != null && e.team !== 0) break; toast('🃏 حصلت على بطاقة جديدة: ' + KL.CARDS[e.card].ar, 3000); break;
    case 'msg': toast(e.text); break;
    case 'coloredBall': snd('powerup'); break;
    case 'jokerPrompt': if (e.to == null || e.to === 0) showJoker(e); break;
    case 'end': S.endT = 1.8; S.endRes = e; break;
  }
}
function showDice(n) {
  overlay('dice', true); const c = $('diceCube'); c.className = ''; $('diceTxt').textContent = 'جاري رمي النرد…'; let k = 0;
  const iv = setInterval(() => { c.textContent = 1 + Math.floor(Math.random() * 6); snd('dice'); if (++k > 18) { clearInterval(iv); c.textContent = n; c.className = 'stop'; $('diceTxt').textContent = 'يبدأ الشوط الثاني بـ ' + n + ' لاعبين لكل فريق!'; snd('powerup'); } }, 130);
  setTimeout(() => overlay('dice', false), 4700);
}
function renderPSO() {
  const m = S.match, p = m && m.pso; if (!p) { $('psoBox').classList.add('hide'); return; }
  const row = i => { const n = Math.max(5, p.shots[i].length); let d = ''; for (let k = 0; k < n; k++) { const v = p.shots[i][k]; d += '<span class="d ' + (v === undefined ? '' : (v ? 'y' : 'n')) + '"></span>'; } return '<div class="r"><b>' + esc(m.t[i].short) + '</b>' + d + '<span>' + p.goals[i] + '</span></div>'; };
  $('psoBox').innerHTML = row(0) + row(1); $('psoBox').classList.remove('hide');
}
function showJoker(e) {
  const m = S.match; $('jokerTxt').textContent = 'الخصم فعّل: ' + KL.CARDS[e.card].ico + ' ' + KL.CARDS[e.card].ar; S.jk = 8; overlay('jokerBox', true); S.paused = true;
}
function jokerChoose(c) { overlay('jokerBox', false); S.jk = 0; S.paused = false; if (S.match) S.match.jokerResponse(c); }

/* ---------------- البطاقات ---------------- */
function windowMsg(m) {
  if (m.mode !== 'play') return 'غير متاح الآن'; if (m.mb) return 'انتهى وقت البطاقات';
  const c = m.clock; if (c < 5) return 'البطاقات متاحة من الدقيقة 5'; if (c >= 17 && c < 23) return 'البطاقات متاحة من الدقيقة 23'; if (c >= 36) return 'انتهى وقت البطاقات'; return 'غير متاح الآن';
}
function openPick(title, items, cb) {
  S.paused = true; $('pickTitle').textContent = title; const L = $('pickList'); L.innerHTML = '';
  items.forEach(it => { const b = document.createElement('button'); b.className = 'btn'; b.innerHTML = esc(it.label) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : ''); b.onclick = () => { snd('ui'); overlay('pickCard', false); S.paused = false; cb(it.id); }; L.appendChild(b); });
  overlay('pickCard', true);
}
function onCardBtn() {
  const m = S.match; if (!m || S.paused || m.mode === 'ended') return; const t = m.t[0];
  if (!t.card) { toast('لا توجد بطاقة'); return; }
  if (!m.canUseCard(0)) { toast(windowMsg(m)); return; }
  const need = ['suspend', 'reverse', 'star'], use = (card, tg) => { if (!m.useCard(0, card, tg)) toast('لا يمكن استخدام البطاقة الآن'); };
  const afterChoose = card => {
    if (need.indexOf(card) >= 0) {
      const list = m.getTargets(0, card).map(p => ({ id: p.id, label: '#' + p.num + '  ' + p.name, sub: POS_AR[p.pos] }));
      if (!list.length) { toast('لا يوجد لاعب مناسب'); return; }
      openPick(card === 'star' ? '⭐ اختر لاعبك النجم' : (card === 'suspend' ? '🚫 اختر لاعب الخصم لإيقافه' : '🔁 اختر لاعب الخصم للعقوبة'), list, id => use(card, id));
    } else use(card);
  };
  if (t.card === 'joker') openPick('🃏 الجوكر — استخدمه كأي بطاقة', ['penalty', 'shootout', 'double', 'suspend', 'star', 'reverse'].map(id => ({ id, label: KL.CARDS[id].ico + ' ' + KL.CARDS[id].ar, sub: KL.CARDS[id].desc })), afterChoose);
  else afterChoose(t.card);
}

/* ---------------- النتيجة والإنهاء ---------------- */
function showResult(r) {
  const m = S.match, sc = r.score, win = r.winner === 0; snd('end');
  let h = '<div class="modal res"><div class="win ' + (win ? 'w' : 'l') + '">' + (win ? '🏆 فوز!' : '😔 خسارة') + '</div><div class="row2">' + lg(m.t[0].d) + '<span style="font-size:15px;font-weight:700">' + esc(m.t[0].short) + ' × ' + esc(m.t[1].short) + '</span>' + lg(m.t[1].d) + '</div><div class="big">' + sc[0] + ' - ' + sc[1] + '</div>';
  if (r.pso) h += '<div class="pso">ركلات الترجيح: ' + r.pso[0] + ' - ' + r.pso[1] + '</div>';
  if (S.goals.length) h += '<div class="sc-list">' + S.goals.map(g => '<div>' + (g.team === 0 ? '🔵 ' : '🔴 ') + esc(g.min) + ' — ' + esc(g.name || 'هدف') + (g.og ? ' (عكسي)' : '') + (g.v > 1 ? ' ×2' : '') + '</div>').join('') + '</div>';
  h += '<div class="plist"><button class="btn gold" id="resOk">متابعة</button></div></div>';
  $('resultBox').innerHTML = h; overlay('resultBox', true); $('resOk').onclick = () => { snd('ui'); overlay('resultBox', false); finishMatch(r); };
}
function cleanupMatch() { S.match = null; S.paused = false; S.online = false; $('bPause').textContent = '⏸'; S.eng.clearMatch(); ['dice', 'pickCard', 'jokerBox', 'pauseBox', 'vs', 'resultBox'].forEach(i => overlay(i, false)); $('psoBox').classList.add('hide'); $('banner').className = ''; Object.keys(IN).forEach(k => IN[k] = (k === 'mx' || k === 'mz') ? 0 : false); }
function finishMatch(r) {
  const ctx = S.ctx; cleanupMatch();
  if (ctx && ctx.onEnd) { ctx.onEnd(r); return; }
  if (!ctx || !ctx.tour) { show('scrHome'); return; }
  const T = S.tour, m = ctx.mref, ua = ctx.userIsA;
  const score = ua ? r.score : [r.score[1], r.score[0]], pso = r.pso ? (ua ? r.pso : [r.pso[1], r.pso[0]]) : null, wi = ua ? (r.winner === 0 ? 0 : 1) : (r.winner === 0 ? 1 : 0);
  T.record(m, score, pso, wi); saveTour(); if (ctx.career && KL.careerAfter) KL.careerAfter(r, S.goals);
  afterUser();
}
function quitMatch() { const on = S.online; dialog(on ? 'الانسحاب من المباراة؟' : 'إنهاء المباراة؟', on ? 'سيُحتسب الانسحاب خسارة.' : 'لن تُحتسب نتيجتها.', [{ t: 'نعم، اخرج', cls: 'red', f: () => { const c = S.ctx; cleanupMatch(); if (c && c.onQuit) c.onQuit(); else if (c && c.tour) { renderHub(); show('scrHub'); } else show('scrHome'); } }, { t: 'متابعة اللعب' }]); }

/* ---------------- الإدخال ---------------- */
function press(k) { if (!IN[k]) { IN[k] = true; IN[k + 'down'] = true; } }
function release(k) { if (IN[k]) { IN[k] = false; IN[k + 'up'] = true; } }
function clearEdges() { IN.Adown = IN.Aup = IN.Bdown = IN.Bup = IN.Cdown = IN.Cup = false; }
function bindBtn(id, key) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { } press(key); el.classList.add('on'); S.eng.sound.init(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => el.addEventListener(ev, () => { release(key); el.classList.remove('on'); }));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, kb = { l: 0, r: 0, u: 0, d: 0 };
function bindStick() {
  const z = $('stickZone'), base = $('stickBase'), knob = $('stickKnob'), R = 56;
  const upd = (cx, cy) => { let dx = cx - stick.ox, dy = cy - stick.oy; const d = Math.hypot(dx, dy); if (d > R) { dx = dx / d * R; dy = dy / d * R; } stick.x = dx / R; stick.y = dy / R; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; };
  z.addEventListener('pointerdown', e => {
    if (stick.id !== null) return; e.preventDefault(); stick.id = e.pointerId; try { z.setPointerCapture(e.pointerId); } catch (x) { }
    stick.ox = e.clientX; stick.oy = e.clientY; base.style.left = (e.clientX - 66) + 'px'; base.style.top = (e.clientY - 66) + 'px'; base.style.bottom = 'auto'; base.classList.add('act'); upd(e.clientX, e.clientY); S.eng.sound.init();
  });
  z.addEventListener('pointermove', e => { if (e.pointerId === stick.id) { e.preventDefault(); upd(e.clientX, e.clientY); } });
  const end = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; base.style.left = base.style.top = base.style.bottom = ''; base.classList.remove('act'); };
  ['pointerup', 'pointercancel'].forEach(ev => z.addEventListener(ev, end));
}
const KEYS = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' }, KACT = { Space: 'A', KeyJ: 'A', KeyK: 'B', KeyL: 'C', KeyE: 'C', ShiftLeft: 'D', ShiftRight: 'D' };
window.addEventListener('keydown', e => { if (!S.match) return; if (KEYS[e.code]) { kb[KEYS[e.code]] = 1; e.preventDefault(); } if (KACT[e.code]) { press(KACT[e.code]); e.preventDefault(); } if (e.code === 'KeyP' || e.code === 'Escape') togglePause(); });
window.addEventListener('keyup', e => { if (KEYS[e.code]) kb[KEYS[e.code]] = 0; if (KACT[e.code]) release(KACT[e.code]); });
function readInput() {
  let x = stick.x, y = stick.y; if (!stick.id && (kb.l || kb.r || kb.u || kb.d)) { x = kb.r - kb.l; y = kb.d - kb.u; const d = Math.hypot(x, y); if (d > 1) { x /= d; y /= d; } }
  const d = Math.hypot(x, y); if (d < 0.14) { x = y = 0; } else { const k = Math.min(1, (d - 0.14) / 0.86) / d; x *= k; y *= k; }
  IN.mx = x; IN.mz = y; return IN;
}

/* ---------------- HUD ---------------- */
function updateHUD() {
  const m = S.match; if (!m) return;
  $('sAs').textContent = m.score[0]; $('sBs').textContent = m.score[1]; $('clk').textContent = m.timeText();
  $('half').textContent = m.pso ? 'ركلات الترجيح' : (m.mb ? 'MATCH BALL' : (m.half === 1 ? 'الشوط 1' : 'الشوط 2'));
  const tags = []; if (m.colored) tags.push(['', '🔮 كرة ملونة ×2']); if (m.mb) tags.push(['c', '⚔️ كرة المباراة']);
  m.t.forEach((t, i) => { if (t.doubleUntil > m.clock) tags.push(['g', '✖️2 ' + t.short]); if (t.star != null) { const p = m.players.find(q => q.id === t.star); if (p && m.clock < 39) tags.push(['g', '⭐ ' + p.name.split(' ')[0]]); } if (t.susp.length) tags.push(['c', '🚫 ' + t.short + ' ' + t.susp.length]); });
  const key = tags.map(t => t.join('')).join('|'); if (key !== S.tagKey) { S.tagKey = key; $('tags').innerHTML = tags.map(t => '<span class="' + t[0] + '">' + esc(t[1]) + '</span>').join(''); }
  const t0 = m.t[0], cb = $('cardBtn'); if (!t0.card) { cb.className = 'none'; $('cardIco').textContent = '—'; $('cardName').textContent = 'لا بطاقة'; }
  else { $('cardIco').textContent = KL.CARDS[t0.card].ico; $('cardName').textContent = KL.CARDS[t0.card].ar; cb.className = m.canUseCard(0) ? 'ready' : 'locked'; }
  const b = m.ball, sp = m.sp; let L, dimB = false, dimC = false, hint = '';
  if (sp && sp.kind === 'penalty') { L = ['تسديد', 'تمرير', 'مهارة', 'جري']; dimB = dimC = true; if (sp.team === 0 && sp.sub === 'aim') hint = 'حرّك العصا لتحديد الزاوية · اضغط مطولاً للقوة'; else if (sp.team === 1 && sp.sub !== 'done') hint = 'الخصم يسدد ركلة جزاء!'; }
  else if (sp && sp.kind === 'shootout') { L = ['تسديد', 'تمرير', 'مهارة', 'جري']; dimB = true; if (sp.team === 0 && sp.sub === 'live' && !sp.kicked) hint = '⏱ ' + Math.max(0, 5 - sp.live).toFixed(1) + ' ث — انطلق وسدّد!'; else if (sp.team === 1 && sp.sub !== 'done') hint = 'انفراد للخصم — الحارس يدافع'; }
  else if (m.mode === 'freekick' && m.fkTeam === 0) { L = ['تسديد', 'تمرير', 'مهارة', 'جري']; dimC = true; hint = 'ركلة حرة! مرّر أو سدّد (العصا لتحديد الاتجاه)'; }
  else if (m.mode === 'freekick') { L = ['قطع', 'تبديل', 'ضغط', 'جري']; hint = 'ركلة حرة للخصم'; }
  else if (b.owner && b.owner.t === 0 && !b.owner.isGK) L = ['تسديد', 'تمرير', 'مهارة', 'جري']; else L = ['قطع', 'تبديل', 'ضغط', 'جري'];
  const set = (id, t, dim) => { const s = $(id).firstChild; if (s.textContent !== t) s.textContent = t; $(id).classList.toggle('dim', !!dim); };
  set('btnA', L[0]); set('btnB', L[1], dimB); set('btnC', L[2], dimC); set('btnD', L[3]);
  const a = $('btnA'); a.style.setProperty('--c', (m.charge * 360) + 'deg'); a.classList.toggle('chg', m.charge > 0.03);
  const h = $('hint'); if (hint) { h.textContent = hint; h.classList.add('on'); } else h.classList.remove('on');
}
function togglePause() { if (!S.match || S.screen !== 'hud') return; if (S.online) { quitMatch(); return; } if (S.paused && !$('pauseBox').classList.contains('hide')) { overlay('pauseBox', false); S.paused = false; } else if (!S.paused && S.match.mode !== 'ended') { S.paused = true; overlay('pauseBox', true); } }

/* ---------------- الحلقة الرئيسية ---------------- */
let last = 0;
function frame(t) {
  requestAnimationFrame(frame); const dt = Math.min(0.1, (t - last) / 1000 || 0.016); last = t;
  const m = S.match;
  if (m) {
    if (!S.paused) { m.update(dt, readInput()); clearEdges(); updateHUD(); }
    if (S.endT > 0) { S.endT -= dt; if (S.endT <= 0) { S.endT = 0; showResult(S.endRes); } }
    if (S.jk > 0) { S.jk -= dt; $('jkTimer').textContent = 'سيُسمح تلقائياً خلال ' + Math.ceil(S.jk) + ' ث'; if (S.jk <= 0) jokerChoose('allow'); }
  }
  try { S.eng.render(dt); } catch (e) { if (!S.rerr) { S.rerr = 1; const b = $('err'); b.classList.remove('hide'); b.textContent = '⚠ render: ' + e.message + ' (اضغط للإخفاء)'; console.error(e); } }
}

/* ---------------- الشاشة الترحيبية + الفيديو ---------------- */
function initIntro() {
  const A = KL.ASSETS, hide = el => { el.onerror = () => { el.style.visibility = 'hidden'; }; };
  const l1 = $('inLg1'), l2 = $('inLg2'), dv = $('inDev');
  l1.src = A.league; l1.onerror = () => { l1.onerror = () => { l1.style.visibility = 'hidden'; }; l1.src = KL.LEAGUE_LOGO; };
  l2.src = A.nations; l2.onerror = () => { l2.onerror = () => { l2.style.visibility = 'hidden'; }; l2.src = KL.NATIONS_LOGO; };
  dv.src = A.dev; hide(dv);
  let done = false; const v = $('inVideo');
  const finish = () => { if (done) return; done = true; try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { } $('introVid').classList.add('hide'); show('scrHome'); };
  show('scrIntro');
  $('inStart').onclick = () => {
    try { S.eng.sound.init(); } catch (e) { }
    $('introLogos').style.display = 'none'; $('introVid').classList.remove('hide');
    v.src = A.video; v.onended = finish; v.onerror = finish;
    const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; const p2 = v.play(); if (p2 && p2.catch) p2.catch(finish); });
    setTimeout(() => { if (!done && v.readyState < 2 && v.currentTime === 0) finish(); }, 15000);
  };
  $('inSkip').onclick = finish;
}

/* ---------------- الإقلاع ---------------- */
/* ملاءمة الواجهة لحجم الشاشة الفعلي (أشرطة المتصفح، الشاشات الصغيرة) */
function fitScreen() {
  const vh = window.innerHeight, vw = window.innerWidth; let z = Math.min(vh / 440, vw / 820); z = Math.max(0.25, Math.min(1, z)); if (vh > vw) z = Math.max(0.25, Math.min(1, vw / 400));
  const r = document.documentElement.style; r.setProperty('--z', z.toFixed(3)); r.setProperty('--vh', (vh / z / 100).toFixed(3) + 'px');
}
fitScreen(); window.addEventListener('resize', fitScreen); window.addEventListener('orientationchange', () => setTimeout(fitScreen, 200));
function init() {
  try { S.eng = new KL.Engine($('gl')); } catch (e) { $('bootMsg').textContent = 'جهازك لا يدعم WebGL: ' + e.message; return; }
  window.addEventListener('resize', () => { S.eng.resize(); checkRotate(); }); window.addEventListener('orientationchange', () => setTimeout(() => { S.eng.resize(); checkRotate(); }, 250));
  const hl = $('homeLogo'); hl.src = KL.ASSETS.league; hl.onerror = () => { hl.onerror = () => hl.style.display = 'none'; hl.src = KL.LEAGUE_LOGO; }; if (0) hl.src = KL.LEAGUE_LOGO; 
  KL.initLineup({ back: () => show(S.screen === 'hud' || S.screen === 'scrLineup' ? 'scrHome' : S.screen) });
  /* القائمة الرئيسية: 3 صفحات أفقية بأزرار صور من assets */
  $$('#hmTabs button').forEach(b => b.onclick = () => { snd('ui'); $$('#hmTabs button').forEach(x => x.classList.toggle('on', x === b)); $$('.hm-page').forEach(x => x.classList.toggle('on', x.dataset.p === b.dataset.p)); });
  $$('.hb').forEach(btn => {
    const names = btn.dataset.img.split(','), cand = []; names.forEach(n => ['png', 'webp', 'jpg'].forEach(e => cand.push('assets/' + n + '.' + e)));
    let i = 0; const im = new Image(); im.alt = btn.textContent; im.onload = () => { btn.classList.add('hasimg'); btn.insertBefore(im, btn.firstChild); }; im.onerror = () => { if (i < cand.length) im.src = cand[i++]; }; im.src = cand[i++];
    btn.onclick = () => {
      try { S.eng.sound.init(); } catch (e) { } snd('ui'); const a = btn.dataset.act;
      if (a === 'mena' || a === 'nations') menuGo(a); else if (KL.ui && KL.ui.acts && KL.ui.acts[a]) KL.ui.acts[a](); else toast('هذا الوضع غير متاح');
    };
  });
  $$('[data-go]').forEach(b => b.onclick = () => { S.eng.sound.init(); snd('ui'); menuGo(b.dataset.go); });
  $$('[data-back]').forEach(b => b.onclick = () => { snd('ui'); show('scrHome'); });
  $('hubBack').onclick = () => { snd('ui'); if (S.tour && S.tour.career && KL.careerOpen) KL.careerOpen(); else show('scrHome'); };
  $$('#hubTabs button').forEach(b => b.onclick = () => { hubTab = b.dataset.tab; snd('ui'); renderHub(); });
  $('btnSettings').onclick = () => { applyCfg(); overlay('settingsBox', true); }; $('setClose').onclick = () => { saveCfg(); overlay('settingsBox', false); };
  $('btnHow').onclick = () => { $('howTxt').innerHTML = HOW; overlay('howBox', true); }; $('howClose').onclick = () => overlay('howBox', false);
  $('btnFull').onclick = () => { try { const d = document.documentElement; const fr = (d.requestFullscreen || d.webkitRequestFullscreen || function () { return Promise.resolve(); }).call(d); if (fr && fr.catch) fr.catch(() => { }); else if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) toast('ملء الشاشة غير مدعوم هنا — افتح اللعبة في متصفح Chrome'); if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } };
  $('bPause').onclick = togglePause; $('pResume').onclick = togglePause;
  $('bCam').onclick = () => { const c = S.eng.cycleCam(); toast(KL.CAMS[c], 1200); S.cfg.cam = c; store.set('kl_cfg', S.cfg); };
  $('pCam').onclick = () => $('bCam').onclick();
  $('bSnd').onclick = () => { S.cfg.snd = +S.cfg.snd ? 0 : 1; store.set('kl_cfg', S.cfg); applyCfg(); }; $('pSnd').onclick = () => $('bSnd').onclick();
  $('pQuit').onclick = () => { overlay('pauseBox', false); quitMatch(); };
  $('cardBtn').addEventListener('pointerdown', e => { e.preventDefault(); onCardBtn(); });
  $('pickCancel').onclick = () => { overlay('pickCard', false); S.paused = false; };
  $('jkCancel').onclick = () => jokerChoose('cancel'); $('jkSteal').onclick = () => jokerChoose('steal'); $('jkAllow').onclick = () => jokerChoose('allow');
  bindBtn('btnA', 'A'); bindBtn('btnB', 'B'); bindBtn('btnC', 'C'); bindBtn('btnD', 'D'); bindStick();
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.match && !S.online && !S.paused && S.match.mode !== 'ended') { S.paused = true; overlay('pauseBox', true); } });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('touchmove', e => { if (S.screen === 'hud') e.preventDefault(); }, { passive: false });
  KL.openHub = () => { renderHub(); show('scrHub'); };
  KL.api = { S, show, startMatch, startRaw: realStart, cleanupMatch, pickTeam, dialog, toast, busy, lg, nm, store, overlay, setLogo, esc, teamGrid, snd };
  if (KL.initModes) KL.initModes(KL.api);
  applyCfg(); $('boot').classList.remove('show'); initIntro(); requestAnimationFrame(frame);
}
window.__loadThree(init, () => { $('bootMsg').textContent = 'تعذّر تحميل مكتبة three.js — تأكد من الإنترنت أو ضع ملف three.min.js بجانب الملفات.'; });
window.KLApp = S;
})();

;

window.__KL_END = 1;
