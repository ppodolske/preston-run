function required(env, key) {
  const value = env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1) throw new Error('PORT must be a positive integer');
  const siteUrl = required(env, 'SITE_URL').replace(/\/$/, '');
  return {
    port,
    nodeEnv: env.NODE_ENV || 'development',
    siteUrl,
    supabaseUrl: required(env, 'SUPABASE_URL'),
    supabasePublishableKey: required(env, 'SUPABASE_PUBLISHABLE_KEY'),
    ownerGoogleEmail: required(env, 'OWNER_GOOGLE_EMAIL').trim().toLowerCase(),
    isProduction: (env.NODE_ENV || 'development') === 'production'
  };
}

module.exports = { loadConfig };
