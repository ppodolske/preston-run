function required(env, key) {
  const value = env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1) throw new Error('PORT must be a positive integer');
  const siteUrl = required(env, 'SITE_URL').replace(/\/$/, '');
  const doseScaleContextUrl = String(env.DOSE_SCALE_CONTEXT_URL || '').trim().replace(/\/$/, '');
  const doseScaleServiceToken = String(env.DOSE_SCALE_SERVICE_TOKEN || '');
  return {
    port,
    nodeEnv: env.NODE_ENV || 'development',
    siteUrl,
    supabaseUrl: required(env, 'SUPABASE_URL'),
    supabasePublishableKey: required(env, 'SUPABASE_PUBLISHABLE_KEY'),
    ownerGoogleEmail: required(env, 'OWNER_GOOGLE_EMAIL').trim().toLowerCase(),
    vapidPublicKey: required(env, 'VAPID_PUBLIC_KEY'),
    googleCalendarClientId: required(env, 'GOOGLE_CALENDAR_CLIENT_ID'),
    googleCalendarClientSecret: required(env, 'GOOGLE_CALENDAR_CLIENT_SECRET'),
    calendarCredentialKey: required(env, 'CALENDAR_CREDENTIAL_KEY'),
    doseScaleContextUrl,
    doseScaleServiceToken,
    isProduction: (env.NODE_ENV || 'development') === 'production'
  };
}

module.exports = { loadConfig };
