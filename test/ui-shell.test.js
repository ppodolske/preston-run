const assert = require('node:assert/strict');
const test = require('node:test');
const { renderShell } = require('../src/ui/shell');

function assertSharedShell(html) {
  assert.match(html, /href="\/preston\.css"/);
  assert.match(html, /class="site-header"/);
  assert.match(html, /href="\/"[^>]*>[\s\S]*?preston\.ai/i);
  assert.match(html, /class="site-footer"/);
  assert.match(html, /<main class="site-main/);
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
