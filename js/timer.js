/**
 * ARCADE - High Precision Countdown Timer
 * Unpausable during competition, automatic lock on zero, 5s red danger warning pulse
 */

export class ArcadeTimer {
  constructor({ onTick, onWarning, onExpire }) {
    this.onTick = onTick;
    this.onWarning = onWarning;
    this.onExpire = onExpire;

    this.duration = 20;
    this.remaining = 20;
    this.intervalId = null;
    this.isRunning = false;
    this.warningThreshold = 5; // 5 seconds
  }

  start(seconds) {
    this.stop();
    this.duration = Math.max(0, Number(seconds) || 0);
    this.remaining = this.duration;

    if (!this.duration) {
      this.notifyTick();
      return;
    }

    this.isRunning = true;
    this.startedAt = Date.now();
    this.notifyTick();

    // Wall-clock timing stays accurate when the browser is briefly busy or
    // the display is throttled by the operating system.
    this.intervalId = setInterval(() => {
      if (!this.isRunning) return;
      const elapsed = (Date.now() - this.startedAt) / 1000;
      this.remaining = Math.max(0, this.duration - elapsed);
      this.notifyTick();

      if (this.remaining <= 0) {
        this.stop();
        if (this.onExpire) this.onExpire();
      }
    }, 100);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  notifyTick() {
    const formatted = this.formatTime(this.remaining);
    const percent = this.duration > 0
      ? Math.max(0, Math.min(100, (this.remaining / this.duration) * 100))
      : 0;
    if (this.onTick) {
      this.onTick({
        remaining: this.remaining,
        formatted,
        percent,
        isWarning: this.remaining <= this.warningThreshold && this.remaining > 0
      });
    }
  }

  formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}
