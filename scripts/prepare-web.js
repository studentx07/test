'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'www');
const files = [
  'index.html',
  'manifest.json',
  'sw.js',
  'icon.png',
  'icon-192.png',
  'icon-512.png',
  'splash.png'
];

fs.mkdirSync(webDir, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(webDir, file));
}
