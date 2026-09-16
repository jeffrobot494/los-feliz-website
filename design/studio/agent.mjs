// studio/agent.mjs
//
// AgentAdapter interface:
//   runEdit({ filePath, currentContent, instruction, history, onProgress, signal }) =>
//     Promise<{ updatedContent: string, summary: string }>
//
//   onProgress is an optional (charsSoFar: number) => void callback invoked
//   as assistant text arrives, so a caller (the /api/edit route) can stream
//   live progress to the client without ever seeing the HTML itself.
//
//   signal is an optional AbortSignal. When it fires, the underlying agent
//   run is aborted — /api/edit uses it to enforce a wall-clock budget.
//
// Two implementations live here:
//   - claudeAdapter: drives the Claude Agent SDK using the user's Claude Code
//     subscription (CLAUDE_CODE_OAUTH_TOKEN). Never reads ANTHROPIC_API_KEY.
//   - mockAdapter: deterministic, offline, used by tests and STUDIO_AGENT=mock.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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
  async runEdit({ currentContent, instruction, onProgress }) {
    const marker = `<!-- studio-edit: ${instruction} -->`;
    const updatedContent = currentContent.includes('</body>')
      ? currentContent.replace('</body>', `${marker}\n</body>`)
      : `${currentContent}\n${marker}`;
    if (typeof onProgress === 'function') {
      // Synthetic progress so tests and offline dev exercise the streaming
      // path without a real (network-calling) agent.
      onProgress(Math.round(updatedContent.length / 2));
      onProgress(updatedContent.length);
    }
    return { updatedContent, summary: `Applied: ${instruction}` };
  },
};

/** The only tools a studio edit ever gets. No Bash, no Write, no Glob/Grep. */
export const EDIT_TOOLS = ['Read', 'Edit'];

/**
 * Builds the query() prompt for a claudeAdapter edit call.
 *
 * The agent edits the file in place with the Edit tool instead of being
 * handed the file's text and asked to re-emit all of it. That earlier
 * full-rewrite design made cost and latency scale with page size rather than
 * edit size (one edit to the 161KB front-runner mockup took 17 minutes and
 * 43K output tokens), and it forced the model to reproduce large inline
 * assets verbatim — that page is 87% a single base64 <img> — which is how a
 * clean `end_turn` response came back holding only 35% of the original file.
 */
export function buildEditPrompt({ instruction, history, editPath }) {
  const transcript = (Array.isArray(history) ? history : [])
    .slice(-10)
    .map((m) => `${m.role}: ${m.text}`)
    .join('\n');

  return (
    `You are editing a standalone HTML mockup at ${editPath}.\n` +
    `Use the Read tool to inspect it and the Edit tool to change it in place. ` +
    `Make the smallest edit that satisfies the instruction: do NOT rewrite the ` +
    `whole file, and do not reformat or re-indent markup you are not changing. ` +
    `Keep it a single self-contained HTML file, and preserve the :root ` +
    `design-token block unless the instruction is about those tokens.\n` +
    `Read and edit ONLY ${editPath}. No other file may be read, created, or changed.\n` +
    `Long inline data: URIs are image assets — never rewrite, shorten, ` +
    `regenerate, or elide them.\n` +
    `When the edit is done, reply with one short sentence saying what you changed.\n` +
    `Recent conversation:\n${transcript}\n\nInstruction: ${instruction}`
  );
}

/**
 * Model and effort for a studio edit. Both are deliberately below the CLI
 * defaults (Opus 5 at 'high'): a mockup edit is "find this markup, change it",
 * which is latency-sensitive and needs very little reasoning. Override either
 * with STUDIO_MODEL / STUDIO_EFFORT when an instruction is open-ended enough
 * to want the extra judgement.
 */
export const DEFAULT_EDIT_MODEL = 'claude-sonnet-5';
export const DEFAULT_EDIT_EFFORT = 'low';
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];

export function editModel(env = process.env) {
  return env.STUDIO_MODEL || DEFAULT_EDIT_MODEL;
}

/** Falls back (loudly) rather than letting a typo reach the API as a 400. */
export function editEffort(env = process.env) {
  const requested = env.STUDIO_EFFORT;
  if (!requested) return DEFAULT_EDIT_EFFORT;
  if (EFFORT_LEVELS.includes(requested)) return requested;
  console.warn(
    `Design Studio: ignoring STUDIO_EFFORT="${requested}" ` +
    `(expected one of ${EFFORT_LEVELS.join(', ')}); using "${DEFAULT_EDIT_EFFORT}".`,
  );
  return DEFAULT_EDIT_EFFORT;
}

/** Options that do not depend on the per-request scratch path. */
export const EDIT_QUERY_OPTIONS = {
  // Read + a few targeted edits + a closing sentence. Higher than the old
  // full-rewrite path needed, but the guard below bounds where those turns
  // can go, which is what actually stopped the original tool wandering.
  maxTurns: 12,
  tools: EDIT_TOOLS,
  // Deliberately NO allowedTools. A bare name there auto-approves the whole
  // tool *before* canUseTool runs (the SDK warns: CLAUDE_SDK_CAN_USE_TOOL_SHADOWED),
  // which would silently disable the per-path guard below. Leaving it unset
  // makes every call fall through to canUseTool. 'default' (not 'acceptEdits')
  // for the same reason — acceptEdits auto-approves edits.
  permissionMode: 'default',
  // Hermetic: without this the SDK loads ~/.claude/settings.json, any project
  // .claude/settings.json, and CLAUDE.md on every edit — so the user's own
  // hooks, permission rules, and MCP servers would leak into studio edits and
  // be re-read on each request.
  settingSources: [],
  includePartialMessages: true, // emits stream_event text deltas, for live progress only
};

/**
 * The second half of the trust boundary. `tools`/`allowedTools` decide which
 * tools exist; this decides what they may touch — every Read/Edit must name
 * exactly the scratch file we staged. Without it, handing the agent Edit back
 * would let an instruction buried in a mockup's own markup reach the rest of
 * the disk.
 */
export function createEditGuard(editPath) {
  return async (toolName, input) => {
    if (!EDIT_TOOLS.includes(toolName)) {
      return { behavior: 'deny', message: `${toolName} is not available in a studio edit.` };
    }
    const target = typeof input?.file_path === 'string' ? input.file_path : null;
    if (!target || path.resolve(target) !== editPath) {
      return { behavior: 'deny', message: `Only ${editPath} may be read or edited.` };
    }
    return { behavior: 'allow' };
  };
}

/** Assembles the full query() options for one edit of `editPath`. */
export function buildEditQueryOptions({ editPath, abortController, env = process.env }) {
  return {
    ...EDIT_QUERY_OPTIONS,
    model: editModel(env),
    effort: editEffort(env),
    cwd: path.dirname(editPath),
    canUseTool: createEditGuard(editPath),
    ...(abortController ? { abortController } : {}),
  };
}

/**
 * Copies the page into a private temp directory and returns the one path the
 * agent is allowed to touch. Staging keeps /api/edit's validation gate
 * meaningful — the agent's edits land on a throwaway copy, and the real
 * mockup is only overwritten after the gate passes. Keeping the copy out of
 * the mockups directory also keeps it out of listPages() and out of the
 * user's OneDrive sync.
 */
export async function stageScratchCopy(filePath, currentContent) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-edit-'));
  // realpath so createEditGuard's exact-match comparison survives a
  // symlinked tmpdir (/var -> /private/var on macOS).
  const realDir = await fs.realpath(dir);
  const editPath = path.join(realDir, filePath ? path.basename(filePath) : 'page.html');
  await fs.writeFile(editPath, currentContent, 'utf8');
  return { editPath, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
}

/**
 * Real adapter factory: an in-place, tool-driven edit of a scratch copy via
 * the Claude Agent SDK, authenticated only through the subscription OAuth
 * token.
 *
 * `loadSdk` is injectable so tests can assert on the exact query() call
 * without installing/invoking the real network-calling SDK. Defaults to the
 * real dynamic import, which is lazy so the app and tests run fine even in
 * environments that skip installing the dependency.
 */
export function createClaudeAdapter({ loadSdk = () => import('@anthropic-ai/claude-agent-sdk') } = {}) {
  return {
    async runEdit({ filePath, currentContent, instruction, history, onProgress, signal }) {
      if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
        // Never attempt the call without the subscription token.
        throw new AuthNotConfiguredError();
      }

      const { query } = await loadSdk();
      const { editPath, cleanup } = await stageScratchCopy(filePath, currentContent);

      try {
        const abortController = new AbortController();
        const forwardAbort = () => abortController.abort();
        if (signal) {
          if (signal.aborted) forwardAbort();
          else signal.addEventListener('abort', forwardAbort, { once: true });
        }

        const prompt = buildEditPrompt({ instruction, history, editPath });
        const options = buildEditQueryOptions({ editPath, abortController });

        let summary = '';
        let charsSoFar = 0;
        try {
          // `await` here works whether query() returns a real (non-thenable)
          // async-iterable Query object, as the real SDK does, or a Promise
          // of one, as test stubs conveniently do -- `await` on a
          // non-thenable value just resolves to that value.
          const stream = await query({ prompt, options });
          for await (const message of stream) {
            const delta = extractTextDelta(message);
            if (delta && typeof onProgress === 'function') {
              charsSoFar += delta.length;
              onProgress(charsSoFar);
            }
            // The last assistant prose wins: earlier turns narrate the edit,
            // the closing turn describes it.
            const text = extractAssistantText(message).trim();
            if (text) summary = text;
          }
        } finally {
          if (signal) signal.removeEventListener('abort', forwardAbort);
        }

        // The edited bytes come off disk, not out of the model's text — the
        // model never reproduces the page, so it cannot silently drop any
        // of it.
        const updatedContent = await fs.readFile(editPath, 'utf8');
        return { updatedContent, summary: summary || 'Updated the page per your instruction.' };
      } finally {
        await cleanup();
      }
    },
  };
}

/**
 * Real adapter: an in-place, tool-driven edit via the Claude Agent SDK,
 * authenticated only through the subscription OAuth token.
 */
export const claudeAdapter = createClaudeAdapter();

/**
 * The concatenated text of an `assistant` message; '' for every other message
 * shape. Used only for the human-readable chat summary.
 */
export function extractAssistantText(message) {
  if (message?.type !== 'assistant') return '';
  const content = message.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
}

/**
 * Pulls the incremental assistant-text delta out of a `stream_event` message
 * (only emitted when `includePartialMessages` is set), or null for every
 * other message shape. Used solely to drive onProgress's running character
 * count -- the delta text itself is never sent anywhere, only its length.
 */
export function extractTextDelta(message) {
  if (message?.type !== 'stream_event') return null;
  const event = message.event;
  if (event?.type !== 'content_block_delta') return null;
  const delta = event.delta;
  if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
    return delta.text;
  }
  return null;
}

/** Selects the adapter implementation via STUDIO_AGENT env var (default: claude). */
export function selectAgentAdapter(env = process.env) {
  const mode = env.STUDIO_AGENT || 'claude';
  if (mode === 'mock') return mockAdapter;
  if (mode === 'claude') return claudeAdapter;
  throw new Error(`Unknown STUDIO_AGENT value: "${mode}" (expected "mock" or "claude")`);
}
