/**
 * SVG Follow Scroll Animation
 * Animates a dynamic decorative SVG path stroke following the page scroll progress
 * Inspired by Skiper19 / svg-follow-scroll
 */
const SvgScrollAnimation = {
  path: null,
  pathLength: 0,
  ticking: false,

  init() {
    this.path = document.getElementById('scroll-follow-path');
    if (!this.path) return;

    this.setupPath();
    this.bindEvents();
    this.update();
  },

  setupPath() {
    if (!this.path) return;
    try {
      this.pathLength = this.path.getTotalLength();
      this.path.style.strokeDasharray = `${this.pathLength} ${this.pathLength}`;
      this.path.style.strokeDashoffset = this.pathLength;
    } catch (e) {
      console.warn('SVG path measurement error:', e);
    }
  },

  bindEvents() {
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
    window.addEventListener('resize', () => {
      this.setupPath();
      this.onScroll();
    }, { passive: true });
  },

  onScroll() {
    if (!this.ticking) {
      requestAnimationFrame(() => {
        this.update();
        this.ticking = false;
      });
      this.ticking = true;
    }
  },

  update() {
    if (!this.path || !this.pathLength) return;
    const docElem = document.documentElement;
    const totalHeight = docElem.scrollHeight - window.innerHeight;
    const scrollY = window.pageYOffset || docElem.scrollTop || 0;

    const progress = totalHeight > 0 ? Math.min(Math.max(scrollY / totalHeight, 0), 1) : 0;

    // Smoothly reveal stroke as user scrolls down the page
    const visibleRatio = 0.15 + (progress * 0.85);
    const offset = this.pathLength * (1 - visibleRatio);
    this.path.style.strokeDashoffset = offset;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  SvgScrollAnimation.init();
});
