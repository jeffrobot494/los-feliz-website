import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createApp, resolveSafePath } from '../server.mjs';
import { mockAdapter } from '../agent.mjs';
import { FIXTURES_DIR, startApp } from './helpers.mjs';

const LISTING_FIXTURE = path.join(FIXTURES_DIR, 'pages-listing');

function makeApp() {
  return createApp({ dir: LISTING_FIXTURE, agentAdapter: mockAdapter });
}

test('resolveSafePath accepts paths inside the target directory', () => {
  const resolved = resolveSafePath(LISTING_FIXTURE, 'sub/c.html');
  assert.equal(resolved, path.join(LISTING_FIXTURE, 'sub', 'c.html'));
});

test('resolveSafePath rejects traversal, absolute paths, and null bytes', () => {
  assert.equal(resolveSafePath(LISTING_FIXTURE, '../.git/config'), null);
  assert.equal(resolveSafePath(LISTING_FIXTURE, 'sub/../../.git/config'), null);
  assert.equal(resolveSafePath(LISTING_FIXTURE, '/etc/passwd'), null);
  assert.equal(resolveSafePath(LISTING_FIXTURE, 'a.html\0.html'), null);
  assert.equal(resolveSafePath(LISTING_FIXTURE, ''), null);
});

test('GET /api/file serves raw bytes for a page with the right content-type', async () => {
  const app = makeApp();
  const { baseUrl, stop } = await startApp(app);
  try {
    const res = await fetch(`${baseUrl}/api/file?path=a.html`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /html/);
    const body = await res.text();
    const expected = await fs.readFile(path.join(LISTING_FIXTURE, 'a.html'), 'utf8');
    assert.equal(body, expected);
  } finally {
    await stop();
  }
});

test('GET /api/file serves a sibling asset (non-.html) referenced by a page', async () => {
  const app = makeApp();
  const { baseUrl, stop } = await startApp(app);
  try {
    const res = await fetch(`${baseUrl}/api/file?path=sub/pixel.png`);
    assert.equal(res.status, 200);
    const bodyBuffer = Buffer.from(await res.arrayBuffer());
    const expected = await fs.readFile(path.join(LISTING_FIXTURE, 'sub', 'pixel.png'));
    assert.deepEqual(bodyBuffer, expected);
  } finally {
    await stop();
  }
});

test('GET /api/file returns 404 for a missing file', async () => {
  const app = makeApp();
  const { baseUrl, stop } = await startApp(app);
  try {
    const res = await fetch(`${baseUrl}/api/file?path=missing.html`);
    assert.equal(res.status, 404);
  } finally {
    await stop();
  }
});

test('GET /api/file rejects ../.git/config traversal with 400', async () => {
  const app = makeApp();
  const { baseUrl, stop } = await startApp(app);
  try {
    const res = await fetch(`${baseUrl}/api/file?path=${encodeURIComponent('../.git/config')}`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'invalid_path');
  } finally {
    await stop();
  }
});

test('GET /api/file rejects URL-encoded traversal variants with 400', async () => {
  const app = makeApp();
  const { baseUrl, stop } = await startApp(app);
  try {
    // %2e%2e%2f.git%2fconfig decodes (by the query-string parser) to ../.git/config
    const fullyEncoded = await fetch(`${baseUrl}/api/file?path=%2e%2e%2f.git%2fconfig`);
    assert.equal(fullyEncoded.status, 400);

    // Mixed encoding — only the dots and one slash are escaped — same traversal after decoding.
    const mixedEncoded = await fetch(`${baseUrl}/api/file?path=%2e%2e/.git/config`);
    assert.equal(mixedEncoded.status, 400);
  } finally {
    await stop();
  }
});

test('GET /api/file with no path returns 400', async () => {
  const app = makeApp();
  const { baseUrl, stop } = await startApp(app);
  try {
    const res = await fetch(`${baseUrl}/api/file`);
    assert.equal(res.status, 400);
  } finally {
    await stop();
  }
});
