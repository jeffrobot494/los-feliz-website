import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

import {
  AuthNotConfiguredError,
  EDIT_QUERY_OPTIONS,
  EDIT_TOOLS,
  EFFORT_LEVELS,
  buildEditPrompt,
  buildEditQueryOptions,
  createClaudeAdapter,
  createEditGuard,
  editEffort,
  editModel,
  extractAssistantText,
  extractTextDelta,
  mockAdapter,
  stageScratchCopy,
} from '../agent.mjs';

// --- The edit is made in place, not re-emitted --------------------------

test('EDIT_QUERY_OPTIONS grants Read/Edit only, and nothing that can reach the shell', () => {
  // The previous design passed `tools: []` and asked the model to re-emit the
  // whole file as text, which made cost and latency scale with page size and
  // let the model silently drop content it was supposed to be copying.
  assert.deepEqual(EDIT_QUERY_OPTIONS.tools, ['Read', 'Edit']);
  assert.ok(!EDIT_QUERY_OPTIONS.tools.includes('Bash'));
  assert.ok(!EDIT_QUERY_OPTIONS.tools.includes('Write'));
  // allowedTools must stay unset: a bare tool name there auto-approves the
  // tool before canUseTool is consulted, silently disabling the path guard.
  assert.equal(EDIT_QUERY_OPTIONS.allowedTools, undefined);
  // 'default' keeps every tool call routed through canUseTool; 'acceptEdits'
  // would auto-approve edits and skip the guard.
  assert.equal(EDIT_QUERY_OPTIONS.permissionMode, 'default');
  assert.equal(EDIT_QUERY_OPTIONS.includePartialMessages, true);
});

test('buildEditPrompt names the scratch path and forbids whole-file rewrites', () => {
  const prompt = buildEditPrompt({
    instruction: 'make the heading title case',
    history: [{ role: 'user', text: 'earlier' }],
    editPath: '/tmp/studio-edit-x/page.html',
  });
  assert.match(prompt, /\/tmp\/studio-edit-x\/page\.html/);
  assert.match(prompt, /do NOT rewrite the whole file/i);
  assert.match(prompt, /data: URIs/);
  assert.match(prompt, /make the heading title case/);
  assert.match(prompt, /user: earlier/);
  // The file's contents must not be pasted into the prompt any more.
  assert.ok(!prompt.includes('Current file:'));
});

test('buildEditQueryOptions confines cwd to the scratch directory and installs the guard', () => {
  const editPath = path.join(path.sep, 'tmp', 'studio-edit-y', 'page.html');
  const options = buildEditQueryOptions({ editPath });
  assert.equal(options.cwd, path.dirname(editPath));
  assert.equal(typeof options.canUseTool, 'function');
  assert.deepEqual(options.tools, EDIT_TOOLS);
  assert.equal(options.allowedTools, undefined);
});

test('buildEditQueryOptions forwards an abortController when one is given', () => {
  const abortController = new AbortController();
  const withAbort = buildEditQueryOptions({ editPath: '/tmp/e/page.html', abortController });
  assert.equal(withAbort.abortController, abortController);
  assert.ok(!('abortController' in buildEditQueryOptions({ editPath: '/tmp/e/page.html' })));
});

// --- The permission guard is the other half of the trust boundary --------

test('createEditGuard allows Read/Edit of the staged file only', async () => {
  const editPath = path.join(path.sep, 'tmp', 'studio-edit-z', 'page.html');
  const guard = createEditGuard(editPath);

  assert.deepEqual(await guard('Read', { file_path: editPath }), { behavior: 'allow' });
  assert.deepEqual(await guard('Edit', { file_path: editPath }), { behavior: 'allow' });
});

test('createEditGuard denies any other tool, even one the SDK might expose', async () => {
  const editPath = path.join(path.sep, 'tmp', 'studio-edit-z', 'page.html');
  const guard = createEditGuard(editPath);

  for (const toolName of ['Bash', 'Write', 'Glob', 'Grep', 'WebFetch']) {
    const result = await guard(toolName, { file_path: editPath });
    assert.equal(result.behavior, 'deny', `${toolName} must be denied`);
  }
});

test('createEditGuard denies Read/Edit of any path other than the staged file', async () => {
  const dir = path.join(path.sep, 'tmp', 'studio-edit-z');
  const editPath = path.join(dir, 'page.html');
  const guard = createEditGuard(editPath);

  const outside = [
    path.join(dir, 'other.html'),
    path.join(path.sep, 'etc', 'passwd'),
    path.join(dir, '..', '..', 'etc', 'passwd'),
    path.join(dir, 'sub', '..', 'page.html.bak'),
  ];
  for (const file_path of outside) {
    const result = await guard('Edit', { file_path });
    assert.equal(result.behavior, 'deny', `${file_path} must be denied`);
  }
  // A traversal that normalizes back to the staged file is still the staged file.
  const roundabout = path.join(dir, 'sub', '..', 'page.html');
  assert.deepEqual(await guard('Edit', { file_path: roundabout }), { behavior: 'allow' });
});

test('createEditGuard denies a tool call that names no file at all', async () => {
  const guard = createEditGuard('/tmp/studio-edit-z/page.html');
  assert.equal((await guard('Edit', {})).behavior, 'deny');
  assert.equal((await guard('Edit', { file_path: 42 })).behavior, 'deny');
});

// --- Scratch staging keeps the real mockup untouched ---------------------

test('stageScratchCopy writes the page outside the mockups dir and cleans up after itself', async () => {
  const content = '<!doctype html><html><body>hi</body></html>';
  const { editPath, cleanup } = await stageScratchCopy('/repo/quiet-full.html', content);
  try {
    assert.equal(await fs.readFile(editPath, 'utf8'), content);
    assert.equal(path.basename(editPath), 'quiet-full.html');
    // Never inside the directory the studio serves.
    assert.ok(!editPath.startsWith('/repo/'));
  } finally {
    await cleanup();
  }
  await assert.rejects(() => fs.readFile(editPath, 'utf8'), { code: 'ENOENT' });
});

// --- Adapter behaviour ---------------------------------------------------

test('claudeAdapter reads the edited bytes back off disk, not out of the model text', async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
  try {
    let capturedOptions;
    let capturedPrompt;
    const edited = '<!doctype html><html><body>EDITED</body></html>';

    const adapter = createClaudeAdapter({
      loadSdk: async () => ({
        async *query({ prompt, options }) {
          capturedPrompt = prompt;
          capturedOptions = options;
          // Simulate the Edit tool writing to the staged file.
          await fs.writeFile(path.join(options.cwd, 'page.html'), edited, 'utf8');
          yield {
            type: 'assistant',
            message: { content: [{ type: 'text', text: 'Changed the body copy.' }] },
          };
        },
      }),
    });

    const { updatedContent, summary } = await adapter.runEdit({
      filePath: '/repo/page.html',
      currentContent: '<!doctype html><html><body>old</body></html>',
      instruction: 'say EDITED',
      history: [],
    });

    assert.equal(updatedContent, edited);
    assert.equal(summary, 'Changed the body copy.');
    assert.deepEqual(capturedOptions.tools, EDIT_TOOLS);
    assert.equal(typeof capturedOptions.canUseTool, 'function');
    assert.match(capturedPrompt, /do NOT rewrite the whole file/i);
  } finally {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }
});

test('claudeAdapter returns the unedited copy when the agent changes nothing (the gate rejects it)', async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
  try {
    const original = '<!doctype html><html><body>old</body></html>';
    const adapter = createClaudeAdapter({
      loadSdk: async () => ({
        async *query() {
          yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Nothing to do.' }] } };
        },
      }),
    });

    const { updatedContent } = await adapter.runEdit({
      filePath: '/repo/page.html',
      currentContent: original,
      instruction: 'do nothing',
      history: [],
    });
    // Identical content — server.mjs's validateEditResponse reports 'unchanged'.
    assert.equal(updatedContent, original);
  } finally {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }
});

test('claudeAdapter forwards an abort signal to the SDK and still cleans up the scratch dir', async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
  try {
    const controller = new AbortController();
    let sdkSignalAborted = false;
    let seenEditPath;

    const adapter = createClaudeAdapter({
      loadSdk: async () => ({
        async *query({ options }) {
          seenEditPath = path.join(options.cwd, 'page.html');
          controller.abort();
          // The adapter bridges the caller's signal onto its own controller,
          // which is what the real SDK watches.
          sdkSignalAborted = options.abortController.signal.aborted;
          yield { type: 'assistant', message: { content: [{ type: 'text', text: 'stopped' }] } };
        },
      }),
    });

    await adapter.runEdit({
      filePath: '/repo/page.html',
      currentContent: '<!doctype html><html><body>hi</body></html>',
      instruction: 'x',
      history: [],
      signal: controller.signal,
    });

    assert.equal(sdkSignalAborted, true);
    await assert.rejects(() => fs.readFile(seenEditPath, 'utf8'), { code: 'ENOENT' });
  } finally {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }
});

test('claudeAdapter aborts immediately when handed an already-aborted signal', async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
  try {
    let sdkSignalAborted = null;
    const adapter = createClaudeAdapter({
      loadSdk: async () => ({
        async *query({ options }) {
          sdkSignalAborted = options.abortController.signal.aborted;
          yield { type: 'assistant', message: { content: [{ type: 'text', text: 'x' }] } };
        },
      }),
    });

    await adapter.runEdit({
      filePath: '/repo/page.html',
      currentContent: '<!doctype html><html><body>hi</body></html>',
      instruction: 'x',
      history: [],
      signal: AbortSignal.abort(),
    });
    assert.equal(sdkSignalAborted, true);
  } finally {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }
});

test('claudeAdapter cleans up the scratch directory even when the SDK throws', async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
  try {
    let seenCwd;
    const adapter = createClaudeAdapter({
      loadSdk: async () => ({
        // eslint-disable-next-line require-yield
        async *query({ options }) {
          seenCwd = options.cwd;
          throw new Error('sdk exploded');
        },
      }),
    });

    await assert.rejects(
      () => adapter.runEdit({
        filePath: '/repo/page.html',
        currentContent: '<!doctype html><html><body>hi</body></html>',
        instruction: 'x',
        history: [],
      }),
      /sdk exploded/,
    );
    await assert.rejects(() => fs.stat(seenCwd), { code: 'ENOENT' });
  } finally {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }
});

test('claudeAdapter never invokes the SDK loader when the token is missing', async () => {
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  let loaderCalled = false;
  const adapter = createClaudeAdapter({ loadSdk: async () => { loaderCalled = true; return {}; } });

  await assert.rejects(
    () => adapter.runEdit({ currentContent: '<!doctype html></html>', instruction: 'x', history: [] }),
    AuthNotConfiguredError,
  );
  assert.equal(loaderCalled, false);
});

// --- Live progress streaming --------------------------------------------

test('extractTextDelta reads a content_block_delta text_delta and ignores everything else', () => {
  const streamEvent = {
    type: 'stream_event',
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hello' } },
  };
  assert.equal(extractTextDelta(streamEvent), 'hello');

  assert.equal(extractTextDelta({ type: 'assistant', message: {} }), null);
  assert.equal(extractTextDelta({ type: 'stream_event', event: { type: 'message_start' } }), null);
  assert.equal(
    extractTextDelta({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'input_json_delta' } } }),
    null,
  );
  assert.equal(extractTextDelta(null), null);
});

test('extractAssistantText joins text blocks and ignores tool_use blocks and other messages', () => {
  assert.equal(
    extractAssistantText({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'a' }, { type: 'tool_use', name: 'Edit' }, { type: 'text', text: 'b' }] },
    }),
    'ab',
  );
  assert.equal(extractAssistantText({ type: 'result', result: 'nope' }), '');
  assert.equal(extractAssistantText({ type: 'stream_event', event: {} }), '');
  assert.equal(extractAssistantText(null), '');
});

test('claudeAdapter reports a running character count via onProgress as stream_event deltas arrive', async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
  try {
    const adapter = createClaudeAdapter({
      loadSdk: async () => ({
        async *query() {
          yield { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Chang' } } };
          yield { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ed it' } } };
          // A non-text stream_event (e.g. a tool-related delta) must not move the counter.
          yield { type: 'stream_event', event: { type: 'content_block_start' } };
          yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Changed it' }] } };
        },
      }),
    });

    const seen = [];
    const { summary } = await adapter.runEdit({
      filePath: '/repo/page.html',
      currentContent: '<!doctype html><html>old</html>',
      instruction: 'say ok',
      history: [],
      onProgress: (chars) => seen.push(chars),
    });

    assert.deepEqual(seen, [5, 10]);
    assert.equal(summary, 'Changed it');
  } finally {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }
});

test('claudeAdapter falls back to a generic summary when the agent says nothing', async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
  try {
    const adapter = createClaudeAdapter({
      loadSdk: async () => ({
        async *query() {
          yield { type: 'result', subtype: 'success' };
        },
      }),
    });
    const { summary } = await adapter.runEdit({
      filePath: '/repo/page.html',
      currentContent: '<!doctype html><html>old</html>',
      instruction: 'x',
      history: [],
    });
    assert.equal(summary, 'Updated the page per your instruction.');
  } finally {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }
});

// --- mockAdapter ---------------------------------------------------------

test('mockAdapter emits synthetic onProgress events so tests and offline dev exercise the streaming path', async () => {
  const seen = [];
  const { updatedContent } = await mockAdapter.runEdit({
    currentContent: '<!doctype html><html><body>hi</body></html>',
    instruction: 'say hi',
    onProgress: (chars) => seen.push(chars),
  });

  assert.equal(seen.length, 2);
  assert.ok(seen[0] > 0);
  assert.equal(seen[1], updatedContent.length);
});

test('mockAdapter.runEdit works fine when onProgress is omitted', async () => {
  const { summary } = await mockAdapter.runEdit({
    currentContent: '<!doctype html><html><body>hi</body></html>',
    instruction: 'say hi',
  });
  assert.equal(typeof summary, 'string');
});

// --- Model and effort are tuned down for a latency-sensitive, low-reasoning task ---

test('buildEditQueryOptions defaults to Sonnet 5 at low effort', () => {
  const options = buildEditQueryOptions({ editPath: '/tmp/e/page.html', env: {} });
  assert.equal(options.model, 'claude-sonnet-5');
  assert.equal(options.effort, 'low');
});

test('STUDIO_MODEL and STUDIO_EFFORT override the defaults', () => {
  const options = buildEditQueryOptions({
    editPath: '/tmp/e/page.html',
    env: { STUDIO_MODEL: 'claude-opus-5', STUDIO_EFFORT: 'high' },
  });
  assert.equal(options.model, 'claude-opus-5');
  assert.equal(options.effort, 'high');
});

test('editEffort accepts every level the API defines', () => {
  for (const level of EFFORT_LEVELS) {
    assert.equal(editEffort({ STUDIO_EFFORT: level }), level);
  }
});

test('editEffort falls back to the default on a typo instead of sending a 400', () => {
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (msg) => warnings.push(msg);
  try {
    assert.equal(editEffort({ STUDIO_EFFORT: 'lowest' }), 'low');
  } finally {
    console.warn = realWarn;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /STUDIO_EFFORT="lowest"/);
});

test('editModel falls back to the default when STUDIO_MODEL is unset or empty', () => {
  assert.equal(editModel({}), 'claude-sonnet-5');
  assert.equal(editModel({ STUDIO_MODEL: '' }), 'claude-sonnet-5');
  assert.equal(editModel({ STUDIO_MODEL: 'claude-haiku-4-5' }), 'claude-haiku-4-5');
});

test('EDIT_QUERY_OPTIONS disables filesystem settings so studio edits stay hermetic', () => {
  // Omitting settingSources loads ~/.claude/settings.json, project
  // .claude/settings.json, and CLAUDE.md on every edit — the user's own hooks,
  // permission rules, and MCP servers would leak into a studio edit session.
  assert.deepEqual(EDIT_QUERY_OPTIONS.settingSources, []);
});
