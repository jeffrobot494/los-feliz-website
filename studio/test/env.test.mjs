import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

import { parseEnvFile, loadEnvFile } from '../env.mjs';
import { makeTempDir, removeTempDir } from './helpers.mjs';

test('parseEnvFile parses KEY=VALUE lines and skips blanks/comments', () => {
  const text = [
    '# a comment',
    '',
    'CLAUDE_CODE_OAUTH_TOKEN=abc123',
    '  PORT = 4590  ',
    '# another comment',
    'EMPTY=',
  ].join('\n');

  assert.deepEqual(parseEnvFile(text), {
    CLAUDE_CODE_OAUTH_TOKEN: 'abc123',
    PORT: '4590',
    EMPTY: '',
  });
});

test('parseEnvFile ignores malformed lines with no "="', () => {
  assert.deepEqual(parseEnvFile('not-a-valid-line\nKEY=value'), { KEY: 'value' });
});

test('loadEnvFile sets keys from the file into env when absent', async () => {
  const dir = await makeTempDir();
  try {
    await fs.writeFile(path.join(dir, '.env'), 'CLAUDE_CODE_OAUTH_TOKEN=from-file\n', 'utf8');
    const env = {};
    loadEnvFile(path.join(dir, '.env'), env);
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, 'from-file');
  } finally {
    await removeTempDir(dir);
  }
});

test('loadEnvFile never overrides a key already set in the real environment', async () => {
  const dir = await makeTempDir();
  try {
    await fs.writeFile(path.join(dir, '.env'), 'CLAUDE_CODE_OAUTH_TOKEN=from-file\n', 'utf8');
    const env = { CLAUDE_CODE_OAUTH_TOKEN: 'from-real-env' };
    loadEnvFile(path.join(dir, '.env'), env);
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, 'from-real-env');
  } finally {
    await removeTempDir(dir);
  }
});

test('loadEnvFile is a silent no-op when the file does not exist', () => {
  const env = { EXISTING: 'untouched' };
  loadEnvFile('/nonexistent/path/.env', env);
  assert.deepEqual(env, { EXISTING: 'untouched' });
});
