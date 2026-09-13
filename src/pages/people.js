'use strict';

const { renderReminderControls } = require('./reminder-controls');
const { renderShell, escapeHtml } = require('../ui/shell');
const { buttonLink, emptyState, flashMessage, card } = require('../ui/components');
const { textField, selectField, textareaField } = require('../ui/forms');

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_OPTIONS = [['', 'Month'], ...MONTHS.slice(1).map((name, index) => [String(index + 1), name])];

function birthdayLabel(person) {
  if (!person.birthday_month || !person.birthday_day) return 'Birthday not set';
  const base = `${MONTHS[person.birthday_month]} ${person.birthday_day}`;
  return person.birth_year ? `${base} · born ${person.birth_year}` : `${base} · year unknown`;
}

function renderUpcoming(upcoming) {
  if (!upcoming || !upcoming.length) return emptyState('No birthdays in the next 90 days.');
  return `<div class="upcoming">${upcoming.slice(0, 5).map(item => `<div class="upcoming-row"><div><strong>${escapeHtml(item.person.name)}</strong><div class="meta">${escapeHtml(birthdayLabel(item.person))}${item.ageTurning == null ? '' : ` · turning ${item.ageTurning}`}</div></div><div class="days">${item.daysAway === 0 ? 'Today' : item.daysAway === 1 ? 'Tomorrow' : `${item.daysAway} days`}</div></div>`).join('')}</div>`;
}

function renderPersonCard(person) {
  const state = person.active ? '' : '<span class="chip chip-inactive">Inactive</span>';
  const body = `<div class="card-head"><div><div class="name">${escapeHtml(person.name)}</div><div class="meta">${escapeHtml(person.relationship || 'Relationship not set')}<br>${escapeHtml(birthdayLabel(person))}</div></div>${state}</div>${person.notes ? `<div class="notes">${escapeHtml(person.notes)}</div>` : ''}<div class="actions">${buttonLink({ href: `/people/${encodeURIComponent(person.id)}/edit`, text: 'Edit' })}<form method="post" action="/people/${encodeURIComponent(person.id)}/delete" onsubmit="return confirm('Delete this person? This cannot be undone.')"><button class="button danger" type="submit">Delete</button></form></div>`;
  return card(body, { className: 'person-card' });
}

function renderPeoplePage({ people = [], upcoming = [], flash = null } = {}) {
  const cards = people.length
    ? `<div class="cards">${people.map(renderPersonCard).join('')}</div>`
    : emptyState('No people yet. Add someone to start tracking birthdays.');
  const body = `<div class="page-heading"><h1>People</h1><p class="sub">Birthdays and the people you want to remember.</p></div>${buttonLink({ href: '/people/new', text: 'Add person', primary: true })}${flash ? flashMessage(flash) : ''}<div class="section">Coming up</div>${renderUpcoming(upcoming)}<div class="section">Everyone</div>${cards}`;
  return renderShell({ title: 'People', activeNav: 'People', body });
}

function numberField({ name, label, value = '', min, max, placeholder = '' }) {
  return textField({ name, label, value, type: 'number', inputmode: 'numeric', min, max, placeholder });
}

function renderPersonFormPage({ person = {}, mode = 'create', error = null, reminderSettings = {}, reminderOverride = null } = {}) {
  const isEdit = mode === 'edit';
  const title = isEdit ? 'Edit person' : 'Add person';
  const action = isEdit ? `/people/${encodeURIComponent(person.id)}` : '/people';
  const reminderControls = renderReminderControls({ reminderClass: 'birthday', settings: reminderSettings, override: reminderOverride, edit: isEdit });
  const birthdayFields = `<div class="date-grid">${selectField({ name: 'birthday_month', label: 'Birthday month', value: person.birthday_month || '', options: MONTH_OPTIONS })}${numberField({ name: 'birthday_day', label: 'Birthday day', value: person.birthday_day || '', min: 1, max: 31, placeholder: 'Day' })}${numberField({ name: 'birth_year', label: 'Birth year', value: person.birth_year || '', min: 1900, max: 2200, placeholder: 'Year (optional)' })}</div>`;
  const body = `<div class="page-heading"><h1>${escapeHtml(title)}</h1><p class="sub">Birthday year is optional.</p></div>${error ? `<div class="flash flash-error" role="alert">${escapeHtml(error)}</div>` : ''}<form class="editor" method="post" action="${action}">${textField({ name: 'name', label: 'Name', value: person.name || '', required: true, maxlength: 200 })}${textField({ name: 'relationship', label: 'Relationship', value: person.relationship || '', maxlength: 200, placeholder: 'Friend, family, colleague…' })}<fieldset class="field-group"><legend>Birthday</legend>${birthdayFields}</fieldset>${textareaField({ name: 'notes', label: 'Notes', value: person.notes || '', rows: 5 })}<label class="check"><input type="checkbox" name="active" value="1" ${person.active !== false ? 'checked' : ''}> Active</label>${reminderControls}<div class="actions"><button class="button primary" type="submit">${isEdit ? 'Save changes' : 'Add person'}</button>${buttonLink({ href: '/people', text: 'Cancel' })}</div></form>`;
  return renderShell({ title, activeNav: 'People', body });
}

module.exports = { renderPeoplePage, renderPersonFormPage, escapeHtml, birthdayLabel };
