async function getAuthorizedOwner(supabase, config) {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { user:null, reason:'auth_error' };
  if (!data || !data.user) return { user:null, reason:'signed_out' };
  const email = (data.user.email || '').trim().toLowerCase();
  if (email !== config.ownerGoogleEmail) return { user:null, reason:'not_owner' };
  return { user:data.user, reason:null };
}
module.exports = { getAuthorizedOwner };
