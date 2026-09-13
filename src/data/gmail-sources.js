function throwIfError(error){if(error)throw error;}
function nowIso(){return new Date().toISOString();}

async function upsertGmailSourceRecord(supabase,userId,connectionId,scanRunId,normalized){
  const row={...normalized,user_id:userId,connection_id:connectionId,scan_run_id:scanRunId,updated_at:nowIso()};
  const {data,error}=await supabase.from('gmail_source_records').upsert(row,{onConflict:'user_id,gmail_account_email,gmail_message_id'}).select('*').single();
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

async function insertExtractedFacts(supabase,userId,facts){
  if(!facts.length)return [];
  const rows=facts.map(f=>({...f,user_id:userId}));
  const {data,error}=await supabase.from('gmail_extracted_facts').insert(rows).select('*');
  throwIfError(error);
  return data||[];
}

module.exports={upsertGmailSourceRecord,upsertGmailAttachmentRecord,insertExtractedFacts};
