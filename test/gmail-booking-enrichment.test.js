const assert=require('node:assert/strict');
const {runGmailBookingEnrichment}=require('../src/services/gmail-booking-enrichment');

const booking={id:'b1',provider:'Jetstar',confirmation_reference:'QNRY8J',title:'Jetstar',starts_at:null,ends_at:null,origin:null,destination:null,location:null,source_metadata:{source:'gmail',manual_fields:[]}};
const links=[
  {booking_id:'b1',source_record_id:'s1',bookings:booking,gmail_source_records:{id:'s1',gmail_message_id:'m1',sender:'Jetstar',subject:'Jetstar Booking Confirmation Email'}},
  {booking_id:'b1',source_record_id:'s2',bookings:booking,gmail_source_records:{id:'s2',gmail_message_id:'m2',sender:'Jetstar',subject:'Jetstar Flight Itinerary for (Booking ref# QNRY8J)'}}
];
const rich={booking_type:'flight',provider:'Jetstar',confirmation_reference:'QNRY8J',title:'Sydney → Queenstown flights',status:'confirmed',starts_at:'2026-08-15T01:50:00.000Z',ends_at:'2026-08-22T05:45:00.000Z',time_zone:'Pacific/Auckland',origin:'Sydney',destination:'Queenstown',location:'Queenstown',booking_url:'https://booking.jetstar.com/mmb',legs:[{position:1,service_number:'JQ223',origin:'Sydney',destination:'Queenstown'},{position:2,service_number:'JQ224',origin:'Queenstown',destination:'Sydney'}]};

const liveJetstarText=`Booking reference
QNRY8J
Your flights Booking date: 02 Mar 2026
Date Flight number Departing Arriving
Sat 15 Aug 2026
11:50am / 11:50
JQ223
Airbus A320NEO
Sydney (Kingsford Smith)
Sat 15 Aug 2026
11:50am / 11:50
Sydney Airport - T1 International
Queenstown
Sat 15 Aug 2026
4:45pm / 16:45
Queenstown Airport
Date Flight number Departing Arriving
Sat 22 Aug 2026
5:45pm / 17:45
JQ224
Airbus A320NEO
Queenstown
Sat 22 Aug 2026
5:45pm / 17:45
Queenstown Airport
Sydney (Kingsford Smith)
Sat 22 Aug 2026
7:00pm / 19:00
Sydney Airport - T1 International
International check-in times
Flight #1: Sydney (Kingsford Smith) > Queenstown
Flight #2: Queenstown > Sydney (Kingsford Smith)
Baggage Information
Cabin Baggage
Starter fares include a carry-on baggage allowance of one bag and one small personal item.`;

(async()=>{
  const writes=[];
  const base={
    data:{listBookingSourceLinksForEnrichment:async()=>links},
    provider:{getMessage:async id=>({id,payload:{mimeType:'text/plain',body:{data:Buffer.from(`message ${id}`).toString('base64url')}},snippet:''})},
    parserVersion:'gmail-parser-v0.14.0',
    extractCandidate:(_envelope)=>({candidate:rich,facts:[]}),
    bookingData:{updateBookingFromGmail:async(_s,_u,id,patch,metadata)=>{writes.push(['booking',id,patch,metadata]);return{id,...booking,...patch};}},
    bookingLegData:{upsertBookingLegFromGmail:async(_s,_u,id,leg,metadata)=>{writes.push(['leg',id,leg,metadata]);return{id:`${id}-${leg.position}`,...leg};}},
    supabase:{},user:{id:'u1'}
  };
  const dry=await runGmailBookingEnrichment({...base,mode:'dry-run'});
  assert.equal(dry.bookingCount,1);assert.equal(dry.sourceCount,2);assert.equal(writes.length,0,'dry-run must not mutate bookings or legs');
  assert.equal(dry.results[0].proposed.legs.length,2);assert.equal(dry.results[0].proposed.legs[0].service_number,'JQ223');
  assert.deepEqual(dry.results[0].sourceRecordIds,['s1','s2']);

  const applied=await runGmailBookingEnrichment({...base,mode:'apply'});
  assert.equal(applied.results[0].applied,true);
  assert.equal(writes.filter(x=>x[0]==='booking').length,1);
  assert.equal(writes.filter(x=>x[0]==='leg').length,2);
  const patch=writes.find(x=>x[0]==='booking')[2];
  assert.equal(patch.starts_at,rich.starts_at);assert.equal(patch.destination,'Queenstown');
  assert.equal(Object.hasOwn(patch,'trip_id'),false,'enrichment must never assign a trip');
  assert.equal(writes.find(x=>x[0]==='booking')[3].source,'gmail');

  await assert.rejects(()=>runGmailBookingEnrichment({...base,mode:'invalid'}),/mode/i);

  const liveBooking={...booking,starts_at:'2026-08-15T00:00:00+00:00',ends_at:'2026-08-22T00:00:00+00:00',origin:'Sydney',destination:'Queenstown',location:'Queenstown'};
  const liveLinks=[{booking_id:'b1',source_record_id:'s-live',bookings:liveBooking,gmail_source_records:{id:'s-live',gmail_message_id:'m-live',sender:'Jetstar <noreplyitineraries@jetstar.com>',subject:'Jetstar Flight Itinerary for (Booking ref# QNRY8J) JQ223 15/08/2026 JQ224 22/08/2026'}}];
  const liveDry=await runGmailBookingEnrichment({
    mode:'dry-run',
    data:{listBookingSourceLinksForEnrichment:async()=>liveLinks},
    provider:{getMessage:async()=>({id:'m-live',payload:{mimeType:'text/plain',body:{data:Buffer.from(liveJetstarText).toString('base64url')}},snippet:''})},
    parserVersion:'gmail-parser-v0.14.0',
    supabase:{},user:{id:'u1'}
  });
  assert.equal(liveDry.results[0].applied,false,'real-path enrichment verification must remain dry-run only');
  assert.deepEqual(liveDry.results[0].proposed.legs.map(leg=>leg.service_number),['JQ223','JQ224']);
  assert.deepEqual(liveDry.results[0].proposed.legs.map(leg=>[leg.origin,leg.destination]),[['Sydney','Queenstown'],['Queenstown','Sydney']]);
  assert.equal(liveDry.results[0].proposed.legs[0].departs_at,'2026-08-15T01:50:00.000Z');
  assert.equal(liveDry.results[0].proposed.legs[0].arrives_at,'2026-08-15T04:45:00.000Z');
  assert.equal(liveDry.results[0].proposed.legs[1].departs_at,'2026-08-22T05:45:00.000Z');
  assert.equal(liveDry.results[0].proposed.legs[1].arrives_at,'2026-08-22T09:00:00.000Z');

  console.log('gmail booking enrichment tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
