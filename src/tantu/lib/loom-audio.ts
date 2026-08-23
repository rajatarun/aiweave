/**
 * The Tantu Acoustic Palette — Teak and Tension.
 *
 * No synthesized digital oscillators are used as voices. Instead the engine
 * renders, once per session, a small bank of micro-samples that model the
 * physical materials of a handloom — seasoned teak, sliding bamboo, taut
 * cotton yarn, metallic drop-weights — by exciting noise through resonant
 * modal filters (the same physics a struck wooden body obeys). The rendered
 * buffers are then played back by a sampler voice chain:
 *
 *   AudioBufferSource -> lowpass EQ (fatigue guard) -> peaking body ->
 *   StereoPanner (grid-mapped) -> gain -> destination
 *
 * Every voice is heavily equalized above 5kHz so long sessions stay
 * subconscious and tactile rather than shrill.
 */

export type LoomVoice = "shuttleGlide" | "battenStrike" | "heddleShift" | "warpSnap" | "spindleLock" | "ratchetPull" | "needlePunch" | "dateLock" | "brassDenial" | "gearGrind" | "lacCrack" | "threadTwang";

export interface LoomAudioOptions {
  /** Master output level, 0–1. */
  volume?: number;
}

export interface LoomVoiceOptions {
  /**
   * Grid-mapped stereo position, -1 (left selvedge) to 1 (right selvedge).
   * Derived from the component's X coordinate on the base-6 lattice.
   */
  pan?: number;
  /** Per-hit gain multiplier — used for rapid overlapping shuttle glides. */
  gain?: number;
  /** Per-hit playback-rate detune, so repeated hits never phase-lock. */
  rate?: number;
}

/**
 * The knot timing scale. The acoustic envelopes are not tuned by ear — they
 * are the base-6 spacing lattice read as time: ms = knot px × 5. A sound and
 * a gap in the weave are the same measurement in two materials.
 */
export const KNOT_MS: Record<number, number> = {
  1: 30,
  2: 60,
  3: 90,
  4: 120,
  6: 180,
  8: 240,
  12: 360,
  14: 420,
  18: 540,
};

interface MaterialSpec {
  /** Duration of the rendered micro-sample in seconds. */
  duration: number;
  /** Modal resonances of the material body: [frequency, Q, amplitude]. */
  modes: Array<[number, number, number]>;
  /** Exciter decay constant — how fast the strike energy dies. */
  decay: number;
  /** Noise-burst attack length in seconds (bow/swish vs. strike). */
  excite: number;
  /** Post-EQ lowpass cutoff, keeping harsh highs off the ear. */
  cutoff: number;
  /**
   * Optional swept bandpass across the exciter: [startHz, endHz]. This is the
   * "slide" of a body travelling through a race, as distinct from a strike.
   */
  sweep?: [number, number];
}

/** Physical material models, measured off the loom's own timbres. */
const MATERIALS: Record<LoomVoice, MaterialSpec> = {
  // Bamboo shuttle sliding in the race — hollow, airy, swift. knot-6 (180ms),
  // the slide carried by a bandpass falling 1800Hz -> 650Hz as the shuttle
  // travels away from the strike point.
  shuttleGlide: {
    duration: KNOT_MS[6]! / 1000,
    modes: [
      [420, 6, 0.5],
      [950, 9, 0.3],
      [1640, 12, 0.14],
    ],
    decay: 26,
    excite: 0.055,
    cutoff: 3200,
    sweep: [1800, 650],
  },
  // Seasoned teak batten locking the weft — deep, resonant wood-on-wood.
  // knot-14 (420ms): the longest envelope on the scale, because mass rings.
  battenStrike: {
    duration: KNOT_MS[14]! / 1000,
    modes: [
      [96, 7, 1.0],
      [188, 10, 0.45],
      [317, 13, 0.22],
      [480, 16, 0.12],
      // 2.76× inharmonic partial — woody, deliberately not a bell.
      [1325, 18, 0.06],
    ],
    decay: 12,
    excite: 0.006,
    cutoff: 2000,
  },
  // Wooden treadles shifting the heddles — low, muted clatter. knot-6.
  heddleShift: {
    duration: KNOT_MS[6]! / 1000,
    modes: [
      [148, 9, 0.7],
      [268, 11, 0.35],
      [690, 14, 0.12],
    ],
    decay: 30,
    excite: 0.004,
    cutoff: 1500,
  },
  // A taut warp thread plucked against a metallic drop-weight — structural
  // resistance at the edge of the lattice.
  // A wooden spindle snicking into the charkha frame — the definitive end of
  // the spin cycle, synced with the Kolam thread snapping taut.
  spindleLock: {
    duration: 0.18,
    modes: [
      [240, 12, 0.8],
      [620, 18, 0.4],
      [1450, 22, 0.16],
    ],
    decay: 40,
    excite: 0.0015,
    cutoff: 2600,
  },
  // Steel needle puncturing heavy cotton — dry, tight, near-percussive tick.
  // A massive wooden gear tooth dropping into its pawl — the date locking the
  // Phad scroll steady. Heavier and longer-bodied than the batten.
  dateLock: {
    duration: 0.55,
    modes: [
      [62, 6, 1.0],
      [124, 9, 0.55],
      [231, 12, 0.26],
      [408, 15, 0.09],
    ],
    decay: 9,
    excite: 0.004,
    cutoff: 1300,
  },
  needlePunch: {

    duration: 0.07,
    modes: [
      [1900, 26, 0.5],
      [3400, 30, 0.22],
      [5200, 34, 0.07],
    ],
    decay: 90,
    excite: 0.0008,
    cutoff: 5200,
  },
  // A single warp thread plucked once it has been pulled dead taut across the
  // lattice — a dry cotton pitch over the wooden frame it is strung on. This is
  // the trace thread arriving at its target, not a musical string.
  threadTwang: {
    duration: 0.5,
    modes: [
      [196, 30, 0.9],
      [392, 26, 0.34],
      [588, 22, 0.14],
      [117, 8, 0.4],
    ],
    decay: 11,
    excite: 0.0012,
    cutoff: 2400,
  },
  // Heavy wooden ratchet: the weaver cranking tension back into the warp.

  ratchetPull: {
    duration: 0.22,
    modes: [
      [150, 9, 0.9],
      [380, 14, 0.5],
      [900, 20, 0.2],
    ],
    decay: 26,
    excite: 0.003,
    cutoff: 2000,
  },
  // Teak mallet striking a solid brass vault plate — the Gupt-Bandhan refusing
  // entry. Almost no decay taper: the mass simply absorbs the blow.
  brassDenial: {
    duration: 0.6,
    modes: [
      [54, 5, 1.0],
      [143, 8, 0.6],
      [287, 22, 0.34],
      [742, 34, 0.18],
      [1180, 40, 0.07],
    ],
    decay: 7,
    excite: 0.008,
    cutoff: 1500,
  },
  // Brass cipher gear seating itself, dragged through the friction of aged
  // teak and stone under load — a click riding on a low grinding body.
  gearGrind: {
    duration: 0.34,
    modes: [
      [88, 4, 0.85],
      [196, 6, 0.5],
      [523, 19, 0.42],
      [1310, 28, 0.24],
      [2270, 32, 0.09],
    ],
    decay: 15,
    excite: 0.026,
    cutoff: 3000,
  },
  // Crimson lac wax fracturing — brittle, dry, glassy, over in an instant.
  lacCrack: {
    duration: 0.3,
    modes: [
      [1620, 40, 0.8],
      [2740, 48, 0.5],
      [4300, 54, 0.26],
      [6100, 60, 0.1],
    ],
    decay: 52,
    excite: 0.0009,
    cutoff: 6400,
  },
  warpSnap: {
    duration: 0.26,
    modes: [
      [1180, 44, 0.6],
      [2360, 52, 0.22],
      [3140, 60, 0.08],
    ],
    decay: 17,
    excite: 0.002,
    cutoff: 4200,
  },
};

type OfflineCtor = typeof OfflineAudioContext;

function renderMaterial(spec: MaterialSpec, sampleRate: number): Promise<AudioBuffer> {
  const Offline: OfflineCtor | undefined =
    (window as unknown as { OfflineAudioContext?: OfflineCtor }).OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: OfflineCtor }).webkitOfflineAudioContext;

  if (!Offline) return Promise.reject(new Error("OfflineAudioContext unavailable"));

  const frames = Math.ceil(spec.duration * sampleRate);
  const ctx = new Offline(1, frames, sampleRate);

  // Exciter: a short burst of noise standing in for the physical impact.
  const noise = ctx.createBuffer(1, frames, sampleRate);
  const data = noise.getChannelData(0);
  let seed = 20240114;
  for (let i = 0; i < frames; i += 1) {
    // Deterministic LCG — the weave never re-randomises between sessions.
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const white = (seed / 0xffffffff) * 2 - 1;
    const t = i / sampleRate;
    const burst = Math.exp(-t / spec.excite);
    const body = Math.exp(-t * spec.decay);
    data[i] = white * (burst * 0.9 + body * 0.1);
  }

  const source = ctx.createBufferSource();
  source.buffer = noise;

  // Fatigue guard: shear the harsh top off every material before it is voiced.
  const tame = ctx.createBiquadFilter();
  tame.type = "lowpass";
  tame.frequency.value = spec.cutoff;
  tame.Q.value = 0.7;

  const out = ctx.createGain();
  out.gain.value = 0.9;
  tame.connect(out);
  out.connect(ctx.destination);

  // Optional travelling bandpass: the shuttle's own passage through the race,
  // voiced alongside the modal body of the material it slides against.
  if (spec.sweep) {
    const [from, to] = spec.sweep;
    const slide = ctx.createBiquadFilter();
    slide.type = "bandpass";
    slide.Q.value = 6;
    slide.frequency.setValueAtTime(from, 0);
    slide.frequency.exponentialRampToValueAtTime(to, spec.duration);
    const slideLevel = ctx.createGain();
    slideLevel.gain.setValueAtTime(0.0001, 0);
    slideLevel.gain.exponentialRampToValueAtTime(0.5, 0.02);
    slideLevel.gain.exponentialRampToValueAtTime(0.0001, spec.duration);
    source.connect(slide);
    slide.connect(slideLevel);
    slideLevel.connect(tame);
  }

  // Modal bank: each resonance is one vibrating mode of the wooden body.
  for (const [frequency, q, amplitude] of spec.modes) {
    const mode = ctx.createBiquadFilter();
    mode.type = "bandpass";
    mode.frequency.value = frequency;
    mode.Q.value = q;
    const level = ctx.createGain();
    level.gain.value = amplitude;
    source.connect(mode);
    mode.connect(level);
    level.connect(tame);
  }

  source.start(0);
  return ctx.startRendering();
}

/**
 * Spatial handloom sampler. One instance per document; voices are fired by the
 * Maku shuttle (Tab), the batten strike (Enter) and the heddles (arrow keys).
 */
export class LoomAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<LoomVoice, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private volume: number;
  private muted = false;

  constructor(options: LoomAudioOptions = {}) {
    this.volume = options.volume ?? 0.35;
  }

  /** True once the sampler bank has finished rendering. */
  get ready(): boolean {
    return this.buffers.size === Object.keys(MATERIALS).length;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master && this.ctx && !this.muted) {
      this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.02);
    }
  }

  /**
   * Prepare the context and render the material bank. Safe to call repeatedly;
   * must ultimately be triggered from a user gesture for autoplay policies.
   */
  prime(): Promise<void> {
    if (this.loading) return this.loading;
    if (typeof window === "undefined") return Promise.resolve();

    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return Promise.resolve();

    const ctx = new Ctor();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volume;

    // Session-wide fatigue EQ: nothing above the loom's own timbre survives.
    const shelf = ctx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 5000;
    shelf.gain.value = -18;

    master.connect(shelf);
    shelf.connect(ctx.destination);
    this.master = master;

    this.loading = Promise.all(
      (Object.keys(MATERIALS) as LoomVoice[]).map(async (voice) => {
        const buffer = await renderMaterial(MATERIALS[voice]!, ctx.sampleRate);
        this.buffers.set(voice, buffer);
      }),
    )
      .then(() => undefined)
      .catch(() => undefined);

    return this.loading;
  }

  /** Resume a context suspended by the browser's autoplay policy. */
  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Fire one material voice, panned to its position on the warp. */
  play(voice: LoomVoice, options: LoomVoiceOptions = {}): void {
    if (this.muted) return;
    const ctx = this.ctx;
    const master = this.master;
    const buffer = this.buffers.get(voice);
    if (!ctx || !master || !buffer) {
      void this.prime();
      return;
    }
    this.resume();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.rate ?? 1;

    const panner = ctx.createStereoPanner
      ? ctx.createStereoPanner()
      : null;

    const gain = ctx.createGain();
    gain.gain.value = options.gain ?? 1;

    if (panner) {
      // Grid-mapped panning: the shuttle is heard where it physically lands.
      panner.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
      source.connect(gain);
      gain.connect(panner);
      panner.connect(master);
    } else {
      source.connect(gain);
      gain.connect(master);
    }

    source.start();
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
  }


  private charkhaSource: AudioBufferSourceNode | null = null;
  private charkhaGain: GainNode | null = null;
  private charkhaBuffer: AudioBuffer | null = null;

  /**
   * Render one revolution of the charkha wheel: the cyclical wooden friction
   * of the spindle in its socket plus the breathing of the drive band. The
   * buffer is loop-seamless so the hum can turn indefinitely while data spins.
   */
  private renderCharkha(ctx: BaseAudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    // One revolution = knot-8 × 6 (1.44s). The wheel turns on the same lattice
    // the layout is spaced on.
    const period = (KNOT_MS[8]! * 6) / 1000;
    const frames = Math.ceil(period * sampleRate);
    const buffer = ctx.createBuffer(1, frames, sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 990133;
    let lp1 = 0;
    let lp2 = 0;
    // Drone fundamental snapped to a whole number of cycles per revolution so
    // the loop seam is silent — ~90Hz, the pitch of a loaded wooden spindle.
    const droneCycles = Math.round(90 * period);
    // The creak: one dry protest of the socket, late in each rotation.
    const creakStart = Math.floor(frames * 0.72);
    const creakFrames = Math.floor(0.09 * sampleRate);
    for (let i = 0; i < frames; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 0xffffffff) * 2 - 1;
      // Two cascaded one-pole lowpasses: dry wood friction, no bright edge.
      lp1 += (white - lp1) * 0.035;
      lp2 += (lp1 - lp2) * 0.05;
      const phase = (i / frames) * Math.PI * 2;
      // Rotational envelope: the wheel loads and unloads once per turn.
      const rotation = 0.55 + 0.45 * (0.5 - 0.5 * Math.cos(phase));
      // Sawtooth-ish drone folded down under 400Hz — harmonics 1..4 only.
      const dronePhase = phase * droneCycles;
      const drone =
        (Math.sin(dronePhase) +
          Math.sin(dronePhase * 2) * 0.5 +
          Math.sin(dronePhase * 3) * 0.28 +
          Math.sin(dronePhase * 4) * 0.14) *
        0.055;
      // Low wooden body tone, phase-locked so the loop point is silent-seamed.
      const body = Math.sin(phase * 3) * 0.05 + Math.sin(phase * 5) * 0.02;
      let creak = 0;
      if (i >= creakStart && i < creakStart + creakFrames) {
        const k = (i - creakStart) / creakFrames;
        // Rise and fall inside the burst, resonating near 500Hz.
        const env = Math.sin(Math.PI * k) ** 2;
        creak =
          Math.sin((2 * Math.PI * 500 * (i - creakStart)) / sampleRate) *
          env *
          (0.06 + Math.abs(lp2) * 0.9);
      }
      data[i] = (lp2 * 7.5 * rotation + body * rotation + drone * rotation + creak) * 0.6;
    }
    return buffer;
  }

  /**
   * Start the Charkha hum — the cyclical, anticipatory sound of raw cotton
   * being spun into yarn, held for as long as data is in flight.
   */
  startCharkha(options: { pan?: number; latency?: number } = {}): void {
    if (this.muted) return;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      void this.prime().then(() => {
        if (this.ctx) this.startCharkha(options);
      });
      return;
    }
    if (this.charkhaSource) {
      this.setCharkhaLatency(options.latency ?? 0);
      return;
    }
    this.resume();

    if (!this.charkhaBuffer) this.charkhaBuffer = this.renderCharkha(ctx);

    const source = ctx.createBufferSource();
    source.buffer = this.charkhaBuffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.12);

    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
      source.connect(gain);
      gain.connect(panner);
      panner.connect(master);
    } else {
      source.connect(gain);
      gain.connect(master);
    }

    source.start();
    this.charkhaSource = source;
    this.charkhaGain = gain;
    this.setCharkhaLatency(options.latency ?? 0);
  }

  /**
   * Bandwidth friction: latency (ms) drags the wheel. High latency slows and
   * deepens the wooden friction so the user hears the transfer speed.
   */
  setCharkhaLatency(latency: number): void {
    const ctx = this.ctx;
    const source = this.charkhaSource;
    if (!ctx || !source) return;
    const drag = Math.max(0, Math.min(1, latency / 2000));
    const rate = 1.25 - drag * 0.75; // fast, light spin -> slow, laboured turn
    source.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.25);
    this.charkhaGain?.gain.setTargetAtTime(0.5 + drag * 0.18, ctx.currentTime, 0.25);
  }

  /**
   * Spindle lock: the hum stops abruptly and a wooden spindle snicks into the
   * frame, synced with the Kolam thread pulling taut.
   */
  stopCharkha(options: { lock?: boolean; pan?: number } = {}): void {
    const ctx = this.ctx;
    const source = this.charkhaSource;
    const gain = this.charkhaGain;
    this.charkhaSource = null;
    this.charkhaGain = null;
    if (ctx && gain && source) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.012);
      window.setTimeout(() => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
        source.disconnect();
        gain.disconnect();
      }, 90);
    }
    if (options.lock !== false) {
      this.play("spindleLock", { pan: options.pan ?? 0, gain: 0.9 });
    }
  }


  private rollerSource: AudioBufferSourceNode | null = null;
  private rollerGain: GainNode | null = null;
  private rollerBuffer: AudioBuffer | null = null;
  private rollerIdle: number | null = null;

  /**
   * Render one turn of the Phad roller: a massive seasoned-teak cylinder
   * grinding in its socket under the dead weight of a wound cloth scroll.
   * Far lower and slower than the charkha — this is mass, not spin.
   */
  private renderRoller(ctx: BaseAudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const period = 2.4; // one full revolution of a heavy cylinder
    const frames = Math.ceil(period * sampleRate);
    const buffer = ctx.createBuffer(1, frames, sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 4471223;
    let lp1 = 0;
    let lp2 = 0;
    let lp3 = 0;
    for (let i = 0; i < frames; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 0xffffffff) * 2 - 1;
      // Three cascaded poles: all edge stripped, only the groan survives.
      lp1 += (white - lp1) * 0.02;
      lp2 += (lp1 - lp2) * 0.028;
      lp3 += (lp2 - lp3) * 0.035;
      const phase = (i / frames) * Math.PI * 2;
      // Load cycle: the cloth's weight shifts once per revolution.
      const rotation = 0.6 + 0.4 * (0.5 - 0.5 * Math.cos(phase));
      // Sub-body of the cylinder, phase-locked for a seamless loop seam.
      const body = Math.sin(phase * 2) * 0.09 + Math.sin(phase * 3) * 0.04;
      data[i] = (lp3 * 11 * rotation + body * rotation) * 0.55;
    }
    return buffer;
  }

  /**
   * The Wooden Roller. Held for as long as the Phad is in motion; `velocity`
   * (0–1) is the scroll speed, which loads the cylinder harder and turns it
   * faster. Call repeatedly while panning — it is idempotent.
   */
  startRoller(options: { pan?: number; velocity?: number } = {}): void {
    if (this.muted) return;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      void this.prime().then(() => {
        if (this.ctx) this.startRoller(options);
      });
      return;
    }
    if (this.rollerSource) {
      this.setRollerVelocity(options.velocity ?? 0);
      return;
    }
    this.resume();

    if (!this.rollerBuffer) this.rollerBuffer = this.renderRoller(ctx);

    const source = ctx.createBufferSource();
    source.buffer = this.rollerBuffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.42, ctx.currentTime, 0.18);

    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
      source.connect(gain);
      gain.connect(panner);
      panner.connect(master);
    } else {
      source.connect(gain);
      gain.connect(master);
    }

    source.start();
    this.rollerSource = source;
    this.rollerGain = gain;
    this.setRollerVelocity(options.velocity ?? 0);
  }

  /** Scroll speed drives the cylinder: faster pan, faster and louder turn. */
  setRollerVelocity(velocity: number): void {
    const ctx = this.ctx;
    const source = this.rollerSource;
    if (!ctx || !source) return;
    const v = Math.max(0, Math.min(1, velocity));
    source.playbackRate.setTargetAtTime(0.72 + v * 0.85, ctx.currentTime, 0.12);
    this.rollerGain?.gain.setTargetAtTime(0.26 + v * 0.4, ctx.currentTime, 0.12);
  }

  /** The scroll comes to rest; the cylinder settles rather than cutting out. */
  stopRoller(): void {
    const ctx = this.ctx;
    const source = this.rollerSource;
    const gain = this.rollerGain;
    this.rollerSource = null;
    this.rollerGain = null;
    if (this.rollerIdle !== null) {
      window.clearTimeout(this.rollerIdle);
      this.rollerIdle = null;
    }
    if (!ctx || !source || !gain) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.09);
    window.setTimeout(() => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      gain.disconnect();
    }, 420);
  }

  /**
   * Convenience for scroll handlers: keep the roller turning while events
   * arrive, and let it settle automatically once panning stops.
   */
  rollerTick(velocity: number, pan = 0): void {
    if (typeof window === "undefined") return;
    this.startRoller({ pan, velocity });
    this.setRollerVelocity(velocity);
    if (this.rollerIdle !== null) window.clearTimeout(this.rollerIdle);
    this.rollerIdle = window.setTimeout(() => {
      this.rollerIdle = null;
      this.stopRoller();
    }, 220);
  }

  private frictionSource: AudioBufferSourceNode | null = null;
  private frictionGain: GainNode | null = null;
  private frictionFilter: BiquadFilterNode | null = null;
  private frictionPanner: StereoPannerNode | null = null;
  private frictionBuffer: AudioBuffer | null = null;
  private frictionIdle: number | null = null;

  /**
   * Glass on Cotton. A dry, grainy hiss: the ground edge of a heavy brass
   * lens dragged across coarse, un-mercerised cotton yarn. Rendered as
   * broadband noise given a fibrous grain — the amplitude is modulated by a
   * dense pseudo-weave so the ear hears individual threads passing, not air.
   */
  private renderFriction(ctx: BaseAudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const frames = Math.ceil(1.7 * sampleRate);
    const buffer = ctx.createBuffer(1, frames, sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 90210711;
    let hp = 0;
    let prev = 0;
    for (let i = 0; i < frames; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 0xffffffff) * 2 - 1;
      // One-pole high-pass: strip the body, keep the dry surface.
      hp += (white - hp) * 0.35;
      const bright = white - hp;
      // Thread grain: two incommensurate pick rates so the loop never pulses.
      const t = i / sampleRate;
      const grain =
        0.62 +
        0.26 * Math.sin(t * 2 * Math.PI * 213) +
        0.12 * Math.sin(t * 2 * Math.PI * 331.7);
      // Slow crossfade at the seam keeps a continuous drag inaudible at loop.
      const seam = Math.min(1, Math.min(i, frames - i) / (0.06 * sampleRate));
      const sample = bright * grain * seam * 0.5;
      // Light smoothing so the hiss is cotton, not tape.
      prev += (sample - prev) * 0.7;
      data[i] = prev;
    }
    return buffer;
  }

  /**
   * Hold the lens against the cloth. `velocity` (0-1) is the drag speed: a
   * slow press-and-pull is a near-silent whisper of fibre, a fast sweep
   * brightens and loudens the abrasion. Idempotent — call on every move.
   */
  startFriction(options: { pan?: number; velocity?: number } = {}): void {
    if (this.muted) return;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      void this.prime().then(() => {
        if (this.ctx) this.startFriction(options);
      });
      return;
    }
    if (this.frictionSource) {
      this.setFrictionVelocity(options.velocity ?? 0, options.pan);
      return;
    }
    this.resume();

    if (!this.frictionBuffer) this.frictionBuffer = this.renderFriction(ctx);

    const source = ctx.createBufferSource();
    source.buffer = this.frictionBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2200;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);

    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
      gain.connect(panner);
      panner.connect(master);
      this.frictionPanner = panner;
    } else {
      gain.connect(master);
      this.frictionPanner = null;
    }

    source.start();
    this.frictionSource = source;
    this.frictionGain = gain;
    this.frictionFilter = filter;
    this.setFrictionVelocity(options.velocity ?? 0, options.pan);
  }

  /** Drag speed drives abrasion: brighter, louder, faster fibre passage. */
  setFrictionVelocity(velocity: number, pan?: number): void {
    const ctx = this.ctx;
    const source = this.frictionSource;
    if (!ctx || !source) return;
    const v = Math.max(0, Math.min(1, velocity));
    const now = ctx.currentTime;
    source.playbackRate.setTargetAtTime(0.6 + v * 1.5, now, 0.08);
    this.frictionGain?.gain.setTargetAtTime(0.03 + v * 0.3, now, 0.07);
    this.frictionFilter?.frequency.setTargetAtTime(1400 + v * 3400, now, 0.09);
    if (pan !== undefined) {
      this.frictionPanner?.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.1);
    }
  }

  /** The finger lifts; the fibre noise decays instead of being cut. */
  stopFriction(): void {
    const ctx = this.ctx;
    const source = this.frictionSource;
    const gain = this.frictionGain;
    const filter = this.frictionFilter;
    const panner = this.frictionPanner;
    this.frictionSource = null;
    this.frictionGain = null;
    this.frictionFilter = null;
    this.frictionPanner = null;
    if (this.frictionIdle !== null) {
      window.clearTimeout(this.frictionIdle);
      this.frictionIdle = null;
    }
    if (!ctx || !source || !gain) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.07);
    window.setTimeout(() => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
      panner?.disconnect();
    }, 300);
  }

  /**
   * The Darshan drag, as one call per pointer move. Below the rumble
   * threshold only the glass-on-cotton hiss is heard; sweeping fast across
   * large swaths of the tapestry additionally wakes the distant loom frame
   * shifting its mass. Both settle on their own once the drag stops.
   */
  lensDrag(velocity: number, pan = 0): void {
    if (typeof window === "undefined") return;
    const v = Math.max(0, Math.min(1, velocity));
    this.startFriction({ pan, velocity: v });
    this.setFrictionVelocity(v, pan);
    // Loom Rumble: the far-off frame only answers to broad, fast movement.
    if (v > 0.45) this.rollerTick((v - 0.45) / 0.55, pan * 0.4);
    if (this.frictionIdle !== null) window.clearTimeout(this.frictionIdle);
    this.frictionIdle = window.setTimeout(() => {
      this.frictionIdle = null;
      this.stopFriction();
    }, 140);
  }

  /**
   * The Macro Snap: the brass lens dropped flat against the cloth, the node
   * locked dead-centre under it.
   */
  lensLock(pan = 0): void {
    if (typeof window === "undefined") return;
    const fire = () => {
      this.play("battenStrike", { pan, gain: 1, rate: 0.82 });
      const seat = window.setTimeout(() => this.play("dateLock", { pan, gain: 0.85, rate: 0.9 }), 70);
      this.ruptureTimers.push(seat);
    };
    if (!this.ctx) {
      void this.prime().then(fire);
      return;
    }
    fire();
  }

  /** Heavy wooden gear dropping into its pawl as a date takes focus. */
  lockDate(pan = 0): void {
    this.play("dateLock", { pan, gain: 0.95, rate: 0.96 + Math.random() * 0.08 });
  }

  private ruptureTimers: number[] = [];


  private clearRuptureTimers(): void {
    this.ruptureTimers.forEach((id) => window.clearTimeout(id));
    this.ruptureTimers = [];
  }

  /**
   * Acoustic rupture: the taut warp yarn snaps, the heddles clatter out of
   * alignment, then the loom plunges into dead silence.
   */
  rupture(options: { pan?: number } = {}): void {
    if (typeof window === "undefined") return;
    const pan = options.pan ?? 0;
    this.clearRuptureTimers();

    const fire = () => {
      // 1. The high-tension snap of taut cotton.
      this.play("warpSnap", { pan, gain: 1, rate: 1.15 });

      // 2. Heddles dropping out of alignment — chaotic, spatially scattered.
      const clatter = [70, 118, 155, 214, 262, 330, 398];
      clatter.forEach((delay, index) => {
        const id = window.setTimeout(() => {
          this.play("heddleShift", {
            pan: Math.max(-1, Math.min(1, pan + (index % 2 === 0 ? -0.55 : 0.5) * ((index % 3) / 2))),
            gain: 0.85 - index * 0.08,
            rate: 0.82 + (index % 4) * 0.11,
          });
        }, delay);
        this.ruptureTimers.push(id);
      });

      // 3. Dead silence: every cyclical voice is cut, nothing replaces it.
      const hush = window.setTimeout(() => this.stopCharkha({ lock: false }), 460);
      this.ruptureTimers.push(hush);
    };

    if (!this.ctx) {
      void this.prime().then(fire);
      return;
    }
    fire();
  }

  /**
   * The Weaver's Knot: a heavy wooden ratchet cranks the frayed warp taut
   * again, ending with the lattice locking rigid.
   */
  repair(options: { pan?: number } = {}): void {
    if (typeof window === "undefined") return;
    const pan = options.pan ?? 0;
    this.clearRuptureTimers();

    const fire = () => {
      [0, 90, 165].forEach((delay, index) => {
        const id = window.setTimeout(() => {
          this.play("ratchetPull", { pan, gain: 0.85, rate: 0.9 + index * 0.12 });
        }, delay);
        this.ruptureTimers.push(id);
      });
      const lock = window.setTimeout(() => {
        this.play("battenStrike", { pan, gain: 1 });
      }, 280);
      this.ruptureTimers.push(lock);
    };

    if (!this.ctx) {
      void this.prime().then(fire);
      return;
    }
    fire();
  }

  /**
   * Acoustic Denial. Wood on solid brass: a dull, heavy thud with a hostile
   * low-frequency tail that vibrates the surrounding lattice.
   */
  denyEntry(options: { pan?: number } = {}): void {
    if (typeof window === "undefined") return;
    const pan = options.pan ?? 0;
    const fire = () => {
      this.play("brassDenial", { pan, gain: 1, rate: 0.94 + Math.random() * 0.06 });
      const tail = window.setTimeout(() => {
        this.play("battenStrike", { pan, gain: 0.5, rate: 0.7 });
      }, 55);
      this.ruptureTimers.push(tail);
    };
    if (!this.ctx) {
      void this.prime().then(fire);
      return;
    }
    fire();
  }

  /**
   * One spool of the Chakra Cipher rotating and locking: brass gear teeth
   * seating over the grinding friction of stone and aged teak.
   */
  cipherStep(index = 0, pan = 0): void {
    if (typeof window === "undefined") return;
    const spread = Math.max(-1, Math.min(1, pan));
    this.play("gearGrind", { pan: spread, gain: 0.9, rate: 0.86 + (index % 5) * 0.07 });
    this.play("heddleShift", { pan: spread, gain: 0.3, rate: 0.7 });
  }

  /**
   * The Trace Thread: a madder filament is shot across the lattice (a run of
   * shuttle passes, panned from origin toward the target) and then pulled taut
   * around the found card, which answers with a dry cotton twang.
   */
  traceRun(options: { from?: number; to?: number; passes?: number } = {}): void {
    if (typeof window === "undefined") return;
    const from = Math.max(-1, Math.min(1, options.from ?? 0));
    const to = Math.max(-1, Math.min(1, options.to ?? 0));
    const passes = Math.max(2, Math.min(8, options.passes ?? 5));
    for (let i = 0; i < passes; i += 1) {
      const k = i / (passes - 1);
      window.setTimeout(() => {
        this.play("shuttleGlide", {
          pan: from + (to - from) * k,
          gain: 0.24 + k * 0.2,
          rate: 1.1 + k * 0.35,
        });
      }, i * 46);
    }
  }

  /** The thread pulls taut around the target and rings once. */
  traceTaut(pan = 0): void {
    if (typeof window === "undefined") return;
    const spread = Math.max(-1, Math.min(1, pan));
    this.play("threadTwang", { pan: spread, gain: 0.85, rate: 0.94 + Math.random() * 0.12 });
    this.play("heddleShift", { pan: spread, gain: 0.22, rate: 1.3 });
  }

  /** No card holds the searched thread: the shuttle runs out and slackens. */
  traceSlack(pan = 0): void {
    if (typeof window === "undefined") return;
    this.play("heddleShift", { pan, gain: 0.5, rate: 0.72 });
    window.setTimeout(() => this.play("heddleShift", { pan, gain: 0.24, rate: 0.6 }), 90);
  }

  /**
   * The Breach: the lac seal cracks, then the dense Kala threads unspool and
   * retract into the selvedges, ending with the cavity locking open.
   */
  breach(options: { pan?: number } = {}): void {
    if (typeof window === "undefined") return;
    const pan = options.pan ?? 0;
    this.clearRuptureTimers();
    const fire = () => {
      this.play("lacCrack", { pan, gain: 1, rate: 1 });
      // Threads unspooling outward to both selvedges.
      [40, 90, 145, 205, 270, 340].forEach((delay, index) => {
        const id = window.setTimeout(() => {
          this.play("shuttleGlide", {
            pan: index % 2 === 0 ? -0.85 : 0.85,
            gain: 0.7 - index * 0.08,
            rate: 0.75 + index * 0.09,
          });
        }, delay);
        this.ruptureTimers.push(id);
      });
      const settle = window.setTimeout(() => this.play("dateLock", { pan, gain: 0.8, rate: 1.1 }), 430);
      this.ruptureTimers.push(settle);
    };
    if (!this.ctx) {
      void this.prime().then(fire);
      return;
    }
    fire();
  }

  dispose(): void {
    this.clearRuptureTimers();
    this.stopCharkha({ lock: false });
    this.stopRoller();
    this.stopFriction();

    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.buffers.clear();
    this.loading = null;
  }
}

let shared: LoomAudioEngine | null = null;

/** The single document-wide loom sampler. */
export function getLoomAudio(options?: LoomAudioOptions): LoomAudioEngine {
  if (!shared) shared = new LoomAudioEngine(options);
  return shared;
}

/** Map a viewport X coordinate onto the loom's stereo field. */
export function panForX(x: number, width = typeof window !== "undefined" ? window.innerWidth : 1): number {
  if (!width) return 0;
  return Math.max(-1, Math.min(1, (x / width) * 2 - 1));
}
