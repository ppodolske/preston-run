function throwIfError(error){if(error)throw error;}
function nowIso(){return new Date().toISOString();}

async function findGmailSourceRecord(supabase,userId,accountEmail,messageId){
  const {data,error}=await supabase.from('gmail_source_records').select('*').eq('user_id',userId).eq('gmail_account_email',accountEmail).eq('gmail_message_id',messageId).maybeSingle();
  throwIfError(error);
  return data||null;
}

async function upsertGmailSourceRecord(supabase,userId,connectionId,scanRunId,normalized){
  const row={...normalized,user_id:userId,connection_id:connectionId,scan_run_id:scanRunId,updated_at:nowIso()};
  const {data,error}=await supabase.from('gmail_source_records').upsert(row,{onConflict:'user_id,gmail_account_email,gmail_message_id'}).select('*').single();
  throwIfError(error);
  return data;
}

async function updateGmailSourceStatus(supabase,userId,sourceRecordId,status,reason=null){
  const {data,error}=await supabase.from('gmail_source_records').update({processing_status:status,processing_reason:reason,updated_at:nowIso()}).eq('user_id',userId).eq('id',sourceRecordId).select('*').single();
  throwIfError(error);
  return data;
}

async function upsertGmailAttachmentRecord(supabase,userId,sourceRecordId,attachment){
  const row={
    user_id:userId,
    source_record_id:sourceRecordId,
    gmail_attachment_id:attachment.gmailAttachmentId,
    filename:attachment.filename||null,
    mime_type:attachment.mimeType||null,
    source_link:attachment.sourceLink||null,
    processing_status:attachment.processingStatus||'pending',
    processing_reason:attachment.processingReason||null,
    updated_at:nowIso()
  };
  const {data,error}=await supabase.from('gmail_attachment_records').upsert(row,{onConflict:'source_record_id,gmail_attachment_id'}).select('*').single();
  throwIfError(error);
  return data;
}

async function updateGmailAttachmentStatus(supabase,userId,attachmentRecordId,status,reason=null){
  const {data,error}=await supabase.from('gmail_attachment_records').update({processing_status:status,processing_reason:reason,updated_at:nowIso()}).eq('user_id',userId).eq('id',attachmentRecordId).select('*').single();
  throwIfError(error);
  return data;
}

async function insertExtractedFacts(supabase,userId,facts){
  if(!facts.length)return [];
  const rows=facts.map(f=>({...f,user_id:userId}));
  const {data,error}=await supabase.from('gmail_extracted_facts').insert(rows).select('*');
  throwIfError(error);
  return data||[];
}

async function recordGmailActivity(supabase,userId,entry){
  const row={
    user_id:userId,
    source_record_id:entry.sourceRecordId||null,
    fact_id:entry.factId||null,
    entity_type:entry.entityType,
    entity_id:entry.entityId||null,
    field_name:entry.fieldName||null,
    old_value:entry.oldValue??null,
    new_value:entry.newValue??null,
    action:entry.action,
    automatic:entry.automatic!==false,
    manual_authority:entry.manualAuthority===true,
    rule_version:entry.ruleVersion
  };
  const {data,error}=await supabase.from('gmail_activity_entries').insert(row).select('*').single();
  throwIfError(error);
  return data;
}

async function undoGmailActivity(supabase,userId,activityId,{restoreField}={}){
  const found=await supabase.from('gmail_activity_entries').select('*').eq('user_id',userId).eq('id',activityId).maybeSingle();
  throwIfError(found.error);
  const activity=found.data;
  if(!activity)return null;
  let restored=false;
  if(typeof restoreField==='function'&&activity.entity_type&&activity.entity_id&&activity.field_name){
    restored=await restoreField({entityType:activity.entity_type,entityId:activity.entity_id,fieldName:activity.field_name,value:activity.old_value,activity});
  }
  return recordGmailActivity(supabase,userId,{
    sourceRecordId:activity.source_record_id,
    factId:activity.fact_id,
    entityType:activity.entity_type,
    entityId:activity.entity_id,
    fieldName:activity.field_name,
    oldValue:activity.new_value,
    newValue:activity.old_value,
    action:restored||!restoreField?'undo':'skip',
    automatic:false,
    manualAuthority:Boolean(restored||!restoreField),
    ruleVersion:'gmail-undo-v0.12.0'
  });
}

module.exports={findGmailSourceRecord,upsertGmailSourceRecord,updateGmailSourceStatus,upsertGmailAttachmentRecord,updateGmailAttachmentStatus,insertExtractedFacts,recordGmailActivity,undoGmailActivity};
