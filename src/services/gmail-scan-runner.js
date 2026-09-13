const {buildEligibleMessagesQuery}=require('./gmail-provider');
const {findPdfAttachments,decodeBase64Url}=require('./gmail-pdf');
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

async function extractPdfFacts({message,provider,persistence,source,config,pdfParse}){
  const facts=[];
  let unreadableCount=0;
  for(const attachment of findPdfAttachments(message)){
    const attachmentRecord=persistence.upsertAttachment?await persistence.upsertAttachment(source.id,attachment):{id:null,...attachment};
    let result;
    try{
      const body=await provider.getAttachment(message.id,attachment.gmailAttachmentId);
      const buffer=decodeBase64Url(body.data||'');
      result=await config.extractNativePdfText(buffer,{pdfParse});
    }catch(error){
      result={status:'retry',text:'',reason:String(error.message||error)};
    }
    if(result.status==='processed'){
      facts.push(...extractTripFacts({sourceRecordId:source.id,attachmentRecordId:attachmentRecord.id,sender:null,subject:attachment.filename,receivedAt:source.received_at,text:result.text},{parserVersion:config.parserVersion}));
    }else{
      unreadableCount+=1;
      if(persistence.updateAttachmentStatus)await persistence.updateAttachmentStatus(attachmentRecord.id,{processing_status:result.status,processing_reason:result.reason});
    }
  }
  return {facts,unreadableCount};
}

async function runGmailScan({supabase,userId,connection,provider,config,existingTrips=[],persistence,actions,pdfParse}){
  const resolvedActions={...defaultActions(),...(actions||{})};
  const resolvedConfig={...config,extractNativePdfText:config.extractNativePdfText||require('./gmail-pdf').extractNativePdfText};
  const window=determineScanWindow(connection,new Date(),resolvedConfig.initialLookbackMonths);
  const query=buildEligibleMessagesQuery(window);
  const scan=await persistence.startScan(supabase,userId,connection,window.scanType,{scannerVersion:resolvedConfig.scannerVersion,lookbackStartAt:window.after});
  let newest=null;
  const counters={discoveredCount:0,processedCount:0,ignoredCount:0,relevantCount:0,factsCreatedCount:0,decisionCount:0,pdfUnreadableCount:0};
  try{
    let pageToken=null;
    do{
      const listed=await provider.listMessages(query,pageToken);
      const messages=listed.messages||[];
      counters.discoveredCount+=messages.length;
      for(const ref of messages){
        const existing=persistence.findExistingSource?await persistence.findExistingSource(connection.gmail_account_email,ref.id):null;
        if(existing&&existing.processing_status==='processed'){
          counters.processedCount+=1;
          continue;
        }
        const message=await provider.getMessage(ref.id);
        if(!isEligibleReceivedMessage(message)){counters.ignoredCount+=1;continue;}
        const normalized=normalizeGmailMessage(message,connection.gmail_account_email,resolvedConfig.scannerVersion);
        const source=await persistence.upsertSource(normalized,scan.id);
        newest=newest||normalized;
        const messageFacts=extractTripFacts({sourceRecordId:source.id,sender:normalized.sender,subject:normalized.subject,receivedAt:normalized.received_at,text:message.snippet||''},{parserVersion:resolvedConfig.parserVersion});
        const pdfResult=await extractPdfFacts({message,provider,persistence,source,config:resolvedConfig,pdfParse});
        counters.pdfUnreadableCount+=pdfResult.unreadableCount;
        const facts=[...messageFacts,...pdfResult.facts];
        if(facts.length)counters.relevantCount+=1;
        const insertedFacts=await persistence.insertFacts(facts);
        const persistedFacts=Array.isArray(insertedFacts)&&insertedFacts.length?insertedFacts:facts;
        counters.factsCreatedCount+=persistedFacts.length;
        const match=rankTripMatch(persistedFacts,existingTrips);
        const decisions=await applyTripDecisions({actions:resolvedActions,facts:persistedFacts,match,source});
        counters.decisionCount+=decisions.length;
        if(persistence.updateSourceStatus)await persistence.updateSourceStatus(source.id,{processing_status:'processed',processing_reason:null});
        counters.processedCount+=1;
      }
      if(persistence.updateScanProgress)await persistence.updateScanProgress(scan.id,counters);
      pageToken=listed.nextPageToken||null;
    }while(pageToken);
    await persistence.finishScan(supabase,userId,connection.id,scan.id,{checkpointReceivedAt:newest&&newest.received_at,checkpointMessageId:newest&&newest.gmail_message_id,firstScanCompleted:window.scanType==='initial'});
    return {status:'succeeded',...counters};
  }catch(error){
    await persistence.failScan(supabase,userId,connection.id,scan.id,String(error.message||error));
    return {status:'failed',error:String(error.message||error)};
  }
}

module.exports={determineScanWindow,runGmailScan,ymd,applyTripDecisions,defaultActions,extractPdfFacts};
