const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { renderShell } = require('../src/ui/shell');

function assertSharedShell(html) {
  assert.match(html, /href="\/preston\.css"/);
  assert.match(html, /class="site-header"/);
  assert.match(html, /href="\/"[^>]*>[\s\S]*?preston\.ai/i);
  assert.match(html, /class="site-footer"/);
  assert.match(html, /<a class="skip-link" href="#main-content">Skip to content<\/a>/);
  assert.match(html, /<main id="main-content" class="site-main/);
}

test('renderShell emits the shared preston.ai document structure', () => {
  const html = renderShell({ title: 'Test', body: '<h1>Hello</h1>', activeNav: 'Test' });
  assertSharedShell(html);
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.match(html, /Test · preston\.ai/);
});

test('renderShell supports the wide layout modifier', () => {
  const html = renderShell({ body: 'Wide', wide: true });
  assert.match(html, /site-main site-main-wide/);
});

test('shared stylesheet uses a deliberate system font stack and visible keyboard focus', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/preston.css'), 'utf8');
  assert.doesNotMatch(css, /\bInter\b|Instrument Serif|IBM Plex Sans/i);
  assert.match(css, /font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif/);
  assert.match(css, /:focus-visible\{outline:3px solid var\(--focus\);outline-offset:2px\}/);
  assert.match(css, /\.skip-link\{/);
  assert.match(css, /\.skip-link:focus/);
});
