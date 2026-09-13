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

module.exports={normalizeGmailMessage,classifyGmailSourceHint,headerValue,sourceLink};
