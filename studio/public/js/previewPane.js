// studio/public/js/previewPane.js
//
// The center preview pane: points the iframe at /api/file, exposes a manual
// and cache-busted reload, and owns the maximize/restore toggle (Esc or the
// floating restore button). Maximize is review-only by construction \u2014 the
// pages and chat panes are hidden via CSS while `.is-maximized` is set, so
// there is nothing left to interact with besides the preview itself.

import { fileUrl } from './api.js';

/**
 * @param {{ appRoot: HTMLElement, frame: HTMLIFrameElement, empty: HTMLElement,
 *           reloadBtn: HTMLElement, maximizeBtn: HTMLElement, restoreBtn: HTMLElement }} elements
 */
export function createPreviewPane({ appRoot, frame, empty, reloadBtn, maximizeBtn, restoreBtn }) {
  let currentPath = null;
  let maximized = false;

  function show(relPath) {
    currentPath = relPath;
    empty.textContent = '';
    frame.hidden = false;
    frame.src = fileUrl(relPath);
  }

  function showEmpty(message) {
    currentPath = null;
    frame.hidden = true;
    frame.src = 'about:blank';
    empty.textContent = message;
  }

  function reload({ cacheBust = false } = {}) {
    if (!currentPath) return;
    frame.src = fileUrl(currentPath, cacheBust ? { cacheBust: Date.now() } : undefined);
  }

  function setMaximized(next) {
    maximized = next;
    appRoot.classList.toggle('is-maximized', maximized);
    restoreBtn.hidden = !maximized;
    // The header (and its maximize button) hides while maximized, so move
    // focus to whichever control is now visible — keeps keyboard use sane.
    if (maximized) {
      restoreBtn.focus();
    } else {
      maximizeBtn.focus();
    }
  }

  reloadBtn.addEventListener('click', () => reload({ cacheBust: true }));
  maximizeBtn.addEventListener('click', () => setMaximized(true));
  restoreBtn.addEventListener('click', () => setMaximized(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && maximized) setMaximized(false);
  });

  return { show, showEmpty, reload };
}
