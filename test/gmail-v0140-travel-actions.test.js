const assert=require('node:assert/strict');
const {buildGmailBookingActions}=require('../src/services/gmail-booking-actions');
const {buildGmailLifeAdminActions}=require('../src/services/gmail-life-admin-actions');

const source={id:'src1',gmail_message_id:'m1',gmail_thread_id:'t1',sender:'Jetstar',subject:'Itinerary'};
const legs=[
  {position:1,service_number:'JQ223',origin:'Sydney',destination:'Queenstown',departs_at:'2026-08-15T01:50:00.000Z',arrives_at:'2026-08-15T04:45:00.000Z',departure_time_zone:'Australia/Sydney',arrival_time_zone:'Pacific/Auckland'},
  {position:2,service_number:'JQ224',origin:'Queenstown',destination:'Sydney',departs_at:'2026-08-22T05:45:00.000Z',arrives_at:null,departure_time_zone:'Pacific/Auckland',arrival_time_zone:'Australia/Sydney'}
];
const candidate={booking_type:'flight',provider:'Jetstar',confirmation_reference:'QNRY8J',title:'Sydney → Queenstown flights',status:'confirmed',starts_at:'2026-08-15T01:50:00.000Z',ends_at:'2026-08-22T05:45:00.000Z',time_zone:'Pacific/Auckland',origin:'Sydney',destination:'Queenstown',location:'Queenstown',geography:{city:'Queenstown',country:'New Zealand'},legs};

(async()=>{
  {
    const calls=[];let matcherTrips=null;
    const actions=buildGmailBookingActions({supabase:{},userId:'u1',
      bookingData:{createBookingFromGmail:async(_s,_u,input,metadata)=>({id:'b1',...input,source_metadata:metadata}),updateBookingFromGmail:async(_s,_u,id,patch)=>({id,...patch})},
      bookingSourceData:{findCanonicalBookingForGmailCandidate:async()=>null,linkBookingSource:async()=>({id:'l1'})},
      bookingLegData:{upsertBookingLegFromGmail:async(_s,_u,bid,leg,meta)=>{calls.push(['leg',bid,leg.position,meta.source_record_id]);return{id:`l${leg.position}`,...leg};}},
      tripData:{createGeneratedTrip:async()=>assert.fail('archived candidate must not cause generated trip here')},
      gmailData:{recordGmailActivity:async()=>{}},
      proposeTripLink:({trips})=>{matcherTrips=trips;return{kind:'none',tripId:null,score:0,reasons:['none'],proposedTrip:null};}
    });
    await actions.processBooking({source,candidate,trips:[{id:'active',archived_at:null},{id:'archived',archived_at:'2026-09-01T00:00:00Z'}]});
    assert.deepEqual(matcherTrips.map(t=>t.id),['active'],'new matching must exclude archived trips');
    assert.deepEqual(calls,[['leg','b1',1,'src1'],['leg','b1',2,'src1']],'all extracted legs must persist after canonical booking resolution');
  }

  {
    const calls=[];
    const existing={id:'b2',trip_id:'archived-trip',source_metadata:{source:'gmail',manual_fields:[]}};
    const actions=buildGmailBookingActions({supabase:{},userId:'u1',
      bookingData:{updateBookingFromGmail:async(_s,_u,id,patch)=>{calls.push(['updateBooking',id,patch]);return{...existing,...patch};}},
      bookingSourceData:{findCanonicalBookingForGmailCandidate:async()=>existing,linkBookingSource:async()=>({id:'l2'})},
      bookingLegData:{upsertBookingLegFromGmail:async()=>({})},
      tripData:{createGeneratedTrip:async()=>{calls.push(['createTrip']);return{id:'bad'};}},
      gmailData:{recordGmailActivity:async()=>{}},
      proposeTripLink:()=>{calls.push(['matcher']);return{kind:'create',tripId:null,score:99,reasons:['bad'],proposedTrip:{title:'bad'}};}
    });
    const result=await actions.processBooking({source,candidate,trips:[{id:'archived-trip',archived_at:'2026-09-01T00:00:00Z'}]});
    assert.equal(result.linkDecision.kind,'link');
    assert.equal(result.linkDecision.tripId,'archived-trip');
    assert.deepEqual(result.linkDecision.reasons,['existing_archived_trip_assignment']);
    assert.equal(calls.some(c=>c[0]==='matcher'),false);
    assert.equal(calls.some(c=>c[0]==='createTrip'),false);
    assert.equal(calls.filter(c=>c[0]==='updateBooking'&&Object.hasOwn(c[2],'trip_id')).length,0,'existing archived assignment must never be rewritten');
  }

  {
    let matcherTrips=null;
    const item={id:'e1',category:'event',title:'Yonder reservation',status:'upcoming',starts_at:'2026-08-17T06:30:00.000Z',linked_trip_id:null,source_metadata:{source:'gmail',manual_fields:[]}};
    const actions=buildGmailLifeAdminActions({supabase:{},userId:'u1',
      lifeAdminData:{ensureGmailLifeItem:async()=>({item,created:true}),updateLifeItemFromGmail:async()=>assert.fail('archived-only event must remain unlinked')},
      tripData:{listTrips:async()=>[{id:'active',archived_at:null},{id:'archived',archived_at:'2026-09-01T00:00:00Z'}]},
      gmailData:{recordGmailActivity:async()=>{}},reviewData:{createGmailReviewLink:async()=>{}},
      tripLinker:({trips})=>{matcherTrips=trips;return{kind:'none',tripId:null,score:0,reasons:['none'],proposedTrip:null};}
    });
    await actions.createLifeAdminItem(source,{...item,geography:{city:'Queenstown',country:'New Zealand'}},{reason:'event'});
    assert.deepEqual(matcherTrips.map(t=>t.id),['active'],'new event auto-linking must exclude archived trips');
  }

  console.log('v0.14 Gmail travel action tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
