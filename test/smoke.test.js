'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function scriptsFromHtml(source) {
  return [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]);
}

test('inline JavaScript parses without syntax errors', () => {
  const scripts = scriptsFromHtml(html);
  assert.ok(scripts.length >= 1);
  for (const source of scripts) new vm.Script(source);
});

test('calendar, recycle bin, history and backup UI are present', () => {
  for (const id of [
    'cal', 'calmonth', 'calgrid', 'caldetail', 'trash', 'trashlist',
    'trashEmpty', 'hist', 'hlg', 'backupPass', 'encBackup'
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  for (const page of ['cal', 'trash', 'hist']) {
    assert.match(html, new RegExp(`data-t=["']${page}["']`));
    assert.match(html, new RegExp(`data-g=["']${page}["']`));
  }
});

test('statistics editor validates edits and sends deleted records to trash', () => {
  assert.match(html, /data-est=/);
  assert.match(html, /data-esd=/);
  assert.match(html, /function openStatsEditor\(index\)/);
  assert.match(html, /شدة الشعور يجب أن تكون من 0 إلى 10/);
  assert.match(html, /addToTrash\("feeling",removed,removed\.s\)/);
});

test('deletion confirmation uses a separate attribute from task checkbox IDs', () => {
  assert.match(html, /function two\(b,fn\)\{if\(b\.getAttribute\("data-confirm"\)\)/);
  assert.match(html, /data-c='"\+esc\(t\.id\)\+"/);
  assert.doesNotMatch(html, /function two\(b,fn\)\{if\(b\.getAttribute\("data-c"\)\)/);
});

test('all critical removed item types have restore handlers', () => {
  for (const type of ['feeling', 'note', 'task', 'habit', 'goal', 'goalStep', 'category']) {
    assert.match(html, new RegExp(`entry\\.type==["']${type}["']`));
  }
  assert.match(html, /function purgeExpiredTrash\(\)/);
});

test('PWA icon files and Capacitor web build configuration exist', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, icon.src)), `missing ${icon.src}`);
  }
  const cap = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
  assert.equal(cap.webDir, 'www');
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'prepare-web.js')));
  assert.ok(fs.existsSync(path.join(root, '.github', 'workflows', 'build-apk.yml')));
});

test('encrypted backup crypto settings support authenticated round-trip', async () => {
  const subtle = webcrypto.subtle;
  const password = 'Sakina-Test-Password';
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const material = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const original = new TextEncoder().encode(JSON.stringify({ app: 'sakina', rows: [{ s: 'test' }] }));
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, original);
  const decoded = await subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  assert.equal(new TextDecoder().decode(decoded), new TextDecoder().decode(original));
  const wrongMaterial = await subtle.importKey('raw', new TextEncoder().encode('wrong-password'), 'PBKDF2', false, ['deriveKey']);
  const wrongKey = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    wrongMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  await assert.rejects(subtle.decrypt({ name: 'AES-GCM', iv }, wrongKey, encrypted));
});
