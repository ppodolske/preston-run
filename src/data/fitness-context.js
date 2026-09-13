function requireUserId(userId){if(!userId)throw new Error('Authenticated user is required');}
function throwIf(result){if(result.error)throw result.error;return result.data;}
function requireObject(value,label){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} is required`);}
function requireText(value,label){const text=String(value||'').trim();if(!text)throw new Error(`${label} is required`);return text;}

const CONTEXT_COLUMNS='user_id,payload,source_generated_at,garmin_sync_at,fetched_at,updated_at';
const DIGEST_COLUMNS='id,user_id,digest_date,schema_version,source_generated_at,garmin_sync_at,status,headline,cards,bullets,generated_at';

async function getFitnessContext(supabase,userId){
  requireUserId(userId);
  const r=await supabase.from('fitness_context_cache').select(CONTEXT_COLUMNS).eq('user_id',userId).maybeSingle();
  return throwIf(r)||null;
}

async function upsertFitnessContext(supabase,userId,input={}){
  requireUserId(userId);
  requireObject(input.payload,'payload');
  const fetchedAt=requireText(input.fetchedAt,'fetchedAt');
  const payload={
    user_id:userId,
    payload:input.payload,
    source_generated_at:input.sourceGeneratedAt||null,
    garmin_sync_at:input.garminSyncAt||null,
    fetched_at:fetchedAt,
    updated_at:fetchedAt
  };
  const r=await supabase.from('fitness_context_cache').upsert(payload,{onConflict:'user_id'}).select(CONTEXT_COLUMNS).single();
  return throwIf(r);
}

async function getMorningDigest(supabase,userId,dateKey){
  requireUserId(userId);
  const digestDate=requireText(dateKey,'digest date');
  const r=await supabase.from('morning_digests').select(DIGEST_COLUMNS).eq('user_id',userId).eq('digest_date',digestDate).maybeSingle();
  return throwIf(r)||null;
}

async function upsertMorningDigest(supabase,userId,digest={}){
  requireUserId(userId);
  const digestDate=requireText(digest.date,'digest date');
  const status=requireText(digest.status,'status');
  const headline=requireText(digest.headline,'headline');
  const generatedAt=requireText(digest.generatedAt,'generatedAt');
  const payload={
    user_id:userId,
    digest_date:digestDate,
    schema_version:Number.isFinite(Number(digest.schemaVersion))?Number(digest.schemaVersion):1,
    source_generated_at:digest.sourceGeneratedAt||null,
    garmin_sync_at:digest.garminSyncAt||null,
    status,
    headline,
    cards:Array.isArray(digest.cards)?digest.cards:[],
    bullets:Array.isArray(digest.bullets)?digest.bullets:[],
    generated_at:generatedAt
  };
  const r=await supabase.from('morning_digests').upsert(payload,{onConflict:'user_id,digest_date'}).select(DIGEST_COLUMNS).single();
  return throwIf(r);
}

module.exports={getFitnessContext,upsertFitnessContext,getMorningDigest,upsertMorningDigest};
