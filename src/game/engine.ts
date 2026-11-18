import { audio } from './audio';
import { lofiRiderSVG, svgToImage } from './lofi';

export type Phase = 'title' | 'playing' | 'crashed' | 'over';

export interface Hud {
  score: number;
  distance: number; // metres
  crystals: number;
  combo: number;
  speed: number; // km/h-ish
}

export interface RunResult {
  score: number;
  distance: number;
  crystals: number;
  flips: number;
  bestAir: number;
}

interface Rock { x: number; r: number; kind: 0 | 1 }
interface Crystal { x: number; y: number; taken: boolean; t: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }
interface Popup { x: number; y: number; text: string; life: number; color: string }
interface Flake { x: number; y: number; z: number; s: number }

const TAU = Math.PI * 2;
const G = 1900;
const PX_PER_M = 24;

const wrap = (a: number) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};

function seededNoise(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w = 0; h = 0; dpr = 1; zoom = 1;
  phase: Phase = 'title';
  onHud?: (h: Hud) => void;
  onOver?: (r: RunResult) => void;

  // terrain params
  private ph = [0, 0, 0, 0];

  // player
  px = 0; py = 0; vx = 0; vy = 0;
  rot = 0; spin = 0; grounded = true;
  airTime = 0; airRot = 0;
  holding = false;
  private holdStart = 0;
  private jumpQueued = false;

  // run stats
  score = 0; bonus = 0; crystals = 0; combo = 0; flips = 0; bestAir = 0;
  private crashT = 0;

  camX = 0; camY = 0; shake = 0;
  t = 0;

  rocks: Rock[] = [];
  gems: Crystal[] = [];
  parts: Particle[] = [];
  pops: Popup[] = [];
  flakes: Flake[] = [];
  private genX = 0;
  private rand = seededNoise(1);

  private sprite = svgToImage(lofiRiderSVG());
  private last = 0;
  private raf = 0;
  private hudTick = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    for (let i = 0; i < 90; i++) this.flakes.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, s: Math.random() * TAU });
    this.reset(true);
    window.addEventListener('resize', this.resize);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
  }

  resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    // landscape: ~1150 world units of look-ahead; portrait phones: ~640
    this.zoom = this.w >= this.h ? Math.min(this.h / 760, this.w / 1150) : this.w / 640;
    this.zoom = Math.max(0.35, Math.min(this.zoom, this.h / 520));
  };

  // ---------- terrain ----------
  /** Difficulty ramps with distance. */
  private amp(x: number) { return Math.min(1, 0.35 + x / 30000); }
  ground(x: number) {
    const a = this.amp(x);
    const [p0, p1, p2, p3] = this.ph;
    return x * 0.36
      + a * (120 * Math.sin(x / 520 + p0) + 55 * Math.sin(x / 233 + p1) + 18 * Math.sin(x / 97 + p2))
      + 30 * Math.sin(x / 1400 + p3);
  }
  slope(x: number) { return (this.ground(x + 1) - this.ground(x - 1)) / 2; }
  angleAt(x: number) { return Math.atan(this.slope(x)); }

  reset(title = false) {
    const seed = (Date.now() & 0xffff) + 7;
    this.rand = seededNoise(seed);
    this.ph = [this.rand() * TAU, this.rand() * TAU, this.rand() * TAU, this.rand() * TAU];
    this.px = 0; this.py = this.ground(0);
    const a = this.angleAt(0);
    this.vx = Math.cos(a) * 420; this.vy = Math.sin(a) * 420;
    this.rot = a; this.spin = 0; this.grounded = true;
    this.airTime = 0; this.airRot = 0;
    this.score = 0; this.bonus = 0; this.crystals = 0; this.combo = 0; this.flips = 0; this.bestAir = 0;
    this.rocks = []; this.gems = []; this.parts = []; this.pops = [];
    this.genX = 900;
    this.crashT = 0;
    this.camX = this.px - this.viewW() * 0.28;
    this.camY = this.py - this.viewH() * (this.w >= this.h ? 0.4 : 0.5);
    this.phase = title ? 'title' : 'playing';
    this.holding = false;
  }

  start() {
    audio.unlock();
    audio.startMusic();
    this.reset(false);
  }

  viewW() { return this.w / this.zoom; }
  viewH() { return this.h / this.zoom; }

  private generate() {
    const ahead = this.px + this.viewW() * 1.5;
    while (this.genX < ahead) {
      const d = this.genX;
      const gap = 760 + this.rand() * 900 - Math.min(240, d / 160);
      const r = this.rand();
      if (r < 0.55 && d > 1400) {
        // avoid placing rocks on steep crests where they are unfair
        this.rocks.push({ x: d, r: 16 + this.rand() * 14, kind: this.rand() < 0.7 ? 0 : 1 });
      } else {
        // arc of crystals
        const n = 4 + Math.floor(this.rand() * 4);
        const lift = 70 + this.rand() * 120;
        for (let i = 0; i < n; i++) {
          const gx = d + i * 46;
          const arc = Math.sin((i / (n - 1)) * Math.PI) * lift;
          this.gems.push({ x: gx, y: this.ground(gx) - 40 - arc, taken: false, t: this.rand() * TAU });
        }
      }
      this.genX += Math.max(560, gap);
    }
    const behind = this.camX - 200;
    this.rocks = this.rocks.filter(r => r.x > behind);
    this.gems = this.gems.filter(g => g.x > behind && !g.taken);
  }

  // ---------- input ----------
  press() {
    audio.unlock();
    if (this.phase !== 'playing') return;
    this.holding = true;
    this.holdStart = this.t;
    if (this.grounded) this.jumpQueued = true;
  }
  release() { this.holding = false; }

  // ---------- loop ----------
  private loop = (now: number) => {
    const dt = Math.min(0.033, (now - (this.last || now)) / 1000);
    this.last = now;
    this.t += dt;
    // sub-step physics for stability at high speed
    const steps = 3;
    for (let i = 0; i < steps; i++) this.update(dt / steps);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private emit(x: number, y: number, n: number, color: string, spread = 1, speed = 200) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * spread;
      const s = speed * (0.3 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * s - this.vx * 0.15, vy: Math.sin(a) * s, life: 0, max: 0.4 + Math.random() * 0.5, size: 2 + Math.random() * 4, color });
    }
  }

  private popup(text: string, color = '#ffffff') {
    this.pops.push({ x: this.px + 40, y: this.py - 110, text, life: 0, color });
  }

  crashReason = '';
  private crash(reason = '') {
    this.crashReason = reason;
    if (this.phase !== 'playing') return;
    this.phase = 'crashed';
    this.crashT = 0;
    this.shake = 18;
    audio.crash();
    this.emit(this.px, this.py - 20, 40, '#ffffff', 2, 420);
    this.emit(this.px, this.py - 20, 14, '#8fc1ff', 2, 300);
    this.spin = 9 * Math.sign(this.vx || 1);
    this.vy = -520;
  }

  private update(dt: number) {
    // ambient
    for (const p of this.parts) { p.life += dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const p of this.pops) { p.life += dt; p.y -= 40 * dt + (this.phase === 'playing' ? this.vy * dt : 0); p.x += this.phase === 'playing' ? this.vx * dt : 0; }
    this.pops = this.pops.filter(p => p.life < 1.1);
    this.shake *= Math.pow(0.02, dt);

    if (this.phase === 'title') {
      // attract mode: ride along the slope automatically
      this.ride(dt, true);
      this.followCam(dt);
      this.generate();
      return;
    }

    if (this.phase === 'crashed') {
      this.crashT += dt;
      this.vy += G * dt;
      this.vx *= Math.pow(0.25, dt);
      this.px += this.vx * dt; this.py += this.vy * dt;
      this.rot += this.spin * dt;
      const g = this.ground(this.px);
      if (this.py > g) { this.py = g; this.vy *= -0.35; this.spin *= 0.6; }
      this.followCam(dt);
      if (this.crashT > 1.1) {
        this.phase = 'over';
        this.onOver?.({ score: this.totalScore(), distance: Math.floor(this.px / PX_PER_M), crystals: this.crystals, flips: this.flips, bestAir: this.bestAir });
      }
      return;
    }
    if (this.phase === 'over') { this.followCam(dt); return; }

    this.ride(dt, false);
    this.followCam(dt);
    this.generate();
    this.collide();

    this.hudTick += dt;
    if (this.hudTick > 0.08) {
      this.hudTick = 0;
      this.onHud?.({ score: this.totalScore(), distance: Math.floor(this.px / PX_PER_M), crystals: this.crystals, combo: this.combo, speed: Math.round(Math.hypot(this.vx, this.vy) / 8) });
    }
  }

  totalScore() { return Math.floor(this.px / PX_PER_M) + this.bonus; }

  private ride(dt: number, auto: boolean) {
    const gx = this.ground(this.px);
    const ang = this.angleAt(this.px);
    if (this.grounded) {
      if (auto && this.rand() < 0.004) this.jumpQueued = true;
      const tx = Math.cos(ang), ty = Math.sin(ang);
      let s = this.vx * tx + this.vy * ty;
      const maxS = 880 + Math.min(520, this.px / 80);
      s += (G * Math.sin(ang) * 0.55 - 0.0009 * s * s * Math.sign(s)) * dt + 60 * dt;
      s = Math.max(360, Math.min(maxS, s));
      this.vx = tx * s; this.vy = ty * s;
      this.rot += wrap(ang - this.rot) * Math.min(1, dt * 18);
      if (this.jumpQueued) {
        this.jumpQueued = false;
        const nx = Math.sin(ang), ny = -Math.cos(ang);
        this.vx += nx * 800; this.vy += ny * 800;
        this.grounded = false; this.airTime = 0; this.airRot = 0;
        this.py -= 2;
        if (!auto) { audio.jump(); this.emit(this.px, this.py, 10, '#ffffff', 0.8, 220); }
      } else {
        this.px += this.vx * dt;
        const ng = this.ground(this.px);
        // takeoff when terrain falls away faster than gravity can follow (crest at speed)
        const curv = (this.slope(this.px + 4) - this.slope(this.px - 4)) / 8; // y'' ; negative = crest (y down)
        const needed = curv * this.vx * this.vx; // vertical accel the ground "demands"
        if (needed < -G * 0.95 && s > 700) {
          this.grounded = false; this.airTime = 0; this.airRot = 0;
          this.py = ng;
        } else {
          this.py = ng;
        }
        if (Math.random() < 0.6 && !auto) {
          this.parts.push({ x: this.px - 30, y: this.py - 2, vx: -this.vx * 0.2 + (Math.random() - 0.5) * 60, vy: -80 - Math.random() * 160, life: 0, max: 0.5, size: 2 + Math.random() * 3, color: '#ffffff' });
        }
      }
      void gx;
      return;
    }

    // airborne
    this.airTime += dt;
    this.vy += G * dt;
    this.px += this.vx * dt; this.py += this.vy * dt;
    const holdingSpin = this.holding && !auto && this.t - this.holdStart > 0.08;
    if (holdingSpin) {
      this.spin = Math.max(-9.5, this.spin - 45 * dt);
    } else {
      this.spin *= Math.pow(0.02, dt);
      // gently level towards the slope below so tapping is forgiving
      const target = this.angleAt(this.px + this.vx * 0.15);
      this.rot += wrap(target - this.rot) * Math.min(1, dt * 3.2);
    }
    this.rot += this.spin * dt;
    this.airRot += this.spin * dt;

    const g = this.ground(this.px);
    if (this.py >= g) {
      this.py = g;
      const a = this.angleAt(this.px);
      const diff = Math.abs(wrap(this.rot - a));
      if (diff > 1.15 && !auto) { this.crash(`landing ${diff.toFixed(2)} air ${this.airTime.toFixed(2)} rot ${this.airRot.toFixed(2)}`); return; }
      this.grounded = true;
      this.spin = 0;
      this.rot = a;
      const fl = Math.floor((Math.abs(this.airRot) + 0.9) / TAU);
      if (!auto) {
        audio.land();
        this.emit(this.px, this.py, 14, '#ffffff', 1, 260);
        if (this.airTime > this.bestAir) this.bestAir = this.airTime;
        if (fl > 0) {
          this.combo = Math.min(10, this.combo + fl);
          this.flips += fl;
          const clean = diff < 0.3;
          const pts = fl * 250 * this.combo * (clean ? 2 : 1);
          this.bonus += pts;
          this.popup(`${fl > 1 ? fl + 'x ' : ''}BACKFLIP${clean ? ' · CLEAN' : ''}  +${pts}`, '#ffd34d');
          audio.flip(fl);
          this.shake = 5;
        } else if (this.airTime > 0.45 && this.combo > 0) {
          this.combo = 0;
          this.popup('COMBO LOST', 'rgba(255,255,255,0.75)');
        }
        if (fl === 0 && this.airTime > 1.1) {
          const pts = Math.round(this.airTime * 60);
          this.bonus += pts;
          this.popup(`BIG AIR  +${pts}`, '#8fd3ff');
        }
      }
      // keep tangential component of velocity
      const tx = Math.cos(a), ty = Math.sin(a);
      const s = Math.max(360, this.vx * tx + this.vy * ty);
      this.vx = tx * s; this.vy = ty * s;
    }
  }

  private collide() {
    const bx = this.px + Math.sin(this.rot) * -28;
    const by = this.py - Math.cos(this.rot) * 28;
    // board/feet circle vs rock circle
    const fx = this.px + Math.sin(this.rot) * 14, fy = this.py - Math.cos(this.rot) * 14;
    for (const r of this.rocks) {
      if (Math.abs(r.x - this.px) > 120) continue;
      const ry = this.ground(r.x) - r.r * 0.65;
      if (Math.hypot(r.x - fx, ry - fy) < r.r * 0.95 + 12) { this.crash(`rock grounded=${this.grounded} air=${this.airTime.toFixed(2)}`); return; }
    }
    for (const gm of this.gems) {
      if (gm.taken) continue;
      if (Math.hypot(gm.x - bx, gm.y - by) < 44) {
        gm.taken = true;
        this.crystals++;
        this.bonus += 25 * Math.max(1, this.combo);
        audio.crystal(this.crystals % 8);
        this.emit(gm.x, gm.y, 8, '#7fe3ff', 2, 160);
      }
    }
  }

  private followCam(dt: number) {
    const vw = this.viewW(), vh = this.viewH();
    const tx = this.px - vw * 0.28;
    const ty = this.py - vh * (this.w >= this.h ? 0.40 : 0.5) + Math.min(120, this.vy * 0.08);
    this.camX = tx; // x locked so speed reads clearly
    this.camY += (ty - this.camY) * Math.min(1, dt * 5);
  }

  // ---------- rendering ----------
  private render() {
    const { ctx } = this;
    const vw = this.viewW(), vh = this.viewH();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, '#081430');
    sky.addColorStop(0.55, '#1b3a7a');
    sky.addColorStop(1, '#6f9fe8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.w, this.h);

    // moon
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(this.w * 0.8, this.h * 0.18, Math.min(this.w, this.h) * 0.05, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(this.w * 0.8, this.h * 0.18, Math.min(this.w, this.h) * 0.09, 0, TAU); ctx.fill();

    // parallax ranges
    this.range(0.08, 0.30, 260, '#24457f', 11);
    this.range(0.18, 0.42, 200, '#2d5596', 23, true);
    this.range(0.32, 0.56, 150, '#3a68ad', 37, true);

    const sx = Math.random() * this.shake - this.shake / 2;
    const sy = Math.random() * this.shake - this.shake / 2;
    ctx.setTransform(this.dpr * this.zoom, 0, 0, this.dpr * this.zoom, (-this.camX * this.zoom + sx) * this.dpr, (-this.camY * this.zoom + sy) * this.dpr);

    // terrain
    const x0 = this.camX - 20, x1 = this.camX + vw + 20;
    ctx.beginPath();
    ctx.moveTo(x0, this.camY + vh + 50);
    for (let x = x0; x <= x1; x += 10) ctx.lineTo(x, this.ground(x));
    ctx.lineTo(x1, this.camY + vh + 50);
    ctx.closePath();
    const snow = ctx.createLinearGradient(0, this.camY, 0, this.camY + vh);
    snow.addColorStop(0, '#ffffff');
    snow.addColorStop(1, '#cfe0f7');
    ctx.fillStyle = snow;
    ctx.fill();
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 10) { const y = this.ground(x) + 9; if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.strokeStyle = 'rgba(120,165,230,0.25)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // rocks
    for (const r of this.rocks) {
      if (r.x < x0 - 60 || r.x > x1 + 60) continue;
      const gy = this.ground(r.x);
      const a = this.angleAt(r.x);
      ctx.save();
      ctx.translate(r.x, gy + 4);
      ctx.rotate(a);
      if (r.kind === 0) {
        ctx.fillStyle = '#4a5f86';
        ctx.beginPath();
        ctx.moveTo(-r.r * 1.2, 0); ctx.lineTo(-r.r * 0.8, -r.r * 1.1); ctx.lineTo(r.r * 0.1, -r.r * 1.5); ctx.lineTo(r.r * 0.9, -r.r * 1.0); ctx.lineTo(r.r * 1.2, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#33456a';
        ctx.beginPath(); ctx.moveTo(r.r * 0.1, -r.r * 1.5); ctx.lineTo(r.r * 0.9, -r.r * 1.0); ctx.lineTo(r.r * 1.2, 0); ctx.lineTo(r.r * 0.2, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(-r.r * 0.8, -r.r * 1.1); ctx.lineTo(r.r * 0.1, -r.r * 1.5); ctx.lineTo(r.r * 0.9, -r.r * 1.0); ctx.lineTo(r.r * 0.3, -r.r * 1.05); ctx.lineTo(-r.r * 0.2, -r.r * 0.95); ctx.closePath(); ctx.fill();
      } else {
        // ice spikes
        ctx.fillStyle = '#8fd3ff';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.moveTo(i * r.r * 0.7 - r.r * 0.4, 0); ctx.lineTo(i * r.r * 0.7, -r.r * (1.7 - Math.abs(i) * 0.5)); ctx.lineTo(i * r.r * 0.7 + r.r * 0.4, 0); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.moveTo(-r.r * 0.1, 0); ctx.lineTo(0, -r.r * 1.6); ctx.lineTo(r.r * 0.12, 0); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    // crystals
    for (const g of this.gems) {
      if (g.taken || g.x < x0 - 30 || g.x > x1 + 30) continue;
      const bob = Math.sin(this.t * 4 + g.t) * 4;
      ctx.save();
      ctx.translate(g.x, g.y + bob);
      ctx.fillStyle = 'rgba(127,227,255,0.14)';
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5fd0ff';
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, -3); ctx.lineTo(0, 14); ctx.lineTo(-9, -3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d8f6ff';
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, -3); ctx.lineTo(0, -1); ctx.lineTo(-9, -3); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // particles
    for (const p of this.parts) {
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // player
    this.drawPlayer();

    // popups
    ctx.textAlign = 'center';
    ctx.font = '800 22px Inter, system-ui, sans-serif';
    for (const p of this.pops) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / 1.1);
      ctx.fillStyle = 'rgba(8,20,48,0.55)';
      ctx.fillText(p.text, p.x + 2, p.y + 2);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    // falling snow (screen space)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const f of this.flakes) {
      f.y += 0.0009 * f.z * 16;
      f.x -= 0.0006 * f.z * 16 * (this.phase === 'playing' ? 2.5 : 1);
      f.s += 0.02;
      if (f.y > 1) f.y -= 1;
      if (f.x < 0) f.x += 1;
      ctx.globalAlpha = 0.3 + f.z * 0.6;
      ctx.beginPath(); ctx.arc(f.x * this.w + Math.sin(f.s) * 6, f.y * this.h, 1 + f.z * 2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private range(par: number, base: number, amp: number, color: string, seed: number, trees = false) {
    const { ctx } = this;
    const off = this.camX * par;
    const yoff = -this.camY * par * 0.15;
    const z = this.zoom;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, this.h);
    const by = this.h * base + yoff * z;
    const f = (x: number) => {
      const u = (x + off) / z;
      return by + (Math.sin(u / 310 + seed) * 0.55 + Math.sin(u / 127 + seed * 2) * 0.3 + Math.abs(Math.sin(u / 61 + seed)) * 0.15) * amp * z * 0.7;
    };
    for (let x = 0; x <= this.w + 8; x += 8) ctx.lineTo(x, f(x));
    ctx.lineTo(this.w, this.h);
    ctx.closePath();
    ctx.fill();
    if (trees) {
      const spacing = 46 * z;
      const start = Math.floor(off / spacing) * spacing - off;
      for (let x = start; x < this.w + spacing; x += spacing) {
        const k = Math.floor((x + off) / spacing);
        const hsh = Math.abs(Math.sin(k * 12.9898 + seed) * 43758.5453) % 1;
        if (hsh < 0.45) continue;
        const ty = f(x);
        const th = (24 + hsh * 26) * z;
        ctx.beginPath();
        ctx.moveTo(x - th * 0.32, ty + 4); ctx.lineTo(x, ty - th); ctx.lineTo(x + th * 0.32, ty + 4);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  private drawPlayer() {
    const { ctx } = this;
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.rotate(this.rot);
    // scarf trailing behind
    const sp = Math.hypot(this.vx, this.vy);
    const flutter = Math.sin(this.t * 22) * 4;
    ctx.strokeStyle = '#ffcf4a';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -72);
    ctx.quadraticCurveTo(-24, -76 + flutter, -30 - sp * 0.02, -66 - flutter);
    ctx.stroke();
    // shadow-ish glow when spinning
    if (this.sprite.complete) ctx.drawImage(this.sprite, -60, -118, 120, 124);
    ctx.restore();
  }
}
