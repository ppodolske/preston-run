const { createServerClient } = require('@supabase/ssr');
const { parseCookies, serializeCookie } = require('../http/cookies');

function appendSetCookie(res, values) {
  const current = res.getHeader ? res.getHeader('Set-Cookie') : undefined;
  const existing = current ? (Array.isArray(current) ? current : [current]) : [];
  const next = existing.concat(values);
  if (res.setHeader) res.setHeader('Set-Cookie', next);
}

function createRequestSupabase(req, res, config) {
  const cookies = {
    getAll() {
      return Object.entries(parseCookies(req.headers && req.headers.cookie || '')).map(([name, value]) => ({ name, value }));
    },
    setAll(cookiesToSet) {
      const values = cookiesToSet.map(({ name, value, options = {} }) => serializeCookie(name, value, {
        ...options,
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        secure: config.isProduction
      }));
      appendSetCookie(res, values);
    }
  };
  return createServerClient(config.supabaseUrl, config.supabasePublishableKey, { cookies });
}

module.exports = { createRequestSupabase, appendSetCookie };
