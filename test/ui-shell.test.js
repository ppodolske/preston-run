const assert = require('node:assert/strict');
const test = require('node:test');
const { renderLoginPage } = require('../src/pages/login');
const { renderHomePage } = require('../src/pages/home');

function assertSharedShell(html) {
  assert.match(html, /href="\/preston\.css"/);
  assert.match(html, /class="site-header"/);
  assert.match(html, /href="\/"[^>]*>[\s\S]*?preston\.ai/i);
  assert.match(html, /class="site-footer"/);
}

test('login page uses the shared preston.ai shell', () => {
  assertSharedShell(renderLoginPage());
});

test('home page uses the shared preston.ai shell', () => {
  assertSharedShell(renderHomePage({ user: {} }));
});
