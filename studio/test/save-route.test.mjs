import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createApp } from '../server.mjs';
import { mockAdapter } from '../agent.mjs';
import { makeSampleWorkspace, removeTempDir, startApp } from './helpers.mjs';

test('POST /api/save copies the current file to a new name in the same directory', async () => {
  const { dir, fileName, content: original } = await makeSampleWorkspace();
  try {
    const app = createApp({ dir, agentAdapter: mockAdapter });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: fileName, newName: 'sample-page-v2.html' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.path, 'sample-page-v2.html');

      const copied = await fs.readFile(path.join(dir, 'sample-page-v2.html'), 'utf8');
      const source = await fs.readFile(path.join(dir, fileName), 'utf8');
      assert.equal(copied, source);
      assert.equal(copied, original);
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

test('POST /api/save returns 409 when the target name already exists and creates nothing new', async () => {
  const { dir, fileName, content: original } = await makeSampleWorkspace();
  try {
    await fs.writeFile(path.join(dir, 'sample-page-v2.html'), '<!doctype html><html><body>existing</body></html>', 'utf8');

    const app = createApp({ dir, agentAdapter: mockAdapter });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: fileName, newName: 'sample-page-v2.html' }),
      });
      assert.equal(res.status, 409);
      const body = await res.json();
      assert.equal(body.error, 'name_exists');

      const existing = await fs.readFile(path.join(dir, 'sample-page-v2.html'), 'utf8');
      assert.equal(existing, '<!doctype html><html><body>existing</body></html>');

      const source = await fs.readFile(path.join(dir, fileName), 'utf8');
      assert.equal(source, original);
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

test('POST /api/save rejects bad target names with 400', async () => {
  const { dir, fileName } = await makeSampleWorkspace();
  try {
    const app = createApp({ dir, agentAdapter: mockAdapter });
    const { baseUrl, stop } = await startApp(app);
    try {
      for (const newName of ['../escape.html', 'nested/escape.html', '.hidden.html', 'no-extension', '']) {
        const res = await fetch(`${baseUrl}/api/save`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: fileName, newName }),
        });
        assert.equal(res.status, 400, `expected 400 for newName=${newName}`);
      }
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

test('POST /api/save rejects a traversal source path with 400', async () => {
  const { dir } = await makeSampleWorkspace();
  try {
    const app = createApp({ dir, agentAdapter: mockAdapter });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '../.git/config', newName: 'copy.html' }),
      });
      assert.equal(res.status, 400);
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

test('POST /api/save returns 404 when the source file does not exist', async () => {
  const { dir } = await makeSampleWorkspace();
  try {
    const app = createApp({ dir, agentAdapter: mockAdapter });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: 'missing.html', newName: 'copy.html' }),
      });
      assert.equal(res.status, 404);
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});
