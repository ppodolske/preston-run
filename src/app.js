const { serveStatic } = require('./http/static');
const { createRequestSupabase } = require('./auth/supabase');
const { createBackgroundSupabaseClient } = require('./auth/background-supabase');
const { handleUatAuth } = require('./auth/uat-basic');
const { handleAuthRoute } = require('./routes/auth');
const { handlePeopleRoute } = require('./routes/people');
const { handleLifeAdminRoute } = require('./routes/life-admin');
const { handleBookingsRoute } = require('./routes/bookings');
const { handleTripsRoute } = require('./routes/trips');
const { handleReminderOverrideRoute } = require('./routes/reminder-overrides');
const { handleNotificationsRoute } = require('./routes/notifications');
const { handleCalendarsRoute } = require('./routes/calendars');
const { handleGmailRoute } = require('./routes/gmail');
const { handleSiteRoute } = require('./routes/site');
const { text } = require('./http/respond');
const { createGmailOAuth } = require('./services/gmail-oauth');
const { startManualGmailScan } = require('./services/gmail-manual-scan');
const { upsertGmailConnection, getGmailConnection, markGmailDisconnected } = require('./data/gmail-connections');
const { encryptCredential, decodeCredentialKey } = require('./security/credential-crypto');

function createGmailDeps(config, overrides = {}) {
  const {
    createBackgroundSupabaseClient: backgroundFactoryOverride,
    startManualGmailScan: scanStarterOverride,
    supabaseServiceRoleKey: serviceRoleKeyOverride,
    ...publicOverrides
  } = overrides;
  const key = () => decodeCredentialKey(config.calendarCredentialKey);
  const backgroundFactory = backgroundFactoryOverride || createBackgroundSupabaseClient;
  const scanStarter = scanStarterOverride || startManualGmailScan;
  const serviceRoleKey = String(serviceRoleKeyOverride || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const productionDeps = {
    googleOAuth: createGmailOAuth(config),
    getGmailConnection,
    markGmailDisconnected,
    upsertGmailConnection,
    encryptAccessToken(value) { return encryptCredential({ accessToken:value }, key()); },
    encryptRefreshToken(value) { return encryptCredential({ refreshToken:value }, key()); },
    startScanNow(_requestSupabase, userId) {
      if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Gmail background scans');
      const backgroundSupabase = backgroundFactory({ supabaseUrl:config.supabaseUrl, serviceRoleKey });
      return scanStarter(backgroundSupabase, userId, config);
    }
  };
  return { ...productionDeps, ...publicOverrides };
}

function createApp(config, dependencies = {}) {
  const createSupabase = dependencies.createRequestSupabase || createRequestSupabase;
  return async function app(req, res) {
    let url;
    try { url = new URL(req.url, config.siteUrl); } catch { return text(res, 400, 'Bad request'); }
    if (await handleUatAuth(req, res, url, config)) return;
    if (serveStatic(req, res, url.pathname)) return;
    const supabase = createSupabase(req, res, config);
    const context = { config, supabase, calendarDeps: dependencies.calendarDeps, gmailDeps: createGmailDeps(config, dependencies.gmailDeps || {}) };
    if (await handleAuthRoute(req, res, context)) return;
    if (await handlePeopleRoute(req, res, context)) return;
    if (await handleLifeAdminRoute(req, res, context)) return;
    if (await handleBookingsRoute(req, res, context)) return;
    if (await handleTripsRoute(req, res, context)) return;
    if (await handleReminderOverrideRoute(req, res, context)) return;
    if (await handleNotificationsRoute(req, res, context)) return;
    if (await handleCalendarsRoute(req, res, context)) return;
    if (await handleGmailRoute(req, res, context)) return;
    if (await handleSiteRoute(req, res, context)) return;
    text(res, 404, 'Not found', {'cache-control':'no-store'});
  };
}
module.exports = { createApp, createGmailDeps };
