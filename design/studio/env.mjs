// studio/env.mjs
//
// Zero-dependency .env support: no dotenv package, just KEY=VALUE parsing.
// The real process environment always wins — a file value only fills in a
// key that isn't already set, so `export CLAUDE_CODE_OAUTH_TOKEN=...` keeps
// working exactly as before.

import fs from 'node:fs';

/** Parses .env-style text into a plain object. Blank lines and lines
 * starting with `#` are ignored; each remaining line must be KEY=VALUE. */
export function parseEnvFile(text) {
  const values = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    if (key) values[key] = line.slice(eqIndex + 1).trim();
  }
  return values;
}

/** Loads `filePath` (if present) and applies its keys to `env`, skipping any
 * key already set. A missing file is a silent no-op. */
export function loadEnvFile(filePath, env = process.env) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }
  for (const [key, value] of Object.entries(parseEnvFile(text))) {
    if (env[key] === undefined) env[key] = value;
  }
}
