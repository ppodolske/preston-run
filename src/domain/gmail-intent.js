function contentText(envelope={}){
  return [envelope.subject,envelope.text].filter(Boolean).join('\n').toLowerCase();
}
function senderText(envelope={}){return String(envelope.sender||'').toLowerCase();}
function textFor(envelope={}){return [envelope.sender,envelope.subject,envelope.text].filter(Boolean).join('\n').toLowerCase();}
function has(text,re){return re.test(text);}

const MARKETING=/\b(newsletter|special offer|limited time|save \d+%|save money|discount|deal|promotion|promo|book your next holiday|travel inspiration|sale now on)\b/i;
const HEALTH_KIND=/\b(physiotherap(?:y|ist)?|physio|dent(?:al|ist)|optometr(?:y|ist)?|chiropract(?:ic|or)?)\b/i;
const APPOINTMENT=/\bappointment\b/i;
const BOOKING_CONFIRMATION=/\bbooking confirmation\b/i;
const RESTAURANT_CONTENT=/\b(reservation at|dinner reservation|lunch reservation)\b/i;
const RESTAURANT_SENDER=/\b(sevenrooms|nowbookit|opentable|resy)\b/i;
const STRONG_TRAVEL_CONTENT=/\b(flight|airline|e-?ticket|itinerary|boarding pass|check-?in|qantas|virgin australia|jetstar|emirates|singapore airlines|cathay|air new zealand|hotel|accommodation|airbnb|booking\.com|hertz|avis|europcar|budget car|car hire|rental car|vehicle rental|ferry|searoad|cruise|train ticket|rail journey|tour booking)\b/i;
const STRONG_TRAVEL_SENDER=/\b(qantas|virginaustralia|virgin australia|jetstar|emirates|singaporeair|singapore airlines|cathay|airnewzealand|air new zealand|airbnb|booking\.com|hertz|avis|europcar|searoad|ferry|cruise)\b/i;
const TRAVEL_TRANSACTIONAL=/\b(booking confirmation|booking (?:reference|ref)|reservation(?: reminder| confirmed)?|confirmation(?: number| reference)?|flight itinerary|itinerary issue date|e-?ticket|boarding pass|check-?in|vehicle has been reserved|your vehicle has been reserved|rental reservation|upcoming trip)\b/i;
const MEMBERSHIP=/\bmembership\b/i;
const MEMBERSHIP_ACTION=/\b(renew|renewal|expires?|expiring|due)\b/i;
const COMPLETED_MEMBERSHIP=/\b(thank you|thanks|renewed|renewing|cancellation request outcome|cancelled|canceled)\b/i;
const SUBSCRIPTION=/\bsubscription\b/i;
const SUBSCRIPTION_ACTION=/\b(renew|renewal|expires?|expiring|due|payment due|action required)\b/i;
const BILL_NOUN=/\b(invoice|bill|payment|statement)\b/i;
const BILL_ACTION=/\b(due|overdue|outstanding|payment required|action required)\b/i;
const GOVERNMENT_SENDER=/\b(australian taxation office|ato\.gov\.au|service\.nsw\.gov\.au|medicare|centrelink|government)\b/i;
const GOVERNMENT_ACTION=/\b(renewal due|renew[^\n]{0,40}\bdue\b|action required|expires?|expiry|due date|lodge by|lodg(?:e|ement) due|registration renewal)\b/i;
const PROPERTY_ACTION=/\b(lease renewal|renew tenancy|tenancy renewal|rent due|council rates? due|home insurance renewal)\b/i;
const DEADLINE=/\b(deadline|due date|must be submitted by|action required by|expires? on|expiry date)\b/i;
const AMBIGUOUS_BOOKING=/\b(booking|reservation)\b/i;

function classifyGmailIntent(envelope={}){
  const content=contentText(envelope);
  const sender=senderText(envelope);
  if(!content&&!sender)return {intent:'ignore',confidence:0.99,reason:'no_content'};

  if(has(sender,STRONG_TRAVEL_SENDER)&&has(content,TRAVEL_TRANSACTIONAL)){
    return {intent:'trip',confidence:0.95,reason:'strong_travel_signal'};
  }
  if(has(content,MARKETING))return {intent:'ignore',confidence:0.99,reason:'marketing'};
  if(has(content,APPOINTMENT)||(has(content,BOOKING_CONFIRMATION)&&has(content,HEALTH_KIND))){
    return {intent:'life_admin',category:'appointment',confidence:0.95,reason:'health_appointment'};
  }
  if(has(content,RESTAURANT_CONTENT)||has(sender,RESTAURANT_SENDER)){
    return {intent:'life_admin',category:'event',confidence:0.9,reason:'restaurant_reservation'};
  }
  if(has(content,STRONG_TRAVEL_CONTENT)||has(sender,STRONG_TRAVEL_SENDER)){
    return {intent:'trip',confidence:0.95,reason:'strong_travel_signal'};
  }
  if(has(content,MEMBERSHIP)&&has(content,MEMBERSHIP_ACTION)&&!has(content,COMPLETED_MEMBERSHIP)){
    return {intent:'life_admin',category:'membership',confidence:0.9,reason:'membership_renewal'};
  }
  if(has(content,BILL_NOUN)&&has(content,BILL_ACTION)){
    return {intent:'life_admin',category:'bill',confidence:0.9,reason:'bill_due'};
  }
  if(has(content,SUBSCRIPTION)&&has(content,SUBSCRIPTION_ACTION)){
    return {intent:'life_admin',category:'subscription',confidence:0.9,reason:'subscription_renewal'};
  }
  if(has(sender,GOVERNMENT_SENDER)&&has(content,GOVERNMENT_ACTION)){
    return {intent:'life_admin',category:'government',confidence:0.9,reason:'government_admin'};
  }
  if(has(content,PROPERTY_ACTION)){
    return {intent:'life_admin',category:'property',confidence:0.9,reason:'property_admin'};
  }
  if(has(content,DEADLINE)){
    return {intent:'life_admin',category:'deadline',confidence:0.85,reason:'deadline'};
  }
  if(has(content,AMBIGUOUS_BOOKING))return {intent:'review',confidence:0.6,reason:'ambiguous_booking'};
  return {intent:'ignore',confidence:0.95,reason:'no_actionable_signal'};
}

module.exports={classifyGmailIntent,textFor,contentText,senderText};