/**
 * RETRO AIM: ARCADE EDITION - WEB AUDIO API SYNTHESIZER
 * Pure synthesized retro sound effects and synthwave procedural soundtrack.
 * Zero external audio files required.
 */

export class RetroAudioEngine {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.musicEnabled = true;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master volume bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // SFX volume bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.soundEnabled ? 1.0 : 0, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Music volume bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicEnabled ? 0.35 : 0, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  get isMuted() {
    return !this.soundEnabled && !this.musicEnabled;
  }

  toggleMute() {
    const nextUnmuted = this.isMuted;
    this.toggleSound(nextUnmuted);
    this.toggleMusic(nextUnmuted);
    return nextUnmuted;
  }

  toggleSound(forceState) {
    this.soundEnabled = forceState !== undefined ? forceState : !this.soundEnabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.soundEnabled ? 1.0 : 0, this.ctx.currentTime);
    }
    return this.soundEnabled;
  }

  toggleMusic(forceState) {
    this.musicEnabled = forceState !== undefined ? forceState : !this.musicEnabled;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicEnabled ? 0.35 : 0, this.ctx.currentTime);
    }
    if (this.musicEnabled) {
      this.startBGM();
    } else {
      this.stopBGM();
    }
    return this.musicEnabled;
  }

  /* -------------------------------------------------------------
     SFX 1: Laser Blaster Shoot
     Retro arcade zapper frequency sweep (sawtooth + high pass)
  ------------------------------------------------------------- */
  playLaserShoot() {
    if (!this.soundEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    // Frequency sweep down rapidly
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.11);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.11);
    filter.Q.setValueAtTime(3, t);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  /* -------------------------------------------------------------
     SFX 2: Target Hit Ping
     Bright high-frequency dual sine harmonic chime
  ------------------------------------------------------------- */
  playTargetHit() {
    if (!this.soundEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    
    // Primary Tone
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, t); // A5
    osc1.frequency.exponentialRampToValueAtTime(1320, t + 0.08); // E6
    gain1.gain.setValueAtTime(0.4, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    // Harmonic Overkill Tone
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, t); // A6
    gain2.gain.setValueAtTime(0.25, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.2);
    osc2.stop(t + 0.2);
  }

  /* -------------------------------------------------------------
     SFX 3: Bomb Detonation Explosion & Danger Buzzer
     Heavy sub-bass impact + filtered white noise burst
  ------------------------------------------------------------- */
  playBombExplosion() {
    if (!this.soundEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Sub-bass thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.45);
    subGain.gain.setValueAtTime(0.7, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(t);
    subOsc.stop(t + 0.52);

    // Noise burst
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2200, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(120, t + 0.4);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.65, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + 0.42);

    // Penalty harsh buzzer
    const buzzOsc = this.ctx.createOscillator();
    const buzzGain = this.ctx.createGain();
    buzzOsc.type = 'sawtooth';
    buzzOsc.frequency.setValueAtTime(80, t);
    buzzGain.gain.setValueAtTime(0.4, t);
    buzzGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    buzzOsc.connect(buzzGain);
    buzzGain.connect(this.sfxGain);
    buzzOsc.start(t);
    buzzOsc.stop(t + 0.36);
  }

  /* -------------------------------------------------------------
     SFX 4: Item Despawn Glitch (Target Timed Out)
  ------------------------------------------------------------- */
  playDespawnFizzle() {
    if (!this.soundEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  /* -------------------------------------------------------------
     SFX 5: Countdown Beeps (3, 2, 1, GO!)
  ------------------------------------------------------------- */
  playCountdownBeep(isGo = false) {
    if (!this.soundEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isGo ? 'sawtooth' : 'square';
    const freq = isGo ? 987.77 : 493.88; // B5 vs B4
    const dur = isGo ? 0.3 : 0.12;

    osc.frequency.setValueAtTime(freq, t);
    if (isGo) {
      osc.frequency.exponentialRampToValueAtTime(1318.51, t + 0.25); // ramp to E6
    }

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /* -------------------------------------------------------------
     SFX 6: Round Cleared Fanfare
  ------------------------------------------------------------- */
  playRoundFanfare() {
    if (!this.soundEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const t = this.ctx.currentTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  /* -------------------------------------------------------------
     SFX 7: Camera Transition Warp Swoosh
  ------------------------------------------------------------- */
  playWarpSwoosh() {
    if (!this.soundEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.8);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(3500, t + 0.8);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 1.0);
  }

  /* -------------------------------------------------------------
     SFX 8: Mechanical Keystroke Click
  ------------------------------------------------------------- */
  playKeyClick() {
    if (!this.soundEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500 + Math.random() * 200, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.025);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.03);
  }

  /* -------------------------------------------------------------
     SFX 9: Blackout Lockdown Alarm
  ------------------------------------------------------------- */
  playAlarmWarning() {
    if (!this.soundEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.15);
    osc.frequency.linearRampToValueAtTime(440, t + 0.3);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  /* -------------------------------------------------------------
     SYNTHWAVE PROCEDURAL BACKGROUND MUSIC (BGM)
     Classic 80s Cyber Arpeggiated Bassline at 124 BPM
  ------------------------------------------------------------- */
  startBGM() {
    if (!this.musicEnabled || this.bgmTimer) return;
    this.ensureContext();
    if (!this.ctx) return;

    const bpm = 124;
    const stepInterval = (60 / bpm) / 4 * 1000; // 16th notes ~120ms
    
    // Cyberpunk synthwave bass progression (in A minor / F / G / E)
    // Notes in Hz: A1=55, C2=65.4, E2=82.4, F1=43.6, G1=49, D2=73.4
    const pattern = [
      55, 55, 110, 55,  55, 110, 55, 110,  // A1
      55, 55, 110, 55,  82.4, 73.4, 65.4, 55,
      43.6, 43.6, 87.3, 43.6, 43.6, 87.3, 43.6, 87.3, // F1
      49, 49, 98, 49,   73.4, 65.4, 82.4, 98 // G1
    ];

    this.bgmStep = 0;
    this.bgmTimer = setInterval(() => {
      if (!this.musicEnabled || !this.ctx) return;

      const freq = pattern[this.bgmStep % pattern.length];
      const isAccent = (this.bgmStep % 4 === 0);
      const isLead = (this.bgmStep % 8 === 6);

      const t = this.ctx.currentTime;

      // Bass synth note
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isAccent ? 1400 : 800, t);
      filter.frequency.exponentialRampToValueAtTime(200, t + 0.1);
      filter.Q.setValueAtTime(4, t);

      const vol = isAccent ? 0.35 : 0.22;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(t);
      osc.stop(t + 0.12);

      // High cyber sparkle on specific steps
      if (isLead && Math.random() > 0.4) {
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        leadOsc.type = 'sine';
        leadOsc.frequency.setValueAtTime(freq * 8, t);
        leadGain.gain.setValueAtTime(0.08, t);
        leadGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        leadOsc.connect(leadGain);
        leadGain.connect(this.musicGain);
        leadOsc.start(t);
        leadOsc.stop(t + 0.22);
      }

      this.bgmStep++;
    }, stepInterval);
  }

  stopBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const retroAudio = new RetroAudioEngine();
if (typeof window !== "undefined") {
  window.retroAudio = retroAudio;
}

