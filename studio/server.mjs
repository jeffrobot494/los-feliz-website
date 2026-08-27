// studio/server.mjs
//
// Design Studio backend: serves the page list, raw file bytes for the iframe
// preview, agent-driven edits (validated before write-back), and save-as-new.
// The server is the trust boundary — the browser UI never touches the
// filesystem, and this process is the only thing that calls the agent adapter.

import express from 'express';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { selectAgentAdapter } from './agent.mjs';
import { loadEnvFile } from './env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

/** Resolves the target directory from --dir <path>, STUDIO_DIR, or the repo root. */
export function resolveTargetDir({ argv = process.argv.slice(2), env = process.env } = {}) {
  const flagIndex = argv.indexOf('--dir');
  const dirArg = flagIndex !== -1 ? argv[flagIndex + 1] : undefined;
  const dir = dirArg || env.STUDIO_DIR || REPO_ROOT;
  return path.resolve(dir);
}

/**
 * Resolves a repo-relative path against targetDir and rejects any path that
 * would escape it (including absolute paths and `..` traversal). Returns the
 * absolute path, or null if the input is invalid/out of bounds.
 */
export function resolveSafePath(targetDir, relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) return null;
  if (relPath.includes('\0')) return null;

  const normalized = path.normalize(relPath);
  const resolved = path.resolve(targetDir, normalized);
  const boundary = targetDir.endsWith(path.sep) ? targetDir : targetDir + path.sep;

  if (resolved !== targetDir && !resolved.startsWith(boundary)) return null;
  return resolved;
}

// This app's own home directory. When the target dir is the repo root (the
// default), its own source/tests/fixtures are not mockups and must never
// show up in the page list.
const STUDIO_HOME = __dirname;

/** Recursively lists .html files under targetDir, grouped by repo-relative folder ("" = root). */
export async function listPages(targetDir, { excludeDirs = [STUDIO_HOME] } = {}) {
  const files = [];

  async function walk(current) {
    if (current !== targetDir && excludeDirs.includes(current)) return;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (err) {
      if (current === targetDir) throw err;
      return; // skip unreadable subdirectories rather than failing the whole listing
    }
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        files.push(path.relative(targetDir, full).split(path.sep).join('/'));
      }
    }
  }

  await walk(targetDir);
  files.sort();

  const grouped = {};
  for (const relPath of files) {
    const folder = path.posix.dirname(relPath);
    const key = folder === '.' ? '' : folder;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(relPath);
  }
  return grouped;
}

/**
 * Validates an agent's edit response before it is allowed to overwrite the
 * file. Pure and independently testable — this is the safety gate that
 * guarantees a malformed/garbage response never touches disk.
 */
export function validateEditResponse(originalContent, result) {
  if (!result || typeof result.updatedContent !== 'string') {
    return { ok: false, reason: 'missing_updated_content' };
  }
  const updated = result.updatedContent;
  if (updated.length === 0) {
    return { ok: false, reason: 'empty_response' };
  }
  const head = updated.trimStart().slice(0, 15).toLowerCase();
  if (!(head.startsWith('<!doctype') || head.startsWith('<html'))) {
    return { ok: false, reason: 'not_html' };
  }
  const originalBytes = Buffer.byteLength(originalContent, 'utf8');
  const updatedBytes = Buffer.byteLength(updated, 'utf8');
  if (updatedBytes > originalBytes * 3) {
    return { ok: false, reason: 'oversized' };
  }
  if (updated === originalContent) {
    return { ok: false, reason: 'unchanged' };
  }
  return { ok: true };
}

/**
 * Maps a caught agent-adapter error to a message safe to show in the chat
 * UI. A missing SDK dependency throws Node's raw module-loader error
 * ("Cannot find package/module ...", code MODULE_NOT_FOUND or
 * ERR_MODULE_NOT_FOUND depending on CJS/ESM) \u2014 confusing and unactionable
 * for a user, so it's replaced with a concrete fix. Every other error's
 * message passes through unchanged; this only ever reads err.code/err.message,
 * never process.env, so it can't leak env values or token material.
 */
export function describeAgentError(err) {
  const code = err?.code;
  const message = typeof err?.message === 'string' ? err.message : '';
  const isModuleNotFound =
    code === 'MODULE_NOT_FOUND' ||
    code === 'ERR_MODULE_NOT_FOUND' ||
    /cannot find (package|module)/i.test(message);
  if (isModuleNotFound && /claude-agent-sdk/i.test(message)) {
    return 'The Claude Agent SDK is not installed \u2014 run npm --prefix studio install and restart the server.';
  }
  return message || 'agent failed';
}

/** A valid "save as new page" filename: no separators/traversal, ends in .html. */
function isValidNewName(name) {
  if (typeof name !== 'string') return false;
  if (name.length === 0 || name.length > 200) return false;
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) return false;
  if (name === '.' || name === '..') return false;
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\.html$/i.test(name);
}

/**
 * Builds the Express app. `dir` defaults to the resolved target directory;
 * tests pass a fixture dir. `agentAdapter` overrides env-based selection so
 * tests can inject controlled (including deliberately broken) adapters.
 */
export function createApp({ dir, agentAdapter } = {}) {
  const targetDir = path.resolve(dir || resolveTargetDir());
  const agent = agentAdapter || selectAgentAdapter();

  const app = express();
  app.use(express.json());

  // Serves the studio's own UI (studio/public/) — distinct from `targetDir`,
  // which is the mockups directory being edited, never served wholesale.
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/pages', async (req, res) => {
    try {
      const pages = await listPages(targetDir);
      res.status(200).json({ dir: targetDir, pages });
    } catch (err) {
      res.status(500).json({ error: 'directory_not_found', message: err.message });
    }
  });

  app.get('/api/file', async (req, res) => {
    const relPath = req.query.path;
    if (typeof relPath !== 'string' || relPath.length === 0) {
      return res.status(400).json({ error: 'invalid_path' });
    }
    const resolved = resolveSafePath(targetDir, relPath);
    if (!resolved) {
      return res.status(400).json({ error: 'invalid_path' });
    }
    try {
      const stat = await fs.stat(resolved);
      if (!stat.isFile()) {
        return res.status(404).json({ error: 'not_found' });
      }
      const buffer = await fs.readFile(resolved);
      const ext = path.extname(resolved).slice(1) || 'bin';
      res.type(ext);
      return res.status(200).send(buffer);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'not_found' });
      }
      return res.status(500).json({ error: 'internal_error', message: err.message });
    }
  });

  app.post('/api/edit', async (req, res) => {
    const { path: relPath, instruction, history } = req.body || {};
    if (typeof relPath !== 'string' || typeof instruction !== 'string' || instruction.length === 0) {
      return res.status(400).json({ error: 'invalid_request' });
    }
    const resolved = resolveSafePath(targetDir, relPath);
    if (!resolved) {
      return res.status(400).json({ error: 'invalid_path' });
    }

    let currentContent;
    try {
      currentContent = await fs.readFile(resolved, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'not_found' });
      }
      return res.status(500).json({ error: 'internal_error', message: err.message });
    }

    let result;
    try {
      result = await agent.runEdit({
        filePath: resolved,
        currentContent,
        instruction,
        history: Array.isArray(history) ? history : [],
      });
    } catch (err) {
      if (err && err.code === 'auth_not_configured') {
        return res.status(401).json({ error: 'auth_not_configured' });
      }
      // The client only ever sees describeAgentError's sanitized message;
      // the raw error (which may include stack/module-resolution detail) is
      // always logged here so it's still discoverable for debugging.
      console.error('Design Studio: agent adapter threw during /api/edit:', err);
      return res.status(502).json({ error: 'agent_error', message: describeAgentError(err) });
    }

    const gate = validateEditResponse(currentContent, result);
    if (!gate.ok) {
      return res.status(502).json({ error: 'validation_failed', reason: gate.reason });
    }

    try {
      await fs.writeFile(resolved, result.updatedContent, 'utf8');
    } catch (err) {
      return res.status(500).json({ error: 'internal_error', message: err.message });
    }

    return res.status(200).json({ summary: result.summary });
  });

  app.post('/api/save', async (req, res) => {
    const { path: relPath, newName } = req.body || {};
    if (typeof relPath !== 'string') {
      return res.status(400).json({ error: 'invalid_request' });
    }
    const sourceResolved = resolveSafePath(targetDir, relPath);
    if (!sourceResolved) {
      return res.status(400).json({ error: 'invalid_path' });
    }
    if (!isValidNewName(newName)) {
      return res.status(400).json({ error: 'invalid_name' });
    }

    try {
      const stat = await fs.stat(sourceResolved);
      if (!stat.isFile()) {
        return res.status(404).json({ error: 'not_found' });
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'not_found' });
      }
      return res.status(500).json({ error: 'internal_error', message: err.message });
    }

    const destResolved = path.join(path.dirname(sourceResolved), newName);
    // Guard against the (already-excluded-by-isValidNewName) edge case where
    // a crafted name could still resolve outside targetDir.
    const safeDest = resolveSafePath(targetDir, path.relative(targetDir, destResolved));
    if (!safeDest) {
      return res.status(400).json({ error: 'invalid_name' });
    }

    try {
      // COPYFILE_EXCL makes the exists-check and the copy atomic: a
      // pre-existing target fails without creating or truncating anything.
      await fs.copyFile(sourceResolved, destResolved, fsConstants.COPYFILE_EXCL);
    } catch (err) {
      if (err.code === 'EEXIST') {
        return res.status(409).json({ error: 'name_exists' });
      }
      return res.status(500).json({ error: 'internal_error', message: err.message });
    }

    const newRelPath = path.relative(targetDir, destResolved).split(path.sep).join('/');
    return res.status(200).json({ path: newRelPath });
  });

  return app;
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  // Load studio/../.env (repo root) before resolving anything env-driven —
  // selectAgentAdapter() reads CLAUDE_CODE_OAUTH_TOKEN right after this.
  // A real exported env var always wins; the file only fills gaps.
  loadEnvFile(path.join(REPO_ROOT, '.env'));

  const targetDir = resolveTargetDir();
  const app = createApp({ dir: targetDir });
  const port = Number(process.env.PORT) || 4590;
  app.listen(port, () => {
    console.log(`Design Studio server listening on http://localhost:${port}, serving ${targetDir}`);
  });
}
