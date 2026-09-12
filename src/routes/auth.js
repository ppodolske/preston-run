const { redirect, html } = require('../http/respond');
const { getAuthorizedOwner } = require('../auth/guard');

async function handleAuthRoute(req, res, context) {
  const { supabase, config } = context;
  let url;
  try { url = new URL(req.url, config.siteUrl); } catch { return false; }

  if (req.method === 'GET' && url.pathname === '/auth/google') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${config.siteUrl}/auth/callback` }
    });
    if (error || !data || !data.url) { redirect(res, '/?auth_error=1'); return true; }
    redirect(res, data.url); return true;
  }

  if (req.method === 'GET' && url.pathname === '/auth/callback') {
    const code = url.searchParams.get('code');
    if (!code) { redirect(res, '/?auth_error=1'); return true; }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) { redirect(res, '/?auth_error=1'); return true; }
    const auth = await getAuthorizedOwner(supabase, config);
    if (auth.user) { redirect(res, '/'); return true; }
    await supabase.auth.signOut();
    redirect(res, auth.reason === 'not_owner' ? '/auth/denied' : '/?auth_error=1'); return true;
  }

  if (req.method === 'POST' && url.pathname === '/auth/logout') {
    await supabase.auth.signOut();
    redirect(res, '/'); return true;
  }

  if (req.method === 'GET' && url.pathname === '/auth/denied') {
    html(res, 403, '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Access denied · preston.ai</title></head><body><main><h1>Access denied</h1><p>This Google account does not have access to preston.ai.</p><p><a href="/">Return to sign in</a></p></main></body></html>', {'cache-control':'no-store'}); return true;
  }

  return false;
}

module.exports = { handleAuthRoute };
