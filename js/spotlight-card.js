/**
 * SpotlightCard Component (Vanilla JS port of React Bits SpotlightCard)
 * Renders an interactive radial spotlight glow that dynamically follows the cursor.
 */

export class SpotlightCard {
  constructor(element, options = {}) {
    if (!element) return;
    this.element = element;
    this.spotlightColor = options.spotlightColor || 'rgba(56, 189, 248, 0.18)';
    this.spotlightSize = options.spotlightSize || 140;

    this.onMouseMove = this.handleMouseMove.bind(this);
    this.onMouseLeave = this.handleMouseLeave.bind(this);

    this.init();
  }

  init() {
    this.element.classList.add('spotlight-card');
    this.element.style.setProperty('--spotlight-color', this.spotlightColor);
    this.element.style.setProperty('--spotlight-size', `${this.spotlightSize}px`);

    this.element.addEventListener('mousemove', this.onMouseMove, { passive: true });
    this.element.addEventListener('mouseleave', this.onMouseLeave, { passive: true });
  }

  handleMouseMove(e) {
    const rect = this.element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.element.style.setProperty('--mouse-x', `${x}px`);
    this.element.style.setProperty('--mouse-y', `${y}px`);
    this.element.style.setProperty('--spotlight-opacity', '1');
  }

  handleMouseLeave() {
    this.element.style.setProperty('--spotlight-opacity', '0');
  }

  destroy() {
    this.element.removeEventListener('mousemove', this.onMouseMove);
    this.element.removeEventListener('mouseleave', this.onMouseLeave);
  }

  static initAll(root = document, selector = '[data-spotlight]') {
    const instances = [];
    const elements = root.querySelectorAll(selector);
    elements.forEach((el) => {
      const color = el.getAttribute('data-spotlight-color') || undefined;
      const size = parseInt(el.getAttribute('data-spotlight-size'), 10) || undefined;
      instances.push(new SpotlightCard(el, { spotlightColor: color, spotlightSize: size }));
    });
    return instances;
  }
}
