// studio/public/js/api.js
//
// Thin fetch wrappers around the studio backend's HTTP API. All network I/O
// for the app lives here; callers get parsed JSON or a typed ApiError.

/** An API failure carrying the HTTP status and the server's error code/reason. */
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

/** POST /api/edit -> { summary } */
export function postEdit({ path, instruction, history }) {
  return request('/api/edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, instruction, history }),
  });
}

/** POST /api/save -> { path } */
export function postSave({ path, newName }) {
  return request('/api/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, newName }),
  });
}
