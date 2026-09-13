function throwIfError(error){if(error)throw error;}
function nowIso(){return new Date().toISOString();}

async function getGmailConnection(supabase,userId){
  const {data,error}=await supabase.from('gmail_connections').select('*').eq('user_id',userId).maybeSingle();
  throwIfError(error);
  return data||null;
}

async function upsertGmailConnection(supabase,userId,input){
  const row={
    user_id:userId,
    gmail_account_email:input.gmailAccountEmail,
    google_subject:input.googleSubject||null,
    access_token_ciphertext:input.accessTokenCiphertext||null,
    refresh_token_ciphertext:input.refreshTokenCiphertext||null,
    scope:input.scope||'',
    status:'connected',
    last_error:null,
    updated_at:nowIso()
  };
  const {data,error}=await supabase.from('gmail_connections').upsert(row,{onConflict:'user_id,gmail_account_email'}).select('*').single();
  throwIfError(error);
  return data;
}

async function markGmailDisconnected(supabase,userId,connectionId){
  const patch={status:'disconnected',updated_at:nowIso()};
  const {data,error}=await supabase.from('gmail_connections').update(patch).eq('user_id',userId).eq('id',connectionId).select('*').single();
  throwIfError(error);
  return data;
}

async function updateGmailConnectionStatus(supabase,userId,connectionId,statusPatch){
  const patch={updated_at:nowIso()};
  if(statusPatch.status)patch.status=statusPatch.status;
  if(Object.hasOwn(statusPatch,'lastError'))patch.last_error=statusPatch.lastError;
  if(statusPatch.lastSuccessfulScanAt)patch.last_successful_scan_at=statusPatch.lastSuccessfulScanAt;
  if(statusPatch.lastAttemptedScanAt)patch.last_attempted_scan_at=statusPatch.lastAttemptedScanAt;
  if(statusPatch.firstScanCompletedAt)patch.first_scan_completed_at=statusPatch.firstScanCompletedAt;
  if(statusPatch.checkpointReceivedAt)patch.checkpoint_received_at=statusPatch.checkpointReceivedAt;
  if(statusPatch.checkpointMessageId)patch.checkpoint_message_id=statusPatch.checkpointMessageId;
  const {data,error}=await supabase.from('gmail_connections').update(patch).eq('user_id',userId).eq('id',connectionId).select('*').single();
  throwIfError(error);
  return data;
}

module.exports={getGmailConnection,upsertGmailConnection,markGmailDisconnected,updateGmailConnectionStatus};
