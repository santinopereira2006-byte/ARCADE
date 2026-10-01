/**
 * GradientText Component (Vanilla JS port of React Bits GradientText)
 * Creates an animated linear gradient text with optional gradient border and hover pause.
 */

export class GradientText {
  constructor(element, options = {}) {
    if (!element) {
      throw new Error('GradientText: element is required');
    }
    this.container = element;
    this.options = {
      colors: options.colors || ['#5227FF', '#FF9FFC', '#B497CF'],
      animationSpeed: options.animationSpeed !== undefined ? options.animationSpeed : 8,
      showBorder: options.showBorder !== undefined ? options.showBorder : false,
      direction: options.direction || 'horizontal',
      pauseOnHover: options.pauseOnHover !== undefined ? options.pauseOnHover : false,
      yoyo: options.yoyo !== undefined ? options.yoyo : true,
      className: options.className || ''
    };

    this.isPaused = false;
    this.elapsed = 0;
    this.lastTime = null;
    this.raf = 0;
    this.alive = true;
    this.visible = true;

    this.init();
  }

  init() {
    this.container.classList.add('animated-gradient-text');
    if (this.options.className) {
      this.options.className.split(' ').filter(Boolean).forEach((cls) => {
        this.container.classList.add(cls);
      });
    }

    if (this.options.showBorder) {
      this.container.classList.add('with-border');
    }

    // Set up DOM elements
    let textContentEl = this.container.querySelector('.text-content');
    if (!textContentEl) {
      textContentEl = document.createElement('span');
      textContentEl.className = 'text-content';
      while (this.container.firstChild) {
        textContentEl.appendChild(this.container.firstChild);
      }
      this.container.appendChild(textContentEl);
    }
    this.textContentEl = textContentEl;

    if (this.options.showBorder) {
      let overlayEl = this.container.querySelector('.gradient-overlay');
      if (!overlayEl) {
        overlayEl = document.createElement('div');
        overlayEl.className = 'gradient-overlay';
        this.container.insertBefore(overlayEl, this.textContentEl);
      }
      this.overlayEl = overlayEl;
    }

    // Compute styles
    const direction = this.options.direction;
    const gradientAngle =
      direction === 'horizontal' ? 'to right' : direction === 'vertical' ? 'to bottom' : 'to bottom right';
    const gradientColors = [...this.options.colors, this.options.colors[0]].join(', ');
    const bgImage = `linear-gradient(${gradientAngle}, ${gradientColors})`;
    const bgSize =
      direction === 'horizontal' ? '300% 100%' : direction === 'vertical' ? '100% 300%' : '300% 300%';

    this.textContentEl.style.backgroundImage = bgImage;
    this.textContentEl.style.backgroundSize = bgSize;
    this.textContentEl.style.backgroundRepeat = 'repeat';

    if (this.overlayEl) {
      this.overlayEl.style.backgroundImage = bgImage;
      this.overlayEl.style.backgroundSize = bgSize;
      this.overlayEl.style.backgroundRepeat = 'repeat';
    }

    // Event listeners
    this.handleMouseEnter = () => {
      if (this.options.pauseOnHover) {
        this.isPaused = true;
      }
    };
    this.handleMouseLeave = () => {
      if (this.options.pauseOnHover) {
        this.isPaused = false;
        this.lastTime = null;
        this.start();
      }
    };

    this.container.addEventListener('mouseenter', this.handleMouseEnter);
    this.container.addEventListener('mouseleave', this.handleMouseLeave);

    // Visibility observer
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible && !this.isPaused) {
        this.lastTime = null;
        this.start();
      }
    });
    this.intersectionObserver.observe(this.container);

    this.start();
  }

  animate(time) {
    if (!this.alive || !this.visible || this.isPaused) {
      this.raf = 0;
      return;
    }

    if (this.lastTime === null) {
      this.lastTime = time;
    }

    const deltaTime = time - this.lastTime;
    this.lastTime = time;
    this.elapsed += deltaTime;

    const animationDuration = Math.max(100, this.options.animationSpeed * 1000);
    let p = 0;

    if (this.options.yoyo) {
      const fullCycle = animationDuration * 2;
      const cycleTime = this.elapsed % fullCycle;
      if (cycleTime < animationDuration) {
        p = (cycleTime / animationDuration) * 100;
      } else {
        p = 100 - ((cycleTime - animationDuration) / animationDuration) * 100;
      }
    } else {
      p = (this.elapsed / animationDuration) * 100;
    }

    let bgPos;
    if (this.options.direction === 'horizontal') {
      bgPos = `${p}% 50%`;
    } else if (this.options.direction === 'vertical') {
      bgPos = `50% ${p}%`;
    } else {
      bgPos = `${p}% 50%`;
    }

    if (this.textContentEl) {
      this.textContentEl.style.backgroundPosition = bgPos;
    }
    if (this.overlayEl) {
      this.overlayEl.style.backgroundPosition = bgPos;
    }

    this.raf = requestAnimationFrame((t) => this.animate(t));
  }

  start() {
    if (this.raf || !this.alive) return;
    this.raf = requestAnimationFrame((t) => this.animate(t));
  }

  destroy() {
    this.alive = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.handleMouseEnter) {
      this.container.removeEventListener('mouseenter', this.handleMouseEnter);
      this.container.removeEventListener('mouseleave', this.handleMouseLeave);
    }
  }

  static initAll(root = document) {
    const instances = [];
    const elements = root.querySelectorAll('[data-gradient-text]');
    elements.forEach((el) => {
      try {
        const colorsAttr = el.getAttribute('data-gradient-colors');
        const colors = colorsAttr ? JSON.parse(colorsAttr) : undefined;
        const speed = parseFloat(el.getAttribute('data-gradient-speed')) || undefined;
        const border = el.getAttribute('data-gradient-border') === 'true';
        const direction = el.getAttribute('data-gradient-direction') || undefined;
        const pause = el.getAttribute('data-gradient-pause') === 'true';
        const yoyo = el.getAttribute('data-gradient-yoyo') !== 'false';

        const instance = new GradientText(el, {
          colors,
          animationSpeed: speed,
          showBorder: border,
          direction,
          pauseOnHover: pause,
          yoyo
        });
        instances.push(instance);
      } catch (err) {
        console.warn('GradientText auto-init failed for element:', el, err);
      }
    });
    return instances;
  }
}
