/* KING'S LEAGUE 3D — game_3.js (جزء 3 من 6) */
/* ===== match_ai.js ===== */
/* ============================================================
   KING'S LEAGUE 3D — match_ai.js
   (تكملة match.js) ذكاء اللاعبين والحارس + التمرير والتسديد والتصدي
   يضيف الدوال إلى KL.Match.prototype — يجب تحميله بعد match.js
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';
const { F, clamp, rnd, rr, hyp, sgn } = KL._m;
class AI {
  /* ---------------- ذكاء اللاعبين ---------------- */
  outfieldAI(P, dt) {
    const t = this.t[P.t], b = this.ball, o = b.owner; const dfs = 0.95 + 0.25 * this.diff;
    if (P.stun > 0) { this.steer(P, P.x, P.z, 0, dt); return; }
    if (this.protect > 0 && P.t === this.protectTeam) { const d = hyp(P.x - b.x, P.z - b.z); if (d < 10) { const n = d || 1; this.steer(P, b.x + (P.x - b.x) / n * 10.5, clamp(b.z + (P.z - b.z) / n * 10.5, -(F.hz - 1), F.hz - 1), P.spd, dt); } else this.steer(P, P.x, P.z, 0, dt); return; }
    if (o === P) return this.aiOwner(P, dt);
    if (this.race > 0 && !o) { this.steer(P, b.x, b.z, P.spd * 1.3, dt); return; }
    if (P.receiving > 0 && !o) { this.steer(P, b.x + b.vx * 0.25, b.z + b.vz * 0.25, P.spd * 1.25, dt); return; }
    if (o && o.t === P.t) { const [ax, az] = this.anchor(P); this.steer(P, ax, az, P.spd * 0.95, dt); return; }
    const press = this.t[P.t].pressing ? 1.1 : 1;
    if (t.chase1 === P) {
      const tg = o || { x: b.x + b.vx * 0.3, z: b.z + b.vz * 0.3 };
      const d = hyp(tg.x - P.x, tg.z - P.z);
      this.steer(P, tg.x, tg.z, P.spd * 1.02 * dfs * press, dt);
      if (o && d < 1.45 && P.tackleCd <= 0 && rr() < dt * (1.8 + 1.8 * this.diff * (this.hu(P.t) ? 0.8 : 1))) this.startTackle(P, tg.x - P.x, tg.z - P.z);
    } else if (t.chase2 === P && o) { this.steer(P, o.x + t.dir * -1.5, o.z, P.spd * 0.95 * dfs, dt); }
    else {
      const [ax, az] = this.anchor(P);
      if (!o && (b.vx * b.vx + b.vz * b.vz) > 16 && b.lastTeam !== P.t) {
        const sp = hyp(b.vx, b.vz) || 1, ux = b.vx / sp, uz = b.vz / sp;
        const k = clamp((P.x - b.x) * ux + (P.z - b.z) * uz, 0, 14), ix = b.x + ux * k, iz = b.z + uz * k;
        if (hyp(ix - P.x, iz - P.z) < 5.5) { this.steer(P, ix, iz, P.spd * 1.2 * dfs, dt); return; }
      }
      if (o && o.t !== P.t) {
        const own = this.gx(t); let mk = null, md = 99;
        for (const q of this.t[o.t].players) { if (!q.on || q.leaving || q.isGK || q === o) continue; const d = hyp(q.x - ax, q.z - az); if (d < md) { md = d; mk = q; } }
        if (mk && md < 11) {
          const dx = own - mk.x, dz = -mk.z, dl = hyp(dx, dz) || 1;
          this.steer(P, mk.x + dx / dl * 1.8, mk.z + dz / dl * 1.8, P.spd * dfs, dt); return;
        }
      }
      this.steer(P, ax, az, P.spd * dfs, dt);
    }
  }
  laneClear(P, Q) {
    const ox = this.t[1 - P.t], vx = Q.x - P.x, vz = Q.z - P.z, L2 = vx * vx + vz * vz || 1;
    for (const q of ox.players) {
      if (!q.on || q.leaving || q.isGK) continue;
      const k = clamp(((q.x - P.x) * vx + (q.z - P.z) * vz) / L2, 0, 1); if (k <= 0.05 || k >= 0.95) continue;
      if (hyp(P.x + vx * k - q.x, P.z + vz * k - q.z) < 1.1) return false;
    }
    return true;
  }
  laneOpen(P, gx) {
    const ox = this.t[1 - P.t]; const ax = P.x, az = P.z, bx = gx, bz = 0; const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
    for (const q of ox.players) {
      if (!q.on || q.leaving || q.isGK) continue;
      const k = clamp(((q.x - ax) * vx + (q.z - az) * vz) / L2, 0, 1); if (k <= 0.02 || k >= 0.98) continue;
      if (hyp(ax + vx * k - q.x, az + vz * k - q.z) < 0.9) return false;
    }
    return true;
  }
  aiOwner(P, dt) {
    const t = this.t[P.t], gx = t.dir * F.hx, opp = this.t[1 - P.t], gk = opp.gk; const d2g = hyp(gx - P.x, P.z);
    let near = null, nd = 99;
    for (const q of opp.players) { if (!q.on || q.leaving) continue; const d = hyp(q.x - P.x, q.z - P.z); if (d < nd) { nd = d; near = q; } }
    P.thinkT -= dt;
    const so = this.sp && this.sp.kind === 'shootout';
    if (so) {
      if (this.sp.sub === 'live' && !this.sp.kicked) {
        if (!P.soShot) P.soShot = 4.8 + rr() * 2.8;
        if (d2g < P.soShot) { P.soShot = 0; const side = -sgn(gk.z || (rr() < 0.5 ? 1 : -1)); this.doShoot(P, rnd(0.75, 1), side * rnd(1.4, 3.0)); return; }
        this.steer(P, gx, clamp(P.z * 0.8, -1.2, 1.2) + Math.sin(this.time * 4) * 1.0, P.spd * 1.3, dt);
      } else this.steer(P, P.x, P.z, 0, dt);
      return;
    }
    if (P.thinkT <= 0) {
      P.thinkT = rnd(0.3, 0.55) * (1.45 - 0.5 * this.diff);
      P._press = nd < 2.6 ? 1 : 0;
      const att = t.tact.style === 'att' ? 1.25 : (t.tact.style === 'def' ? 0.8 : 1);
      const lane = d2g < 24 ? this.laneOpen(P, gx) : false;
      // تسديد قريب
      if (d2g < F.penD && P.a.shoot > 0.3) {
        let p = (0.3 + (F.penD - d2g) * 0.05) * att; if (!lane) p *= 0.35;
        if (rr() < p) { const side = rr() < 0.58 ? -sgn(gk.z || (rr() < 0.5 ? 1 : -1)) : (rr() < 0.5 ? 1 : -1); this.doShoot(P, rnd(0.65, 1), side * rnd(0.6, 3.1)); return; }
      }
      // تسديد بعيد (13.5 – 22م) عند وجود خط مفتوح ومسدد جيد
      else if (d2g >= F.penD && d2g < F.penD + 9 && lane && nd > 2.2 && P.a.shoot > 0.55) {
        const p = 0.24 * att * (P.a.shoot - 0.3) * (1.3 - (d2g - F.penD) / 14);
        if (rr() < p) { this.doShoot(P, rnd(0.8, 1), (rr() < 0.5 ? -1 : 1) * rnd(1.2, 3.2)); return; }
      }
      // تمرير منظم: تحت الضغط، أو إذا وُجد زميل أفضل تمركزاً
      const Q = this.bestPass(P, t.dir, 0, false, true);
      if (Q) {
        const prog = (Q.x - P.x) * t.dir, dgP = hyp(gx - P.x, P.z), dgQ = hyp(gx - Q.x, Q.z);
        const better = dgQ < dgP - 3 && this.minOpp(P.t, Q.x, Q.z) > nd + 1;
        if (nd < 2.6 || (better && rr() < 0.55) || (prog > 4 && rr() < 0.18)) { this.doPass(P, Q); return; }
      }
    }
    // مراوغة نحو المرمى
    let dx = gx - P.x, dz = clamp(-P.z * 0.4, -3, 3) - P.z * 0.0; let n = hyp(dx, dz) || 1; dx /= n; dz /= n;
    let ax = 0, az = 0;
    for (const q of opp.players) {
      if (!q.on || q.leaving) continue; const qx = q.x - P.x, qz = q.z - P.z, d = hyp(qx, qz);
      if (d < 3.4 && d > 0.01 && (qx * dx + qz * dz) / d > 0.2) { const s = (3.4 - d) / 3.4; const side = (-dz * qx + dx * qz) > 0 ? -1 : 1; ax += -dz * side * s * 1.6; az += dx * side * s * 1.6; }
    }
    dx += ax; dz += az; n = hyp(dx, dz) || 1;
    this.steer(P, P.x + dx / n * 10, P.z + dz / n * 10, P.spd * (nd > 3 ? 1.15 : 1.0) * (P.stun > 0 ? .4 : 1), dt);
    if (nd < 0.75 && rr() < dt * 0.35 && near && !near.isGK && near.t !== P.t && P.skillT <= 0) { this.ball.owner = null; this.ball.cd = 0.1; this.ball.vx = near.fx * 4; this.ball.vz = near.fz * 4; P.noPick = 0.3; }
  }
  bestPass(P, dx, dz, hasDir, ai) {
    const t = this.t[P.t]; let best = null, bs = -1e9; const n = hyp(dx, dz) || 1; dx /= n; dz /= n;
    for (const Q of this.fieldOut(t)) {
      if (Q === P || Q.idle) continue; const vx = Q.x - P.x, vz = Q.z - P.z, d = hyp(vx, vz); if (d < 1.5) continue;
      const op = this.minOpp(P.t, Q.x, Q.z); let s;
      if (ai) {
        if (op < 1.6) continue; if (!this.laneClear(P, Q)) continue;
        const prog = (Q.x - P.x) * t.dir, gx = t.dir * F.hx, dg = hyp(gx - Q.x, Q.z);
        const press = P._press || 0;
        s = prog * 0.11 + Math.min(op, 7) * 0.3 - Math.abs(d - 9) * 0.05 - dg * 0.035;
        if (prog < -1) s -= press > 0 ? 0.2 : 1.6;           // لا تمريرات للخلف إلا تحت الضغط
        if (Q.role === 'FW' && dg < 14) s += 0.7;
        if (Q.role !== 'FW' && Math.abs(Q.z) < 3 && prog > 0) s += 0.15;
      }
      else { const cos = (vx * dx + vz * dz) / d; if (hasDir && cos < 0.25) continue; s = cos * 2 - d * 0.03 + Math.min(op, 5) * 0.12; }
      if (s > bs) { bs = s; best = Q; }
    }
    if (!best && ai && P.isGK) best = this.fieldOut(t)[0] || null;
    return best;
  }

  /* ---------------- الحارس ---------------- */
  gkAI(P, dt) {
    const t = this.t[P.t], b = this.ball, inw = t.dir, gx = this.gx(t); const skill = 0.55 + 0.45 * P.a.gk, dfac = 0.5 + 0.5 * this.diff * (this.hu(P.t) ? 0.8 : 1);
    if (b.owner === P) { P.hold += dt; this.steer(P, P.x, P.z, 0, dt); if (P.hold > 1.1) this.gkDistribute(P); return; }
    P.hold = 0;
    if (!b.owner && b.vx * inw < -5 && P.diveT <= 0 && !P.reacting) {
      const tt = (gx - b.x) / b.vx;
      if (tt > 0 && tt < 1.3) {
        const zc = b.z + b.vz * tt, yc = b.y + b.vy * tt - 9 * tt * tt;
        if (Math.abs(zc) < F.gw + 0.9 && yc < F.gh + 0.7 && b.lastTeam !== P.t) { P.reacting = true; P.reactT = (0.46 - 0.2 * dfac) * (1.25 - 0.4 * skill); P.diveZ = clamp(zc + rnd(-1.8, 1.8) * (1.4 - skill) + (rr() < 0.22 ? (rr() < 0.5 ? -2.4 : 2.4) : 0), -(F.gw - 0.3), F.gw - 0.3); }
      }
    }
    if (P.reacting) { P.reactT -= dt; if (P.reactT <= 0) { P.reacting = false; P.diveT = 0.8; this.emit('dive', { P }); } }
    if (P.diveT > 0) { const sp = 6.5 + 3.5 * dfac * skill; this.steer(P, P.x, P.diveZ, sp, dt); return; }
    let tx = gx + inw * 1.0, tz = clamp(b.z * (b.owner ? 0.3 : 0.4), -(F.gw - 0.6), F.gw - 0.6); if (!b.owner) tx = gx + inw * clamp(0.8 + (1 - Math.min(1, Math.abs(b.x - gx) / 30)) * 0.9, 0.8, 1.7);
    const bd = Math.abs(b.x - gx); let sp = 4.6;
    if (b.owner && b.owner.t !== P.t && bd < 15) {
      tx = gx + inw * clamp(bd * 0.3, 1, this.sp ? 5.4 : 4.6); tz = clamp(b.owner.z * 0.55, -(F.gw - 0.4), F.gw - 0.4);
      const d = hyp(b.owner.x - P.x, b.owner.z - P.z);
      if (d < 1.1 && P.tackleCd <= 0) { P.tackleCd = 0.9; if (rr() < (0.25 + 0.4 * skill) * dfac && b.owner.skillT <= 0) { this.takeBall(P); this.emit('save', { G: P, hold: true }); return; } }
    } else if (!b.owner && Math.abs(b.x - gx) < F.penD && hyp(b.vx, b.vz) < 9 && Math.abs(b.z) < F.penW / 2) {
      const dg = hyp(b.x - P.x, b.z - P.z); let ad = 99; for (const q of this.t[1 - P.t].players) { if (q.on && !q.leaving) ad = Math.min(ad, hyp(q.x - b.x, q.z - b.z)); }
      if (dg < ad * 1.15) { tx = b.x; tz = b.z; sp = 7; }
    }
    this.steer(P, tx, tz, sp, dt);
  }
  gkDistribute(P) {
    const t = this.t[P.t]; let best = null, bs = -1e9;
    for (const Q of this.fieldOut(t)) { const op = this.minOpp(P.t, Q.x, Q.z); const s = op * 0.8 + (Q.x - P.x) * t.dir * 0.05 - Math.abs(Q.z) * 0.02; if (op > 1.8 && s > bs) { bs = s; best = Q; } }
    if (best) { this.doPass(P, best); if (this.hu(P.t)) t.ctrl = best; }
    else { this.kickBall(P, t.dir * 13, 6, rnd(-3, 3)); }
  }

  /* ---------------- الكرة ---------------- */
  takeBall(P) {
    const b = this.ball; if (b.owner && b.owner.t !== P.t) this.possChanged = true; else if (!b.owner && b.lastTeam !== P.t && b.lastTeam !== -1) this.possChanged = true;
    b.owner = P; b.lastTeam = P.t; b.last = P; b.vx = b.vy = b.vz = 0; P.hold = 0; P.receiving = 0; this.race = 0; b.net = false;
    if (this.hu(P.t) && !P.isGK && this.mode === 'play') this.t[P.t].ctrl = P;
  }
  kickBall(P, vx, vy, vz) {
    const b = this.ball; b.owner = null; b.vx = vx; b.vy = vy; b.vz = vz; b.y = Math.max(b.y, F.R + 0.05); b.cd = 0.1; b.lastTeam = P.t; b.last = P; P.noPick = 0.4; P.kickT = 0.3; this.emit('kick', { P, power: 0.5 });
  }
  doPass(P, Q) {
    const b = this.ball; const d = hyp(Q.x - P.x, Q.z - P.z); const lead = 0.15 + d * 0.028;
    const px = Q.x + Q.vx * lead, pz = Q.z + Q.vz * lead; let ang = Math.atan2(pz - b.z, px - b.x);
    const acc = (this.hu(P.t) ? 1.0 : (1.25 - 0.45 * this.diff)); ang += rnd(-1, 1) * (1.08 - P.a.pass) * 0.1 * acc;
    const sp = clamp(9 + d * 0.85, 10, 21);
    b.owner = null; b.vx = Math.cos(ang) * sp; b.vz = Math.sin(ang) * sp; b.vy = d > 14 ? 3.6 : 0.2; b.y = Math.max(b.y, F.R + 0.05); b.cd = 0.1;
    b.lastTeam = P.t; b.last = P; P.noPick = 0.4; P.kickT = 0.3; Q.receiving = 1.6; P.fx = Math.cos(ang); P.fz = Math.sin(ang);
    this.emit('kick', { P, power: 0.4 });
  }
  doShoot(P, power, tz) {
    const b = this.ball, t = this.t[P.t], gx = t.dir * F.hx, tx = gx + t.dir * 0.4;
    tz = clamp(tz, -(F.gw - 0.35), F.gw - 0.35);
    let ang = Math.atan2(tz - b.z, tx - b.x); const d = hyp(tx - b.x, tz - b.z);
    const err = (1.08 - P.a.shoot) * 0.17 * (0.55 + d / 22) * (this.hu(P.t) ? 1.0 : (1.55 - 0.5 * this.diff)) + (power > 0.95 ? 0.04 : 0);
    ang += rnd(-err, err);
    const sp = 15 + 16 * power;
    b.owner = null; b.vx = Math.cos(ang) * sp; b.vz = Math.sin(ang) * sp; b.vy = rnd(0.4, 1.2) + power * rnd(0.5, 3.0); b.y = Math.max(b.y, F.R + 0.05);
    b.shotSp = sp; b.shotD = hyp(gx - P.x, P.z); b.cd = 0.12; b.shotT = 1.6; b.shotBy = P; b.lastTeam = P.t; b.last = P; P.noPick = 0.45; P.kickT = 0.35; P.fx = Math.cos(ang); P.fz = Math.sin(ang);
    { const oG = this.t[1 - P.t].gk; if (oG) oG.shotKz = oG.z; }
    this.stats[P.t].shots++; if (hyp(gx - P.x, P.z) > F.penD) this.stats[P.t].long = (this.stats[P.t].long || 0) + 1; this.emit('kick', { P, power, shot: true });
    if (this.sp && this.sp.kind === 'shootout') { this.sp.kicked = true; this.sp.kt = 0; }
  }
  tryPickup() {
    const b = this.ball; if (b.owner || b.cd > 0 || b.y > 1.15) return;
    const sp = hyp(b.vx, b.vz); let best = null, bd = 1e9;
    for (const P of this.players) {
      if (!P.on || P.leaving || P.noPick > 0 || P.idle) continue;
      if (this.sp && P !== this.sp.shooter && !P.isGK) continue;
      const rad = P.isGK ? 1.15 : 0.85, d = hyp(b.x - P.x, b.z - P.z);
      if (d < rad && d < bd) { bd = d; best = P; }
    }
    if (!best) return;
    if (best.isGK && best.t !== b.lastTeam && hyp(b.vx, b.vy, b.vz) > 7.5) return; // الحارس لا يلتقط الكرات القوية تلقائياً — يعتمد على saveAttempt
    if (this.sp && this.sp.kicked && !best.isGK) return;
    if (best.t !== b.lastTeam) { for (const P of this.players) if (P.on && P.t === b.lastTeam && P.skillT > 0 && hyp(b.x - P.x, b.z - P.z) < 1.3) return; }
    if (sp > 15 && !best.isGK && rr() < 0.68) { b.vx = b.vx * 0.45 + rnd(-3, 3); b.vz = b.vz * 0.45 + rnd(-3, 3); b.cd = 0.25; b.last = best; b.lastTeam = best.t; return; }
    this.takeBall(best);
  }
  saveAttempt(G) {
    const b = this.ball; G.saveCd = 0.35; const sp = hyp(b.vx, b.vy, b.vz), skill = 0.55 + 0.45 * G.a.gk;
    const gx = this.gx(this.t[G.t]); let zc = b.z; if (Math.abs(b.vx) > 0.5) { const tt = (gx - b.x) / b.vx; if (tt > 0) zc = b.z + b.vz * tt; }
    // مدى صعوبة الكرة: بُعد نقطة الدخول عن الحارس (بعد خصم مدى وصوله)، السرعة، الارتفاع
    const kz = G.shotKz != null && b.shotBy && b.shotBy.t !== G.t ? G.shotKz : G.z;
    const miss = Math.max(0, Math.abs(zc - kz) - 1.25 - skill * 0.7);
    const ssp = b.shotBy && b.shotSp ? b.shotSp : sp + 4, inside = (b.shotD == null ? 10 : b.shotD) <= F.penD;
    // الواقعية: الكرة القريبة من الحارس تدخل ~30%، من داخل المنطقة بعيداً عنه معظمها يدخل، ومن خارج المنطقة ~50%
    let p = inside ? clamp(0.7 - miss * 0.36, 0.22, 0.7) : clamp(0.55 - miss * 0.2, 0.35, 0.55);
    p *= clamp(1.2 - (ssp - 18) * 0.02, 0.8, 1.15) * (0.92 + 0.14 * skill);
    if (b.y > 1.7) p *= 0.85;
    p *= this.hu(G.t) ? 1.1 : 1;
    p = clamp(p, 0.1, 0.8); if (KL.dbgSave) KL.dbgSave.push({ p, miss, ssp, y: b.y, zc, inside });
    if (this.sp && this.sp.kind === 'penalty') p *= 0.55; else if (this.sp && this.sp.kind === 'shootout') p *= 0.8;
    if (rr() < p) {
      if (sp < 13.5 || rr() < 0.35) { this.takeBall(G); b.y = 1.1; this.emit('save', { G, hold: true }); }
      else { const inw = this.t[G.t].dir; b.vx = -b.vx * 0.3 + inw * 3; b.vz = (b.z - G.z) * 4 + rnd(-2.5, 2.5); b.vy = rnd(1, 3.5); b.cd = 0.2; b.lastTeam = G.t; b.last = G; this.emit('save', { G, hold: false }); }
    }
  }
}
for (const k of Object.getOwnPropertyNames(AI.prototype)) if (k !== 'constructor') Object.defineProperty(KL.Match.prototype, k, Object.getOwnPropertyDescriptor(AI.prototype, k));
})();

;
/* ===== tournament.js ===== */
/* ============================================================
   KING'S LEAGUE MENA 3D — tournament.js
   (4/6) منطق البطولتين: دوري MENA + مجموعات NATIONS + الإقصائيات
   منطق بحت بدون واجهة (يمكن اختباره في Node)
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';

/* محاكاة مباراة كاملة بين فريقين بالذكاء الاصطناعي (بدون رسم) — غير متزامنة كي لا تجمّد الشاشة */
KL.simulate = function (A, B, cb) {
  const m = new KL.Match({ teams: [A, B], user: -1, secPerMin: 7.5, diff: 0.7 }); let guard = 0;
  (function step() {
    const t0 = Date.now();
    while (m.mode !== 'ended' && Date.now() - t0 < 14 && guard < 60000) { for (let k = 0; k < 8; k++) { m.update(1 / 20, null); guard++; if (m.mode === 'ended') break; } }
    if (m.mode === 'ended') cb(m.result);
    else if (guard >= 60000) { m.endMatch('time'); cb(m.result); }
    else setTimeout(step, 0);
  })();
};

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

function roundRobin(ids) {
  const t = ids.slice(); if (t.length % 2) t.push(null); const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(pairs); t.splice(1, 0, t.pop());
  }
  return rounds;
}

const STAGE_AR = { league: 'الدوري', groups: 'دور المجموعات', playoff: 'التصفيات الإقصائية', playoff6: 'التصفيات الإقصائية', qf: 'ربع النهائي', sf: 'نصف النهائي', final: 'النهائي', done: 'انتهت البطولة' };

class Tournament {
  constructor(mode, userId) {
    this.mode = mode; this.userId = userId; this.stage = ''; this.round = 0; this.matches = []; this.history = []; this.groups = null;
    this.rounds = []; this.champion = null; this.eliminated = false; this.seeds = {}; this.created = Date.now();
    if (mode === 'mena') {
      this.ids = KL.CLUBS.map(t => t.id); this.rounds = roundRobin(shuffle(this.ids)); this.stage = 'league';
    } else {
      this.ids = KL.NATIONS.map(t => t.id);
      const sorted = this.ids.slice().sort((a, b) => KL.ALL[b].ovr - KL.ALL[a].ovr + (Math.random() - 0.5) * 2);
      this.groups = [[], [], [], [], []];
      for (let pot = 0; pot < 5; pot++) { const p = shuffle(sorted.slice(pot * 5, pot * 5 + 5)); p.forEach((id, gi) => this.groups[gi].push(id)); }
      this.gRounds = this.groups.map(g => roundRobin(g)); this.stage = 'groups';
    }
    this.round = 0; this.buildRound();
  }
  static fromJSON(o) { const t = Object.create(Tournament.prototype); Object.assign(t, o); return t; }
  toJSON() { return Object.assign({}, this); }
  get stageName() { const s = STAGE_AR[this.stage] || ''; if (this.stage === 'league') return s + ' — الجولة ' + (this.round + 1) + ' من 9'; if (this.stage === 'groups') return s + ' — الجولة ' + (this.round + 1) + ' من 5'; return s; }
  mk(a, b, label) { return { a, b, sa: null, sb: null, pso: null, w: null, done: false, label: label || '', stage: this.stage }; }
  buildRound() {
    if (this.stage === 'league') this.matches = this.rounds[this.round].map(p => this.mk(p[0], p[1]));
    else if (this.stage === 'groups') { this.matches = []; this.gRounds.forEach((gr, gi) => { (gr[this.round] || []).forEach(p => this.matches.push(this.mk(p[0], p[1], 'المجموعة ' + 'ABCDE'[gi]))); }); }
  }
  userMatch() { return this.matches.find(m => !m.done && (m.a === this.userId || m.b === this.userId)) || null; }
  pending() { return this.matches.filter(m => !m.done); }
  roundDone() { return this.matches.every(m => m.done); }

  record(m, score, pso, winnerIdx) {
    m.sa = score[0]; m.sb = score[1]; m.pso = pso || null; m.done = true;
    m.w = score[0] > score[1] ? m.a : (score[1] > score[0] ? m.b : (winnerIdx === 0 ? m.a : m.b));
    if (pso && score[0] === score[1]) m.w = pso[0] > pso[1] ? m.a : m.b;
    this.history.push(m);
  }
  recordResult(m, res) { this.record(m, res.score, res.pso, res.winner); }

  /* جدول الترتيب: 3 للفوز العادي، 2 للفوز بالترجيح، 1 للخسارة بالترجيح */
  tableFor(ids, stages) {
    const T = {}; ids.forEach(id => T[id] = { id, p: 0, pts: 0, w: 0, l: 0, gf: 0, ga: 0, gd: 0, rnd: Math.random() });
    for (const m of this.history) {
      if (!stages.includes(m.stage) || !T[m.a] || !T[m.b]) continue;
      const A = T[m.a], B = T[m.b]; A.p++; B.p++; A.gf += m.sa; A.ga += m.sb; B.gf += m.sb; B.ga += m.sa;
      const viaPso = m.pso && m.sa === m.sb;
      if (m.w === m.a) { A.w++; B.l++; A.pts += 3; } else { B.w++; A.l++; B.pts += 3; }
    }
    const arr = Object.values(T); arr.forEach(r => r.gd = r.gf - r.ga);
    arr.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || y.rnd - x.rnd); return arr;
  }
  leagueTable() { return this.tableFor(this.ids, ['league']); }
  groupTable(i) { return this.tableFor(this.groups[i], ['groups']); }

  /* الانتقال للمرحلة التالية بعد اكتمال الجولة */
  advance() {
    const S = this.stage, win = (m) => m.w;
    if (S === 'league') {
      this.round++;
      if (this.round < this.rounds.length) { this.buildRound(); return; }
      const tb = this.leagueTable().map(r => r.id); this.seeds = {}; tb.forEach((id, i) => this.seeds[id] = i + 1); this.direct = tb[0];
      this.stage = 'playoff'; this.matches = [this.mk(tb[1], tb[6], 'المركز 2 × 7'), this.mk(tb[2], tb[5], 'المركز 3 × 6'), this.mk(tb[3], tb[4], 'المركز 4 × 5')]; return;
    }
    if (S === 'playoff') {
      const ws = this.matches.map(win).sort((a, b) => this.seeds[a] - this.seeds[b]);
      this.stage = 'sf'; this.matches = [this.mk(this.direct, ws[2], 'نصف النهائي 1'), this.mk(ws[0], ws[1], 'نصف النهائي 2')]; return;
    }
    if (S === 'groups') {
      this.round++;
      if (this.round < 5) { this.buildRound(); return; }
      const gt = this.groups.map((g, i) => this.groupTable(i)); const rank = arr => arr.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || y.rnd - x.rnd);
      const winners = rank(gt.map(t => t[0])), seconds = gt.map(t => t[1]), thirds = rank(gt.map(t => t[2]));
      this.winners = winners.map(r => r.id); const six = rank(seconds.concat([thirds[0]])).map(r => r.id); this.six = six;
      this.stage = 'playoff6'; this.matches = [this.mk(six[0], six[5], 'تصفية 1'), this.mk(six[1], six[4], 'تصفية 2'), this.mk(six[2], six[3], 'تصفية 3')]; return;
    }
    if (S === 'playoff6') {
      const ws = this.matches.map(win); const q = this.winners.concat(ws); this.q = q;
      this.stage = 'qf'; this.matches = [this.mk(q[0], q[7], 'ربع النهائي 1'), this.mk(q[1], q[6], 'ربع النهائي 2'), this.mk(q[2], q[5], 'ربع النهائي 3'), this.mk(q[3], q[4], 'ربع النهائي 4')]; return;
    }
    if (S === 'qf') {
      const w = this.matches.map(win); this.stage = 'sf'; this.matches = [this.mk(w[0], w[3], 'نصف النهائي 1'), this.mk(w[1], w[2], 'نصف النهائي 2')]; return;
    }
    if (S === 'sf') { const w = this.matches.map(win); this.stage = 'final'; this.matches = [this.mk(w[0], w[1], 'النهائي')]; return; }
    if (S === 'final') { this.champion = this.matches[0].w; this.stage = 'done'; this.matches = []; return; }
  }
  /* هل ما زال المستخدم في المنافسة؟ */
  userAlive() {
    if (this.stage === 'done') return false;
    if (this.stage === 'league' || this.stage === 'groups') return true;
    return this.matches.some(m => m.a === this.userId || m.b === this.userId) || (this.stage === 'sf' && false);
  }
  /* محاكاة كل المباريات المتبقية غير مباراة المستخدم في الجولة الحالية */
  simPending(onProgress, done) {
    const todo = this.matches.filter(m => !m.done && m.a !== this.userId && m.b !== this.userId); let i = 0;
    const next = () => {
      if (i >= todo.length) { done && done(); return; }
      const m = todo[i++]; onProgress && onProgress(i, todo.length);
      KL.simulate(KL.ALL[m.a], KL.ALL[m.b], res => { this.record(m, res.score, res.pso, res.winner); next(); });
    }; next();
  }
  /* محاكاة مباراة المستخدم أيضاً (زر "محاكاة") */
  simUserMatch(done) {
    const m = this.userMatch(); if (!m) { done && done(); return; }
    KL.simulate(KL.ALL[m.a], KL.ALL[m.b], res => { this.record(m, res.score, res.pso, res.winner); done && done(m); });
  }
  /* محاكاة كل شيء حتى النهاية */
  simAll(onProgress, done) {
    const loop = () => {
      if (this.stage === 'done') { done && done(); return; }
      const um = this.matches.filter(m => !m.done);
      if (!um.length) { this.advance(); loop(); return; }
      let k = 0; const go = () => {
        if (k >= um.length) { this.advance(); loop(); return; }
        const m = um[k++]; onProgress && onProgress(this.stageName);
        KL.simulate(KL.ALL[m.a], KL.ALL[m.b], res => { this.record(m, res.score, res.pso, res.winner); go(); });
      }; go();
    }; loop();
  }
}
Tournament.STAGE_AR = STAGE_AR;
KL.Tournament = Tournament;
})();

;
/* ===== lineup.js ===== */
/* ============================================================
   KING'S LEAGUE 3D — lineup.js
   شاشة التشكيلة قبل كل مباراة: ملعب مستطيل بـ7 مراكز (حارس + 6)
   ============================================================ */
var KL = window.KL = window.KL || {};
(function () {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const POSAR = { GK: 'حارس', DEF: 'مدافع', MID: 'وسط', FW: 'مهاجم' };
const ovr = p => Math.round(((p.a.shoot + p.a.pass + p.a.def + p.a.drb) / 4 + (p.a.pace - 1)) * 60 + 25);
let st = null; // { team, lu:{gk, field[6], form, style, press}, sel, cb }
const FM = () => KL.FORMS;
function valid(d, lu) {
  if (!lu || lu.gk == null || !lu.field || lu.field.length !== 6) return false;
  const n = d.players.length, all = [lu.gk].concat(lu.field);
  return all.every(i => Number.isInteger(i) && i >= 0 && i < n) && new Set(all).size === 7;
}
KL.loadLineup = function (d) {
  let lu = null; try { lu = JSON.parse(localStorage.getItem('kl_lu2_' + d.id)); } catch (e) { }
  if (!valid(d, lu)) lu = KL.autoLineup(d, '2-2-2');
  if (!FM()[lu.form]) lu.form = '2-2-2'; lu.style = lu.style || 'bal'; lu.press = lu.press || 'mid';
  return lu;
};
function render() {
  const d = st.team, P = d.players, lu = st.lu;
  const slotEl = (cls, style, i, kind) => {
    const k = kind === 'gk' ? lu.gk : lu.field[i], p = k == null ? null : P[k];
    const sel = st.sel && st.sel.kind === 'slot' && st.sel.i === (kind === 'gk' ? -1 : i);
    return '<div class="lsl ' + cls + (sel ? ' sel' : '') + (p ? '' : ' empty') + '" style="' + style + '" data-kind="' + kind + '" data-i="' + (kind === 'gk' ? -1 : i) + '">' +
      (p ? '<b class="n">' + esc(p.num) + '</b><span class="nm">' + esc(p.name.split(' ').slice(-1)[0]) + '</span><i>' + POSAR[p.pos] + '</i>' : '<b class="n">+</b><span class="nm">' + (kind === 'gk' ? 'حارس' : POSAR[FM()[lu.form].slots[i][2]]) + '</span>') + '</div>';
  };
  let html = slotEl('gk', 'left:6%;top:50%', 0, 'gk');
  FM()[lu.form].slots.forEach((s, i) => { html += slotEl('', 'left:' + (s[0] * 100 + 4) + '%;top:' + (50 + s[1] * 66) + '%', i, 'f'); });
  $('luPitch').innerHTML = '<div class="pl-line c"></div><div class="pl-circle"></div><div class="pl-box l"></div><div class="pl-box r"></div><div class="pl-goal l"></div><div class="pl-goal r"></div><div class="pl-dir">⮞ اتجاه الهجوم</div>' + html;
  const inLu = new Set([lu.gk].concat(lu.field));
  const order = P.map((p, i) => i).sort((a, b) => ({ GK: 0, DEF: 1, MID: 2, FW: 3 }[P[a].pos] - { GK: 0, DEF: 1, MID: 2, FW: 3 }[P[b].pos]) || ovr(P[b]) - ovr(P[a]));
  $('luList').innerHTML = order.map(i => {
    const p = P[i], on = inLu.has(i), sel = st.sel && st.sel.kind === 'pl' && st.sel.i === i;
    return '<div class="lpl' + (on ? ' on' : '') + (sel ? ' sel' : '') + '" data-i="' + i + '"><b>' + esc(p.num) + '</b><span>' + esc(p.name) + '</span><i class="pos ' + p.pos + '">' + POSAR[p.pos] + '</i><em>' + ovr(p) + '</em></div>';
  }).join('');
  $('luTitle').textContent = d.type === 'nation' ? d.ar : d.name;
  $('luHint').textContent = st.sel ? (st.sel.kind === 'pl' ? 'اضغط على مركز في الملعب لوضع اللاعب فيه' : 'اضغط على لاعب من القائمة لوضعه في هذا المركز') : 'اضغط لاعباً ثم مركزاً — أو مركزاً ثم لاعباً. تبديل بين مركزين: اضغط الأول ثم الثاني';
  $('luForm').value = lu.form; $('luStyle').value = lu.style; $('luPress').value = lu.press; $('luCam').value = String(st.cam); $('luNames').checked = st.names;
}
function put(slotI, playerIdx) {
  const lu = st.lu, cur = slotI === -1 ? lu.gk : lu.field[slotI];
  if (slotI === -1 && st.team.players[playerIdx].pos !== 'GK') { toast('هذا المركز للحارس فقط'); return; }
  if (slotI !== -1 && st.team.players[playerIdx].pos === 'GK') { toast('الحارس لا يلعب في الميدان'); return; }
  const at = lu.field.indexOf(playerIdx);
  if (at >= 0) lu.field[at] = cur; // تبديل مع مركز آخر
  else if (lu.gk === playerIdx) lu.gk = cur;
  if (slotI === -1) lu.gk = playerIdx; else lu.field[slotI] = playerIdx;
}
function toast(t) { const e = $('luHint'); e.textContent = '⚠ ' + t; }
function click(e) {
  const sl = e.target.closest('.lsl'), pl = e.target.closest('.lpl');
  if (sl) {
    const i = +sl.dataset.i;
    if (st.sel && st.sel.kind === 'pl') { put(i, st.sel.i); st.sel = null; }
    else if (st.sel && st.sel.kind === 'slot') {
      if (st.sel.i !== i && st.sel.i !== -1 && i !== -1) { const a = st.lu.field[st.sel.i]; st.lu.field[st.sel.i] = st.lu.field[i]; st.lu.field[i] = a; }
      st.sel = null;
    } else st.sel = { kind: 'slot', i };
  } else if (pl) {
    const i = +pl.dataset.i;
    if (st.sel && st.sel.kind === 'slot') { put(st.sel.i, i); st.sel = null; }
    else st.sel = { kind: 'pl', i };
  } else return;
  render();
}
KL.openLineup = function (team, opts, cb) {
  st = { team, lu: KL.loadLineup(team), sel: null, cb, cam: opts.cam, names: opts.names, must: opts.must == null ? null : opts.must };
  if (st.must != null && !([st.lu.gk].concat(st.lu.field)).includes(st.must)) { const f = st.lu.field, s = FM()[st.lu.form].slots.findIndex(q => q[2] === team.players[st.must].pos); f[s >= 0 ? s : 5] = st.must; if (new Set(f).size !== 6) { st.lu = KL.autoLineup(team, st.lu.form); } }
  render(); document.querySelectorAll('.screen').forEach(s => s.classList.remove('show')); $('hud').classList.add('hide'); $('scrLineup').classList.add('show');
  if (KL.onScreen) KL.onScreen('scrLineup');
};
KL.initLineup = function (hooks) {
  $('scrLineup').addEventListener('click', click);
  $('luForm').innerHTML = KL.FORM_IDS.map(k => '<option value="' + k + '">' + KL.FORMS[k].ar + '</option>').join('');
  $('luForm').onchange = () => { const k = $('luForm').value, s = st.lu; const n = KL.autoLineup(st.team, k); st.lu = { gk: s.gk, field: n.field, form: k, style: s.style, press: s.press }; st.sel = null; render(); };
  $('luStyle').onchange = () => { st.lu.style = $('luStyle').value; };
  $('luPress').onchange = () => { st.lu.press = $('luPress').value; };
  $('luAuto').onclick = () => { const s = st.lu, n = KL.autoLineup(st.team, s.form); st.lu = { gk: n.gk, field: n.field, form: s.form, style: s.style, press: s.press }; st.sel = null; render(); };
  $('luCam').onchange = () => { st.cam = +$('luCam').value; };
  $('luNames').onchange = () => { st.names = $('luNames').checked; };
  $('luBack').onclick = () => { $('scrLineup').classList.remove('show'); hooks.back && hooks.back(); };
  $('luGo').onclick = () => {
    if (!valid(st.team, st.lu)) { toast('أكمل المراكز السبعة'); return; }
    if (st.must != null && !st.lu.field.includes(st.must)) { toast('لاعبك في الكارير يجب أن يكون أساسياً'); return; }
    try { localStorage.setItem('kl_lu2_' + st.team.id, JSON.stringify(st.lu)); } catch (e) { }
    $('scrLineup').classList.remove('show'); const c = st.cb; c({ lu: st.lu, cam: st.cam, names: st.names });
  };
};
})();

;


