'use strict';

const { escapeHtml } = require('./shell');

function attrs(input = {}) {
  return Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== false).map(([key, value]) => value === true ? key : `${key}="${escapeHtml(value)}"`).join(' ');
}

function fieldWrap({ id, label, control, help = '' }) {
  return `<div class="field"><label for="${escapeHtml(id)}">${escapeHtml(label)}</label>${control}${help ? `<small>${escapeHtml(help)}</small>` : ''}</div>`;
}

function textField({ name, label, value = '', id = name, type = 'text', required = false, maxlength, minlength, placeholder, autocomplete, inputmode, min, max, help = '' } = {}) {
  const control = `<input ${attrs({ id, name, type, value, required, maxlength, minlength, placeholder, autocomplete, inputmode, min, max })}>`;
  return fieldWrap({ id, label, control, help });
}

function dateField(options = {}) {
  return textField({ ...options, type: 'date' });
}

function textareaField({ name, label, value = '', id = name, required = false, maxlength, placeholder, rows, help = '' } = {}) {
  const control = `<textarea ${attrs({ id, name, required, maxlength, placeholder, rows })}>${escapeHtml(value)}</textarea>`;
  return fieldWrap({ id, label, control, help });
}

function selectField({ name, label, value = '', id = name, options = [], required = false, help = '' } = {}) {
  const rendered = options.map(option => {
    const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
    return `<option value="${escapeHtml(optionValue)}"${String(optionValue) === String(value) ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`;
  }).join('');
  const control = `<select ${attrs({ id, name, required })}>${rendered}</select>`;
  return fieldWrap({ id, label, control, help });
}

module.exports = { textField, selectField, dateField, textareaField };
