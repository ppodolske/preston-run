function optionalText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function payload(input = {}) {
  return {
    title:String(input.title ?? '').trim(),
    category:input.category,
    status:input.status,
    due_at:input.due_at || null,
    starts_at:input.starts_at || null,
    recurrence_rule:optionalText(input.recurrence_rule),
    priority:input.priority || 'normal',
    notes:optionalText(input.notes),
    linked_person_id:optionalText(input.linked_person_id)
  };
}

function gmailSourceMetadata(input={}){
  const metadata={
    source:'gmail',
    source_record_id:optionalText(input.source_record_id),
    gmail_message_id:optionalText(input.gmail_message_id),
    source_link:optionalText(input.source_link),
    sender:optionalText(input.sender),
    classification_reason:optionalText(input.classification_reason)
  };
  const threadId=optionalText(input.gmail_thread_id);
  if(threadId)metadata.gmail_thread_id=threadId;
  return metadata;
}

async function listLifeItems(supabase) {
  const result = await supabase.from('life_items').select('*').order('due_at',{ascending:true,nullsFirst:false}).order('title',{ascending:true});
  if (result.error) throw result.error;
  return result.data || [];
}

async function getLifeItem(supabase,id) {
  const result = await supabase.from('life_items').select('*').eq('id',id).maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

async function createLifeItem(supabase,user,input) {
  if (!user || !user.id) throw new Error('Authenticated user is required');
  const result = await supabase.from('life_items').insert({...payload(input),user_id:user.id,source_metadata:{source:'manual'}}).select('*').single();
  if (result.error) throw result.error;
  return result.data;
}

async function findGmailLifeItem(supabase,user,sourceMetadata={}){
  if (!user || !user.id) throw new Error('Authenticated user is required');
  const metadata=gmailSourceMetadata(sourceMetadata);
  const identity=metadata.gmail_thread_id?['gmail_thread_id',metadata.gmail_thread_id]:metadata.source_record_id?['source_record_id',metadata.source_record_id]:null;
  if(!identity)return null;
  let query=supabase.from('life_items').select('*').eq('user_id',user.id).eq('source_metadata->>source','gmail').eq(`source_metadata->>${identity[0]}`,identity[1]);
  if(typeof query.limit==='function')query=query.limit(1);
  const result=await query.maybeSingle();
  if(result.error)throw result.error;
  return result.data||null;
}

async function createGmailLifeItem(supabase,user,input,sourceMetadata={}){
  if (!user || !user.id) throw new Error('Authenticated user is required');
  const result=await supabase.from('life_items').insert({...payload(input),user_id:user.id,source_metadata:gmailSourceMetadata(sourceMetadata)}).select('*').single();
  if(result.error)throw result.error;
  return result.data;
}

async function ensureGmailLifeItem(supabase,user,input,sourceMetadata={}){
  const existing=await findGmailLifeItem(supabase,user,sourceMetadata);
  if(existing)return {item:existing,created:false};
  try{
    return {item:await createGmailLifeItem(supabase,user,input,sourceMetadata),created:true};
  }catch(error){
    if(String(error&&error.code||'')!=='23505')throw error;
    const raced=await findGmailLifeItem(supabase,user,sourceMetadata);
    if(!raced)throw error;
    return {item:raced,created:false};
  }
}

async function updateLifeItem(supabase,user,id,input) {
  if (!user || !user.id) throw new Error('Authenticated user is required');
  const result = await supabase.from('life_items').update({...payload(input),updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id).select('*').maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

async function deleteLifeItem(supabase,user,id) {
  if (!user || !user.id) throw new Error('Authenticated user is required');
  const result = await supabase.from('life_items').delete().eq('id',id).eq('user_id',user.id).select('id').maybeSingle();
  if (result.error) throw result.error;
  return Boolean(result.data);
}

module.exports={listLifeItems,getLifeItem,createLifeItem,createGmailLifeItem,findGmailLifeItem,ensureGmailLifeItem,updateLifeItem,deleteLifeItem,payload,gmailSourceMetadata};
