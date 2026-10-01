/**
 * ArcadeCursor Component
 * High-precision cyberpunk target reticle cursor with smooth lerp physics,
 * interactive lock-on states, and neon click ripples.
 */

export class ArcadeCursor {
  constructor(options = {}) {
    // Only initialize on desktop/mouse devices
    if (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
      return;
    }

    this.lerpSpeed = options.lerpSpeed || 0.18;
    this.mouse = { x: -100, y: -100 };
    this.ring = { x: -100, y: -100 };
    this.alive = true;
    this.visible = false;
    this.raf = 0;

    this.init();
  }

  init() {
    // Create cursor DOM elements
    this.container = document.createElement('div');
    this.container.className = 'arcade-cursor cursor-hidden';
    this.container.id = 'arcadeCursor';
    this.container.setAttribute('aria-hidden', 'true');

    this.dot = document.createElement('div');
    this.dot.className = 'arcade-cursor-dot';

    this.ring = document.createElement('div');
    this.ring.className = 'arcade-cursor-ring';
    this.ring.innerHTML = `
      <span class="reticle-corner reticle-tl"></span>
      <span class="reticle-corner reticle-tr"></span>
      <span class="reticle-corner reticle-br"></span>
      <span class="reticle-corner reticle-bl"></span>
    `;

    this.container.appendChild(this.ring);
    this.container.appendChild(this.dot);
    document.body.appendChild(this.container);

    this.ringPos = { x: -100, y: -100 };

    this.bindEvents();
    this.animate();
  }

  bindEvents() {
    const interactiveSelector =
      'button, a, input, select, textarea, [role="button"], .spotlight-card, .discipline-card, .tech-text, .round-strip-item, .admin-portal-btn, .btn-primary-gaming, .btn-secondary-gaming, [data-cursor-hover], .game-card-teaser';

    this.onPointerMove = (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;

      if (!this.visible) {
        this.visible = true;
        this.container.classList.remove('cursor-hidden');
        this.ringPos.x = this.mouse.x;
        this.ringPos.y = this.mouse.y;
      }

      // Check hover target
      const target = e.target;
      if (target && target.closest) {
        const inputEl = target.closest('input[type="text"], input[type="password"], textarea');
        if (inputEl) {
          this.container.classList.add('cursor-input');
          this.container.classList.remove('cursor-hover');
          return;
        }

        const interactiveEl = target.closest(interactiveSelector);
        if (interactiveEl) {
          this.container.classList.add('cursor-hover');
          this.container.classList.remove('cursor-input');
          return;
        }
      }

      this.container.classList.remove('cursor-hover', 'cursor-input');
    };

    this.onPointerDown = (e) => {
      this.container.classList.add('cursor-down');
      this.spawnRipple(e.clientX, e.clientY);
    };

    this.onPointerUp = () => {
      this.container.classList.remove('cursor-down');
    };

    this.onMouseLeave = () => {
      this.visible = false;
      this.container.classList.add('cursor-hidden');
    };

    this.onMouseEnter = () => {
      this.visible = true;
      this.container.classList.remove('cursor-hidden');
    };

    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    document.addEventListener('mouseleave', this.onMouseLeave);
    document.addEventListener('mouseenter', this.onMouseEnter);
  }

  spawnRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'arcade-cursor-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 450);
  }

  animate() {
    if (!this.alive) return;

    if (this.visible) {
      // Smooth lerp physics for trailing ring
      this.ringPos.x += (this.mouse.x - this.ringPos.x) * this.lerpSpeed;
      this.ringPos.y += (this.mouse.y - this.ringPos.y) * this.lerpSpeed;

      this.dot.style.transform = `translate3d(${this.mouse.x}px, ${this.mouse.y}px, 0)`;
      this.ring.style.transform = `translate3d(${this.ringPos.x}px, ${this.ringPos.y}px, 0)`;
    }

    this.raf = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    this.alive = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('mouseleave', this.onMouseLeave);
    document.removeEventListener('mouseenter', this.onMouseEnter);
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
