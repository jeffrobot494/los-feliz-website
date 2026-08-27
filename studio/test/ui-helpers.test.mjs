// studio/test/ui-helpers.test.mjs — unit tests for the frontend's pure
// helpers (studio/public/js/format.js). No DOM, no network: these functions
// take plain values in and return plain values out.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  baseNameOf,
  createNdjsonLineBuffer,
  describeEditError,
  describeSaveError,
  firstPage,
  flattenGrouped,
  folderKey,
  formatEditProgress,
  formatElapsed,
  nextVariantName,
  pageFromSearch,
  searchWithPage,
  variantStem,
} from '../public/js/format.js';

test('pageFromSearch reads ?page= and treats absent/empty as none', () => {
  assert.equal(pageFromSearch('?page=homepage-mockup.html'), 'homepage-mockup.html');
  assert.equal(pageFromSearch('?page=sub%2Fc.html'), 'sub/c.html');
  assert.equal(pageFromSearch(''), null);
  assert.equal(pageFromSearch('?page='), null);
  assert.equal(pageFromSearch('?other=1'), null);
});

test('searchWithPage sets, replaces, and removes the page param without disturbing others', () => {
  assert.equal(searchWithPage('', 'a.html'), '?page=a.html');
  assert.equal(searchWithPage('?page=a.html', 'b.html'), '?page=b.html');
  assert.equal(searchWithPage('?foo=1&page=a.html', 'b.html'), '?foo=1&page=b.html');
  assert.equal(searchWithPage('?page=a.html', null), '');
  assert.equal(searchWithPage('?foo=1&page=a.html', null), '?foo=1');
});

test('folderKey and baseNameOf mirror the server\u2019s grouping for root and nested paths', () => {
  assert.equal(folderKey('a.html'), '');
  assert.equal(folderKey('sub/c.html'), 'sub');
  assert.equal(folderKey('sub/nested/d.html'), 'sub/nested');
  assert.equal(baseNameOf('a.html'), 'a.html');
  assert.equal(baseNameOf('sub/c.html'), 'c.html');
});

test('variantStem strips a trailing -vN suffix but leaves plain names alone', () => {
  assert.equal(variantStem('homepage-mockup.html'), 'homepage-mockup');
  assert.equal(variantStem('homepage-mockup-v2.html'), 'homepage-mockup');
  assert.equal(variantStem('homepage-mockup-v13.html'), 'homepage-mockup');
});

test('nextVariantName starts at v2 and increments past existing siblings', () => {
  assert.equal(nextVariantName('homepage-mockup.html', []), 'homepage-mockup-v2.html');
  assert.equal(
    nextVariantName('homepage-mockup.html', ['homepage-mockup.html', 'homepage-mockup-v2.html']),
    'homepage-mockup-v3.html',
  );
  // Saving a variant again suggests the next free name off the same stem, not -v2-v2.
  assert.equal(
    nextVariantName('homepage-mockup-v2.html', ['homepage-mockup.html', 'homepage-mockup-v2.html']),
    'homepage-mockup-v3.html',
  );
});

test('firstPage picks the first entry of the first folder in sorted order', () => {
  assert.equal(firstPage({ '': ['b.html', 'a.html'], sub: ['c.html'] }), 'b.html');
  assert.equal(firstPage({ sub: ['c.html'] }), 'c.html');
  assert.equal(firstPage({}), null);
  assert.equal(firstPage({ '': [] }), null);
});

test('flattenGrouped concatenates every folder\u2019s entries', () => {
  assert.deepEqual(
    flattenGrouped({ '': ['a.html', 'b.html'], sub: ['sub/c.html'] }),
    ['a.html', 'b.html', 'sub/c.html'],
  );
});

test('describeEditError distinguishes auth-not-configured, validation failures, and generic errors', () => {
  const authMessage = describeEditError({ status: 401, code: 'auth_not_configured' });
  assert.match(authMessage, /\.env/i);
  assert.match(authMessage, /README/i);
  assert.match(describeEditError({ status: 502, reason: 'not_html' }), /\(not_html\)/);
  assert.match(describeEditError({ status: 502 }), /left unchanged/);
  assert.match(describeEditError({ status: 500 }), /went wrong/);
});

test('describeEditError surfaces the server\u2019s agent_error message verbatim, prefixed', () => {
  const message = describeEditError({
    status: 502,
    code: 'agent_error',
    message: 'The Claude Agent SDK is not installed \u2014 run npm --prefix studio install and restart the server.',
  });
  assert.match(message, /^Agent error: The Claude Agent SDK is not installed/);
  assert.match(message, /left unchanged/i);
});

test('describeEditError maps 400 invalid_request\/invalid_path to a rejection message naming the code', () => {
  assert.match(describeEditError({ status: 400, code: 'invalid_request' }), /rejected by the server \(invalid_request\)/);
  assert.match(describeEditError({ status: 400, code: 'invalid_path' }), /rejected by the server \(invalid_path\)/);
});

test('describeEditError maps 404 not_found to a page-missing message', () => {
  assert.match(describeEditError({ status: 404, code: 'not_found' }), /no longer exists/i);
});

test('describeEditError gives a network-specific message when there is no HTTP status at all', () => {
  const message = describeEditError(new TypeError('Failed to fetch'));
  assert.match(message, /could not reach the server/i);
  assert.match(message, /left unchanged/i);
});

test('describeEditError treats a code-only shape (no HTTP status) the same as its status-carrying equivalent', () => {
  // Errors that arrive as a terminal NDJSON stream event carry no HTTP
  // status \u2014 streaming fixes the status at 200 \u2014 so the dispatch must
  // key off `code` first, not require `status` alongside it.
  const authMessage = describeEditError({ code: 'auth_not_configured' });
  assert.match(authMessage, /\.env/i);
  assert.match(authMessage, /README/i);

  const agentMessage = describeEditError({ code: 'agent_error', message: 'boom' });
  assert.equal(agentMessage, describeEditError({ status: 502, code: 'agent_error', message: 'boom' }));

  const validationMessage = describeEditError({ code: 'validation_failed', reason: 'not_html' });
  assert.match(validationMessage, /\(not_html\)/);
  assert.match(validationMessage, /rephrasing/);
});

test('describeEditError treats a truncated stream (no terminal event, no status, no code) as a network failure', () => {
  const message = describeEditError({});
  assert.match(message, /could not reach the server/i);
  assert.match(message, /left unchanged/i);
});

test('createNdjsonLineBuffer parses complete lines and buffers a line split across chunk boundaries', () => {
  const buffer = createNdjsonLineBuffer();

  // A line arriving in one chunk parses immediately.
  assert.deepEqual(buffer.push('{"type":"started"}\n'), [{ type: 'started' }]);

  // A line split across two chunks yields nothing until the second chunk
  // completes it, and any trailing partial line stays buffered.
  const first = buffer.push('{"type":"progress",');
  assert.deepEqual(first, []);
  const second = buffer.push('"chars":5}\n{"type":"do');
  assert.deepEqual(second, [{ type: 'progress', chars: 5 }]);

  const third = buffer.push('ne","summary":"ok"}\n');
  assert.deepEqual(third, [{ type: 'done', summary: 'ok' }]);

  // flush() is a no-op once every line has already ended in a newline.
  assert.deepEqual(buffer.flush(), []);
});

test('createNdjsonLineBuffer.flush parses a final line with no trailing newline', () => {
  const buffer = createNdjsonLineBuffer();
  assert.deepEqual(buffer.push('{"type":"started"}\n{"type":"done","summary":"ok"}'), [{ type: 'started' }]);
  assert.deepEqual(buffer.flush(), [{ type: 'done', summary: 'ok' }]);
  // A second flush with nothing left buffered is a no-op.
  assert.deepEqual(buffer.flush(), []);
});

test('formatElapsed renders seconds under a minute and minutes+seconds at/after 60s', () => {
  assert.equal(formatElapsed(0), '0s');
  assert.equal(formatElapsed(42_000), '42s');
  assert.equal(formatElapsed(59_000), '59s');
  assert.equal(formatElapsed(60_000), '1m 0s');
  assert.equal(formatElapsed(125_000), '2m 5s');
});

test('formatEditProgress renders the live working status line, with and without a character count', () => {
  assert.equal(formatEditProgress({ elapsedMs: 42_000, chars: 12340 }), 'Working\u2026 42s \u00b7 12,340 characters written so far');
  assert.equal(formatEditProgress({ elapsedMs: 12_000 }), 'Working\u2026 12s');
});

test('describeSaveError distinguishes name conflicts, invalid names, and generic errors', () => {
  assert.match(describeSaveError({ status: 409 }), /already exists/);
  assert.match(describeSaveError({ status: 400 }), /isn.t valid/);
  assert.match(describeSaveError({ status: 500 }), /try again/i);
});
