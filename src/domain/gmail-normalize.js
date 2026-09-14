const MAX_GMAIL_MESSAGE_TEXT=120000;

function headerValue(message,name){
  const headers=message?.payload?.headers||[];
  const found=headers.find(h=>String(h.name||'').toLowerCase()===name.toLowerCase());
  return found?found.value||'':null;
}

function receivedAt(message){
  if(message.internalDate)return new Date(Number(message.internalDate)).toISOString();
  const date=headerValue(message,'Date');
  return date?new Date(date).toISOString():new Date(0).toISOString();
}

function sourceLink(accountEmail,messageId){
  return `https://mail.google.com/mail/u/${encodeURIComponent(accountEmail)}/#all/${encodeURIComponent(messageId)}`;
}

function decodeBase64UrlText(value){
  const text=String(value||'').trim();
  if(!text)return '';
  const normalized=text.replace(/-/g,'+').replace(/_/g,'/');
  const padded=normalized+'='.repeat((4-normalized.length%4)%4);
  try{return Buffer.from(padded,'base64').toString('utf8');}catch{return '';}
}

function isAttachmentPart(part){
  if(String(part?.filename||'').trim())return true;
  const headers=part?.headers||[];
  const disposition=headers.find(h=>String(h.name||'').toLowerCase()==='content-disposition');
  return Boolean(disposition&&/attachment/i.test(String(disposition.value||'')));
}

function collectBodyParts(part,plain=[],html=[]){
  if(!part||isAttachmentPart(part))return {plain,html};
  const mime=String(part.mimeType||'').toLowerCase();
  const data=part.body&&part.body.data;
  if(data&&mime==='text/plain')plain.push(decodeBase64UrlText(data));
  else if(data&&mime==='text/html')html.push(decodeBase64UrlText(data));
  for(const child of part.parts||[])collectBodyParts(child,plain,html);
  return {plain,html};
}

function decodeHtmlEntity(entity){
  const named={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",'#39':"'"};
  const key=String(entity||'').toLowerCase();
  if(Object.hasOwn(named,key))return named[key];
  if(/^#x[0-9a-f]+$/i.test(key))return String.fromCodePoint(parseInt(key.slice(2),16));
  if(/^#\d+$/.test(key))return String.fromCodePoint(parseInt(key.slice(1),10));
  return `&${entity};`;
}

function htmlToPlainText(value){
  return String(value||'')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/p\s*>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
    .replace(/&([^;\s]{1,16});/g,(_m,entity)=>decodeHtmlEntity(entity));
}

function normalizeEvidenceText(value){
  return String(value||'')
    .replace(/\u0000/g,' ')
    .replace(/[\t\r\n ]+/g,' ')
    .replace(/(\b\d{1,2}:\d{2}(?:am|pm)\s*\/\s*\d{1,2}:\d{2})\s+Flight\s+number\s+(JQ\d{2,4}\b)/gi,'$1 $2')
    .trim();
}
function uniqueEvidence(values){
  const seen=new Set(),out=[];
  for(const value of values){const normalized=normalizeEvidenceText(value);if(!normalized||seen.has(normalized))continue;seen.add(normalized);out.push(normalized);}
  return out;
}

function extractGmailMessageText(message,{maxLength=MAX_GMAIL_MESSAGE_TEXT}={}){
  const {plain,html}=collectBodyParts(message?.payload||{});
  const evidence=uniqueEvidence([
    ...plain,
    ...html.map(htmlToPlainText)
  ]);
  const fallback=normalizeEvidenceText(message?.snippet||'');
  const selected=evidence.length?evidence.join('\n'):fallback;
  return selected.slice(0,Math.max(0,Number(maxLength)||MAX_GMAIL_MESSAGE_TEXT));
}

function classifyGmailSourceHint(normalized){
  const text=`${normalized.sender||''} ${normalized.subject||''}`.toLowerCase();
  if(/flight|hotel|booking|itinerary|reservation|airline|train|ferry|cruise|tour|ticket|check-in|car hire|rental car/.test(text))return 'trip_candidate';
  if(/invoice|bill|payment|receipt|renewal|subscription|appointment|deadline|statement|policy|warranty/.test(text))return 'future_life_admin_candidate';
  return 'none';
}

function normalizeGmailMessage(message,accountEmail,scannerVersion){
  const row={
    source_system:'gmail',
    gmail_account_email:accountEmail,
    gmail_message_id:message.id,
    gmail_thread_id:message.threadId||null,
    sender:headerValue(message,'From'),
    subject:headerValue(message,'Subject'),
    received_at:receivedAt(message),
    label_ids:message.labelIds||[],
    source_link:sourceLink(accountEmail,message.id),
    scanner_version:scannerVersion,
    processing_status:'pending'
  };
  row.classification_hint=classifyGmailSourceHint(row);
  return row;
}

module.exports={normalizeGmailMessage,classifyGmailSourceHint,headerValue,sourceLink,extractGmailMessageText,decodeBase64UrlText,htmlToPlainText,MAX_GMAIL_MESSAGE_TEXT};
