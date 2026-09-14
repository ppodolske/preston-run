'use strict';

const assert=require('node:assert/strict');
const {discoverLegacyTripShells,runGmailTripReconstruction,isLegacyTripCreateActivity,withQuotaRetry}=require('../src/services/gmail-trip-reconstruction');

function enc(text){return Buffer.from(text,'utf8').toString('base64url');}
function snap(id,title){return{id,title,status:'planning',start_date:null,end_date:null,notes:title==='Gmail trip'?'Created from Gmail evidence.':`Created from Gmail booking reference ${title.replace('Trip booking ','')}.`};}

const trips={
  t1:snap('t1','Trip booking ERENCE'),
  t2:snap('t2','Trip booking ERENCE'),
  t3:snap('t3','Trip booking EMAIL'),
  t4:snap('t4','Trip booking NUMBER'),
  t5:snap('t5','Trip booking 95640384'),
  anz:{id:'anz',title:'ANZ',status:'planning',start_date:'2026-12-10',end_date:'2027-01-04',destination_label:null,destination_city:null,destination_region:null,destination_country:null,notes:null,automation_managed:false}
};
const activities=[
  {id:'a1',source_record_id:'s-q',entity_type:'trip',entity_id:'t1',action:'create',automatic:true,rule_version:'gmail-trip-actions-v0.12.0',new_value:snap('t1','Trip booking ERENCE')},
  {id:'a2',source_record_id:'s-q',entity_type:'trip',entity_id:'t2',action:'create',automatic:true,rule_version:'gmail-trip-actions-v0.12.0',new_value:snap('t2','Trip booking ERENCE')},
  {id:'a3',source_record_id:'s-j',entity_type:'trip',entity_id:'t3',action:'create',automatic:true,rule_version:'gmail-trip-actions-v0.12.0',new_value:snap('t3','Trip booking EMAIL')},
  {id:'a4',source_record_id:'s-b',entity_type:'trip',entity_id:'t4',action:'create',automatic:true,rule_version:'gmail-trip-actions-v0.12.0',new_value:snap('t4','Trip booking NUMBER')},
  {id:'a5',source_record_id:'s-y',entity_type:'trip',entity_id:'t5',action:'create',automatic:true,rule_version:'gmail-trip-actions-v0.12.0',new_value:snap('t5','Trip booking 95640384')},
  {id:'manual',source_record_id:null,entity_type:'trip',entity_id:'anz',action:'create',automatic:false,rule_version:'manual',new_value:trips.anz}
];
const sources={
  's-q':{id:'s-q',gmail_message_id:'m-q',gmail_thread_id:'th-q',sender:'Qantas <noreply@qantas.com>',subject:'Confirmation and E-Ticket Flight Itinerary for ECECAB from Sydney (Kingsford Smith) to Brisbane on 18Dec26',received_at:'2026-09-01T00:00:00Z',source_link:'https://mail.google.com/m-q'},
  's-j':{id:'s-j',gmail_message_id:'m-j',gmail_thread_id:'th-j',sender:'Jetstar <itineraries@jetstar.com>',subject:'Jetstar Flight Itinerary for (Booking ref# QNRY8J) JQ223 15/08/2026 JQ224 22/08/2026',received_at:'2026-08-01T00:00:00Z',source_link:'https://mail.google.com/m-j'},
  's-b':{id:'s-b',gmail_message_id:'m-b',gmail_thread_id:'th-b',sender:'Booking.com <customer.service@booking.com>',subject:'Thanks! Your booking is confirmed at Belle in Bowral',received_at:'2026-09-02T00:00:00Z',source_link:'https://mail.google.com/m-b'},
  's-y':{id:'s-y',gmail_message_id:'m-y',gmail_thread_id:'th-y',sender:'Yonder <reservations@nowbookit.com>',subject:'Booking Confirmation - Yonder',received_at:'2026-08-02T00:00:00Z',source_link:'https://mail.google.com/m-y'}
};
const bodies={
  'm-q':'Your Qantas booking reference is ECECAB. Flight from Sydney (Kingsford Smith) to Brisbane on 18Dec26.',
  'm-j':'Booking ref# QNRY8J. JQ223 Sydney to Queenstown 15/08/2026. JQ224 Queenstown to Sydney 22/08/2026.',
  'm-b':'Confirmation: 5072736754. Belle in Bowral. Bowral, New South Wales, Australia. Check-in 20 December 2026. Check-out 22 December 2026.',
  'm-y':'Booking reference: 95640384\nSaturday 15 August 2026\n6:30 PM - 8:00 PM\nLocation: 14 Church Street, Queenstown, Otago 9300, New Zealand\nManage booking: https://bookings.example/yonder/95640384'
};

function fixtureData(){
  return{
    listLegacyTripCreateActivities:async()=>activities,
    getTrip:async id=>trips[id]||null,
    getTripDependencies:async id=>id==='t4'?{segments:[],bookings:[{id:'real-booking'}],tasks:[],lifeItems:[]}:{segments:[],bookings:[],tasks:[],lifeItems:[]},
    getSource:async id=>sources[id]||null,
    listTrips:async()=>Object.values(trips),
    findCanonicalBooking:async(candidate)=>candidate.confirmation_reference==='ECECAB'?{id:'booking-q',trip_id:null,...candidate}:null,
    findLifeItem:async()=>null
  };
}
function provider(reads){return{getMessage:async id=>{reads.push(id);return{id,threadId:`thread-${id}`,labelIds:['INBOX'],internalDate:String(Date.parse('2026-09-01T00:00:00Z')),snippet:'',payload:{mimeType:'text/plain',headers:[{name:'From',value:sources[Object.keys(sources).find(k=>sources[k].gmail_message_id===id)].sender},{name:'Subject',value:sources[Object.keys(sources).find(k=>sources[k].gmail_message_id===id)].subject}],body:{data:enc(bodies[id])}}};}};}

(async()=>{
  assert.equal(isLegacyTripCreateActivity(activities[0]),true);
  assert.equal(isLegacyTripCreateActivity(activities.at(-1)),false,'manual ANZ activity must never be treated as a Gmail legacy shell');

  const discovered=await discoverLegacyTripShells({data:fixtureData(),expectedBaseline:28});
  assert.equal(discovered.observedCount,5);
  assert.equal(discovered.expectedBaseline,28);
  assert.equal(discovered.baselineMatches,false,'count drift must be surfaced instead of silently accepted');
  assert.equal(discovered.shells.some(row=>row.trip.id==='anz'),false,'manual ANZ trip must not enter the shell set');
  assert.equal(discovered.shells.find(row=>row.trip.id==='t4').cleanupEligible,false,'shell with a real booking dependency must be blocked from cleanup');
  assert.match(discovered.shells.find(row=>row.trip.id==='t4').cleanupReasons.join(' '),/booking/i);
  assert.equal(discovered.shells.find(row=>row.trip.id==='t1').cleanupEligible,true);

  const reads=[];
  const dry=await runGmailTripReconstruction({
    mode:'dry-run',expectedBaseline:28,data:fixtureData(),provider:provider(reads),parserVersion:'reconstruction-v1',paceMs:0,
    bookingActions:{processBooking:async()=>assert.fail('dry-run must never mutate bookings')},
    lifeAdminActions:{createLifeAdminItem:async()=>assert.fail('dry-run must never mutate Life Admin')}
  });
  assert.equal(dry.mode,'dry-run');
  assert.equal(dry.observedCount,5);
  assert.equal(dry.baselineMatches,false);
  assert.ok(dry.warnings.some(x=>/expected 28.*found 5/i.test(x)));
  assert.deepEqual(reads.sort(),['m-b','m-j','m-q','m-y'],'duplicate shell sources must be fetched exactly once');
  assert.equal(dry.rows.length,5,'report remains shell-oriented even when one source created duplicate shells');

  const qRows=dry.rows.filter(row=>row.sourceRecordIds.includes('s-q'));
  assert.equal(qRows.length,2);
  assert.ok(qRows.every(row=>row.candidateObjectType==='booking'));
  assert.ok(qRows.every(row=>row.canonicalObjectId==='booking-q'));
  assert.ok(qRows.every(row=>row.confirmationReference==='ECECAB'));
  assert.ok(qRows.every(row=>row.tripLinkDecision.kind==='review'&&row.tripLinkDecision.tripId==='anz'),'Qantas booking inside manual ANZ dates but without ANZ geography must be review-only');

  const jet=dry.rows.find(row=>row.sourceRecordIds.includes('s-j'));
  assert.equal(jet.confirmationReference,'QNRY8J');
  assert.equal(jet.candidateObjectType,'booking');
  assert.equal(jet.geography.city,'Queenstown');
  assert.equal(jet.tripLinkDecision.kind,'create');
  assert.match(jet.tripLinkDecision.proposedTrip.title,/Queenstown/i);

  const blocked=dry.rows.find(row=>row.oldTripId==='t4');
  assert.equal(blocked.confirmationReference,'5072736754');
  assert.equal(blocked.cleanupEligible,false);

  const yonder=dry.rows.find(row=>row.sourceRecordIds.includes('s-y'));
  assert.equal(yonder.candidateObjectType,'event');
  assert.equal(yonder.confirmationReference,'95640384');
  assert.equal(yonder.geography.city,'Queenstown');

  const appliedBookings=[],appliedEvents=[];
  const applyReads=[];
  const applied=await runGmailTripReconstruction({
    mode:'apply',expectedBaseline:28,data:fixtureData(),provider:provider(applyReads),parserVersion:'reconstruction-v1',paceMs:0,
    bookingActions:{processBooking:async({source,candidate})=>{appliedBookings.push([source.id,candidate.confirmation_reference]);return{booking:{id:`booking-${source.id}`,trip_id:null,...candidate},created:true,linkDecision:{kind:'review',tripId:null,score:0,reasons:['test_apply']}};}},
    lifeAdminActions:{createLifeAdminItem:async(source,candidate)=>{appliedEvents.push([source.id,candidate.confirmation_reference]);return{id:`event-${source.id}`,linked_trip_id:null,...candidate};}}
  });
  assert.equal(applied.mode,'apply');
  assert.deepEqual(applyReads.sort(),['m-b','m-j','m-q','m-y'],'apply also processes each distinct Gmail source once');
  assert.equal(appliedBookings.length,3);
  assert.deepEqual(appliedEvents,[['s-y','95640384']]);
  assert.equal(applied.rows.length,5);
  assert.equal(applied.rows.some(row=>row.oldTripId==='anz'),false);

  const clusterTrips={
    ca:snap('ca','Trip booking REMINDER'),
    cj:snap('cj','Trip booking EMAIL'),
    cy:snap('cy','Trip booking 95640384')
  };
  const clusterActivities=[
    {id:'ca1',source_record_id:'s-air',entity_type:'trip',entity_id:'ca',action:'create',automatic:true,rule_version:'gmail-trip-actions-v0.12.0',new_value:clusterTrips.ca},
    {id:'cj1',source_record_id:'s-jet',entity_type:'trip',entity_id:'cj',action:'create',automatic:true,rule_version:'gmail-trip-actions-v0.12.0',new_value:clusterTrips.cj},
    {id:'cy1',source_record_id:'s-y2',entity_type:'trip',entity_id:'cy',action:'create',automatic:true,rule_version:'gmail-trip-actions-v0.12.0',new_value:clusterTrips.cy}
  ];
  const clusterSources={
    's-air':{id:'s-air',gmail_message_id:'m-air',gmail_thread_id:'th-air',sender:'Airbnb <automated@airbnb.com>',subject:'Reservation reminder - August 15, 2026',received_at:'2026-08-13T00:00:00Z',source_link:'https://mail.google.com/m-air'},
    's-jet':{id:'s-jet',gmail_message_id:'m-jet',gmail_thread_id:'th-jet',sender:'Jetstar <noreplyitineraries@jetstar.com>',subject:'Jetstar Flight Itinerary for (Booking ref# QNRY8J) JQ223 15/08/2026 JQ224 22/08/2026',received_at:'2026-08-13T00:00:00Z',source_link:'https://mail.google.com/m-jet'},
    's-y2':{id:'s-y2',gmail_message_id:'m-y2',gmail_thread_id:'th-y2',sender:'Yonder <info@nowbookit.com>',subject:'Your Reservation at Yonder is coming up',received_at:'2026-08-16T00:00:00Z',source_link:'https://mail.google.com/m-y2'}
  };
  const clusterBodies={
    'm-air':'Reservation reminder for your Queenstown stay. Check-in August 15, 2026.',
    'm-jet':'Booking ref# QNRY8J. JQ223 Sydney to Queenstown 15/08/2026. JQ224 Queenstown to Sydney 22/08/2026.',
    'm-y2':'Date: Monday, August 17, 2026. Booking Reference: 95640384. Time: 6:30 PM - 8:00 PM. Location: 14 Church Street, Queenstown, Otago 9300, New Zealand.'
  };
  const generatedTrips=[];
  const clusterData={
    listLegacyTripCreateActivities:async()=>clusterActivities,
    getTrip:async id=>clusterTrips[id]||generatedTrips.find(row=>row.id===id)||null,
    getTripDependencies:async()=>({segments:[],bookings:[],tasks:[],lifeItems:[]}),
    getSource:async id=>clusterSources[id]||null,
    listTrips:async()=>[...Object.values(clusterTrips),...generatedTrips],
    findCanonicalBooking:async()=>null,
    findLifeItem:async()=>null
  };
  const clusterProvider={getMessage:async id=>{const source=Object.values(clusterSources).find(row=>row.gmail_message_id===id);return{id,threadId:source.gmail_thread_id,labelIds:['INBOX'],internalDate:String(Date.parse(source.received_at)),snippet:'',payload:{mimeType:'text/plain',headers:[{name:'From',value:source.sender},{name:'Subject',value:source.subject}],body:{data:enc(clusterBodies[id])}}};}};
  const clusterDry=await runGmailTripReconstruction({mode:'dry-run',expectedBaseline:3,data:clusterData,provider:clusterProvider,paceMs:0});
  const jetAnchor=clusterDry.rows.find(row=>row.sourceRecordIds.includes('s-jet'));
  const airRelated=clusterDry.rows.find(row=>row.sourceRecordIds.includes('s-air'));
  const yonderRelated=clusterDry.rows.find(row=>row.sourceRecordIds.includes('s-y2'));
  assert.equal(jetAnchor.tripLinkDecision.kind,'create','round-trip itinerary should anchor the generated Queenstown trip');
  assert.equal(airRelated.tripLinkDecision.kind,'link','related Queenstown accommodation should plan to link to the anchor trip');
  assert.equal(airRelated.tripLinkDecision.tripId,'proposed:s-jet');
  assert.equal(yonderRelated.tripLinkDecision.kind,'link','related Queenstown event should plan to link to the anchor trip');
  assert.equal(yonderRelated.tripLinkDecision.tripId,'proposed:s-jet');

  const applyOrder=[];
  await runGmailTripReconstruction({
    mode:'apply',expectedBaseline:3,data:clusterData,provider:clusterProvider,paceMs:0,
    bookingActions:{processBooking:async({source,candidate,trips})=>{
      applyOrder.push(source.id);
      if(source.id==='s-jet'){
        const trip={id:'generated-queenstown',title:'Queenstown, New Zealand',status:'planning',start_date:'2026-08-15',end_date:'2026-08-22',destination_label:'Queenstown, New Zealand',destination_city:'Queenstown',destination_region:null,destination_country:'New Zealand',automation_managed:true};
        generatedTrips.push(trip);
        return{booking:{id:'booking-jet',trip_id:trip.id,...candidate},created:true,linkDecision:{kind:'create',tripId:null,score:90,reasons:['round_trip_itinerary'],proposedTrip:trip}};
      }
      assert.ok(trips.some(row=>row.id==='generated-queenstown'),'anchor trip must exist before related booking apply');
      return{booking:{id:`booking-${source.id}`,trip_id:'generated-queenstown',...candidate},created:true,linkDecision:{kind:'link',tripId:'generated-queenstown',score:100,reasons:['date_overlap','geography_match'],proposedTrip:null}};
    }},
    lifeAdminActions:{createLifeAdminItem:async(source,candidate)=>{applyOrder.push(source.id);assert.ok(generatedTrips.some(row=>row.id==='generated-queenstown'),'anchor trip must exist before related event apply');return{id:'event-y2',linked_trip_id:'generated-queenstown',...candidate};}}
  });
  assert.equal(applyOrder[0],'s-jet','strong trip creator must be applied before related source records regardless of shell/source order');

  const delays=[];let attempts=0;
  const retried=await withQuotaRetry(async()=>{attempts+=1;if(attempts<3){const error=new Error('403 quota exceeded');error.status=403;throw error;}return'ok';},{sleep:async ms=>delays.push(ms),delays:[15,30,60]});
  assert.equal(retried,'ok');
  assert.deepEqual(delays,[15,30]);

  console.log('gmail trip reconstruction tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
