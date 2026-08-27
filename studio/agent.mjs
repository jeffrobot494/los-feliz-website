// studio/agent.mjs
//
// AgentAdapter interface:
//   runEdit({ filePath, currentContent, instruction, history }) =>
//     Promise<{ updatedContent: string, summary: string }>
//
// Two implementations live here:
//   - claudeAdapter: drives the Claude Agent SDK using the user's Claude Code
//     subscription (CLAUDE_CODE_OAUTH_TOKEN). Never reads ANTHROPIC_API_KEY.
//   - mockAdapter: deterministic, offline, used by tests and STUDIO_AGENT=mock.

/** Thrown when the real adapter is invoked without CLAUDE_CODE_OAUTH_TOKEN set. */
export class AuthNotConfiguredError extends Error {
  constructor() {
    super('CLAUDE_CODE_OAUTH_TOKEN is not set — run `claude setup-token` and export it.');
    this.name = 'AuthNotConfiguredError';
    this.code = 'auth_not_configured';
  }
}

/**
 * Mock adapter for tests and local dev without network access.
 * Deterministically appends an HTML comment recording the instruction,
 * so the output is always valid, non-trivial-length, changed HTML.
 */
export const mockAdapter = {
  async runEdit({ currentContent, instruction }) {
    const marker = `<!-- studio-edit: ${instruction} -->`;
    const updatedContent = currentContent.includes('</body>')
      ? currentContent.replace('</body>', `${marker}\n</body>`)
      : `${currentContent}\n${marker}`;
    return { updatedContent, summary: `Applied: ${instruction}` };
  },
};

/**
 * Builds the query() options for a claudeAdapter edit call. Pulled out as a
 * pure function so the tool-stripping regression (`tools: []`) is directly
 * assertable without spinning up the real SDK.
 */
export function buildEditPrompt({ currentContent, instruction, history }) {
  const transcript = (Array.isArray(history) ? history : [])
    .slice(-10)
    .map((m) => `${m.role}: ${m.text}`)
    .join('\n');

  return (
    `You are editing a standalone HTML mockup. Return the COMPLETE updated file.\n` +
    `Rules: keep it a single self-contained HTML file; preserve the :root design-token ` +
    `block unless asked to change styling; change only what the instruction requires. ` +
    `Do NOT use any tools. Respond with the complete updated file as plain text.\n` +
    `Recent conversation:\n${transcript}\n\n` +
    `Current file:\n${currentContent}\n\nInstruction: ${instruction}`
  );
}

export const EDIT_QUERY_OPTIONS = {
  maxTurns: 4, // belt-and-braces — a correct one-shot rewrite still takes 1 turn
  tools: [], // removes tool exposure entirely (allowedTools only filters permissions)
  allowedTools: [], // defense in depth alongside `tools: []`
};

/**
 * Real adapter factory: one-shot full-file rewrite via the Claude Agent SDK,
 * authenticated only through the subscription OAuth token.
 *
 * `loadSdk` is injectable so tests can assert on the exact query() call
 * (e.g. that `tools: []` is passed) without installing/invoking the real
 * network-calling SDK. Defaults to the real dynamic import, which is lazy
 * so the app and tests run fine even in environments that skip installing
 * the (now real, non-optional) dependency.
 */
export function createClaudeAdapter({ loadSdk = () => import('@anthropic-ai/claude-agent-sdk') } = {}) {
  return {
    async runEdit({ currentContent, instruction, history }) {
      if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
        // Never attempt the call without the subscription token.
        throw new AuthNotConfiguredError();
      }

      const { query } = await loadSdk();
      const prompt = buildEditPrompt({ currentContent, instruction, history });
      const result = await query({ prompt, options: EDIT_QUERY_OPTIONS });

      return extractResult(result);
    },
  };
}

/**
 * Real adapter: one-shot full-file rewrite via the Claude Agent SDK,
 * authenticated only through the subscription OAuth token.
 */
export const claudeAdapter = createClaudeAdapter();

/**
 * Normalizes the Claude Agent SDK's response into { updatedContent, summary }.
 * The SDK streams messages; we take the final assistant text as the full
 * rewritten file and a short trailing note (if any) as the summary.
 */
async function extractResult(result) {
  let text = '';
  const messages = [];

  if (result && typeof result[Symbol.asyncIterator] === 'function') {
    for await (const message of result) {
      messages.push(message);
    }
  } else if (Array.isArray(result)) {
    messages.push(...result);
  } else if (result) {
    messages.push(result);
  }

  for (const message of messages) {
    const content = message?.message?.content ?? message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'text' && typeof block.text === 'string') {
          text += block.text;
        }
      }
    } else if (typeof content === 'string') {
      text += content;
    }
  }

  const docIndex = text.toLowerCase().indexOf('<!doctype');
  const htmlIndex = text.toLowerCase().indexOf('<html');
  const start = docIndex !== -1 ? docIndex : htmlIndex;
  const sliced = start !== -1 ? text.slice(start) : text.trim();
  const updatedContent = stripTrailingCodeFence(sliced);

  return {
    updatedContent,
    summary: 'Updated the page per your instruction.',
  };
}

/**
 * The model sometimes wraps its answer in a markdown code fence even when
 * asked not to. We already slice from <!doctype/<html to drop an opening
 * fence line, but a trailing ``` (with optional trailing whitespace) is
 * still part of the extracted tail and would corrupt the written HTML file.
 */
export function stripTrailingCodeFence(text) {
  return text.replace(/\n?```\s*$/, '');
}

/** Selects the adapter implementation via STUDIO_AGENT env var (default: claude). */
export function selectAgentAdapter(env = process.env) {
  const mode = env.STUDIO_AGENT || 'claude';
  if (mode === 'mock') return mockAdapter;
  if (mode === 'claude') return claudeAdapter;
  throw new Error(`Unknown STUDIO_AGENT value: "${mode}" (expected "mock" or "claude")`);
}
