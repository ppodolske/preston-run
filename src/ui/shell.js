'use strict';

const { PRODUCT_NAME, VERSION } = require('../branding');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderShell({ title = PRODUCT_NAME, body = '', activeNav = '', wide = false, headExtra = '', scripts = [] } = {}) {
  const pageTitle = title === PRODUCT_NAME ? PRODUCT_NAME : `${escapeHtml(title)} · ${PRODUCT_NAME}`;
  const scriptTags = (Array.isArray(scripts) ? scripts : []).map(src => `<script src="${escapeHtml(src)}" defer></script>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#162a4c"><meta name="robots" content="noindex,nofollow"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icons/favicon-32.png" type="image/png"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><link rel="stylesheet" href="/preston.css"><title>${pageTitle}</title>${headExtra || ''}</head><body><a class="skip-link" href="#main-content">Skip to content</a><div class="site-shell"><header class="site-header"><a class="site-brand" href="/" aria-label="preston.ai home"><img src="/assets/preston-ai-logo.png" alt="preston.ai"></a><nav class="site-nav" aria-label="Primary">${activeNav ? `<span class="site-nav-current">${escapeHtml(activeNav)}</span>` : ''}<a href="/">Home</a><a href="/me/settings/gmail">Gmail</a></nav></header><main id="main-content" class="site-main${wide ? ' site-main-wide' : ''}">${body}</main><footer class="site-footer">${PRODUCT_NAME} · v${VERSION}</footer></div>${scriptTags}</body></html>`;
}

module.exports = { renderShell, escapeHtml };
