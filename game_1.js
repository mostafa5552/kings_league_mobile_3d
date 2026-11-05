/* KING'S LEAGUE 3D — game_1.js (جزء 1 من 6) */
/* ===== config.js ===== */
/* ============================================================
   إعدادات Supabase (مفتاح publishable آمن للنشر — لا تضع service_role هنا أبداً)
   ============================================================ */
window.KL_CONFIG = {
  SUPABASE_URL: 'https://cctxdrbpqackrfujgquo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_rjDO_XO9oxzlDAn9QpgNvw_pw9vQRQq'
};

;
/* ===== data.js ===== */
/* ============================================================
   KING'S LEAGUE MENA 3D — data.js
   (1/4) البيانات: الفرق، المنتخبات، اللاعبين، الأطقم، البطاقات
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- الألوان ---------- */
const C = {
  navy: '#0a1f5c', sky: '#38b6ff', white: '#f4f4f4', black: '#101010', gold: '#d4af37', neon: '#d6ff00', red: '#e11d1d',
  dgreen: '#0d5c2e', royal: '#1a47e0', gray: '#9aa0a6', orange: '#ff7f11', dgray: '#4b5058', turq: '#13b5c9', pink: '#ff4fa0', purple: '#7e2fd0',
  yellow: '#ffdf00', coral: '#ff6b57', amber: '#ffbf00', cyan: '#19c3e6', green: '#0f8f3c', crimson: '#b3123c', cream: '#f4ecd2',
  maroon: '#7d1230', mint: '#8ff0c2', lime: '#b6f000', charcoal: '#2f3a40', lav: '#b79cf0', silver: '#c4c8cc', olive: '#6f7d2a',
  brown: '#6b4226', teal: '#0e9aa7', magenta: '#e0189f', skyb: '#75c8ff', redp: '#d81e2c', gmar: '#0b7a3b', mintg: '#98f0c8'
};
KL.COLORS = C;

/* ---------- البطاقات السرية ---------- */
KL.CARDS = {
  penalty:  { ico: '🎯', ar: 'ركلة جزاء', desc: 'ركلة جزاء مباشرة ضد الحارس.' },
  shootout: { ico: '🏃', ar: 'شووت آوت', desc: 'انفراد من منتصف الملعب، لديك 5 ثوانٍ فقط للتسديد.' },
  double:   { ico: '✖️2', ar: 'الهدف المضاعف', desc: 'كل أهدافك تُحتسب بهدفين لمدة 4 دقائق.' },
  suspend:  { ico: '🚫', ar: 'الإيقاف الزمني', desc: 'اطرد لاعباً من الخصم (غير الحارس) لمدة 4 دقائق.' },
  star:     { ico: '⭐', ar: 'اللاعب النجم', desc: 'أهداف لاعبك المختار تُحتسب بهدفين حتى الدقيقة 39.' },
  reverse:  { ico: '🔁', ar: 'العقوبة العكسية', desc: 'تُجبر لاعباً من الخصم على تسديد جزاء ضد مرماك؛ إن أضاعها تحصل على هدف.' },
  joker:    { ico: '🃏', ar: 'الجوكر', desc: 'استخدمه كأي بطاقة، أو ألغِ/اسرق بطاقة الخصم لحظة إعلانه.' }
};

/* ---------- أدوات الألوان (Lab) لضمان تباين الأطقم ---------- */
function rgb(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
function lab(h) {
  let [r, g, b] = rgb(h).map(v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; });
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = (r * 0.2126 + g * 0.7152 + b * 0.0722), z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dE = KL.dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

/* اختيار طقم الفريقين: ممنوع التشابه، والحراس بألوان مختلفة عن الجميع */
KL.pickKits = function (A, B) {
  const combos = [['home', 'home'], ['home', 'away'], ['away', 'home'], ['away', 'away']];
  let chosen = null, best = null, bs = -1;
  for (const [ka, kb] of combos) {
    const d = dE(A.kits[ka].shirt, B.kits[kb].shirt), sd = dE(A.kits[ka].shorts, B.kits[kb].shorts);
    if (d >= 45 && sd >= 15) { chosen = [ka, kb]; break; }
    const sc = d + 0.25 * Math.min(sd, 40); if (sc > bs) { bs = sc; best = [ka, kb]; }
  }
  const pick = chosen || best;
  const ka = Object.assign({}, A.kits[pick[0]]), kb = Object.assign({}, B.kits[pick[1]]);
  const cand = ['#00e676', '#ff9100', '#ff4081', '#00b0ff', '#ffea00', '#b388ff', '#212121', '#ffffff'];
  const gkc = avoid => { let b2 = cand[0], s = -1; for (const c of cand) { const m = Math.min.apply(null, avoid.map(v => dE(c, v))); if (m > s) { s = m; b2 = c; } } return b2; };
  ka.gk = gkc([ka.shirt, kb.shirt, ka.shorts, kb.shorts]);
  kb.gk = gkc([ka.shirt, kb.shirt, ka.shorts, kb.shorts, ka.gk]);
  ka.gkShorts = dE(ka.gk, '#222222') < 35 ? '#eeeeee' : '#222222';
  kb.gkShorts = dE(kb.gk, '#222222') < 35 ? '#eeeeee' : '#222222';
  ka.which = pick[0]; kb.which = pick[1];
  return [ka, kb];
};

/* ---------- شارة احتياطية (Canvas) ---------- */
KL.badge = function (t, size) {
  size = size || 128;
  const key = t.id + size; KL._b = KL._b || {}; if (KL._b[key]) return KL._b[key];
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const k = t.kits.home;
  x.fillStyle = k.shirt; x.beginPath(); x.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2); x.fill();
  x.lineWidth = size * 0.07; x.strokeStyle = k.shorts; x.stroke();
  x.fillStyle = dE(k.shirt, '#ffffff') < 40 ? '#111' : '#fff';
  x.font = '900 ' + (size * 0.34) + 'px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(t.short, size / 2, size / 2 + 2);
  return KL._b[key] = c.toDataURL();
};

/* ---------- توليد القدرات ---------- */
function attrs(name, pos, star, ovr) {
  const r = rng(hash(name)), lv = (ovr - 72) / 100, s = star ? 0.07 : 0;
  const g = (b, w) => clamp(b + r() * w + lv + s, 0.3, 0.98);
  const pace = clamp(0.94 + r() * 0.14 + (star ? 0.02 : 0), 0.9, 1.12);
  if (pos === 'GK') return { pace: 0.95, shoot: 0.3, pass: g(0.45, 0.3), def: 0.4, drb: 0.3, gk: g(0.6, 0.3) };
  if (pos === 'FW') return { pace, shoot: g(0.62, 0.28), pass: g(0.5, 0.3), def: g(0.3, 0.2), drb: g(0.6, 0.3), gk: 0.1 };
  if (pos === 'MID') return { pace, shoot: g(0.5, 0.3), pass: g(0.62, 0.28), def: g(0.5, 0.25), drb: g(0.55, 0.3), gk: 0.1 };
  return { pace, shoot: g(0.38, 0.25), pass: g(0.5, 0.3), def: g(0.62, 0.28), drb: g(0.4, 0.25), gk: 0.1 };
}
const NUMPOOL = { GK: [1, 12, 13], DEF: [2, 3, 4, 5, 15, 16], MID: [6, 8, 10, 14, 17, 18, 20], FW: [7, 9, 11, 19, 21] };
function fillNums(list) {
  const used = new Set(list.filter(p => p.num != null).map(p => p.num)); let extra = 30;
  list.forEach(p => { if (p.num == null) { let n = (NUMPOOL[p.pos] || []).find(v => !used.has(v)); if (n == null) { while (used.has(extra)) extra++; n = extra; } p.num = n; used.add(n); } });
}
function finish(t, list) {
  const starred = list.filter(p => p.star).length;
  const useStar = starred < list.length * 0.5;
  list.forEach(p => { p.star = useStar && p.star; p.a = attrs(t.name + p.name, p.pos, p.star, t.ovr); });
  fillNums(list); t.players = list; return t;
}

/* ---------- الفرق (King's League MENA) ---------- */
const L = 'https://i.supaimg.com/51fed601-7bff-487e-8197-3189211d9777/';
KL.LEAGUE_LOGO = L + '881ef962-8370-4d85-9582-7f153108d6cd.webp';
const kit = (s, sh, tr) => ({ shirt: s, shorts: sh, trim: tr || s });

function parseClub(txt) {
  return txt.trim().split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [n, name, pos] = l.split('|'); return { num: n === '' ? null : parseInt(n, 10), name: name.trim(), pos: pos.trim(), star: false };
  });
}
function club(o) {
  const t = { id: o.id, type: 'club', name: o.name, ar: o.name, short: o.short, logo: o.logo, ovr: o.ovr, kits: { home: o.home, away: o.away } };
  return finish(t, parseClub(o.roster));
}

KL.CLUBS = [
  club({ id: 'ra2', name: 'RA2 FC', short: 'RA2', ovr: 78, logo: L + '02730e1c-dc76-49b2-8e50-7b0d8df317fe.png', home: kit(C.orange, C.orange, C.black), away: kit(C.black, C.black, C.orange), roster: `
22|Albaraa Aldosari|GK
1|Eloy Amoedo|GK
87|Hussam Tah|DEF
21|Sergio Juste|DEF
88|Abulaziz Maiga|MID
10|David Reyes|MID
13|Mansour Alzahrani|MID
8|Mark Sorroche|MID
11|Ossama Said Aly Essa|MID
6|Théo Chendri|MID
7|Diego Jiménez|FW
77|Nawaf Saleh|FW` }),
  club({ id: 'dr7', name: 'DR7 FC', short: 'DR7', ovr: 79, logo: L + '41d177f0-ea9d-47ba-8b57-9c1cf09a324f.webp', home: kit(C.royal, C.royal), away: kit(C.white, C.gray), roster: `
40|Davi “Major” Natã|GK
43|Saleh Alhawsawi|GK
5|Abdul Ilah Hussein|DEF
12|Alwaleed Alsalhi|DEF
47|Denilson Lobón|DEF
4|Nawaf Arwan|DEF
6|Saleh Alqarni|DEF
18|Moath Alasiri|MID
19|Abdullah Alaqeeli|FW
11|Faris Almaleh|FW
7|Igo Canindé|FW
24|Jhon Palacios|FW
9|Sultan Azaz|FW` }),
  club({ id: 'fwaz', name: 'FWAZ', short: 'FWZ', ovr: 76, logo: L + 'fbdf5123-ebff-44aa-a389-80342f2782eb.webp', home: kit(C.purple, C.purple), away: kit(C.white, C.black), roster: `
99|Igor Campos|GK
24|Marouane Mzirira|GK
17|David Loaiza|DEF
5|Everton "Chiclete" Araújo|DEF
6|Mohamed Bencherif|DEF
7|Abdulaziz Al Dabl|MID
80|Fouad El Amrani|MID
10|Gerard Verge|MID
26|Lucas "Pulguinha"|MID
8|Sohaib Rektout|MID
88|Cristian Hernández|FW
11|Maicol Hernández|FW
29|Muhannad Ali|FW` }),
  club({ id: 'abo', name: 'ABO FC', short: 'ABO', ovr: 74, logo: L + '76dca4b7-7981-4d50-a5f8-09d38cd135a2.webp', home: kit(C.navy, C.sky), away: kit(C.white, C.navy), roster: `
1|Manel Jiménez|GK
22|Moayad Alkarnib|GK
4|Faisal Gul Ahmad|DEF
17|Johnatan Baton|DEF
5|Obada Barud|DEF
91|Abdulrazaq Alshanqiti|MID
20|Fahad Aljohani|MID
89|Habib Abu Bakar|MID
14|Malek Althaqafi|MID
9|Abdulraheem Saleh Ali Jashan|FW
7|Bilal Fadili|FW
19|Galde Hugue|FW` }),
  club({ id: '3bs', name: '3BS', short: '3BS', ovr: 77, logo: L + '8cfa642f-6c16-41eb-914e-0e6550833c7f.webp', home: kit(C.dgreen, C.black), away: kit(C.white, C.white, C.dgreen), roster: `
99|JMK|GK
1|Mohammad Kanbar|GK
24|Abde Bakkali|DEF
7|Amir Aljawabrah|DEF
19|Jarrah Alnaser|DEF
4|Sahir Boumhand|DEF
27|Amine Kheche|MID
25|Giannelli Imbula|MID
14|Mostafa Muhamed|MID
11|Bader Alnaimat|FW
8|Carlos Omabegho|FW
10|Khaled Abbas|FW
9|Moussa Sao|FW` }),
  club({ id: 'turbo', name: 'Turbo', short: 'TUR', ovr: 68, logo: L + '44823516-1678-48ae-bcf6-f72a9511fae8.png', home: kit(C.neon, C.black), away: kit(C.dgray, C.black), roster: `
|Ahmed Awad|GK
|Eslam Ahmed|GK
|Eslam Mohamed|DEF
|Islam Arafa|DEF
|Zeiad Abdo|DEF
|Ahmed Abdalla|MID
|Amr Abdelrahman|MID
|Hussien Mostafa|MID
|Islam Moursy|MID
|Moaaz Hemida|MID
|Omar Mohamed|MID
|Youssef Elnabarawy|MID
|Abd Elgleel|FW
|Shehab Mostafa|FW
|Abdelrahman Issa|FW` }),
  club({ id: 'redzone', name: 'Red Zone', short: 'RED', ovr: 75, logo: L + '823721c2-d499-4698-b408-ffbf616a4d9a.png', home: kit(C.red, C.red, C.black), away: kit(C.black, C.black, C.red), roster: `
59|Abdallah Almbaidin|GK
1|Camilo Gaviria|GK
5|Daniel Pérez|DEF
23|Mahmoud Mishael|DEF
6|Mohamed Amin|DEF
4|Ahmad Mohammad|MID
10|Jero Martín|MID
20|Khalid Dardas|MID
27|Mahmoud Badran|MID
8|Mohamed Abdelfattah|MID
7|Christian Ronchi|FW
11|Gilles Vidal|FW
30|Julen Álvarez|FW
9|Samer Ahmad|FW` }),
  club({ id: 'bakhira', name: 'Bakhira FC', short: 'BAK', ovr: 73, logo: L + 'ab9cbd7c-734d-4b9b-a200-4db98ecf3c41.png', home: kit(C.turq, C.white), away: kit(C.white, C.white), roster: `
59|Bilal Hmidouch|GK
1|Mame Cheikh|GK
5|Ben Hssayen|DEF
45|Herbert Paul|DEF
13|Maicon Silva|DEF
6|Mehdi Gacem|DEF
39|Memos Sözer|DEF
26|Walid Soudi|DEF
10|Amar Cekic|FW
8|Karim Tarfi|FW
11|Luiz "Pepinho" Souza|FW
90|Yacine Boucharoud|FW` }),
  club({ id: 'ultra', name: 'Ultra Chmicha', short: 'ULT', ovr: 80, logo: L + '612a5ae4-e017-4903-b2fd-517ff5c72282.png', home: kit(C.black, C.black, C.gold), away: kit(C.neon, C.black), roster: `
12|Hamza Benadraa|GK
1|Marc Briones|GK
18|Abdenacer Afi|DEF
8|Alex "Capi" Domingo|DEF
13|Sagar Escoto|DEF
23|Dani Liñares|MID
19|Soufiane El Jadi|MID
20|Ali Acha|FW
7|Marc Granero|FW
9|Masi Dabo|FW
10|Walid Jaadi|FW
99|Youssef Chakiri|FW` }),
  /* ملاحظة: لم يُرسل تشكيل Rising Peaks في الملف، لذلك أسماؤه عشوائية مؤقتة — استبدلها بالحقيقية متى أردت */
  club({ id: 'rising', name: 'Rising Peaks', short: 'RIS', ovr: 70, logo: L + 'd3bcff24-b372-449b-81a2-cb6793e601db.png', home: kit(C.pink, C.black), away: kit(C.white, C.pink), roster: `
1|Karim Zaki|GK
12|Omar Hadi|GK
2|Adel Rashid|DEF
3|Walid Karam|DEF
4|Samir Fares|DEF
5|Tamer Nasr|DEF
6|Nour Eldin|MID
8|Yassin Mourad|MID
10|Hady Salem|MID
14|Rami Khalil|MID
7|Zaid Hakim|FW
9|Amir Seif|FW
11|Basem Wagdy|FW` })
];

/* ---------- أعلام المنتخبات + شعارات (دروع مرسومة بالكود) ---------- */
KL.FLAG = { BRA: '🇧🇷', ARG: '🇦🇷', CHI: '🇨🇱', COL: '🇨🇴', PER: '🇵🇪', MEX: '🇲🇽', USA: '🇺🇸', EGY: '🇪🇬', MAR: '🇲🇦', ALG: '🇩🇿', NGA: '🇳🇬', ESP: '🇪🇸', FRA: '🇫🇷', ITA: '🇮🇹', GER: '🇩🇪', POL: '🇵🇱', ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', POR: '🇵🇹', NED: '🇳🇱', KSA: '🇸🇦', QAT: '🇶🇦', IDN: '🇮🇩', JPN: '🇯🇵', KOR: '🇰🇷', CHN: '🇨🇳' };
/* لو عندك روابط شعارات حقيقية للمنتخبات ضعها هنا، مثال:  BRA: 'https://.../brazil.png'  — وإلا يُرسم درع تلقائي بألوان المنتخب */
KL.NATION_LOGOS = {BRA:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/419201f3-9895-4b62-b2c0-77ddd2311fcf.png',ARG:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/f2a28b5a-7e3b-4d9e-a4c6-ff65f7de2a9c.png',CHI:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/dd357766-7a33-4e64-ab21-fe35e1d17af2.png',COL:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/aa9044cc-ce58-475d-8fae-b458562d08b3.png',PER:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/b272f91e-321b-4df7-b7d6-88a94a2c7c62.png',MEX:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/92904b80-359d-4a2e-880d-70f098d659a5.png',USA:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/5de786ac-bf48-4f50-9f40-37bc05a93e2e.png',EGY:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/8652cf35-7996-43eb-9866-21e0891db002.png',MAR:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/bc526748-38df-42b4-8fcf-16931099646a.png',ALG:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/e626c419-2eba-41c0-af47-784e697c2cc8.png',NGA:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/aef2d752-8721-49f6-84ae-4686d013668e.png',ESP:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/9a423320-225b-44e3-ab72-672c181b6d4c.png',FRA:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/f61003d3-f444-43c7-b7d8-43e541127cae.png',ITA:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/52815dbb-0d84-4fe3-a5ab-ef9f422aab1b.png',GER:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/7444f649-5b7e-42e6-ab76-6e0262d01f0d.png',POL:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/fc5720bf-0d50-4a91-a147-922572ebb986.png',ENG:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/7bd209bb-f3bc-4bc9-8464-9ad3aae7e09e.png',POR:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/7aa40e18-568c-4c31-8c02-f488802bfc9a.png',NED:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/9943ed7e-fd00-4713-827c-1f2f4eca9a2e.png',KSA:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/cadcf543-bdcf-43cd-ad83-55091c3ad778.png',QAT:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/97b005b3-2787-476d-abab-b63c281128ab.png',IDN:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/b9c000f7-a329-44b6-9a90-a6cb7e8020bf.png',JPN:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/f815113a-47e4-4034-8b43-f8a5cbab8a98.png',KOR:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/f18de191-bb79-42bb-9075-a5be67fa8042.png',CHN:'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/4cba8c55-b927-4ecc-98e4-bf468bdab3ef.png'};
KL.NATIONS_LOGO = 'https://i.supaimg.com/9b836138-e901-4e3b-a57b-85af24b46cef/abc5d11f-0420-4b69-8091-44179041aaf6.png';
KL.crest = function (t, size) {
  size = size || 128; KL._c = KL._c || {}; const key = t.id + 'c' + size; if (KL._c[key]) return KL._c[key];
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), s = size, k = t.kits.home;
  x.beginPath(); x.moveTo(.12 * s, .06 * s); x.lineTo(.88 * s, .06 * s); x.lineTo(.88 * s, .5 * s); x.quadraticCurveTo(.88 * s, .84 * s, .5 * s, .96 * s); x.quadraticCurveTo(.12 * s, .84 * s, .12 * s, .5 * s); x.closePath();
  x.save(); x.clip(); x.fillStyle = k.shirt; x.fillRect(0, 0, s, s); x.fillStyle = k.shorts; x.fillRect(0, .62 * s, s, s); x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(0, 0, s, .2 * s); x.restore();
  x.lineWidth = s * .05; x.strokeStyle = '#ffd400'; x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = (s * .34) + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; x.fillText(KL.FLAG[t.id] || '', s * .5, s * .37);
  x.font = '900 ' + (s * .19) + 'px Arial'; x.lineWidth = s * .04; x.strokeStyle = 'rgba(0,0,0,.7)'; x.fillStyle = '#fff'; x.strokeText(t.short, s * .5, s * .76); x.fillText(t.short, s * .5, s * .76);
  return KL._c[key] = c.toDataURL();
};

/* ---------- المنتخبات (King's League NATIONS) ---------- */
function parseNation(str) {
  const out = [];
  str.split('|').forEach(sec => {
    const [k, rest] = sec.split(':'); const pos = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'FW' }[k.trim()];
    rest.split(',').forEach(tok => {
      tok = tok.trim(); const m = tok.match(/^(\d+)\s+(.+?)(\*)?$/); if (!m) return;
      out.push({ num: parseInt(m[1], 10), name: m[2].trim(), pos, star: !!m[3] });
    });
  });
  return out;
}
function nation(id, ar, en, ovr, h, a, r) {
  const t = { id, type: 'nation', name: en, ar, short: id, logo: KL.NATION_LOGOS[id] || null, ovr, kits: { home: kit(h[0], h[1]), away: kit(a[0], a[1]) } };
  return finish(t, parseNation(r));
}
KL.NATIONS = [
  nation('BRA', 'البرازيل', 'Brazil', 86, [C.yellow, C.royal], [C.royal, C.yellow], `GK:27 Esaú Nascimento,33 Victor Hugo|DF:2 Rafael Souza*,3 Wembley Luiz,6 Canhoto,20 Matheus Dedo|MF:8 Well,10 Andreas Vaz,12 Jeffinho,17 Lucas Ferreira*,19 Luan Mestre|FW:7 Everton Felipe,9 Kelvin Oliveira,11 Leleti,14 Lipão`),
  nation('ARG', 'الأرجنتين', 'Argentina', 85, [C.skyb, C.black], [C.navy, C.skyb], `GK:1 Leo Silva,23 Luís Sánchez|DF:2 Ezequiel Cohen,3 Fabrizio Foresto,5 Dago Campari,8 Facu Navajas,21 Leonel Vangioni|MF:6 Santiago Rotemberg,10 Matías Giménez*,11 Franco Romero,27 Gonzalo Lescano|FW:7 Tomás Sandoval,9 Aaron Martínez,14 Joaquín Ledesma*,17 Facu Romero`),
  nation('CHI', 'تشيلي', 'Chile', 75, [C.coral, C.white], [C.white, C.navy], `GK:1 Rodrigo Martínez,99 Matías Herrera|DF:3 Christian Vilches,19 Ezequiel Luna,24 Fernando Saavedra,80 Matías Rojas|MF:6 Felipe Contreras*,10 Mathías Vidangossy,17 Piero Gárate,21 Juan Araya,23 Ángel Iturra|FW:7 Cristóbal Pizarro*,9 Matías Donoso,28 Ignacio Herrera,30 Carlos González`),
  nation('COL', 'كولومبيا', 'Colombia', 78, [C.amber, C.navy], [C.cyan, C.navy], `GK:1 Felipe Urán,12 Camilo Mena|DF:2 Denilson Lobón,3 Santiago Cuesta*,5 Alberto Benítez,22 Yair Arias|MF:8 Brihan Gutiérrez,10 Angellot Caro,17 David Loaiza,19 Brayam Nazarit,24 Jhon Palacios|FW:7 Julio Perea,9 Duván Mosquera*,11 Alejandro Ortega,18 Cristian González`),
  nation('PER', 'بيرو', 'Peru', 74, [C.white, C.redp], [C.redp, C.white], `GK:1 Percy Valverde,17 Erick Ramírez|DF:3 Renzo Huamán*,4 Diego Quispe*,8 Luis Saravia,16 Yovanny Portilla|MF:7 Bruno Agnello,10 Ivan Gálvez,18 Rimber Sánchez,19 Jesús Honores,22 Juan Carlos Pérez,30 Kevin Gutiérrez|FW:9 Giovani Asencio,11 Luis Fidel Vivas,15 Jorge Sevilla`),
  nation('MEX', 'المكسيك', 'Mexico', 77, [C.green, C.white], [C.black, C.green], `GK:1 Antonio Monterde,26 Moisés Dabbah|DF:5 Martín Rodríguez,6 Carlos Valdez,13 Eddie Sánchez,19 Tonatiuh Mejía,90 Alexis Silva|MF:8 Luis Hernández*,10 Obed Martínez,11 Martín Lara,14 Emiliano Ramírez*|FW:7 José Askenazi,22 Daviz Junco,34 Genaro Castillo,77 Diego Martínez`),
  nation('USA', 'أمريكا', 'USA', 76, [C.navy, C.white], [C.crimson, C.navy], `GK:1 Eduardo Cortés,23 Anthony Martinez|DF:5 Brady O'Neill,13 Danny Núñez,18 Erik Macías,24 Stefan Mijatovic|MF:7 Gustavo Gomes,10 Gabriel Costa,11 Roc Bancells,17 Sebastian Mendez,25 Juan Ramírez,31 David Ortiz|FW:9 Tyler Brooks*,15 Luiz Morales,22 Raheem Taylor-Parkes`),
  /* مصر: لم يُرسل لها تشكيل في الملف، أسماؤها عشوائية مؤقتة */
  nation('EGY', 'مصر', 'Egypt', 75, [C.crimson, C.black], [C.cream, C.black], `GK:1 Omar Fathy,22 Youssef Salem|DF:2 Ahmed Nabil,3 Mostafa Adel,4 Hossam Ragab,5 Karim Essam|MF:6 Tarek Samir,8 Mahmoud Reda,10 Amr Sherif*,14 Ziad Ramy,16 Hany Wael|FW:7 Ali Magdy,9 Omar Khaled*,11 Seif Anwar,17 Adham Tamer`),
  nation('MAR', 'المغرب', 'Morocco', 79, [C.maroon, C.gmar], [C.green, C.redp], `GK:1 Sofiane Bouzian,31 Moustafa Idrissi|DF:3 Nadir Louah,8 Sohaib Rektout,17 Yacine Dahmani,18 Abdenacer Afi,23 Younes Boudadi,48 Youssef Khatiri|MF:6 Hamza Benali*,10 Amine Tazi*,14 Zakaria El Fassi*,80 Fuad El Amrani|FW:7 Isma Reguia,11 Mohamed Lamlih,98 Walid Jaadi`),
  nation('ALG', 'الجزائر', 'Algeria', 75, [C.dgreen, C.white], [C.mint, C.dgreen], `GK:23 El-Hedi Boussaid,30 Yonni Bouguerra|DF:3 Karim Benaissa*,5 Zahana Haouari,6 Amine Bencherif,12 Carl Medjani|MF:7 Riyad Messaoudi,10 Ismaïl Haddou,18 Sofiane Bendaoud,19 Moussa Haddad,20 Driss Zidane,99 Sofiane Ahmed-Kadi|FW:0 Haris El Mouttaqi,9 Yacine Belkacem*,63 Boucif El Afghani`),
  nation('NGA', 'نيجيريا', 'Nigeria', 74, [C.lime, C.dgreen], [C.dgreen, C.lime], `GK:1 Chinedu Okafor*,12 Emeka Nwosu*|DF:2 Chukwuemeka Obi*,3 Tunde Adeyemi*,4 Ikenna Eze*,5 Oluwaseun Bello*|MF:6 Chidi Okeke*,8 Femi Balogun*,10 Kelechi Anyanwu*,14 Segun Ogunleye*,16 Obinna Uche*|FW:7 Ifeanyi Nnamdi*,9 Ayo Adebayo*,11 Samuel Okonkwo*,17 Emmanuel Igwe*`),
  nation('ESP', 'إسبانيا', 'Spain', 84, [C.red, C.navy], [C.yellow, C.red], `GK:1 Eloy Amoedo,25 Dani Pérez|DF:4 David Soriano,5 Javier Molina*,16 Àlex Gutiérrez,17 Aitor Vives,21 Carles Planas|MF:8 Marc Pelaz,10 Óscar Coll,11 Dani Liñares,19 Cristian Lobato|FW:7 Nico Santos,9 Pablo Herrero*,30 Gerard Nolla,92 Aleix Martí`),
  nation('FRA', 'فرنسا', 'France', 84, [C.royal, C.white], [C.charcoal, C.royal], `GK:15 Florian Verplanck,19 Guillaume Lesec,20 Emmanuel Mifsud|DF:17 Anthony Scaramozzino,29 Walid Soudi,78 Alseny Sano|MF:8 Théo Chendri,10 Moussa Sao,23 Clément Goguey,25 Giannelli Imbula,27 Nicolas Martins,95 Idir Ahmin|FW:9 Maxime Leclerc*,22 Jonathan Kodjia,99 Nassim Lallemand`),
  nation('ITA', 'إيطاليا', 'Italy', 80, [C.cyan, C.white], [C.lav, C.cyan], `GK:22 Gianmarco Chironi,97 Vittorio Gilli|DF:3 Vlad Marin,4 Lorenzo Bianchi*,6 Marco Evangelisti,25 Alessandro Di Dio|MF:8 Domenico Rossi,14 Federico Greco*,23 Alessandro Gelsi,30 Niccolò Marino|FW:0 Paolo Scienza,10 Matteo Perrotti,11 Alessandro Colombo,27 Giammarco Massa,77 Simone Lo Faso`),
  nation('GER', 'ألمانيا', 'Germany', 82, [C.charcoal, C.white], [C.lime, C.black], `GK:1 Daniel Dreesen,29 Aboubakar Fofana|DF:3 Hagen Blohm,5 Herbert Paul,6 Daniel Jelisic,21 Salvatore Giambra,22 Emir Sejdovic|MF:7 Nick Salihamidžić,8 Lukas Schneider*,10 Amar Cekić,17 Danny Blum,77 Mehmet-Can Senocak|FW:9 Serhat Imsak,11 Yazid Tambo,19 Felix Neumann*`),
  nation('POL', 'بولندا', 'Poland', 74, [C.cream, C.redp], [C.maroon, C.white], `GK:25 Dawid Zioberro,94 Patryk Zapała|DF:3 Marcin Kowalski*,4 Tomasz Nowak*,17 Julien Tadrowski,27 Kamil Kucharski|MF:6 Roger Guerreiro,8 Karol Bienias,10 Norbert Jaszczak,21 Jakub Hat|FW:7 Bartłomiej Dębicki,11 Dominik Środa,20 Dawid Linca,33 Michał Matczak,95 Oliver Zaręba`),
  nation('ENG', 'إنجلترا', 'England', 82, [C.silver, C.navy], [C.purple, C.silver], `GK:1 Jack Turner*,13 Harry Walker*|DF:2 Tom Bennett*,3 Callum Hughes*,4 Jordan Clarke*,5 Liam Foster*|MF:6 Ben Matthews*,8 Oliver Barnes*,10 Ryan Fletcher*,14 Josh Hartley*,16 Charlie Dawson*|FW:7 Danny Hargreaves*,9 Mason Reid*,11 Connor Ellis*,17 Luke Harrison*`),
  nation('POR', 'البرتغال', 'Portugal', 82, [C.olive, C.redp], [C.gold, C.olive], `GK:1 Rui Carvalho*,12 Tiago Pereira*|DF:2 André Lopes*,3 Diogo Ferreira*,4 Miguel Rocha*,15 Fábio Coentrão|MF:6 Bruno Mendes*,8 Nuno Costa*,10 Rafael Gomes*,14 Pedro Almeida*,16 Gonçalo Ribeiro*|FW:7 Ricardo Santos*,9 Hugo Marques*,11 Rúben Sousa*,17 Tomás Fernandes*`),
  nation('NED', 'هولندا', 'Netherlands', 80, [C.orange, C.white], [C.silver, C.orange], `GK:1 Joe van der Sar,20 Huub Schuurman|DF:3 Daan de Vries*,4 Ismail Bouhalhoul,6 Oualid Tarifit,21 Jordy Cretier|MF:8 Yuya Ikeshita,14 Sven van Dijk*,22 Mohamed Chih,23 Yassine Bensalah|FW:7 Abdelghani El Bachir,10 Jama Telli,11 Randy Wolters,12 Said Bouzambou,80 Ilias Boudouni`),
  nation('KSA', 'السعودية', 'Saudi Arabia', 73, [C.mintg, C.gmar], [C.olive, C.white], `GK:1 Moayad Alkarnib,22 Albaraa Aldosari|DF:4 Nawaf Aroan,5 Hussam Tah,8 Osama Baabdullah,18 Ali Aldhawyan|MF:6 Faisal Alotaibi*,7 Wail Bin Jubeir,10 Moath Alasiri,14 Turki Alshehri*,70 Abullah Almaghrabi|FW:9 Sultan Azaz,11 Muath Alharbi,19 Abdullah Alaqeeli,77 Nawaf Saleh`),
  nation('QAT', 'قطر', 'Qatar', 72, [C.purple, C.white], [C.brown, C.white], `GK:1 Mame Cheikh Diop,33 Houssine Benchrif|DF:3 Abdulaziz Al-Kuwari*,5 Abelilah Elferdaousy,20 Zakaria Zeroual,21 Jay Toet,98 Jorge Monegal|MF:10 Daniel Moreno,11 Mohamed Amine El Attac,17 Chouaib Wazad,40 Haythem Ben,44 Aaron Clarke|FW:7 Keshaun McCalla,9 Hassan Al-Marri*,99 Youssef Chakiri`),
  nation('IDN', 'إندونيسيا', 'Indonesia', 69, [C.pink, C.white], [C.teal, C.redp], `GK:1 Muhamad Nazil,15 Leonardo Pasautaya|DF:3 Rizky Pratama*,4 Ahmad Yani,19 Jordy Rinalvi,99 Anan Lestaluhu|MF:7 Mohammad Fauzan,8 Abdul Aziz,11 Piter Junior,18 Reza Yamani,76 Fhandy Permana,77 Gurpreet Dhillon|FW:9 Ahmad Dilbar,10 Dimas Saputra*,17 Muhammad Fatur`),
  nation('JPN', 'اليابان', 'Japan', 73, [C.teal, C.navy], [C.pink, C.navy], `GK:1 Rikiya Narita,29 Yusei Narita|DF:3 Haruto Kobayashi*,6 Shohei Agata,7 Kouga Yokoyama,83 Masaya Nozaki|MF:8 Yuya Hakozaki,9 Kazuki Hamamoto,10 Toshiya Miyashita,11 Sota Yamamoto*,74 Keisuke Shigenobu|FW:13 Ryuhei Tanabe,14 Reo Umetsu,46 Kensei Matsumori,77 Pablo Miura`),
  nation('KOR', 'كوريا الجنوبية', 'South Korea', 72, [C.lav, C.black], [C.amber, C.black], `GK:1 Kim Min-jun*,12 Park Seo-jun*|DF:2 Lee Jun-ho*,3 Choi Hyun-woo*,4 Jung Dong-hyun*,5 Kang Tae-yang*|MF:6 Han Ji-hoon*,8 Yoon Sung-min*,10 Shin Jae-won*,14 Song Min-ho*,16 Oh Seung-woo*|FW:7 Hwang Do-yun*,9 Lim Jae-hyuk*,11 Cho Won-jun*,17 Seo Kang-min*`),
  nation('CHN', 'الصين', 'China', 70, [C.magenta, C.yellow], [C.skyb, C.white], `GK:1 Li Jiahao*,12 Zhang Yichen*|DF:2 Liu Zihan*,3 Chen Haoran*,4 Zhao Junjie*,5 Yang Boyu*|MF:6 Huang Zhiwei*,8 Wu Jiawei*,10 Sun Yuxuan*,14 Zhou Mingyu*,16 Xu Tianyi*|FW:7 Lin Zihao*,9 He Chenxi*,11 Ma Jiajun*,17 Gao Ruize*`)
];

KL.CAMS = ['📺 كاميرا البث', '🎥 كاميرا قريبة', '🏃 داخل المباراة (خلف اللاعب)', '🎬 كاميرا ديناميكية', '🛰 من الأعلى', '↔ عرضية'];
KL.attrs = attrs; KL.NUMPOOL = NUMPOOL; KL.finishTeam = finish; KL.kit = kit; KL.hash = hash;
KL.ALL = {};
KL.CLUBS.concat(KL.NATIONS).forEach(t => KL.ALL[t.id] = t);
/* مجلد assets/: أسماء ملفات الشعارات المحلية (512×512) */
KL.ASSET_FILE = { ra2: 'ra2', dr7: 'dr7', abo: 'abo', '3bs': '3bs', ultra: 'ultra', fwaz: 'fwaz', turbo: 'turbo', redzone: 'redzone', bakhira: 'bakhira', rising: 'resing',
  BRA: 'brazil', ARG: 'argentina', CHI: 'chile', COL: 'colombia', PER: 'peru', MEX: 'mexico', USA: 'usa', EGY: 'egypt', MAR: 'morocco', ALG: 'algeria', NGA: 'nigeria', ESP: 'spain', FRA: 'france', ITA: 'italy', GER: 'germany', POL: 'poland', ENG: 'england', POR: 'portugal', NED: 'netherlands', KSA: 'saudi', QAT: 'qatar', IDN: 'indonesia', JPN: 'japan', KOR: 'korea', CHN: 'china' };
KL.ASSETS = { league: 'assets/kl-logo.webp', nations: 'assets/nations-league.png', dev: 'assets/desha.png', video: 'assets/video.mp4' };
KL.localLogo = t => KL.ASSET_FILE[t.id] ? 'assets/' + KL.ASSET_FILE[t.id] + '.png' : null;
KL.logoSrc = t => KL.localLogo(t) || t.logo || (t.type === 'nation' ? KL.crest(t, 128) : KL.badge(t, 128));
KL.logoFallback = id => { const t = KL.ALL[id]; return t.type === 'nation' ? KL.crest(t, 128) : KL.badge(t, 128); };
KL.teamLogo = KL.logoSrc;
/* عند فشل الصورة: الرابط البعيد ثم الشعار المولّد */
KL.imgErr = (im, id) => { const t = KL.ALL[id]; if (!im.dataset.f && t && t.logo && im.src.indexOf('assets/') >= 0) { im.dataset.f = 1; im.src = t.logo; } else { im.onerror = null; im.src = KL.logoFallback(id); } };
/* سلسلة تحميل الشعار: assets/ ← logos/ ← الرابط المباشر ← وكيل صور يدعم CORS ← شعار مولّد */
KL.logoChain = t => {
  const l = []; const lo = KL.localLogo(t); if (lo) l.push(lo); l.push('logos/' + t.id + '.png');
  if (t.logo) { l.push(t.logo); l.push('https://images.weserv.nl/?url=' + encodeURIComponent(t.logo.replace(/^https?:\/\//, '')) + '&w=256&output=png'); }
  return l;
};
})();

;


