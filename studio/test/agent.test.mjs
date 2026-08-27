import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AuthNotConfiguredError,
  EDIT_QUERY_OPTIONS,
  createClaudeAdapter,
  extractTextDelta,
  mockAdapter,
  stripTrailingCodeFence,
} from '../agent.mjs';

// --- Regression: tools must be fully removed, not just permission-filtered -

test('EDIT_QUERY_OPTIONS strips tools entirely (not just allowedTools)', () => {
  // allowedTools: [] only filters permissions — the SDK still exposes
  // Bash/Edit/etc., which is what sent the model exploring and hitting
  // error_max_turns in production. `tools: []` removes tool exposure outright.
  assert.deepEqual(EDIT_QUERY_OPTIONS.tools, []);
  assert.deepEqual(EDIT_QUERY_OPTIONS.allowedTools, []);
  assert.equal(EDIT_QUERY_OPTIONS.maxTurns, 4);
  assert.equal(EDIT_QUERY_OPTIONS.includePartialMessages, true);
});

test('claudeAdapter calls query() with EDIT_QUERY_OPTIONS via an injected SDK loader', async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
  try {
    let capturedOptions;
    const fakeSdk = {
      async loadSdk() {
        return {
          async query({ prompt, options }) {
            capturedOptions = options;
            assert.match(prompt, /Do NOT use any tools/);
            return [
              { message: { content: [{ type: 'text', text: '<!doctype html><html>ok</html>' }] } },
            ];
          },
        };
      },
    };

    const adapter = createClaudeAdapter({ loadSdk: fakeSdk.loadSdk });
    const { updatedContent, summary } = await adapter.runEdit({
      currentContent: '<!doctype html><html>old</html>',
      instruction: 'say ok',
      history: [],
    });

    assert.deepEqual(capturedOptions, EDIT_QUERY_OPTIONS);
    assert.deepEqual(capturedOptions.tools, []);
    assert.equal(updatedContent, '<!doctype html><html>ok</html>');
    assert.equal(typeof summary, 'string');
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

test('claudeAdapter reports a running character count via onProgress as stream_event deltas arrive', async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
  try {
    const adapter = createClaudeAdapter({
      loadSdk: async () => ({
        async *query() {
          yield { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: '<!doc' } } };
          yield { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'type>' } } };
          // A non-text stream_event (e.g. a tool-related delta) must not move the counter.
          yield { type: 'stream_event', event: { type: 'content_block_start' } };
          yield { message: { content: [{ type: 'text', text: '<!doctype html><html>done</html>' }] } };
        },
      }),
    });

    const seen = [];
    const { updatedContent } = await adapter.runEdit({
      currentContent: '<!doctype html><html>old</html>',
      instruction: 'say ok',
      history: [],
      onProgress: (chars) => seen.push(chars),
    });

    assert.deepEqual(seen, [5, 10]);
    assert.equal(updatedContent, '<!doctype html><html>done</html>');
  } finally {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }
});

// --- Regression: trailing markdown code fence must not corrupt the file ----

test('stripTrailingCodeFence removes a trailing ``` fence and its leading newline', () => {
  const withFence = '<!doctype html><html><body>hi</body></html>\n```';
  assert.equal(stripTrailingCodeFence(withFence), '<!doctype html><html><body>hi</body></html>');
});

test('stripTrailingCodeFence tolerates trailing whitespace after the fence', () => {
  const withFence = '<!doctype html><html><body>hi</body></html>\n```  \n';
  assert.equal(stripTrailingCodeFence(withFence), '<!doctype html><html><body>hi</body></html>');
});

test('stripTrailingCodeFence is a no-op when there is no trailing fence', () => {
  const clean = '<!doctype html><html><body>hi</body></html>';
  assert.equal(stripTrailingCodeFence(clean), clean);
});

test('claudeAdapter extraction strips a trailing fence from a fenced SDK response end-to-end', async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
  try {
    const fencedResponse =
      '```html\n<!doctype html><html><body>fenced</body></html>\n```';
    const adapter = createClaudeAdapter({
      loadSdk: async () => ({
        async query() {
          return [{ message: { content: [{ type: 'text', text: fencedResponse }] } }];
        },
      }),
    });

    const { updatedContent } = await adapter.runEdit({
      currentContent: '<!doctype html><html><body>old</body></html>',
      instruction: 'rewrite',
      history: [],
    });

    assert.equal(updatedContent, '<!doctype html><html><body>fenced</body></html>');
    assert.ok(!updatedContent.includes('```'));
  } finally {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }
});
