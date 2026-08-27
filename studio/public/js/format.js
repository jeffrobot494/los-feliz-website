// studio/public/js/format.js
//
// Pure helpers with no DOM/network dependency — kept separate so they are
// importable and unit-testable from studio/test/ without a browser.

/** Reads ?page= from a location.search-shaped string; '' and absent both mean "none". */
export function pageFromSearch(search) {
  const page = new URLSearchParams(search).get('page');
  return page && page.length > 0 ? page : null;
}

/** Returns a new search string with ?page= set (or removed when page is falsy). */
export function searchWithPage(search, page) {
  const params = new URLSearchParams(search);
  if (page) {
    params.set('page', page);
  } else {
    params.delete('page');
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** The folder key a relative page path belongs to, matching the server's grouping ('' = root). */
export function folderKey(relPath) {
  const idx = relPath.lastIndexOf('/');
  return idx === -1 ? '' : relPath.slice(0, idx);
}

/** The file name portion of a repo-relative path. */
export function baseNameOf(relPath) {
  const idx = relPath.lastIndexOf('/');
  return idx === -1 ? relPath : relPath.slice(idx + 1);
}

/** Strips a trailing "-vN" variant suffix from a file name, leaving the stem (no extension). */
export function variantStem(fileName) {
  const stem = fileName.replace(/\.html$/i, '');
  const match = stem.match(/^(.*)-v(\d+)$/);
  return match ? match[1] : stem;
}

/** The next "<stem>-vN.html" name not present among siblingFileNames, starting at v2. */
export function nextVariantName(fileName, siblingFileNames) {
  const stem = variantStem(fileName);
  const taken = new Set(siblingFileNames);
  let n = 2;
  while (taken.has(`${stem}-v${n}.html`)) n += 1;
  return `${stem}-v${n}.html`;
}

/** The first page path in a { folder: string[] } grouping, folders and entries sorted. */
export function firstPage(groupedPages) {
  for (const folder of Object.keys(groupedPages).sort()) {
    const entries = groupedPages[folder];
    if (entries && entries.length > 0) return entries[0];
  }
  return null;
}

/** All page paths in a grouping, flattened. */
export function flattenGrouped(groupedPages) {
  return Object.values(groupedPages).flat();
}

/** A chat-facing message for a failed edit request, based on the API error shape. */
export function describeEditError(err) {
  if (err && err.status === 401 && err.code === 'auth_not_configured') {
    return 'Claude isn\u2019t connected yet. Run `claude setup-token`, export CLAUDE_CODE_OAUTH_TOKEN, and restart the server, then try again.';
  }
  if (err && err.status === 502) {
    const reason = err.reason ? ` (${err.reason})` : '';
    return `The edit failed and the page was left unchanged${reason}. Try rephrasing the instruction.`;
  }
  return 'Something went wrong applying that edit. The page was left unchanged.';
}

/** An inline message for a failed save-as-new request, based on the API error shape. */
export function describeSaveError(err) {
  if (err && err.status === 409) {
    return 'A page with that name already exists \u2014 choose another.';
  }
  if (err && err.status === 400) {
    return 'That name isn\u2019t valid. Use letters, numbers, "-", "_", "." and end with .html.';
  }
  return 'Could not save the page. Try again.';
}
