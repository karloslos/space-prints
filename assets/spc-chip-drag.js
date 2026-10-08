/*
 * Space Prints – size chips on product tiles.
 * - Click-and-drag scrolling for mouse/pen (touch already scrolls natively).
 * - Toggles .has-more-start / .has-more-end so CSS can fade the edge where sizes are hidden.
 * Uses event delegation, so it also works on grids re-rendered by filters.
 */
(function () {
  if (window.__spcChipDrag) return;
  window.__spcChipDrag = true;

  var SELECTOR = '.spc-product-card__chips';
  var THRESHOLD = 5;
  var drag = null;
  var justDragged = false;

  function updateFade(row) {
    var max = row.scrollWidth - row.clientWidth;
    row.classList.toggle('has-more-start', row.scrollLeft > 2);
    row.classList.toggle('has-more-end', max > 2 && row.scrollLeft < max - 2);
  }

  var pending = false;
  function updateAll() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      document.querySelectorAll(SELECTOR).forEach(updateFade);
    });
  }

  // scroll events don't bubble, so listen in the capture phase
  document.addEventListener(
    'scroll',
    function (e) {
      if (e.target.matches && e.target.matches(SELECTOR)) updateFade(e.target);
    },
    true
  );
  window.addEventListener('resize', updateAll);
  window.addEventListener('load', updateAll);
  document.addEventListener('DOMContentLoaded', updateAll);
  // grids re-rendered by filters / pagination
  new MutationObserver(updateAll).observe(document.documentElement, { childList: true, subtree: true });
  updateAll();

  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    var row = e.target.closest && e.target.closest(SELECTOR);
    if (!row || row.scrollWidth <= row.clientWidth) return;
    drag = { row: row, startX: e.clientX, startScroll: row.scrollLeft, id: e.pointerId, active: false };
  });

  document.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.startX;
    if (!drag.active) {
      if (Math.abs(dx) < THRESHOLD) return;
      drag.active = true;
      drag.row.classList.add('is-dragging');
      try { drag.row.setPointerCapture(e.pointerId); } catch (err) {}
    }
    drag.row.scrollLeft = drag.startScroll - dx;
    e.preventDefault();
  });

  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.active) {
      justDragged = true; // swallow the click that follows a drag so it doesn't open a size
      setTimeout(function () { justDragged = false; }, 0);
      drag.row.classList.remove('is-dragging');
    }
    drag = null;
  }
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);

  document.addEventListener(
    'click',
    function (e) {
      if (justDragged && e.target.closest && e.target.closest(SELECTOR)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  // stop the browser's native link-drag ghost image from hijacking the gesture
  document.addEventListener('dragstart', function (e) {
    if (e.target.closest && e.target.closest(SELECTOR)) e.preventDefault();
  });
})();
