async function ensureProfile(supabase, user) {
  if (!user || !user.id) throw new Error('Authenticated user is required');
  const existing = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const displayName = String(user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name) || '').trim() || null;
  const inserted = await supabase.from('profiles').insert({
    user_id: user.id,
    display_name: displayName,
    timezone: 'Australia/Sydney'
  }).select('*').single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

module.exports = { ensureProfile };
