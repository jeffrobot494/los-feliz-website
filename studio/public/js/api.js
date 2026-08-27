// studio/public/js/api.js
//
// Thin fetch wrappers around the studio backend's HTTP API. All network I/O
// for the app lives here; callers get parsed JSON or a typed ApiError.

import { createNdjsonLineBuffer } from './format.js';

/**
 * An API failure carrying the server's error code/reason. `status` is the
 * HTTP status for a normal JSON error response (bad request, invalid path,
 * missing file); it is left undefined for an error that arrived as a
 * terminal NDJSON stream event, since streaming fixes the HTTP status at
 * 200 -- describeEditError (format.js) dispatches on `code` first for
 * exactly this reason, so both shapes render the same message.
 */
export class ApiError extends Error {
  constructor(status, code, message, reason) {
    super(message || code || `request failed with status ${status}`);
    this.status = status;
    this.code = code;
    this.reason = reason;
  }
}

async function parseJsonBody(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function request(path, options) {
  const res = await fetch(path, options);
  const body = await parseJsonBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error, body?.message, body?.reason);
  }
  return body;
}

/** GET /api/pages -> { dir, pages: { [folder: string]: string[] } } */
export function fetchPages() {
  return request('/api/pages');
}

/** The /api/file URL for a page, optionally cache-busted with a fresh token. */
export function fileUrl(relPath, { cacheBust } = {}) {
  const params = new URLSearchParams({ path: relPath });
  if (cacheBust) params.set('_', String(cacheBust));
  return `/api/file?${params.toString()}`;
}

/**
 * POST /api/edit -> { summary }.
 *
 * The response is an NDJSON event stream (one JSON object per line):
 * {type:'started'}, {type:'heartbeat'|'progress', elapsedMs, chars?}
 * along the way, then a terminal {type:'done', summary} or
 * {type:'error', code, message?, reason?}. `onEvent`, if given, is called
 * for every parsed event (including non-terminal ones) so a caller can
 * render live status; the promise itself resolves with { summary } on
 * 'done' and rejects with an ApiError-shaped error on 'error' or on a
 * truncated stream (connection dropped before any terminal event).
 */
export async function postEdit({ path, instruction, history, onEvent } = {}) {
  const res = await fetch('/api/edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, instruction, history }),
  });

  if (!res.ok) {
    // A pre-stream failure (bad request body, invalid path, missing file):
    // the response is a normal JSON error, exactly as before streaming.
    const body = await parseJsonBody(res);
    throw new ApiError(res.status, body?.error, body?.message, body?.reason);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const lineBuffer = createNdjsonLineBuffer();
  let doneResult = null;
  let terminalError = null;

  const handleEvents = (events) => {
    for (const event of events) {
      onEvent?.(event);
      if (event.type === 'done') doneResult = { summary: event.summary };
      if (event.type === 'error') terminalError = new ApiError(undefined, event.code, event.message, event.reason);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) handleEvents(lineBuffer.push(decoder.decode(value, { stream: true })));
    if (done) break;
  }
  handleEvents(lineBuffer.flush());

  if (terminalError) throw terminalError;
  if (doneResult) return doneResult;
  // The stream closed without ever sending a terminal event -- the
  // connection dropped mid-edit. Same shape/message as a network failure.
  throw new ApiError();
}

/** POST /api/save -> { path } */
export function postSave({ path, newName }) {
  return request('/api/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, newName }),
  });
}
