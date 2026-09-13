const assert = require('node:assert/strict');
const test = require('node:test');
const { buttonLink, statusChip, emptyState, flashMessage, card } = require('../src/ui/components');
const { textField, selectField, dateField, textareaField } = require('../src/ui/forms');

test('textField associates its label and input deterministically', () => {
  const html = textField({ name: 'title', label: 'Title', value: 'Example', required: true, maxlength: 240 });
  assert.match(html, /<label for="title">Title<\/label>\s*<input[^>]*id="title"[^>]*name="title"/);
  assert.match(html, /value="Example"/);
  assert.match(html, /required/);
});

test('selectField and textareaField associate labels with controls', () => {
  const select = selectField({ name: 'status', label: 'Status', value: 'open', options: [['open', 'Open'], ['done', 'Done']] });
  const textarea = textareaField({ name: 'notes', label: 'Notes', value: 'Hello' });
  assert.match(select, /<label for="status">Status<\/label>[\s\S]*<select[^>]*id="status"[^>]*name="status"/);
  assert.match(select, /<option value="open" selected>Open<\/option>/);
  assert.match(textarea, /<label for="notes">Notes<\/label>[\s\S]*<textarea[^>]*id="notes"[^>]*name="notes"[^>]*>Hello<\/textarea>/);
});

test('dateField emits a native date input', () => {
  const html = dateField({ name: 'due_at', label: 'Due date', value: '2026-09-14' });
  assert.match(html, /type="date"/);
  assert.match(html, /value="2026-09-14"/);
});

test('shared components escape content and expose stable classes', () => {
  assert.match(buttonLink({ href: '/x', text: 'Open', primary: true }), /class="button primary"/);
  assert.match(statusChip('needs_action'), /class="chip/);
  assert.match(emptyState('<none>'), /&lt;none&gt;/);
  assert.match(flashMessage('Saved'), /class="flash"/);
  assert.match(card('<strong>Body<\/strong>'), /class="card"/);
});
