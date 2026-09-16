// studio/public/js/pagesPane.js
//
// The left pages pane: renders the folder-grouped page list (with loading,
// error, and empty states), tracks the active page, and owns the
// minimize-to-rail toggle whose collapsed state persists in localStorage.

import { baseNameOf } from './format.js';

const COLLAPSE_STORAGE_KEY = 'studio.pagesCollapsed';

function readCollapsedPreference() {
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
}

function writeCollapsedPreference(collapsed) {
  window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0');
}

function buildStatusRow(text, kind) {
  const row = document.createElement('div');
  row.className = `page-status page-status-${kind}`;
  row.textContent = text;
  return row;
}

function buildPageButton(relPath, isActive, onSelect) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'page-item';
  btn.dataset.path = relPath;
  btn.textContent = baseNameOf(relPath);
  btn.setAttribute('aria-current', isActive ? 'true' : 'false');
  btn.addEventListener('click', () => onSelect(relPath));
  return btn;
}

function buildGroup(folder, pages, activePath, onSelect) {
  const group = document.createElement('div');
  group.className = 'page-group';
  if (folder) {
    const heading = document.createElement('div');
    heading.className = 'page-group-label';
    heading.textContent = folder;
    group.appendChild(heading);
  }
  for (const relPath of pages) {
    group.appendChild(buildPageButton(relPath, relPath === activePath, onSelect));
  }
  return group;
}

/**
 * @param {{ appRoot: HTMLElement, list: HTMLElement, minimizeBtn: HTMLElement, expandBtn: HTMLElement }} elements
 * @param {{ onSelect: (relPath: string) => void }} callbacks
 */
export function createPagesPane({ appRoot, list, minimizeBtn, expandBtn }, { onSelect }) {
  let activePath = null;

  function setCollapsed(collapsed) {
    appRoot.classList.toggle('pages-collapsed', collapsed);
    writeCollapsedPreference(collapsed);
  }

  minimizeBtn.addEventListener('click', () => setCollapsed(true));
  expandBtn.addEventListener('click', () => setCollapsed(false));
  setCollapsed(readCollapsedPreference());

  function renderLoading() {
    list.replaceChildren(buildStatusRow('Loading pages\u2026', 'loading'));
  }

  function renderError(message, onRetry) {
    const row = buildStatusRow(message, 'error');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn';
    retry.textContent = 'Retry';
    retry.addEventListener('click', onRetry);
    row.appendChild(retry);
    list.replaceChildren(row);
  }

  function renderEmpty(dir) {
    list.replaceChildren(buildStatusRow(`No .html pages found in ${dir}.`, 'empty'));
  }

  function renderPages(groupedPages) {
    const groups = Object.keys(groupedPages)
      .sort()
      .map((folder) => buildGroup(folder, groupedPages[folder], activePath, onSelect));
    list.replaceChildren(...groups);
  }

  function setActive(relPath) {
    activePath = relPath;
    for (const btn of list.querySelectorAll('.page-item')) {
      btn.setAttribute('aria-current', btn.dataset.path === relPath ? 'true' : 'false');
    }
  }

  return { renderLoading, renderError, renderEmpty, renderPages, setActive };
}
