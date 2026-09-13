'use strict';

const crypto = require('node:crypto');
const { readForm, isSameOriginRequest } = require('../http/forms');
const { html, redirect, text } = require('../http/respond');

const COOKIE_NAME = 'preston_uat';

function same(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function sessionToken(config) {
  return crypto.createHmac('sha256', config.uatBasicPassword)
    .update(`${config.uatBasicUser}\0${config.uatUserId}\0${config.uatUserEmail}`)
    .digest('hex');
}

function cookieMap(header='') {
  const out = {};
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0,i).trim()] = part.slice(i+1).trim();
  }
  return out;
}

function hasUatSession(req, config) {
  if (!config.uatAuthEnabled) return true;
  const token = cookieMap(req.headers && req.headers.cookie || '')[COOKIE_NAME] || '';
  return same(token, sessionToken(config));
}

function sessionCookie(config) {
  return `${COOKIE_NAME}=${sessionToken(config)}; Path=/; Max-Age=14400; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function renderLogin({error=''}={}) {
  const errorHtml = error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#162a4c"><title>UAT sign in · preston.ai</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#eef2f4;color:#122432;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(440px,100%);background:#fff;border:1px solid #d7e0e4;border-radius:22px;padding:32px;box-shadow:0 18px 55px #12243218}.kicker{margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#667781;font-weight:800}h1{margin:0 0 8px;font-size:28px}.copy{margin:0 0 24px;color:#526873}.field{display:grid;gap:7px;margin:0 0 16px}.field label{font-size:13px;font-weight:800}.field input{width:100%;border:1px solid #bfcbd1;border-radius:11px;padding:13px 14px;font:inherit;background:#fff;color:#122432}.field input:focus-visible,.signin:focus-visible{outline:3px solid #2f80ed;outline-offset:2px}.signin{width:100%;border:0;border-radius:12px;padding:14px 18px;background:#162a4c;color:#fff;font:inherit;font-weight:800;cursor:pointer}.error{background:#fff3f3;color:#8a2929;padding:10px 12px;border-radius:10px;font-size:13px;margin:0 0 16px}</style></head><body><main class="card"><p class="kicker">preston.ai UAT</p><h1>Sign in</h1><p class="copy">Temporary isolated test environment.</p>${errorHtml}<form method="post" action="/uat-login"><div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><button class="signin" type="submit">Sign in</button></form></main></body></html>`;
}

async function handleUatAuth(req, res, url, config) {
  if (!config.uatAuthEnabled || url.pathname === '/health') return false;

  if (url.pathname === '/uat-login') {
    if (req.method === 'GET') {
      html(res, 200, renderLogin(), {'cache-control':'no-store'});
      return true;
    }
    if (req.method === 'POST') {
      if (!isSameOriginRequest(req, config)) {
        text(res, 403, 'Forbidden', {'cache-control':'no-store'});
        return true;
      }
      let form;
      try { form = await readForm(req); }
      catch (error) {
        text(res, error.statusCode || 400, 'Invalid form request', {'cache-control':'no-store'});
        return true;
      }
      const user = String(form.get('username') || '');
      const password = String(form.get('password') || '');
      if (!same(user, config.uatBasicUser) || !same(password, config.uatBasicPassword)) {
        html(res, 401, renderLogin({error:'Incorrect username or password.'}), {'cache-control':'no-store'});
        return true;
      }
      res.setHeader('Set-Cookie', sessionCookie(config));
      redirect(res, '/');
      return true;
    }
    text(res, 405, 'Method not allowed', {'cache-control':'no-store'});
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/auth/logout') {
    res.setHeader('Set-Cookie', clearSessionCookie());
    redirect(res, '/uat-login');
    return true;
  }

  if (hasUatSession(req, config)) return false;
  redirect(res, '/uat-login');
  return true;
}

module.exports = { handleUatAuth, hasUatSession };
