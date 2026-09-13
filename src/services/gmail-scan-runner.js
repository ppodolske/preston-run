const {buildEligibleMessagesQuery}=require('./gmail-provider');
const {isEligibleReceivedMessage}=require('../domain/gmail-eligibility');
const {normalizeGmailMessage}=require('../domain/gmail-normalize');
const {extractTripFacts}=require('../domain/gmail-trip-extractor');
const {rankTripMatch}=require('../domain/gmail-trip-matcher');
const {decideGmailTripActions}=require('../domain/gmail-decisions');

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

function defaultActions(){
  return {
    getManualFieldsForMatch:async()=>new Set(),
    applyCreateTripFromGmail:async()=>null,
    applyUpdateTripFromGmail:async()=>null,
    createGmailReviewItem:async()=>null,
    recordGmailActivity:async()=>null
  };
}

async function applyTripDecisions({actions,facts,match,source}){
  const manualFields=(await actions.getManualFieldsForMatch(match,{source,facts}))||new Set();
  const decisions=decideGmailTripActions({facts,match,manualFields});
  for(const decision of decisions){
    const enriched={...decision,sourceRecordId:source.id};
    if(decision.type==='create_trip')await actions.applyCreateTripFromGmail(enriched);
    else if(decision.type==='update_trip')await actions.applyUpdateTripFromGmail(enriched);
    else if(decision.type==='review')await actions.createGmailReviewItem(enriched);
    else await actions.recordGmailActivity({action:'skip',reason:decision.reason,sourceRecordId:source.id,entityType:'gmail_source',ruleVersion:'gmail-decision-v0.12.0'});
  }
  return decisions;
}

async function runGmailScan({supabase,userId,connection,provider,config,existingTrips=[],persistence,actions}){
  const resolvedActions={...defaultActions(),...(actions||{})};
  const window=determineScanWindow(connection,new Date(),config.initialLookbackMonths);
  const query=buildEligibleMessagesQuery(window);
  const scan=await persistence.startScan(supabase,userId,connection,window.scanType,{scannerVersion:config.scannerVersion,lookbackStartAt:window.after});
  let newest=null;
  let decisionCount=0;
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
      const insertedFacts=await persistence.insertFacts(facts);
      const persistedFacts=Array.isArray(insertedFacts)&&insertedFacts.length?insertedFacts:facts;
      const match=rankTripMatch(persistedFacts,existingTrips);
      const decisions=await applyTripDecisions({actions:resolvedActions,facts:persistedFacts,match,source});
      decisionCount+=decisions.length;
    }
    await persistence.finishScan(supabase,userId,connection.id,scan.id,{checkpointReceivedAt:newest&&newest.received_at,checkpointMessageId:newest&&newest.gmail_message_id,firstScanCompleted:window.scanType==='initial'});
    return {status:'succeeded',processedCount:messages.length,decisionCount};
  }catch(error){
    await persistence.failScan(supabase,userId,connection.id,scan.id,String(error.message||error));
    return {status:'failed',error:String(error.message||error)};
  }
}

module.exports={determineScanWindow,runGmailScan,ymd,applyTripDecisions,defaultActions};
