const assert=require('node:assert/strict');
const {buildGmailBookingActions}=require('../src/services/gmail-booking-actions');

function harness({existing=null,decision={kind:'review',tripId:null,score:30,reasons:['insufficient_trip_dates'],proposedTrip:null}}={}){
  const calls=[];
  let booking=existing||null;
  const bookingData={
    createBookingFromGmail:async(_db,_user,input,metadata)=>{calls.push(['createBooking',input,metadata]);booking={id:'b-new',...input,source_metadata:metadata};return booking;},
    updateBookingFromGmail:async(_db,_user,id,patch,metadata)=>{calls.push(['updateBooking',id,patch,metadata]);booking={...(booking||{id}),...patch,source_metadata:{...(booking&&booking.source_metadata||{}),...metadata}};return booking;}
  };
  const bookingSourceData={
    findCanonicalBookingForGmailCandidate:async()=>existing,
    linkBookingSource:async(_db,_user,bookingId,sourceId)=>{calls.push(['linkSource',bookingId,sourceId]);return{id:'link1'};}
  };
  const tripData={
    createGeneratedTrip:async(_db,_user,input)=>{calls.push(['createTrip',input]);return{id:'trip-new',...input,automation_managed:true};}
  };
  const gmailData={recordGmailActivity:async(_db,_uid,entry)=>{calls.push(['activity',entry]);return entry;}};
  const reviewData={createReviewItem:async(source,linkDecision)=>{calls.push(['review',source.id,linkDecision]);return{id:'review1'};}};
  const actions=buildGmailBookingActions({supabase:{},userId:'u1',bookingData,bookingSourceData,tripData,gmailData,reviewData,proposeTripLink:()=>decision,ruleVersion:'booking-actions-test'});
  return{actions,calls,getBooking:()=>booking};
}

const source={id:'src1',gmail_message_id:'m1',gmail_thread_id:'thread1',source_link:'https://mail.google.com/x',sender:'Qantas',subject:'Flight'};
const candidate={booking_type:'flight',provider:'Qantas',confirmation_reference:'ECECAB',title:'Sydney → Brisbane flight',status:'confirmed',starts_at:'2026-12-18T00:00:00Z',ends_at:null,time_zone:'Australia/Sydney',location:'Brisbane',origin:'Sydney',destination:'Brisbane',booking_url:null,geography:{label:'Brisbane',city:'Brisbane',country:'Australia'},confidence:0.97,evidence:['provider:qantas']};
const facts=[{fact_type:'booking.identity'}];

(async()=>{
  let h=harness();
  let result=await h.actions.processBooking({source,candidate,facts,trips:[]});
  assert.equal(result.booking.id,'b-new');
  assert.equal(h.calls.filter(c=>c[0]==='createBooking').length,1,'first travel source creates a Booking');
  assert.equal(h.calls.filter(c=>c[0]==='createTrip').length,0,'review decision must not create a Trip');
  assert.deepEqual(h.calls.find(c=>c[0]==='linkSource').slice(1),['b-new','src1']);
  assert.equal(h.calls.find(c=>c[0]==='createBooking')[2].source,'gmail');
  assert.ok(h.calls.some(c=>c[0]==='review'));
  assert.ok(h.calls.filter(c=>c[0]==='activity').every(c=>c[1].entityType!=='trip'),'booking/review flow must not log a fake trip change');

  const existing={id:'b-existing',provider:'Qantas',confirmation_reference:'ECECAB',status:'confirmed',source_metadata:{source:'gmail',manual_fields:['title']},title:'My flight'};
  h=harness({existing,decision:{kind:'none',tripId:null,score:0,reasons:['insufficient_evidence'],proposedTrip:null}});
  result=await h.actions.processBooking({source:{...source,id:'src2'},candidate:{...candidate,title:'Automated new title',status:'cancelled'},facts,trips:[]});
  assert.equal(h.calls.filter(c=>c[0]==='createBooking').length,0,'follow-up must reuse canonical booking');
  const update=h.calls.find(c=>c[0]==='updateBooking');
  assert.equal(update[1],'b-existing');
  assert.equal(update[2].status,'cancelled','Gmail cancellation can update automation-owned status');
  assert.equal(update[2].title,'Automated new title','service supplies extracted fields; data layer enforces manual_fields');
  assert.deepEqual(h.calls.find(c=>c[0]==='linkSource').slice(1),['b-existing','src2']);

  h=harness({existing,decision:{kind:'link',tripId:'trip1',score:90,reasons:['date_overlap','geography_match'],proposedTrip:null}});
  await h.actions.processBooking({source,candidate,facts,trips:[{id:'trip1'}]});
  const linkUpdate=h.calls.filter(c=>c[0]==='updateBooking').at(-1);
  assert.equal(linkUpdate[2].trip_id,'trip1');
  assert.ok(h.calls.some(c=>c[0]==='activity'&&c[1].entityType==='booking'&&c[1].action==='update'));
  assert.equal(h.calls.some(c=>c[0]==='activity'&&c[1].entityType==='trip'),false);

  const manualTripBooking={id:'b-manual-trip',trip_id:'manual-trip',provider:'Qantas',confirmation_reference:'ECECAB',status:'confirmed',title:'My flight',source_metadata:{source:'gmail',manual_fields:['trip_id']}};
  h=harness({existing:manualTripBooking,decision:{kind:'link',tripId:'wrong-trip',score:99,reasons:['date_overlap','geography_match'],proposedTrip:null}});
  result=await h.actions.processBooking({source:{...source,id:'src-manual'},candidate,facts,trips:[{id:'manual-trip'},{id:'wrong-trip'}]});
  assert.equal(result.booking.trip_id,'manual-trip');
  assert.equal(result.linkDecision.kind,'link');
  assert.equal(result.linkDecision.tripId,'manual-trip');
  assert.deepEqual(result.linkDecision.reasons,['manual_trip_assignment']);
  assert.equal(h.calls.filter(c=>c[0]==='updateBooking'&&Object.hasOwn(c[2],'trip_id')).length,0,'manual trip lock must remove trip_id from Gmail enrichment and skip matcher relinks');
  assert.equal(h.calls.some(c=>c[0]==='activity'&&c[1].fieldName==='trip_id'),false,'manual trip assignment must not log a false Gmail relink');

  const manualUnlinkedBooking={...manualTripBooking,id:'b-manual-unlinked',trip_id:null};
  h=harness({existing:manualUnlinkedBooking,decision:{kind:'create',tripId:null,score:99,reasons:['strong_accommodation'],proposedTrip:{title:'Wrong generated trip'}}});
  result=await h.actions.processBooking({source:{...source,id:'src-manual-unlinked'},candidate:{...candidate,booking_type:'accommodation'},facts,trips:[]});
  assert.equal(result.booking.trip_id,null);
  assert.equal(result.linkDecision.kind,'none');
  assert.equal(result.linkDecision.tripId,null);
  assert.deepEqual(result.linkDecision.reasons,['manual_trip_assignment']);
  assert.equal(h.calls.some(c=>c[0]==='createTrip'),false,'manual No trip choice must prevent generated trip creation');
  assert.equal(h.calls.some(c=>c[0]==='activity'&&c[1].fieldName==='trip_id'),false);

  const createDecision={kind:'create',tripId:null,score:95,reasons:['strong_accommodation'],proposedTrip:{title:'Bowral, NSW',start_date:'2026-12-20',end_date:'2026-12-22',destination_label:'Bowral, NSW',destination_city:'Bowral',destination_region:'NSW',destination_country:'Australia',status:'planning'}};
  h=harness({decision:createDecision});
  await h.actions.processBooking({source,candidate:{...candidate,booking_type:'accommodation',title:'Belle in Bowral'},facts,trips:[]});
  assert.equal(h.calls.filter(c=>c[0]==='createTrip').length,1);
  assert.equal(h.calls.filter(c=>c[0]==='updateBooking').at(-1)[2].trip_id,'trip-new');
  assert.ok(h.calls.some(c=>c[0]==='activity'&&c[1].entityType==='trip'&&c[1].action==='create'));
  assert.doesNotMatch(h.calls.find(c=>c[0]==='createTrip')[1].title,/ECECAB|confirmation/i);

  console.log('gmail booking action tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
