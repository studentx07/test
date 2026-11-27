'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);

test('all inline JavaScript parses', () => {
  assert.ok(scripts.length > 0, 'expected inline scripts');
  scripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source), 'inline script ' + (index + 1));
  });
});

test('HTML element IDs are unique', () => {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('literal element selectors point to existing IDs', () => {
  const selectors = [...new Set([...html.matchAll(/\$\(["']([^"']+)["']\)/g)].map(match => match[1]))];
  const missing = selectors.filter(id => !ids.includes(id));
  assert.deepEqual(missing, []);
});

test('critical data integrity safeguards remain present', () => {
  assert.match(html, /Array\.isArray\(storedRows\)/);
  assert.match(html, /if\(!save\(\)\)\{if\(wasEdit\)rows\[ed\]=oldRecord/);
  assert.match(html, /mergeTasks\(q\.arch,P\.arch\)/);
  assert.match(html, /existing\.s\.push\(step\)/);
  assert.match(html, /if\(!save\(\)\)\{rows=originalRows/);
  assert.match(html, /today\.setHours\(0,0,0,0\)/);
  assert.match(html, /if\(chatSave\(\)\)\{/);
});

test('service worker cache version is bumped for this release', () => {
  const sw = fs.readFileSync('sw.js', 'utf8');
  assert.match(sw, /const V="sakina-v8"/);
});
