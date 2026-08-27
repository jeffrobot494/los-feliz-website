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

const LEFT_UNCHANGED = ' The page was left unchanged.';

/**
 * A chat-facing message for a failed edit request. Accepts two shapes:
 *   - an ApiError-like object with an HTTP status ({ status, code, message,
 *     reason }), for failures that happen before the /api/edit response
 *     starts streaming (bad request body, invalid path, missing file), and
 *   - a code-only object with no status ({ code, message, reason }), for a
 *     terminal {type:'error', ...} event read off the NDJSON stream \u2014
 *     streaming fixes the HTTP status at 200, so these errors carry no
 *     status of their own.
 * Recognized codes are matched first, regardless of which shape carried
 * them, so the same wording (auth_not_configured, agent_error,
 * validation_failed) applies whether the error came from a stream event or
 * a pre-stream JSON response. Every branch keeps the "page was left
 * unchanged" reassurance, since the server never writes the file unless the
 * whole request succeeds.
 */
export function describeEditError(err) {
  if (err) {
    if (err.code === 'auth_not_configured') {
      return (
        'No Claude token found \u2014 create a .env file in the repo root with ' +
        `CLAUDE_CODE_OAUTH_TOKEN (see README) and restart the server.${LEFT_UNCHANGED}`
      );
    }
    if (err.code === 'agent_error') {
      // The server's message is already sanitized (see describeAgentError in
      // server.mjs) and safe to show verbatim.
      return `Agent error: ${err.message || 'the agent failed.'}${LEFT_UNCHANGED}`;
    }
    if (err.code === 'validation_failed') {
      const reason = err.reason ? ` (${err.reason})` : '';
      return `The edit failed${reason}.${LEFT_UNCHANGED} Try rephrasing the instruction.`;
    }
  }

  // fetch() itself throwing (offline, DNS failure, timeout), or the stream
  // ending without a terminal event (connection dropped mid-edit), yields a
  // plain error with no HTTP status and none of the codes above.
  if (!err || typeof err.status !== 'number') {
    return `Could not reach the server (network error or timeout).${LEFT_UNCHANGED} Try again.`;
  }
  if (err.status === 502) {
    const reason = err.reason ? ` (${err.reason})` : '';
    return `The edit failed${reason}.${LEFT_UNCHANGED} Try rephrasing the instruction.`;
  }
  if (err.status === 400) {
    return `The request was rejected by the server (${err.code || 'invalid_request'}).${LEFT_UNCHANGED}`;
  }
  if (err.status === 404) {
    return `That page no longer exists on disk.${LEFT_UNCHANGED}`;
  }
  return `Something went wrong applying that edit.${LEFT_UNCHANGED}`;
}

/**
 * Incrementally buffers NDJSON text arriving in arbitrary chunk boundaries
 * (a single JSON line can be split across two chunks) and yields complete,
 * parsed events one line at a time. No DOM/network dependency -- directly
 * unit-testable by feeding it chunk strings.
 */
export function createNdjsonLineBuffer() {
  let buffer = '';

  function push(chunkText) {
    buffer += chunkText;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    return lines.filter((line) => line.length > 0).map((line) => JSON.parse(line));
  }

  /** Parses any content left after the stream has closed (a final line with no trailing newline). */
  function flush() {
    const remaining = buffer.trim();
    buffer = '';
    return remaining.length > 0 ? [JSON.parse(remaining)] : [];
  }

  return { push, flush };
}

/** Formats a duration as "Ns" under a minute, else "Mm Ss". */
export function formatElapsed(elapsedMs) {
  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * The live "Working\u2026" status line shown while an edit streams progress,
 * built from a 'progress' or 'heartbeat' event ({ elapsedMs, chars? }).
 * chars is only present on 'progress' events -- 'heartbeat' events prove
 * the connection is alive during an otherwise-quiet turn.
 */
export function formatEditProgress({ elapsedMs, chars }) {
  const elapsed = formatElapsed(elapsedMs);
  if (typeof chars === 'number') {
    return `Working\u2026 ${elapsed} \u00b7 ${chars.toLocaleString()} characters written so far`;
  }
  return `Working\u2026 ${elapsed}`;
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
