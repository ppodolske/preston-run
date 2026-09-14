'use strict';

const {extractGmailMessageText}=require('../domain/gmail-normalize');
const {extractBookingCandidate}=require('../domain/gmail-booking-extractor');
const {findPdfAttachments,decodeBase64Url,extractNativePdfText}=require('./gmail-pdf');

const ENRICH_FIELDS=['booking_type','title','provider','confirmation_reference','status','starts_at','ends_at','time_zone','location','origin','destination','booking_url','notes'];
function compactText(value){const text=String(value||'').trim();return text||null;}
function candidateRichness(candidate={}){
  let score=0;
  for(const key of ENRICH_FIELDS)if(candidate[key]!==null&&candidate[key]!==undefined&&String(candidate[key]).trim()!=='')score+=1;
  score+=(Array.isArray(candidate.legs)?candidate.legs.length:0)*4;
  score+=(Array.isArray(candidate.evidence)?candidate.evidence.length:0);
  return score;
}
function sourceForRow(row={}){return row.gmail_source_records||row.source||null;}
function bookingForRow(row={}){return row.bookings||row.booking||null;}
function unique(values){return[...new Set(values.filter(Boolean))];}
function bookingPatch(candidate={}){const patch={};for(const key of ENRICH_FIELDS){const value=candidate[key];if(value===null||value===undefined)continue;if(typeof value==='string'&&!value.trim())continue;patch[key]=value;}return patch;}
async function pdfEvidence(message,provider,{pdfParse,extractPdfText=extractNativePdfText}={}){
  const out=[];
  if(!provider||typeof provider.getAttachment!=='function')return out;
  for(const attachment of findPdfAttachments(message)){
    const body=await provider.getAttachment(message.id,attachment.gmailAttachmentId);
    const parsed=await extractPdfText(decodeBase64Url(body&&body.data||''),{pdfParse});
    if(parsed&&parsed.status==='processed'&&compactText(parsed.text))out.push(String(parsed.text));
  }
  return out;
}
async function envelopeForSource(source,provider,options={}){
  if(!source||!source.gmail_message_id)throw new Error('Canonical booking source is missing gmail_message_id');
  const message=await provider.getMessage(source.gmail_message_id);
  const body=extractGmailMessageText(message);
  const pdf=await pdfEvidence(message,provider,options);
  return{sourceRecordId:source.id,sender:source.sender||null,subject:source.subject||null,text:[body,message.snippet,...pdf].filter(Boolean).join('\n')};
}
function snapshot(booking={}){return{starts_at:booking.starts_at||null,ends_at:booking.ends_at||null,origin:booking.origin||null,destination:booking.destination||null,location:booking.location||null};}

async function runGmailBookingEnrichment({mode='dry-run',data,provider,parserVersion='gmail-parser-v0.14.0',bookingData,bookingLegData,supabase,user,extractCandidate=extractBookingCandidate,pdfParse,extractPdfText}={}){
  if(!['dry-run','apply'].includes(mode))throw new Error('Booking enrichment mode must be dry-run or apply');
  if(!data||typeof data.listBookingSourceLinksForEnrichment!=='function')throw new Error('Booking enrichment data adapter is required');
  if(!provider||typeof provider.getMessage!=='function')throw new Error('Gmail provider is required');
  const links=await data.listBookingSourceLinksForEnrichment(supabase,user)||[];
  const groups=new Map();
  for(const row of links){const booking=bookingForRow(row),source=sourceForRow(row);if(!booking||!source)continue;const id=booking.id||row.booking_id;if(!id)continue;if(!groups.has(id))groups.set(id,{booking,sources:[]});groups.get(id).sources.push(source);}
  const results=[];
  for(const[bookingId,group]of groups){
    const parsed=[];
    for(const source of group.sources){
      const envelope=await envelopeForSource(source,provider,{pdfParse,extractPdfText});
      const extracted=extractCandidate(envelope,{parserVersion});
      if(extracted&&extracted.candidate)parsed.push({source,candidate:extracted.candidate});
    }
    parsed.sort((a,b)=>candidateRichness(b.candidate)-candidateRichness(a.candidate));
    const proposed=parsed[0]&&parsed[0].candidate||{};
    const row={bookingId,provider:group.booking.provider||proposed.provider||null,confirmationReference:group.booking.confirmation_reference||proposed.confirmation_reference||null,sourceRecordIds:unique(group.sources.map(s=>s.id)),before:snapshot(group.booking),proposed:{...snapshot(proposed),legs:Array.isArray(proposed.legs)?proposed.legs:[]},applied:false};
    if(mode==='apply'&&parsed.length){
      if(!bookingData||typeof bookingData.updateBookingFromGmail!=='function')throw new Error('bookingData.updateBookingFromGmail is required in apply mode');
      if(!bookingLegData||typeof bookingLegData.upsertBookingLegFromGmail!=='function')throw new Error('bookingLegData.upsertBookingLegFromGmail is required in apply mode');
      const sourceIds=row.sourceRecordIds;
      await bookingData.updateBookingFromGmail(supabase,user,bookingId,bookingPatch(proposed),{source:'gmail',enrichment_version:'gmail-booking-enrichment-v0.14.0',source_record_ids:sourceIds});
      for(const leg of Array.isArray(proposed.legs)?proposed.legs:[])await bookingLegData.upsertBookingLegFromGmail(supabase,user,bookingId,leg,{source:'gmail',source_record_ids:sourceIds,extractor_version:parserVersion});
      row.applied=true;
    }
    results.push(row);
  }
  return{mode,bookingCount:groups.size,sourceCount:links.length,results};
}

module.exports={ENRICH_FIELDS,candidateRichness,bookingPatch,envelopeForSource,runGmailBookingEnrichment};
