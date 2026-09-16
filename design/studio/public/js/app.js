// studio/public/js/app.js
//
// Entry point: fetches the page list, wires the three panes together, and
// owns the two pieces of cross-pane state \u2014 the current page and the URL's
// ?page= param (kept in sync via history.replaceState, never a reload).

import { fetchPages } from './api.js';
import { firstPage, flattenGrouped, pageFromSearch, searchWithPage } from './format.js';
import { createPagesPane } from './pagesPane.js';
import { createPreviewPane } from './previewPane.js';
import { createChatPane } from './chatPane.js';

const appRoot = document.getElementById('app');
let groupedPages = {};

const pagesPane = createPagesPane(
  {
    appRoot,
    list: document.getElementById('pagesList'),
    minimizeBtn: document.getElementById('minimizePagesBtn'),
    expandBtn: document.getElementById('expandPagesBtn'),
  },
  { onSelect: (relPath) => selectPage(relPath) },
);

const previewPane = createPreviewPane({
  appRoot,
  frame: document.getElementById('previewFrame'),
  empty: document.getElementById('previewEmpty'),
  reloadBtn: document.getElementById('reloadBtn'),
  maximizeBtn: document.getElementById('maximizeBtn'),
  restoreBtn: document.getElementById('restoreBtn'),
});

const chatPane = createChatPane(
  {
    history: document.getElementById('chatHistory'),
    form: document.getElementById('chatForm'),
    input: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    saveAsBtn: document.getElementById('saveAsBtn'),
    workingIndicator: document.getElementById('workingIndicator'),
    savePanel: document.getElementById('savePanel'),
    saveNameInput: document.getElementById('saveNameInput'),
    saveConfirmBtn: document.getElementById('saveConfirmBtn'),
    saveCancelBtn: document.getElementById('saveCancelBtn'),
    saveError: document.getElementById('saveError'),
  },
  {
    getGroupedPages: () => groupedPages,
    onEditSuccess: () => previewPane.reload({ cacheBust: true }),
    onSaved: (newPath) => refreshThenSelect(newPath),
  },
);

/** Selects a page across all three panes and reflects it in the URL, without reloading the app. */
function selectPage(relPath) {
  pagesPane.setActive(relPath);
  previewPane.show(relPath);
  chatPane.setPage(relPath);
  const url = `${location.pathname}${searchWithPage(location.search, relPath)}${location.hash}`;
  history.replaceState(null, '', url);
}

/** Re-fetches the page list (after a save) and switches to the newly created page. */
async function refreshThenSelect(newPath) {
  try {
    const { pages } = await fetchPages();
    groupedPages = pages;
    pagesPane.renderPages(pages);
  } finally {
    selectPage(newPath);
  }
}

async function init() {
  pagesPane.renderLoading();
  try {
    const { dir, pages } = await fetchPages();
    groupedPages = pages;
    const flat = flattenGrouped(pages);

    if (flat.length === 0) {
      pagesPane.renderEmpty(dir);
      previewPane.showEmpty(`No .html pages found in ${dir}.`);
      chatPane.setPage(null);
      return;
    }

    pagesPane.renderPages(pages);
    const requested = pageFromSearch(location.search);
    selectPage(requested && flat.includes(requested) ? requested : firstPage(pages));
  } catch {
    pagesPane.renderError('Could not load the page list.', init);
  }
}

init();
