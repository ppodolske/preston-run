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
  return {
    source:'gmail',
    source_record_id:optionalText(input.source_record_id),
    gmail_message_id:optionalText(input.gmail_message_id),
    source_link:optionalText(input.source_link),
    sender:optionalText(input.sender),
    classification_reason:optionalText(input.classification_reason)
  };
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

async function createGmailLifeItem(supabase,user,input,sourceMetadata={}){
  if (!user || !user.id) throw new Error('Authenticated user is required');
  const result=await supabase.from('life_items').insert({...payload(input),user_id:user.id,source_metadata:gmailSourceMetadata(sourceMetadata)}).select('*').single();
  if(result.error)throw result.error;
  return result.data;
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

module.exports={listLifeItems,getLifeItem,createLifeItem,createGmailLifeItem,updateLifeItem,deleteLifeItem,payload,gmailSourceMetadata};
