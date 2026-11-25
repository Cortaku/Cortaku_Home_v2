// Effects use Web Audio for low latency; the soundtrack streams through an <audio> element.

type Effect = 'jump' | 'death';

const EFFECT_FILES: Record<Effect, string> = {
  jump: '/game-assets/jump.wav',
  death: '/game-assets/death_sound.mp3',
};

export class GameAudio {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffers = new Map<Effect, AudioBuffer>();
  private music: HTMLAudioElement | null = null;
  private muted: boolean;
  private wantsMusic = false;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  /** Call from a tap or key press; browsers block sound otherwise. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      if (this.wantsMusic && this.music?.paused) this.music.play().catch(() => {});
      return;
    }
    try {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
    } catch {
      return; // no audio on this device; the game plays silently
    }
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.muted ? 0 : 1;
    this.gain.connect(this.ctx.destination);

    for (const name of Object.keys(EFFECT_FILES) as Effect[]) {
      fetch(EFFECT_FILES[name])
        .then((res) => res.arrayBuffer())
        .then((data) => this.ctx!.decodeAudioData(data))
        .then((buffer) => this.buffers.set(name, buffer))
        .catch(() => {});
    }

    this.music = new Audio('/game-assets/soundtrack.mp3');
    this.music.loop = true;
    this.music.volume = 0.3;
    this.music.muted = this.muted;
  }

  play(name: Effect) {
    const buffer = this.buffers.get(name);
    if (!this.ctx || !this.gain || !buffer || this.muted) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);
    source.start();
  }

  /** Two-note chime for a new zone. */
  chime() {
    if (!this.ctx || !this.gain || this.muted) return;
    const now = this.ctx.currentTime;
    [660, 990].forEach((frequency, i) => {
      const osc = this.ctx!.createOscillator();
      const env = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.value = frequency;
      env.gain.setValueAtTime(0.0001, now + i * 0.09);
      env.gain.exponentialRampToValueAtTime(0.12, now + i * 0.09 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.16);
      osc.connect(env).connect(this.gain!);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.18);
    });
  }

  setMusic(playing: boolean) {
    this.wantsMusic = playing;
    if (!this.music) return;
    if (playing) this.music.play().catch(() => {});
    else this.music.pause();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.gain) this.gain.gain.value = muted ? 0 : 1;
    if (this.music) {
      this.music.muted = muted;
      if (!muted && this.wantsMusic) this.music.play().catch(() => {});
    }
  }

  dispose() {
    this.music?.pause();
    this.music = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
