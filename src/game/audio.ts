// Tiny WebAudio synth: SFX + a mellow lo-fi chord loop. No audio files needed.
export class Audio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  muted = false;
  private musicTimer: number | null = null;
  private step = 0;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      this.musicGain.connect(lp).connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, dest?: AudioNode) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number) {
    if (!this.ctx || !this.master) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  jump() { this.tone(320, 0.18, 'triangle', 0.25, 640); }
  land() { this.noise(0.12, 0.25, 900); }
  crystal(combo: number) {
    const base = 880 * Math.pow(2, (Math.min(combo, 8) * 2) / 12);
    this.tone(base, 0.12, 'sine', 0.22);
    setTimeout(() => this.tone(base * 1.5, 0.16, 'sine', 0.16), 50);
  }
  flip(n: number) {
    [0, 4, 7, 12].slice(0, 2 + Math.min(n, 2)).forEach((s, i) =>
      setTimeout(() => this.tone(523 * Math.pow(2, s / 12), 0.2, 'square', 0.08), i * 70));
  }
  crash() {
    this.noise(0.6, 0.5, 600);
    this.tone(220, 0.5, 'sawtooth', 0.12, 55);
  }
  click() { this.tone(660, 0.06, 'triangle', 0.15); }

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    // Fmaj7 – Em7 – Dm7 – Cmaj7, soft keys + a sub bass, 80 bpm.
    const chords = [
      [53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59],
    ];
    const beat = 60 / 80;
    const play = () => {
      if (!this.ctx || !this.musicGain) return;
      const c = chords[Math.floor(this.step / 4) % chords.length];
      const b = this.step % 4;
      const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
      if (b === 0) {
        c.forEach((n, i) => setTimeout(() => this.tone(mtof(n + 12), beat * 3.6, 'triangle', 0.18, undefined, this.musicGain!), i * 25));
        this.tone(mtof(c[0] - 12), beat * 1.8, 'sine', 0.5, undefined, this.musicGain);
      }
      if (b === 2) this.tone(mtof(c[0] - 12), beat * 1.6, 'sine', 0.4, undefined, this.musicGain);
      if (b === 1 || b === 3) this.tone(mtof(c[(this.step * 3) % 4] + 24), beat * 0.8, 'sine', 0.09, undefined, this.musicGain);
      this.step++;
    };
    play();
    this.musicTimer = window.setInterval(play, beat * 1000);
  }
}

export const audio = new Audio();
