const { getAuthorizedOwner } = require('../auth/guard');
const { listPeople, getPerson, createPerson, updatePerson, deletePerson } = require('../data/people');
const { validateBirthdayParts, getUpcomingBirthdays, todayInTimeZone } = require('../domain/birthdays');
const { readForm, isSameOriginRequest } = require('../http/forms');
const { html, redirect, text } = require('../http/respond');
const { renderPeoplePage, renderPersonFormPage } = require('../pages/people');

function rawPersonFromForm(form, id = undefined) {
  return {
    ...(id ? { id } : {}),
    name: form.get('name') || '',
    relationship: form.get('relationship') || '',
    birthday_month: form.get('birthday_month') || '',
    birthday_day: form.get('birthday_day') || '',
    birth_year: form.get('birth_year') || '',
    notes: form.get('notes') || '',
    active: form.get('active') === '1'
  };
}

function validatedPersonFromForm(form) {
  const name = String(form.get('name') || '').trim();
  if (!name) throw new Error('Name is required');
  if (name.length > 200) throw new Error('Name must be 200 characters or fewer');
  const birthday = validateBirthdayParts({
    month:form.get('birthday_month'),
    day:form.get('birthday_day'),
    year:form.get('birth_year')
  });
  return {
    name,
    relationship:String(form.get('relationship') || '').trim() || null,
    ...birthday,
    notes:String(form.get('notes') || '').trim() || null,
    active:form.get('active') === '1'
  };
}

async function ownerForRoute(supabase, config, res) {
  const auth = await getAuthorizedOwner(supabase, config);
  if (auth.user) return auth.user;
  if (auth.reason === 'not_owner') await supabase.auth.signOut();
  redirect(res, '/');
  return null;
}

function flashMessage(url) {
  if (url.searchParams.get('created')) return 'Person added.';
  if (url.searchParams.get('saved')) return 'Changes saved.';
  if (url.searchParams.get('deleted')) return 'Person deleted.';
  return null;
}

async function handlePeopleRoute(req, res, context) {
  const { supabase, config } = context;
  let url;
  try { url = new URL(req.url, config.siteUrl); } catch { return false; }
  if (!(url.pathname === '/people' || url.pathname === '/people/new' || /^\/people\/[^/]+(?:\/edit|\/delete)?$/.test(url.pathname))) return false;

  const user = await ownerForRoute(supabase, config, res);
  if (!user) return true;

  if (req.method === 'GET' && url.pathname === '/people') {
    try {
      const people = await listPeople(supabase);
      const upcoming = getUpcomingBirthdays(people, todayInTimeZone('Australia/Sydney'), 90);
      html(res, 200, renderPeoplePage({people, upcoming, flash:flashMessage(url)}), {'cache-control':'private, no-store'});
    } catch {
      html(res, 500, renderPeoplePage({people:[], upcoming:[], flash:'People are temporarily unavailable.'}), {'cache-control':'private, no-store'});
    }
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/people/new') {
    html(res, 200, renderPersonFormPage({person:{active:true}, mode:'create'}), {'cache-control':'private, no-store'});
    return true;
  }

  const editMatch = url.pathname.match(/^\/people\/([^/]+)\/edit$/);
  if (req.method === 'GET' && editMatch) {
    let person;
    try { person = await getPerson(supabase, decodeURIComponent(editMatch[1])); } catch { person = null; }
    if (!person) { text(res, 404, 'Not found', {'cache-control':'no-store'}); return true; }
    html(res, 200, renderPersonFormPage({person, mode:'edit'}), {'cache-control':'private, no-store'});
    return true;
  }

  if (req.method === 'POST') {
    if (!isSameOriginRequest(req, config)) { text(res, 403, 'Forbidden', {'cache-control':'no-store'}); return true; }
    let form;
    try { form = await readForm(req); }
    catch (error) { text(res, error.statusCode || 400, 'Invalid form request', {'cache-control':'no-store'}); return true; }

    if (url.pathname === '/people') {
      try {
        const input = validatedPersonFromForm(form);
        await createPerson(supabase, user, input);
        redirect(res, '/people?created=1');
      } catch (error) {
        html(res, 400, renderPersonFormPage({person:rawPersonFromForm(form), mode:'create', error:error && error.message ? error.message : 'Unable to save person.'}), {'cache-control':'private, no-store'});
      }
      return true;
    }

    const deleteMatch = url.pathname.match(/^\/people\/([^/]+)\/delete$/);
    if (deleteMatch) {
      try {
        const deleted = await deletePerson(supabase, decodeURIComponent(deleteMatch[1]));
        if (!deleted) { text(res, 404, 'Not found', {'cache-control':'no-store'}); return true; }
        redirect(res, '/people?deleted=1');
      } catch { text(res, 500, 'Unable to delete person', {'cache-control':'no-store'}); }
      return true;
    }

    const updateMatch = url.pathname.match(/^\/people\/([^/]+)$/);
    if (updateMatch) {
      const id = decodeURIComponent(updateMatch[1]);
      try {
        const input = validatedPersonFromForm(form);
        const updated = await updatePerson(supabase, user, id, input);
        if (!updated) { text(res, 404, 'Not found', {'cache-control':'no-store'}); return true; }
        redirect(res, '/people?saved=1');
      } catch (error) {
        html(res, 400, renderPersonFormPage({person:rawPersonFromForm(form, id), mode:'edit', error:error && error.message ? error.message : 'Unable to save changes.'}), {'cache-control':'private, no-store'});
      }
      return true;
    }
  }

  text(res, 405, 'Method not allowed', {'cache-control':'no-store'});
  return true;
}

module.exports = { handlePeopleRoute, validatedPersonFromForm, rawPersonFromForm };
