import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createApp, describeAgentError, validateEditResponse } from '../server.mjs';
import { claudeAdapter } from '../agent.mjs';
import { makeSampleWorkspace, readNdjsonEvents, removeTempDir, startApp } from './helpers.mjs';

// --- validateEditResponse: pure-function unit tests ------------------------

test('validateEditResponse accepts a well-formed, changed HTML response', () => {
  const original = '<!doctype html><html><body>old</body></html>';
  const gate = validateEditResponse(original, {
    updatedContent: '<!doctype html><html><body>new</body></html>',
    summary: 'changed body text',
  });
  assert.deepEqual(gate, { ok: true });
});

test('validateEditResponse rejects an empty response', () => {
  const gate = validateEditResponse('<!doctype html>...', { updatedContent: '', summary: 'x' });
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'empty_response');
});

test('validateEditResponse rejects non-HTML output', () => {
  const gate = validateEditResponse('<!doctype html>...', {
    updatedContent: 'just some plain text, not html at all',
    summary: 'x',
  });
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'not_html');
});

test('validateEditResponse rejects output over 3x the original byte length', () => {
  const original = '<!doctype html><html><body>x</body></html>';
  const oversized = `<!doctype html><html><body>${'x'.repeat(original.length * 4)}</body></html>`;
  const gate = validateEditResponse(original, { updatedContent: oversized, summary: 'x' });
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'oversized');
});

test('validateEditResponse rejects output identical to the input', () => {
  const original = '<!doctype html><html><body>same</body></html>';
  const gate = validateEditResponse(original, { updatedContent: original, summary: 'no-op' });
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'unchanged');
});

// --- describeAgentError: pure-function unit tests ---------------------------

test('describeAgentError replaces a module-not-found error for the agent SDK with an actionable message', () => {
  const err = new Error(
    "Cannot find package '@anthropic-ai/claude-agent-sdk' imported from /repo/studio/agent.mjs",
  );
  err.code = 'ERR_MODULE_NOT_FOUND';
  const message = describeAgentError(err);
  assert.match(message, /npm --prefix studio install/);
  assert.doesNotMatch(message, /Cannot find package/);
});

test('describeAgentError also recognizes the CJS MODULE_NOT_FOUND code', () => {
  const err = new Error("Cannot find module '@anthropic-ai/claude-agent-sdk'");
  err.code = 'MODULE_NOT_FOUND';
  assert.match(describeAgentError(err), /npm --prefix studio install/);
});

test('describeAgentError leaves an unrelated module-not-found error untouched', () => {
  const err = new Error("Cannot find package 'left-pad' imported from /repo/studio/agent.mjs");
  err.code = 'ERR_MODULE_NOT_FOUND';
  assert.equal(describeAgentError(err), err.message);
});

test('describeAgentError passes through a generic agent error message unchanged', () => {
  assert.equal(describeAgentError(new Error('agent blew up')), 'agent blew up');
  assert.equal(describeAgentError({}), 'agent failed');
});

// --- POST /api/edit: route-level behavior -----------------------------------

function garbageAdapter(updatedContent) {
  return { async runEdit() { return { updatedContent, summary: 'garbage' }; } };
}

test('POST /api/edit happy path: mock adapter writes the file and returns a summary via the NDJSON stream', async () => {
  const { dir, fileName, content: original } = await makeSampleWorkspace();
  try {
    const app = createApp({ dir, agentAdapter: { async runEdit({ currentContent, instruction }) {
      return { updatedContent: currentContent.replace('Sample Mockup', 'Updated Mockup'), summary: `Applied: ${instruction}` };
    } } });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: fileName, instruction: 'rename the heading', history: [] }),
      });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /application\/x-ndjson/);
      const events = await readNdjsonEvents(res);
      assert.equal(events[0].type, 'started');
      assert.equal(events[0].path, fileName);
      const done = events.at(-1);
      assert.equal(done.type, 'done');
      assert.equal(done.summary, 'Applied: rename the heading');

      const written = await fs.readFile(path.join(dir, fileName), 'utf8');
      assert.ok(written.includes('Updated Mockup'));
      assert.notEqual(written, original);
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

test('POST /api/edit streams started \u2192 progress \u2192 done and writes the file only after the terminal event', async () => {
  const { dir, fileName } = await makeSampleWorkspace();
  try {
    const app = createApp({
      dir,
      agentAdapter: {
        async runEdit({ currentContent, instruction, onProgress }) {
          onProgress(10);
          // The file must still be untouched here \u2014 progress events fire
          // before the write, which only happens after this adapter resolves.
          const midway = await fs.readFile(path.join(dir, fileName), 'utf8');
          assert.equal(midway, currentContent);
          onProgress(25);
          return { updatedContent: currentContent.replace('Sample Mockup', 'Streamed Mockup'), summary: `Applied: ${instruction}` };
        },
      },
    });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: fileName, instruction: 'stream it', history: [] }),
      });
      const events = await readNdjsonEvents(res);
      const types = events.map((e) => e.type);
      assert.deepEqual(types, ['started', 'progress', 'progress', 'done']);
      assert.equal(events[1].chars, 10);
      assert.equal(events[2].chars, 25);
      assert.equal(typeof events[1].elapsedMs, 'number');

      const written = await fs.readFile(path.join(dir, fileName), 'utf8');
      assert.ok(written.includes('Streamed Mockup'));
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

for (const [label, garbageContent] of [
  ['empty', ''],
  ['non-html', 'not html at all, just prose'],
  ['oversized', `<!doctype html>${'y'.repeat(5000)}`],
]) {
  test(`POST /api/edit emits a validation_failed error event for a ${label} adapter response and leaves the file byte-identical`, async () => {
    const { dir, fileName, content: original } = await makeSampleWorkspace();
    try {
      const app = createApp({ dir, agentAdapter: garbageAdapter(garbageContent) });
      const { baseUrl, stop } = await startApp(app);
      try {
        const res = await fetch(`${baseUrl}/api/edit`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: fileName, instruction: 'do anything', history: [] }),
        });
        // Streaming fixes the HTTP status at 200; the failure travels as the
        // terminal event instead of an HTTP status code.
        assert.equal(res.status, 200);
        const events = await readNdjsonEvents(res);
        const last = events.at(-1);
        assert.equal(last.type, 'error');
        assert.equal(last.code, 'validation_failed');

        const afterBytes = await fs.readFile(path.join(dir, fileName));
        const originalBytes = Buffer.from(original, 'utf8');
        assert.deepEqual(afterBytes, originalBytes);
      } finally {
        await stop();
      }
    } finally {
      await removeTempDir(dir);
    }
  });
}

test('POST /api/edit emits an agent_error event and leaves the file untouched when the adapter throws', async () => {
  const { dir, fileName, content: original } = await makeSampleWorkspace();
  try {
    const app = createApp({
      dir,
      agentAdapter: { async runEdit() { throw new Error('agent blew up'); } },
    });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: fileName, instruction: 'do anything', history: [] }),
      });
      assert.equal(res.status, 200);
      const events = await readNdjsonEvents(res);
      const last = events.at(-1);
      assert.equal(last.type, 'error');
      assert.equal(last.code, 'agent_error');
      assert.equal(last.message, 'agent blew up');

      const after = await fs.readFile(path.join(dir, fileName), 'utf8');
      assert.equal(after, original);
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

test('POST /api/edit replaces a missing-SDK error with an actionable message and leaves the file untouched', async () => {
  const { dir, fileName, content: original } = await makeSampleWorkspace();
  try {
    const moduleErr = new Error(
      "Cannot find package '@anthropic-ai/claude-agent-sdk' imported from /repo/studio/agent.mjs",
    );
    moduleErr.code = 'ERR_MODULE_NOT_FOUND';
    const app = createApp({ dir, agentAdapter: { async runEdit() { throw moduleErr; } } });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: fileName, instruction: 'do anything', history: [] }),
      });
      assert.equal(res.status, 200);
      const events = await readNdjsonEvents(res);
      const last = events.at(-1);
      assert.equal(last.type, 'error');
      assert.equal(last.code, 'agent_error');
      assert.match(last.message, /npm --prefix studio install/);
      assert.doesNotMatch(last.message, /Cannot find package/);

      const after = await fs.readFile(path.join(dir, fileName), 'utf8');
      assert.equal(after, original);
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

test('POST /api/edit rejects a traversal path with 400', async () => {
  const { dir } = await makeSampleWorkspace();
  try {
    const app = createApp({ dir, agentAdapter: garbageAdapter('<!doctype html>ignored</html>') });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '../.git/config', instruction: 'x', history: [] }),
      });
      assert.equal(res.status, 400);
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

test('POST /api/edit returns 404 for a file that does not exist', async () => {
  const { dir } = await makeSampleWorkspace();
  try {
    const app = createApp({ dir, agentAdapter: garbageAdapter('<!doctype html>ignored</html>') });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: 'missing.html', instruction: 'x', history: [] }),
      });
      assert.equal(res.status, 404);
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

test('POST /api/edit emits an auth_not_configured error event when CLAUDE_CODE_OAUTH_TOKEN is unset, without touching the file', async () => {
  const { dir, fileName, content: original } = await makeSampleWorkspace();
  const savedToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  try {
    const app = createApp({ dir, agentAdapter: claudeAdapter });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: fileName, instruction: 'anything', history: [] }),
      });
      assert.equal(res.status, 200);
      const events = await readNdjsonEvents(res);
      const last = events.at(-1);
      assert.equal(last.type, 'error');
      assert.equal(last.code, 'auth_not_configured');

      const after = await fs.readFile(path.join(dir, fileName), 'utf8');
      assert.equal(after, original);
    } finally {
      await stop();
    }
  } finally {
    if (savedToken !== undefined) process.env.CLAUDE_CODE_OAUTH_TOKEN = savedToken;
    await removeTempDir(dir);
  }
});

// --- Regression: a silently truncated rewrite must not reach the file -----

test('validateEditResponse rejects a response under half the original byte length', () => {
  // The old full-rewrite adapter returned a clean `end_turn` response holding
  // 56KB of a 161KB page (the model abbreviated a large inline base64 asset
  // instead of copying it). Every other gate passed it, so it overwrote the
  // mockup; only a lower bound catches that shape.
  const original = `<!doctype html><html><body>${'x'.repeat(1000)}</body></html>`;
  const truncated = `<!doctype html><html><body>${'x'.repeat(200)}</body></html>`;
  const gate = validateEditResponse(original, { updatedContent: truncated, summary: 'x' });
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'shrunk');
});

test('validateEditResponse still accepts an ordinary edit that trims some content', () => {
  const original = `<!doctype html><html><body>${'x'.repeat(1000)}</body></html>`;
  const trimmed = `<!doctype html><html><body>${'x'.repeat(800)}</body></html>`;
  assert.deepEqual(validateEditResponse(original, { updatedContent: trimmed, summary: 'x' }), { ok: true });
});

test('POST /api/edit rejects a truncated rewrite with validation_failed and leaves the file untouched', async () => {
  const { dir, fileName, content: original } = await makeSampleWorkspace();
  try {
    const app = createApp({
      dir,
      agentAdapter: {
        async runEdit({ currentContent }) {
          // A well-formed HTML response that has quietly dropped most of the page.
          return {
            updatedContent: currentContent.slice(0, Math.floor(currentContent.length * 0.3)),
            summary: 'rewrote the page',
          };
        },
      },
    });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: fileName, instruction: 'title case the heading', history: [] }),
      });
      const events = await readNdjsonEvents(res);
      const last = events.at(-1);
      assert.equal(last.type, 'error');
      assert.equal(last.code, 'validation_failed');
      assert.equal(last.reason, 'shrunk');

      assert.equal(await fs.readFile(path.join(dir, fileName), 'utf8'), original);
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

// --- Regression: a runaway edit must terminate the stream -----------------

test('POST /api/edit aborts an over-budget edit, emits edit_timeout, and leaves the file untouched', async () => {
  const { dir, fileName, content: original } = await makeSampleWorkspace();
  try {
    let signalSeen = null;
    const app = createApp({
      dir,
      editTimeoutMs: 60,
      agentAdapter: {
        // Never resolves on its own — exactly the hang the budget exists for.
        runEdit({ signal }) {
          signalSeen = signal;
          return new Promise(() => {});
        },
      },
    });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: fileName, instruction: 'take forever', history: [] }),
      });
      assert.equal(res.status, 200);
      const events = await readNdjsonEvents(res);
      const last = events.at(-1);
      assert.equal(last.type, 'error');
      assert.equal(last.code, 'edit_timeout');
      assert.equal(last.budgetMs, 60);
      assert.equal(typeof last.elapsedMs, 'number');

      // The adapter is asked to stop, not just abandoned.
      assert.ok(signalSeen);
      assert.equal(signalSeen.aborted, true);

      assert.equal(await fs.readFile(path.join(dir, fileName), 'utf8'), original);
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});

test('POST /api/edit does not time out an edit that finishes inside its budget', async () => {
  const { dir, fileName } = await makeSampleWorkspace();
  try {
    const app = createApp({
      dir,
      editTimeoutMs: 5000,
      agentAdapter: {
        async runEdit({ currentContent }) {
          return { updatedContent: currentContent.replace('</body>', '<p>ok</p></body>'), summary: 'added ok' };
        },
      },
    });
    const { baseUrl, stop } = await startApp(app);
    try {
      const res = await fetch(`${baseUrl}/api/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: fileName, instruction: 'add ok', history: [] }),
      });
      const events = await readNdjsonEvents(res);
      assert.equal(events.at(-1).type, 'done');
      assert.ok((await fs.readFile(path.join(dir, fileName), 'utf8')).includes('<p>ok</p>'));
    } finally {
      await stop();
    }
  } finally {
    await removeTempDir(dir);
  }
});
