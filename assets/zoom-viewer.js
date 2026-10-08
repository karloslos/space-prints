/*
 * Space Prints – full detail zoom viewer
 *
 * Fullscreen pan/zoom viewer for a single very large image (the "Zoom image"
 * product metafield). Extends Dawn's ModalDialog, so focus trapping, Escape,
 * body scroll lock and the modal-opener wiring come from the theme.
 *
 * - Shows a small preview straight away, then swaps in the full-resolution file.
 * - Zoom is capped at 1 image pixel = 1 device pixel, so it never goes blurry.
 * - Mouse wheel / trackpad pinch, drag, touch pinch, double-tap, keyboard, buttons.
 */
if (!customElements.get('zoom-viewer')) {
  customElements.define(
    'zoom-viewer',
    class ZoomViewer extends ModalDialog {
      constructor() {
        super();

        this.stage = this.querySelector('.zoom-viewer__stage');
        this.canvas = this.querySelector('.zoom-viewer__canvas');
        this.preview = this.querySelector('.zoom-viewer__preview');
        this.full = this.querySelector('.zoom-viewer__full');
        this.readout = this.querySelector('.zoom-viewer__readout');
        this.status = this.querySelector('.zoom-viewer__status');
        this.hint = this.querySelector('.zoom-viewer__hint');
        this.btnIn = this.querySelector('[data-zoom-action="in"]');
        this.btnOut = this.querySelector('[data-zoom-action="out"]');

        this.iw = parseInt(this.dataset.width, 10) || 0;
        this.ih = parseInt(this.dataset.height, 10) || 0;
        this.view = { s: 1, x: 0, y: 0 };
        this.fit = 1;
        this.max = 1;
        this.sw = 0;
        this.sh = 0;
        this.dpr = 1;
        this.atFit = true;
        this.pointers = new Map();
        this.lastTap = null;
        this.raf = null;
        this.loadState = 'idle';
        this.hintShown = false;
        this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

        if (!this.stage || !this.canvas || !this.iw || !this.ih) return;

        this.canvas.style.width = `${this.iw}px`;
        this.canvas.style.height = `${this.ih}px`;

        this.bindEvents();
        this.resizeObserver = new ResizeObserver(() => {
          if (this.hasAttribute('open')) this.onResize();
        });
      }

      /* ---------- open / close ---------- */

      show(opener) {
        super.show(opener);
        if (!this.stage || !this.iw) return;

        this.resizeObserver.observe(this.stage);
        this.measure();
        this.resetView(false);
        this.loadImages();
        this.showHint();
      }

      hide() {
        this.stopMotion();
        this.pointers.clear();
        if (this.stage) this.stage.classList.remove('is-dragging');
        if (this.resizeObserver) this.resizeObserver.disconnect();
        super.hide();
      }

      loadImages() {
        if (this.loadState === 'loading' || this.loadState === 'loaded') return;
        this.loadState = 'loading';

        if (!this.preview.getAttribute('src')) this.preview.src = this.dataset.previewSrc;
        this.setStatus('Loading full resolution…');

        const done = () => {
          this.loadState = 'loaded';
          this.canvas.classList.add('is-loaded');
          this.setStatus('');
        };

        this.full.onload = () => {
          // decode() keeps the swap smooth; ignore failures and show regardless
          const decoded = this.full.decode ? this.full.decode().catch(() => {}) : Promise.resolve();
          decoded.then(done);
        };
        this.full.onerror = () => {
          this.loadState = 'idle';
          this.setStatus('Couldn’t load the full-resolution image. Close and reopen to try again.', true);
        };
        this.full.src = this.dataset.fullSrc;
      }

      setStatus(message, isError = false) {
        if (!this.status) return;
        this.status.textContent = message;
        this.status.hidden = !message;
        this.status.classList.toggle('is-error', isError);
      }

      showHint() {
        if (!this.hint || this.hintShown) return;
        this.hintShown = true;
        this.hint.classList.add('is-visible');
        setTimeout(() => this.hint.classList.remove('is-visible'), 4500);
      }

      /* ---------- geometry ---------- */

      measure() {
        const rect = this.stage.getBoundingClientRect();
        this.sw = rect.width;
        this.sh = rect.height;
        this.dpr = window.devicePixelRatio || 1;
        this.fit = Math.min(this.sw / this.iw, this.sh / this.ih);
        // never zoom past 1 image pixel per device pixel (but always allow at least the fit view)
        this.max = Math.max(1 / this.dpr, this.fit);
      }

      onResize() {
        const wasFit = this.atFit;
        const center = this.pointToImage(this.sw / 2, this.sh / 2);
        this.measure();
        if (wasFit) {
          this.resetView(false);
        } else {
          const s = this.clampScale(this.view.s);
          this.setView({ s, x: this.sw / 2 - center.x * s, y: this.sh / 2 - center.y * s });
        }
      }

      pointToImage(px, py) {
        return { x: (px - this.view.x) / this.view.s, y: (py - this.view.y) / this.view.s };
      }

      clampScale(s) {
        return Math.min(this.max, Math.max(this.fit, s));
      }

      clampPosition(view) {
        const w = this.iw * view.s;
        const h = this.ih * view.s;
        view.x = w <= this.sw ? (this.sw - w) / 2 : Math.min(0, Math.max(this.sw - w, view.x));
        view.y = h <= this.sh ? (this.sh - h) / 2 : Math.min(0, Math.max(this.sh - h, view.y));
        return view;
      }

      setView(view) {
        this.view = this.clampPosition({ s: view.s, x: view.x, y: view.y });
        this.atFit = this.view.s <= this.fit * 1.001;
        this.render();
      }

      render() {
        const { s, x, y } = this.view;
        this.canvas.style.transform = `translate(${x}px, ${y}px) scale(${s})`;

        const pct = Math.round(s * this.dpr * 100);
        if (this.readout) {
          this.readout.textContent = this.atFit ? 'Fit' : `${pct}%`;
        }
        if (this.btnIn) this.btnIn.disabled = s >= this.max * 0.999;
        if (this.btnOut) this.btnOut.disabled = this.atFit;
      }

      /* ---------- view changes ---------- */

      resetView(animate = true) {
        const s = this.fit;
        const target = {
          s,
          x: (this.sw - this.iw * s) / 2,
          y: (this.sh - this.ih * s) / 2,
        };
        animate ? this.animateTo(target) : this.setView(target);
      }

      // Zoom to scale `s`, keeping the image point under (cx, cy) where it is.
      viewZoomedAt(s, cx, cy, from = this.view) {
        const next = this.clampScale(s);
        const ix = (cx - from.x) / from.s;
        const iy = (cy - from.y) / from.s;
        return { s: next, x: cx - ix * next, y: cy - iy * next };
      }

      zoomBy(factor, cx = this.sw / 2, cy = this.sh / 2, animate = true) {
        const target = this.viewZoomedAt(this.view.s * factor, cx, cy);
        animate ? this.animateTo(target) : this.setView(target);
      }

      zoomToActualPixels() {
        this.animateTo(this.viewZoomedAt(this.max, this.sw / 2, this.sh / 2));
      }

      stopMotion() {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = null;
      }

      animateTo(target, duration = 240) {
        this.stopMotion();
        if (this.reduceMotion.matches) return this.setView(target);

        const from = { ...this.view };
        const clamped = this.clampPosition({ ...target });
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / duration);
          const e = 1 - Math.pow(1 - t, 3);
          // interpolate scale geometrically so zoom feels even
          const s = from.s * Math.pow(clamped.s / from.s, e);
          this.setView({
            s,
            x: from.x + (clamped.x - from.x) * e,
            y: from.y + (clamped.y - from.y) * e,
          });
          this.raf = t < 1 ? requestAnimationFrame(step) : null;
        };
        this.raf = requestAnimationFrame(step);
      }

      coast(vx, vy) {
        this.stopMotion();
        if (this.reduceMotion.matches) return;
        let last = performance.now();
        const step = (now) => {
          const dt = Math.min(48, now - last);
          last = now;
          const decay = Math.exp(-dt / 320);
          vx *= decay;
          vy *= decay;
          this.setView({ s: this.view.s, x: this.view.x + vx * dt, y: this.view.y + vy * dt });
          this.raf = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(step) : null;
        };
        this.raf = requestAnimationFrame(step);
      }

      /* ---------- input ---------- */

      bindEvents() {
        const stage = this.stage;

        stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        stage.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        stage.addEventListener('pointermove', (e) => this.onPointerMove(e));
        stage.addEventListener('pointerup', (e) => this.onPointerUp(e));
        stage.addEventListener('pointercancel', (e) => this.onPointerUp(e, true));
        stage.addEventListener('dragstart', (e) => e.preventDefault());

        this.addEventListener('keydown', (e) => this.onKeyDown(e));

        this.querySelectorAll('[data-zoom-action]').forEach((button) => {
          button.addEventListener('click', () => {
            const action = button.dataset.zoomAction;
            if (action === 'in') this.zoomBy(1.6);
            if (action === 'out') this.zoomBy(1 / 1.6);
            if (action === 'fit') this.resetView(true);
            if (action === 'actual') this.zoomToActualPixels();
          });
        });
      }

      stagePoint(e) {
        const rect = this.stage.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }

      onWheel(e) {
        e.preventDefault();
        this.stopMotion();
        const p = this.stagePoint(e);
        const unit = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.0016;
        const k = e.ctrlKey ? 0.01 : unit; // ctrlKey = trackpad pinch
        this.zoomBy(Math.exp(-e.deltaY * k), p.x, p.y, false);
      }

      onPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        this.stopMotion();
        this.stage.setPointerCapture(e.pointerId);
        const p = this.stagePoint(e);
        this.pointers.set(e.pointerId, { x: p.x, y: p.y });

        if (this.pointers.size === 1) {
          this.tap = { t: performance.now(), x: p.x, y: p.y, moved: false, multi: false };
          this.velocity = { x: 0, y: 0, t: performance.now() };
          this.stage.classList.add('is-dragging');
        } else {
          if (this.tap) this.tap.multi = true;
          this.startPinch();
        }
      }

      startPinch() {
        const [a, b] = [...this.pointers.values()];
        this.pinch = {
          dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          view: { ...this.view },
          anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        };
      }

      onPointerMove(e) {
        const prev = this.pointers.get(e.pointerId);
        if (!prev) return;
        const p = this.stagePoint(e);
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        this.pointers.set(e.pointerId, { x: p.x, y: p.y });

        if (this.pointers.size >= 2 && this.pinch) {
          const [a, b] = [...this.pointers.values()];
          const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
          const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const s = this.clampScale(this.pinch.view.s * (dist / this.pinch.dist));
          const ix = (this.pinch.anchor.x - this.pinch.view.x) / this.pinch.view.s;
          const iy = (this.pinch.anchor.y - this.pinch.view.y) / this.pinch.view.s;
          this.setView({ s, x: center.x - ix * s, y: center.y - iy * s });
          return;
        }

        if (this.tap && Math.hypot(p.x - this.tap.x, p.y - this.tap.y) > 8) this.tap.moved = true;

        const now = performance.now();
        const dt = Math.max(1, now - this.velocity.t);
        this.velocity = {
          x: 0.8 * (dx / dt) + 0.2 * this.velocity.x,
          y: 0.8 * (dy / dt) + 0.2 * this.velocity.y,
          t: now,
        };
        this.setView({ s: this.view.s, x: this.view.x + dx, y: this.view.y + dy });
      }

      onPointerUp(e, cancelled = false) {
        if (!this.pointers.has(e.pointerId)) return;
        const wasPinching = this.pointers.size >= 2;
        this.pointers.delete(e.pointerId);

        if (this.pointers.size === 1) {
          // lifted one finger of a pinch: carry on panning with the other
          this.pinch = null;
          this.velocity = { x: 0, y: 0, t: performance.now() };
          return;
        }
        if (this.pointers.size > 0) {
          this.startPinch();
          return;
        }

        this.pinch = null;
        this.stage.classList.remove('is-dragging');
        if (cancelled || wasPinching) return;

        const tap = this.tap;
        const now = performance.now();
        if (tap && !tap.moved && !tap.multi && now - tap.t < 350) {
          this.handleTap(tap.x, tap.y, now);
        } else if (now - this.velocity.t < 80 && Math.hypot(this.velocity.x, this.velocity.y) > 0.15) {
          this.coast(this.velocity.x, this.velocity.y);
        }
      }

      handleTap(x, y, now) {
        const last = this.lastTap;
        if (last && now - last.t < 350 && Math.hypot(x - last.x, y - last.y) < 30) {
          this.lastTap = null;
          if (this.atFit) {
            const target = Math.min(this.max, Math.max(this.fit * 3, 0.5 / this.dpr));
            this.animateTo(this.viewZoomedAt(target, x, y));
          } else {
            this.resetView(true);
          }
        } else {
          this.lastTap = { t: now, x, y };
        }
      }

      onKeyDown(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const pan = 90;
        switch (e.key) {
          case '+':
          case '=':
            this.zoomBy(1.6);
            break;
          case '-':
          case '_':
            this.zoomBy(1 / 1.6);
            break;
          case '0':
            this.resetView(true);
            break;
          case '1':
            this.zoomToActualPixels();
            break;
          case 'ArrowLeft':
            this.panBy(pan, 0);
            break;
          case 'ArrowRight':
            this.panBy(-pan, 0);
            break;
          case 'ArrowUp':
            this.panBy(0, pan);
            break;
          case 'ArrowDown':
            this.panBy(0, -pan);
            break;
          default:
            return;
        }
        e.preventDefault();
      }

      panBy(dx, dy) {
        this.animateTo({ s: this.view.s, x: this.view.x + dx, y: this.view.y + dy }, 140);
      }
    }
  );
}
