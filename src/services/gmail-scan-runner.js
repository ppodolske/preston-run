const {buildEligibleMessagesQuery}=require('./gmail-provider');
const {isEligibleReceivedMessage}=require('../domain/gmail-eligibility');
const {normalizeGmailMessage}=require('../domain/gmail-normalize');
const {extractTripFacts}=require('../domain/gmail-trip-extractor');

function ymd(date){return date.toISOString().slice(0,10).replaceAll('-','/');}
function addMonths(date,months){const d=new Date(date);d.setUTCMonth(d.getUTCMonth()+months);return d;}
function determineScanWindow(connection,now=new Date(),lookbackMonths=12){
  if(!connection.first_scan_completed_at){
    const after=addMonths(now,-lookbackMonths);
    return {scanType:'initial',after:ymd(after),before:ymd(addMonths(now,0))};
  }
  const checkpoint=connection.checkpoint_received_at?new Date(connection.checkpoint_received_at):addMonths(now,-lookbackMonths);
  return {scanType:'manual_incremental',after:ymd(checkpoint),before:ymd(addMonths(now,0))};
}

async function runGmailScan({supabase,userId,connection,provider,config,existingTrips=[],persistence}){
  void existingTrips;
  const window=determineScanWindow(connection,new Date(),config.initialLookbackMonths);
  const query=buildEligibleMessagesQuery(window);
  const scan=await persistence.startScan(supabase,userId,connection,window.scanType,{scannerVersion:config.scannerVersion,lookbackStartAt:window.after});
  let newest=null;
  try{
    const listed=await provider.listMessages(query,null);
    const messages=listed.messages||[];
    for(const ref of messages){
      const message=await provider.getMessage(ref.id);
      if(!isEligibleReceivedMessage(message))continue;
      const normalized=normalizeGmailMessage(message,connection.gmail_account_email,config.scannerVersion);
      const source=await persistence.upsertSource(normalized,scan.id);
      newest=newest||normalized;
      const facts=extractTripFacts({sourceRecordId:source.id,sender:normalized.sender,subject:normalized.subject,receivedAt:normalized.received_at,text:message.snippet||''},{parserVersion:config.parserVersion});
      await persistence.insertFacts(facts);
    }
    await persistence.finishScan(supabase,userId,connection.id,scan.id,{checkpointReceivedAt:newest&&newest.received_at,checkpointMessageId:newest&&newest.gmail_message_id,firstScanCompleted:window.scanType==='initial'});
    return {status:'succeeded',processedCount:messages.length};
  }catch(error){
    await persistence.failScan(supabase,userId,connection.id,scan.id,String(error.message||error));
    return {status:'failed',error:String(error.message||error)};
  }
}

module.exports={determineScanWindow,runGmailScan,ymd};
