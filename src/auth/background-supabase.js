const {createClient}=require('@supabase/supabase-js');

function createBackgroundSupabaseClient({supabaseUrl,serviceRoleKey}){
  if(!supabaseUrl)throw new Error('SUPABASE_URL is required');
  if(!serviceRoleKey)throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  return createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}

async function resolveOwnerUserId(supabase,email){
  const wanted=String(email||'').trim().toLowerCase();
  if(!wanted)throw new Error('OWNER_GOOGLE_EMAIL is required');
  for(let page=1;page<=20;page++){
    const result=await supabase.auth.admin.listUsers({page,perPage:100});
    if(result.error)throw result.error;
    const users=result.data&&Array.isArray(result.data.users)?result.data.users:[];
    const match=users.find(user=>String(user.email||'').toLowerCase()===wanted);
    if(match)return match.id;
    if(users.length<100)break;
  }
  throw new Error('Owner account not found');
}

module.exports={createBackgroundSupabaseClient,resolveOwnerUserId};
