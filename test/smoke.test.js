'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('service worker source is present without executing browser-only globals', () => {
  const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

  assert.match(serviceWorker, /self\.addEventListener\(["']install["']/);
  assert.match(serviceWorker, /self\.addEventListener\(["']fetch["']/);
});
