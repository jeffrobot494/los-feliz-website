import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createApp, describeAgentError, validateEditResponse } from '../server.mjs';
import { claudeAdapter } from '../agent.mjs';
import { makeSampleWorkspace, removeTempDir, startApp } from './helpers.mjs';

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

test('POST /api/edit happy path: mock adapter writes the file and returns a summary', async () => {
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
      const body = await res.json();
      assert.equal(body.summary, 'Applied: rename the heading');

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

for (const [label, garbageContent] of [
  ['empty', ''],
  ['non-html', 'not html at all, just prose'],
  ['oversized', `<!doctype html>${'y'.repeat(5000)}`],
]) {
  test(`POST /api/edit rejects a ${label} adapter response with 502 and leaves the file byte-identical`, async () => {
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
        assert.equal(res.status, 502);
        const body = await res.json();
        assert.equal(body.error, 'validation_failed');

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

test('POST /api/edit returns 502 and leaves the file untouched when the adapter throws', async () => {
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
      assert.equal(res.status, 502);
      const body = await res.json();
      assert.equal(body.error, 'agent_error');

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
      assert.equal(res.status, 502);
      const body = await res.json();
      assert.equal(body.error, 'agent_error');
      assert.match(body.message, /npm --prefix studio install/);
      assert.doesNotMatch(body.message, /Cannot find package/);

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

test('POST /api/edit returns auth_not_configured when CLAUDE_CODE_OAUTH_TOKEN is unset, without touching the file', async () => {
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
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error, 'auth_not_configured');

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
