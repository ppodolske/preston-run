'use strict';

const { escapeHtml } = require('./shell');

function label(value) {
  return String(value ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buttonLink({ href = '#', text = '', primary = false, danger = false, className = '' } = {}) {
  const classes = ['button', primary ? 'primary' : '', danger ? 'danger' : '', className].filter(Boolean).join(' ');
  return `<a class="${escapeHtml(classes)}" href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
}

function statusChip(value, { className = '' } = {}) {
  const raw = String(value ?? '');
  const classes = ['chip', raw ? `chip-${raw.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()}` : '', className].filter(Boolean).join(' ');
  return `<span class="${escapeHtml(classes)}">${escapeHtml(label(raw))}</span>`;
}

function emptyState(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

function flashMessage(text, { kind = 'success' } = {}) {
  return `<div class="flash flash-${escapeHtml(kind)}" role="status">${escapeHtml(text)}</div>`;
}

function card(body, { className = '' } = {}) {
  const classes = ['card', className].filter(Boolean).join(' ');
  return `<article class="${escapeHtml(classes)}">${body ?? ''}</article>`;
}

module.exports = { buttonLink, statusChip, emptyState, flashMessage, card, label };
