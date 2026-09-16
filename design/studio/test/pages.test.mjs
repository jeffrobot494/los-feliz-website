import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createApp, listPages } from '../server.mjs';
import { mockAdapter } from '../agent.mjs';
import { FIXTURES_DIR, startApp } from './helpers.mjs';

const LISTING_FIXTURE = path.join(FIXTURES_DIR, 'pages-listing');
// The live repo root: studio/test/.. /.. — read-only in this test, never written to.
const REPO_ROOT = path.resolve(FIXTURES_DIR, '..', '..', '..');

test('listPages groups .html files by folder and excludes non-html files', async () => {
  const grouped = await listPages(LISTING_FIXTURE);

  assert.deepEqual(grouped, {
    '': ['a.html', 'b.html'],
    sub: ['sub/c.html'],
    'sub/nested': ['sub/nested/d.html'],
  });
});

test('listPages throws when the target directory does not exist', async () => {
  await assert.rejects(() => listPages(path.join(LISTING_FIXTURE, 'does-not-exist')));
});

test('GET /api/pages returns the fixture listing grouped by folder', async () => {
  const app = createApp({ dir: LISTING_FIXTURE, agentAdapter: mockAdapter });
  const { baseUrl, stop } = await startApp(app);
  try {
    const res = await fetch(`${baseUrl}/api/pages`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.pages, {
      '': ['a.html', 'b.html'],
      sub: ['sub/c.html'],
      'sub/nested': ['sub/nested/d.html'],
    });
  } finally {
    await stop();
  }
});

test('GET /api/pages against the live repo lists every known mockup, grouped correctly', async () => {
  // Independently walk the real repo (read-only) so this assertion tracks
  // reality instead of a hard-coded count that would go stale as mockups
  // are added or removed.
  const expected = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'studio') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        expected.push(path.relative(REPO_ROOT, full).split(path.sep).join('/'));
      }
    }
  }
  await walk(REPO_ROOT);
  expected.sort();

  const grouped = await listPages(REPO_ROOT);
  const actual = Object.values(grouped).flat().sort();

  assert.deepEqual(actual, expected);
  assert.ok(actual.includes('homepage-mockup.html'));
  assert.ok(actual.includes('kittens-jumping/kittens-leap-04-purple.html'));
  assert.ok(actual.includes('quiet-variations/quiet-left-nav.html'));
  assert.equal(grouped['kittens-jumping'].length, 4);
  assert.equal(grouped['quiet-variations'].length, 8);
});
