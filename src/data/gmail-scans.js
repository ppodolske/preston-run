function throwIfError(error){if(error)throw error;}
function nowIso(){return new Date().toISOString();}

function scanProgressPatch(input={}){
  const map={
    discoveredCount:'discovered_count',
    processedCount:'processed_count',
    ignoredCount:'ignored_count',
    relevantCount:'relevant_count',
    tripCount:'trip_count',
    lifeAdminCount:'life_admin_count',
    factsCreatedCount:'facts_created_count',
    recordsCreatedCount:'records_created_count',
    recordsUpdatedCount:'records_updated_count',
    reviewItemsCreatedCount:'review_items_created_count',
    pdfUnreadableCount:'pdf_unreadable_count'
  };
  const patch={};
  for(const [from,to] of Object.entries(map)){
    if(Object.hasOwn(input,from))patch[to]=input[from];
  }
  return patch;
}

async function startGmailScanRun(supabase,userId,connection,scanType,options={}){
  const row={
    user_id:userId,
    connection_id:connection.id,
    scan_type:scanType,
    status:'running',
    scanner_version:options.scannerVersion,
    lookback_start_at:options.lookbackStartAt||null,
    checkpoint_before_at:connection.checkpoint_received_at||null
  };
  const {data,error}=await supabase.from('gmail_scan_runs').insert(row).select('*').single();
  throwIfError(error);
  return data;
}

async function updateGmailScanProgress(supabase,userId,scanRunId,patch){
  const dbPatch=scanProgressPatch(patch);
  const {data,error}=await supabase.from('gmail_scan_runs').update(dbPatch).eq('user_id',userId).eq('id',scanRunId).select('*').single();
  throwIfError(error);
  return data;
}

async function finishGmailScanRun(supabase,userId,connectionId,scanRunId,result={}){
  const finishedAt=nowIso();
  const {data,error}=await supabase.from('gmail_scan_runs').update({
    status:'succeeded',
    finished_at:finishedAt,
    checkpoint_after_at:result.checkpointReceivedAt||null,
    error_summary:null
  }).eq('user_id',userId).eq('id',scanRunId).select('*').single();
  throwIfError(error);
  const connectionPatch={
    status:'connected',
    last_successful_scan_at:finishedAt,
    last_attempted_scan_at:finishedAt,
    last_error:null,
    updated_at:finishedAt
  };
  if(result.checkpointReceivedAt)connectionPatch.checkpoint_received_at=result.checkpointReceivedAt;
  if(result.checkpointMessageId)connectionPatch.checkpoint_message_id=result.checkpointMessageId;
  if(result.firstScanCompleted)connectionPatch.first_scan_completed_at=finishedAt;
  const conn=await supabase.from('gmail_connections').update(connectionPatch).eq('user_id',userId).eq('id',connectionId).select('*').single();
  throwIfError(conn.error);
  return data;
}

async function failGmailScanRun(supabase,userId,connectionId,scanRunId,errorSummary){
  const finishedAt=nowIso();
  const {data,error}=await supabase.from('gmail_scan_runs').update({status:'failed',finished_at:finishedAt,error_summary:errorSummary}).eq('user_id',userId).eq('id',scanRunId).select('*').single();
  throwIfError(error);
  const conn=await supabase.from('gmail_connections').update({status:'degraded',last_attempted_scan_at:finishedAt,last_error:errorSummary,updated_at:finishedAt}).eq('user_id',userId).eq('id',connectionId).select('*').single();
  throwIfError(conn.error);
  return data;
}

module.exports={startGmailScanRun,updateGmailScanProgress,finishGmailScanRun,failGmailScanRun,scanProgressPatch};
