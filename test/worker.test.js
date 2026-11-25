'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8');

test('AI worker JavaScript parses as a module after export wrapper removal', () => {
  assert.match(worker, /export default \{/);
  new vm.Script(worker.replace('export default', 'const worker ='));
});

test('AI worker keeps provider credentials server-side and disables response storage', () => {
  assert.match(worker, /env\.OPENAI_API_KEY/);
  assert.match(worker, /env\.SAKINA_ACCESS_TOKEN/);
  assert.match(worker, /store:\s*false/);
  assert.doesNotMatch(worker, /OPENAI_API_KEY\s*[:=]\s*["'][^"']/);
});

test('AI worker validates origin, auth, message count and message size', () => {
  for (const pattern of [
    /allowed\.includes\(origin\)/,
    /X-Sakina-Token/,
    /MAX_BODY_BYTES/,
    /MAX_MESSAGES/,
    /MAX_MESSAGE_CHARS/,
    /messages\[messages\.length - 1\]\.role !== "user"/
  ]) assert.match(worker, pattern);
});
