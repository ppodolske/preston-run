function textFor(envelope={}){
  return [envelope.sender,envelope.subject,envelope.text].filter(Boolean).join('\n').toLowerCase();
}

function has(text,re){return re.test(text);}

const MARKETING=/\b(newsletter|special offer|limited time|save \d+%|discount|deal|promotion|promo|book your next holiday|travel inspiration|sale now on)\b/i;
const HEALTH=/\b(appointment|physiotherapy|physio|physiotherapist|dentist|dental|doctor|medical|clinic|nookal|chiropract|optomet|specialist)\b/i;
const RESTAURANT=/\b(sevenrooms|nowbookit|opentable|resy|restaurant|cafe|dinner reservation|lunch reservation|reservation at)\b/i;
const MEMBERSHIP=/\b(membership|member renewal|membership renewal|membership expires?|renew your membership)\b/i;
const SUBSCRIPTION=/\b(subscription|subscription renewal|subscription expires?|renew your subscription)\b/i;
const BILL=/\b(invoice|bill due|payment due|amount due|statement due|overdue payment)\b/i;
const GOVERNMENT=/\b(australian taxation office|\bato\b|service nsw|medicare|centrelink|government|council notice|registration renewal)\b/i;
const PROPERTY=/\b(strata|lease renewal|landlord|tenancy|tenant|rent due|property inspection|council rates|home insurance renewal)\b/i;
const DEADLINE=/\b(deadline|due date|must be submitted by|action required by|expires? on|expiry date)\b/i;
const STRONG_TRAVEL=/\b(flight|airline|e-?ticket|itinerary|boarding pass|check-?in|qantas|virgin australia|jetstar|emirates|singapore airlines|cathay|air new zealand|hotel|accommodation|airbnb|booking\.com|hertz|avis|europcar|budget car|car hire|rental car|vehicle rental|ferry|searoad|cruise|train ticket|rail journey|tour booking)\b/i;
const AMBIGUOUS_BOOKING=/\b(booking|reservation|confirmation|ticket)\b/i;

function classifyGmailIntent(envelope={}){
  const text=textFor(envelope);
  if(!text)return {intent:'ignore',confidence:0.99,reason:'no_content'};

  if(has(text,MARKETING))return {intent:'ignore',confidence:0.99,reason:'marketing'};
  if(has(text,HEALTH))return {intent:'life_admin',category:'appointment',confidence:0.95,reason:'health_appointment'};
  if(has(text,MEMBERSHIP))return {intent:'life_admin',category:'membership',confidence:0.9,reason:'membership_renewal'};
  if(has(text,SUBSCRIPTION))return {intent:'life_admin',category:'subscription',confidence:0.9,reason:'subscription_renewal'};
  if(has(text,BILL))return {intent:'life_admin',category:'bill',confidence:0.9,reason:'bill_due'};
  if(has(text,GOVERNMENT))return {intent:'life_admin',category:'government',confidence:0.9,reason:'government_admin'};
  if(has(text,PROPERTY))return {intent:'life_admin',category:'property',confidence:0.9,reason:'property_admin'};
  if(has(text,DEADLINE))return {intent:'life_admin',category:'deadline',confidence:0.85,reason:'deadline'};
  if(has(text,RESTAURANT))return {intent:'life_admin',category:'event',confidence:0.9,reason:'restaurant_reservation'};
  if(has(text,STRONG_TRAVEL))return {intent:'trip',confidence:0.95,reason:'strong_travel_signal'};
  if(has(text,AMBIGUOUS_BOOKING))return {intent:'review',confidence:0.6,reason:'ambiguous_booking'};
  return {intent:'ignore',confidence:0.95,reason:'no_actionable_signal'};
}

module.exports={classifyGmailIntent,textFor};
