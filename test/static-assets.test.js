'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { serveStatic, ALLOWED } = require('../src/http/static');

function response() {
  return {
    statusCode: null,
    headers: {},
    body: Buffer.alloc(0),
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), v]));
    },
    end(value = Buffer.alloc(0)) {
      this.body = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
    }
  };
}

for (const [pathname, contentType] of [
  ['/preston.css', /text\/css/],
  ['/settings.css', /text\/css/],
  ['/gmail-status.js', /javascript/],
  ['/favicon.ico', /image\/png/],
  ['/apple-touch-icon.png', /image\/png/],
  ['/apple-touch-icon-precomposed.png', /image\/png/]
]) {
  test(`${pathname} is an allowed, readable static asset`, () => {
    assert.ok(ALLOWED.has(pathname), `${pathname} missing from static allowlist`);
    const res = response();
    const handled = serveStatic({ url: pathname }, res, pathname);
    assert.equal(handled, true);
    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers['content-type'] || ''), contentType);
    assert.ok(res.body.length > 0);
  });
}
