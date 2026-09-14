'use strict';

const {classifyGmailIntent}=require('../domain/gmail-intent');
const {extractGmailMessageText}=require('../domain/gmail-normalize');
const {extractBookingCandidate}=require('../domain/gmail-booking-extractor');
const {extractLifeAdminCandidate}=require('../domain/gmail-life-admin-extractor');
const {proposeTripLink}=require('../domain/trip-linker');
const {findPdfAttachments,decodeBase64Url,extractNativePdfText}=require('./gmail-pdf');

const EXPECTED_LEGACY_SHELL_COUNT=28;
const LEGACY_RULE_PREFIX='gmail-trip-actions-v0.12.';
const SNAPSHOT_FIELDS=['title','status','start_date','end_date','notes'];
function sleepDefault(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function same(a,b){return(a??null)===(b??null);}
function unique(values){return[...new Set(values.filter(Boolean))];}
function isLegacyTripCreateActivity(row={}){return row.entity_type==='trip'&&row.action==='create'&&row.automatic!==false&&String(row.rule_version||'').startsWith(LEGACY_RULE_PREFIX)&&Boolean(row.entity_id);}
function isQuotaError(error){const status=Number(error&&(?:error.status||error.statusCode||error.code));return status===403||/\b403\b|quota|rate limit|user-rate/i.test(String(error&&error.message||error||''));}

async function withQuotaRetry(fn,{sleep=sleepDefault,delays=[15000,30000,60000]}={}){
  let index=0;
  while(true){try{return await fn();}catch(error){if(!isQuotaError(error)||index>=delays.length)throw error;await sleep(delays[index++]);}}
}
function dependencyReasons(dependencies={}){
  const reasons=[];
  if((dependencies.segments||[]).length)reasons.push('linked_segment');
  if((dependencies.bookings||[]).length)reasons.push('linked_booking');
  if((dependencies.tasks||[]).length)reasons.push('linked_task');
  if((dependencies.lifeItems||[]).length)reasons.push('linked_life_item');
  return reasons;
}
function tripChangedSinceCreate(trip,snapshot){if(!snapshot)return true;return SNAPSHOT_FIELDS.some(field=>!same(trip&&trip[field],snapshot&&snapshot[field]));}

async function discoverLegacyTripShells({data,expectedBaseline=EXPECTED_LEGACY_SHELL_COUNT}={}){
  if(!data||typeof data.listLegacyTripCreateActivities!=='function')throw new Error('Reconstruction data adapter is required');
  const activities=(await data.listLegacyTripCreateActivities()).filter(isLegacyTripCreateActivity),byTrip=new Map();
  for(const activity of activities){if(!byTrip.has(activity.entity_id))byTrip.set(activity.entity_id,[]);byTrip.get(activity.entity_id).push(activity);}
  const shells=[];
  for(const[tripId,rows]of byTrip){
    const trip=await data.getTrip(tripId);if(!trip)continue;
    const dependencies=await data.getTripDependencies(tripId)||{},snapshot=rows.find(row=>row.new_value&&typeof row.new_value==='object')?.new_value||null;
    const cleanupReasons=dependencyReasons(dependencies);if(!snapshot)cleanupReasons.push('missing_create_snapshot');else if(tripChangedSinceCreate(trip,snapshot))cleanupReasons.push('trip_changed_since_create');
    shells.push({trip,activities:rows,sourceRecordIds:unique(rows.map(row=>row.source_record_id)),dependencies,cleanupEligible:cleanupReasons.length===0,cleanupReasons});
  }
  shells.sort((a,b)=>String(a.trip.id).localeCompare(String(b.trip.id)));
  const observedCount=shells.length,baselineMatches=observedCount===expectedBaseline;
  return{shells,observedCount,expectedBaseline,baselineMatches,warnings:baselineMatches?[]:[`Legacy Gmail trip shell baseline mismatch: expected ${expectedBaseline}, found ${observedCount}.`]};
}

function combineEvidence(...values){const seen=new Set(),out=[];for(const value of values){const text=String(value||'').trim();if(!text||seen.has(text))continue;seen.add(text);out.push(text);}return out.join('\n');}
async function readPdfText(message,provider,{pdfParse,extractPdfText=extractNativePdfText,sleep=sleepDefault,retryDelays}={}){
  const fragments=[];
  for(const attachment of findPdfAttachments(message)){
    if(!provider||typeof provider.getAttachment!=='function')continue;
    const body=await withQuotaRetry(()=>provider.getAttachment(message.id,attachment.gmailAttachmentId),{sleep,delays:retryDelays||[15000,30000,60000]});
    const parsed=await extractPdfText(decodeBase64Url(body&&body.data||''),{pdfParse});if(parsed&&parsed.status==='processed'&&String(parsed.text||'').trim())fragments.push(String(parsed.text));
  }
  return fragments;
}
async function sourceEnvelope(source,provider,options={}){
  if(!source||!source.gmail_message_id)throw new Error('Historical Gmail source is missing gmail_message_id');
  const message=await withQuotaRetry(()=>provider.getMessage(source.gmail_message_id),{sleep:options.sleep||sleepDefault,delays:options.retryDelays||[15000,30000,60000]});
  const body=extractGmailMessageText(message),attachments=findPdfAttachments(message).map(row=>row.filename).filter(Boolean).join(' '),pdfText=await readPdfText(message,provider,options);
  return{message,envelope:{sourceRecordId:source.id,sender:source.sender||null,subject:source.subject||null,text:combineEvidence(body,message.snippet,attachments,...pdfText)}};
}
function sourceMetadataLookup(source={}){return{source_record_id:source.id||null,gmail_message_id:source.gmail_message_id||null,gmail_thread_id:source.gmail_thread_id||null};}
function currentTripDecisionForEvent(existing,candidate,trips){if(existing&&existing.linked_trip_id)return{kind:'link',tripId:existing.linked_trip_id,score:100,reasons:['existing_trip_link'],proposedTrip:null};return proposeTripLink({subjectType:'event',subject:candidate,trips});}

async function reconstructSource({source,provider,data,mode,parserVersion,bookingActions,lifeAdminActions,shellIds,paceMs=1000,sleep=sleepDefault,pdfParse,extractPdfText,retryDelays}={}){
  const{envelope}=await sourceEnvelope(source,provider,{sleep,pdfParse,extractPdfText,retryDelays}),classification=classifyGmailIntent(envelope);
  const trips=(await data.listTrips()).filter(trip=>!shellIds.has(trip.id));
  let candidateObjectType='none',candidate=null,facts=[],canonical=null,tripLinkDecision={kind:'none',tripId:null,score:0,reasons:['not_reconstructable'],proposedTrip:null};
  if(classification.intent==='trip'){
    const extracted=extractBookingCandidate(envelope,{parserVersion});candidateObjectType='booking';candidate=extracted.candidate;facts=extracted.facts||[];
    canonical=typeof data.findCanonicalBooking==='function'?await data.findCanonicalBooking(candidate,source):null;
    tripLinkDecision=proposeTripLink({subjectType:'booking',subject:{...(canonical||{}),...candidate},trips});
    if(mode==='apply'){
      if(!bookingActions||typeof bookingActions.processBooking!=='function')throw new Error('bookingActions.processBooking is required in apply mode');
      const outcome=await bookingActions.processBooking({source,candidate,facts,trips});canonical=outcome&&outcome.booking||canonical;tripLinkDecision=outcome&&outcome.linkDecision||tripLinkDecision;
    }
  }else if(classification.intent==='life_admin'&&['event','appointment'].includes(classification.category)){
    candidateObjectType='event';candidate=extractLifeAdminCandidate(envelope,classification);canonical=typeof data.findLifeItem==='function'?await data.findLifeItem(source):null;tripLinkDecision=currentTripDecisionForEvent(canonical,candidate,trips);
    if(mode==='apply'){
      if(!lifeAdminActions||typeof lifeAdminActions.createLifeAdminItem!=='function')throw new Error('lifeAdminActions.createLifeAdminItem is required in apply mode');
      canonical=await lifeAdminActions.createLifeAdminItem(source,candidate,classification)||canonical;
      if(canonical&&canonical.linked_trip_id)tripLinkDecision={kind:'link',tripId:canonical.linked_trip_id,score:tripLinkDecision.score,reasons:unique([...(tripLinkDecision.reasons||[]),'applied_trip_link']),proposedTrip:null};
    }
  }else if(classification.intent==='review'){candidateObjectType='review';tripLinkDecision={kind:'review',tripId:null,score:classification.confidence||0,reasons:[classification.reason||'review'],proposedTrip:null};}
  if(paceMs>0)await sleep(paceMs);
  return{source,classification,candidateObjectType,candidate,facts,canonicalObjectId:canonical&&canonical.id||null,tripLinkDecision};
}
function mappingRow(shell,sourceResults){
  const results=shell.sourceRecordIds.map(id=>sourceResults.get(id)).filter(Boolean),primary=results[0]||{},candidate=primary.candidate||{};
  return{
    oldTripId:shell.trip.id,oldTripTitle:shell.trip.title,sourceRecordIds:shell.sourceRecordIds,gmailMessageIds:unique(results.map(row=>row.source&&row.source.gmail_message_id)),candidateObjectType:primary.candidateObjectType||'none',canonicalObjectId:primary.canonicalObjectId||null,
    confirmationReference:candidate.confirmation_reference||null,startsAt:candidate.starts_at||null,endsAt:candidate.ends_at||null,geography:candidate.geography||null,tripLinkDecision:primary.tripLinkDecision||{kind:'none',tripId:null,score:0,reasons:['missing_source_result'],proposedTrip:null},cleanupEligible:shell.cleanupEligible,cleanupReasons:shell.cleanupReasons,dependencies:shell.dependencies,sourceResults:results
  };
}

async function runGmailTripReconstruction({mode='dry-run',expectedBaseline=EXPECTED_LEGACY_SHELL_COUNT,data,provider,parserVersion='gmail-booking-parser-v0.13.0',bookingActions,lifeAdminActions,paceMs=1000,sleep=sleepDefault,pdfParse,extractPdfText,retryDelays,onProgress}={}){
  if(!['dry-run','apply'].includes(mode))throw new Error('Reconstruction mode must be dry-run or apply');if(!provider||typeof provider.getMessage!=='function')throw new Error('Gmail provider is required');
  const discovery=await discoverLegacyTripShells({data,expectedBaseline}),shellIds=new Set(discovery.shells.map(row=>row.trip.id)),sourceIds=unique(discovery.shells.flatMap(row=>row.sourceRecordIds)),sourceResults=new Map();let index=0;
  for(const sourceId of sourceIds){const source=await data.getSource(sourceId);if(!source){sourceResults.set(sourceId,{source:null,candidateObjectType:'none',candidate:null,canonicalObjectId:null,tripLinkDecision:{kind:'review',tripId:null,score:0,reasons:['missing_source_record'],proposedTrip:null}});continue;}
    const result=await reconstructSource({source,provider,data,mode,parserVersion,bookingActions,lifeAdminActions,shellIds,paceMs:index===sourceIds.length-1?0:paceMs,sleep,pdfParse,extractPdfText,retryDelays});sourceResults.set(sourceId,result);index+=1;if(onProgress)await onProgress({processedSources:index,totalSources:sourceIds.length,sourceRecordId:sourceId,candidateObjectType:result.candidateObjectType});}
  const rows=discovery.shells.map(shell=>mappingRow(shell,sourceResults));return{mode,observedCount:discovery.observedCount,expectedBaseline:discovery.expectedBaseline,baselineMatches:discovery.baselineMatches,warnings:discovery.warnings,distinctSourceCount:sourceIds.length,rows};
}

module.exports={EXPECTED_LEGACY_SHELL_COUNT,LEGACY_RULE_PREFIX,isLegacyTripCreateActivity,isQuotaError,withQuotaRetry,discoverLegacyTripShells,sourceEnvelope,reconstructSource,runGmailTripReconstruction,dependencyReasons,tripChangedSinceCreate,mappingRow};
