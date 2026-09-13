'use strict';

const crypto = require('node:crypto');

function same(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function reject(res) {
  res.statusCode = 401;
  if (res.setHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="preston.ai UAT", charset="UTF-8"');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  }
  res.end('UAT authentication required');
  return false;
}

function authorizeUatRequest(req, res, config) {
  if (!config.uatAuthEnabled) return true;
  const header = String(req.headers && req.headers.authorization || '');
  if (!header.startsWith('Basic ')) return reject(res);
  let decoded = '';
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return reject(res); }
  const separator = decoded.indexOf(':');
  if (separator < 0) return reject(res);
  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  return same(user, config.uatBasicUser) && same(password, config.uatBasicPassword) ? true : reject(res);
}

module.exports = { authorizeUatRequest };
