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
 * Real adapter: one-shot full-file rewrite via the Claude Agent SDK,
 * authenticated only through the subscription OAuth token.
 */
export const claudeAdapter = {
  async runEdit({ currentContent, instruction, history }) {
    if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
      // Never attempt the call without the subscription token.
      throw new AuthNotConfiguredError();
    }

    // Lazy/dynamic import: the SDK is an optional peer dependency, not listed
    // in package.json, so the app and tests run fine without it installed.
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    const transcript = (Array.isArray(history) ? history : [])
      .slice(-10)
      .map((m) => `${m.role}: ${m.text}`)
      .join('\n');

    const prompt =
      `You are editing a standalone HTML mockup. Return the COMPLETE updated file.\n` +
      `Rules: keep it a single self-contained HTML file; preserve the :root design-token ` +
      `block unless asked to change styling; change only what the instruction requires.\n` +
      `Recent conversation:\n${transcript}\n\n` +
      `Current file:\n${currentContent}\n\nInstruction: ${instruction}`;

    const result = await query({
      prompt,
      options: {
        maxTurns: 1,
        allowedTools: [], // no tool use — pure content transformation
      },
    });

    return extractResult(result);
  },
};

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
  const updatedContent = start !== -1 ? text.slice(start) : text.trim();

  return {
    updatedContent,
    summary: 'Updated the page per your instruction.',
  };
}

/** Selects the adapter implementation via STUDIO_AGENT env var (default: claude). */
export function selectAgentAdapter(env = process.env) {
  const mode = env.STUDIO_AGENT || 'claude';
  if (mode === 'mock') return mockAdapter;
  if (mode === 'claude') return claudeAdapter;
  throw new Error(`Unknown STUDIO_AGENT value: "${mode}" (expected "mock" or "claude")`);
}
