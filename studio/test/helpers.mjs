// studio/test/helpers.mjs — shared test utilities (no network, no live repo writes).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = path.join(__dirname, 'fixtures');

/** Creates a fresh temp directory under the OS tmp dir; caller is responsible for cleanup. */
export async function makeTempDir(prefix = 'studio-test-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function removeTempDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Creates a temp working directory seeded with a copy of fixtures/sample-page.html
 * (named `fileName`), so edit/save tests write to a throwaway file, never to
 * checked-in fixtures or the live repo mockups.
 */
export async function makeSampleWorkspace(fileName = 'sample-page.html') {
  const dir = await makeTempDir();
  const content = await fs.readFile(path.join(FIXTURES_DIR, 'sample-page.html'), 'utf8');
  await fs.writeFile(path.join(dir, fileName), content, 'utf8');
  return { dir, fileName, content };
}

/**
 * Reads a fetch() Response body as NDJSON (one JSON object per line) and
 * returns the parsed events in order. Used for the streaming /api/edit
 * response; res.text() waits for the full body, which is fine in tests
 * since there's no real multi-minute agent call behind a fake adapter.
 */
export async function readNdjsonEvents(res) {
  const text = await res.text();
  return text
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

/** Starts an Express app on an ephemeral port; returns the base URL and a stop() closer. */
export async function startApp(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        stop: () => new Promise((res) => server.close(res)),
      });
    });
    server.on('error', reject);
  });
}
