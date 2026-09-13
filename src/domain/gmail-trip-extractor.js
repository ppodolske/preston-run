const {buildFact}=require('./gmail-facts');

function findBookingReference(text){
  const match=text.match(/(?:booking reference|confirmation|reservation|ref(?:erence)?)[^A-Z0-9]{0,20}([A-Z0-9]{5,10})/i);
  return match?match[1].toUpperCase():null;
}
function findFlightNumber(text){
  const match=text.match(/\b([A-Z]{2}\d{2,4})\b/);
  return match?match[1].toUpperCase():null;
}
function findMoney(text){
  const match=text.match(/\$\s?([0-9]+(?:\.[0-9]{2})?)/);
  return match?Number(match[1]):null;
}
function confidenceForTrip(text){
  return /flight|hotel|booking|itinerary|reservation|airline|train|ferry|cruise|tour|ticket|check-in|car hire|rental car/i.test(text)?0.85:0.4;
}

function extractTripFacts(envelope,{parserVersion}){
  const text=[envelope.sender,envelope.subject,envelope.text].filter(Boolean).join('\n');
  const classificationConfidence=confidenceForTrip(text);
  if(classificationConfidence<0.7)return [];
  const common={sourceRecordId:envelope.sourceRecordId,attachmentRecordId:envelope.attachmentRecordId||null,parserVersion,classificationConfidence,extractionConfidence:0.8};
  const facts=[];
  const reference=findBookingReference(text);
  if(reference)facts.push(buildFact({...common,factType:'trip.booking_reference',factValue:{reference}}));
  const flightNumber=findFlightNumber(text);
  if(flightNumber)facts.push(buildFact({...common,factType:'trip.flight',factValue:{flightNumber}}));
  if(/cancelled|canceled|cancellation/i.test(text))facts.push(buildFact({...common,factType:'trip.cancellation',factValue:{status:'cancelled'}}));
  const amount=findMoney(text);
  if(amount!==null&&/refund/i.test(text))facts.push(buildFact({...common,factType:'trip.refund',factValue:{amount,currency:'AUD'}}));
  if(/hotel|accommodation|check-in|check out|checkout/i.test(text))facts.push(buildFact({...common,factType:'trip.accommodation',factValue:{provider:envelope.sender||null}}));
  if(/car hire|rental car|vehicle booking/i.test(text))facts.push(buildFact({...common,factType:'trip.car_hire',factValue:{provider:envelope.sender||null}}));
  return facts;
}

module.exports={extractTripFacts,findBookingReference,findFlightNumber};
