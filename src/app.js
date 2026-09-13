const { serveStatic } = require('./http/static');
const { createRequestSupabase } = require('./auth/supabase');
const { handleAuthRoute } = require('./routes/auth');
const { handlePeopleRoute } = require('./routes/people');
const { handleLifeAdminRoute } = require('./routes/life-admin');
const { handleTripsRoute } = require('./routes/trips');
const { handleReminderOverrideRoute } = require('./routes/reminder-overrides');
const { handleNotificationsRoute } = require('./routes/notifications');
const { handleCalendarsRoute } = require('./routes/calendars');
const { handleGmailRoute } = require('./routes/gmail');
const { handleSiteRoute } = require('./routes/site');
const { text } = require('./http/respond');

function createApp(config, dependencies = {}) {
  const createSupabase = dependencies.createRequestSupabase || createRequestSupabase;
  return async function app(req, res) {
    let url;
    try { url = new URL(req.url, config.siteUrl); } catch { return text(res, 400, 'Bad request'); }
    if (serveStatic(req, res, url.pathname)) return;
    const supabase = createSupabase(req, res, config);
    const context = { config, supabase, calendarDeps: dependencies.calendarDeps, gmailDeps: dependencies.gmailDeps };
    if (await handleAuthRoute(req, res, context)) return;
    if (await handlePeopleRoute(req, res, context)) return;
    if (await handleLifeAdminRoute(req, res, context)) return;
    if (await handleTripsRoute(req, res, context)) return;
    if (await handleReminderOverrideRoute(req, res, context)) return;
    if (await handleNotificationsRoute(req, res, context)) return;
    if (await handleCalendarsRoute(req, res, context)) return;
    if (await handleGmailRoute(req, res, context)) return;
    if (await handleSiteRoute(req, res, context)) return;
    text(res, 404, 'Not found', {'cache-control':'no-store'});
  };
}
module.exports = { createApp };
