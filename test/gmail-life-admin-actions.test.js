const assert=require('node:assert/strict');
const {buildGmailLifeAdminActions}=require('../src/services/gmail-life-admin-actions');

(async()=>{
  const calls=[];
  const lifeAdminData={
    createGmailLifeItem:async(_db,user,input,source)=>{calls.push(['createLifeItem',user,input,source]);return {id:'life1',...input,source_metadata:source};}
  };
  const gmailData={recordGmailActivity:async(_db,userId,entry)=>{calls.push(['activity',userId,entry]);return {id:'act1',...entry};}};
  const reviewData={createGmailReviewLink:async(_db,userId,input)=>{calls.push(['reviewLink',userId,input]);return {id:'review-link-1',...input};}};
  const actions=buildGmailLifeAdminActions({supabase:{},userId:'user1',lifeAdminData,gmailData,reviewData});

  const source={id:'src1',gmail_message_id:'m1',gmail_thread_id:'thread1',source_link:'https://mail.google.com/mail/u/0/#all/m1',sender:'Physio <noreply@nookal.com>',subject:'Booking Confirmation - Physiotherapy'};
  const candidate={title:'Physiotherapy appointment',category:'appointment',status:'upcoming',due_at:null,starts_at:null,recurrence_rule:null,priority:'normal',notes:'From Gmail.',linked_person_id:null};
  const created=await actions.createLifeAdminItem(source,candidate,{reason:'health_appointment'});
  assert.equal(created.id,'life1');
  const createCall=calls.find(c=>c[0]==='createLifeItem');
  assert.equal(createCall[3].source,'gmail');
  assert.equal(createCall[3].source_record_id,'src1');
  assert.equal(createCall[3].gmail_message_id,'m1');
  assert.equal(createCall[3].gmail_thread_id,'thread1');
  assert.equal(createCall[3].classification_reason,'health_appointment');
  assert.equal(calls.some(c=>c[0]==='activity'&&c[2].entityType==='life_item'&&c[2].entityId==='life1'&&c[2].action==='create'),true);

  const review=await actions.createReviewItem({id:'src2',gmail_message_id:'m2',gmail_thread_id:'thread2',source_link:'https://mail.google.com/m2',sender:'Uber <no-reply@uber.com>',subject:'Reservation confirmed for Sunday 5 July'},{reason:'ambiguous_booking'});
  assert.equal(review.id,'life1');
  const reviewCreate=calls.filter(c=>c[0]==='createLifeItem').at(-1);
  assert.equal(reviewCreate[2].category,'other');
  assert.equal(reviewCreate[2].status,'needs_action');
  assert.match(reviewCreate[2].title,/Review Gmail/i);
  assert.equal(calls.some(c=>c[0]==='reviewLink'&&c[2].sourceRecordId==='src2'&&c[2].reviewItemId==='life1'&&c[2].reviewType==='confirm_new_item'),true);
  assert.equal(calls.some(c=>c[0]==='activity'&&c[2].entityType==='gmail_review'&&c[2].entityId==='life1'&&c[2].action==='create'),true);

  const eventCalls=[];
  let storedEvent={
    id:'event1',title:'Yonder reservation',category:'event',status:'upcoming',starts_at:'2026-08-15T06:30:00.000Z',ends_at:'2026-08-15T08:00:00.000Z',time_zone:'Pacific/Auckland',location:'14 Church Street, Queenstown, Otago 9300, New Zealand',provider:'Yonder',confirmation_reference:'95640384',booking_url:'https://bookings.example/yonder/95640384',linked_trip_id:null,source_metadata:{source:'gmail',manual_fields:[]}
  };
  const eventCandidate={...storedEvent,id:undefined,source_metadata:undefined,geography:{label:'Queenstown, Otago',city:'Queenstown',region:'Otago',country:'New Zealand'}};
  const eventActions=buildGmailLifeAdminActions({
    supabase:{},userId:'user1',
    lifeAdminData:{
      ensureGmailLifeItem:async()=>({item:storedEvent,created:true}),
      updateLifeItemFromGmail:async(_db,_user,id,patch)=>{eventCalls.push(['update',id,patch]);storedEvent={...storedEvent,...patch};return storedEvent;}
    },
    tripData:{listTrips:async()=>[{id:'trip-q',title:'Queenstown',start_date:'2026-08-15',end_date:'2026-08-22',destination_label:'Queenstown, Otago',destination_city:'Queenstown',destination_region:'Otago',destination_country:'New Zealand',automation_managed:false}]},
    gmailData:{recordGmailActivity:async(_db,_uid,entry)=>eventCalls.push(['activity',entry])},
    reviewData:{createGmailReviewLink:async(_db,_uid,input)=>eventCalls.push(['review',input])}
  });
  const linked=await eventActions.createLifeAdminItem({id:'src-y',gmail_message_id:'my',gmail_thread_id:'ty',source_link:'https://mail.google.com/my',sender:'Yonder',subject:'Booking Confirmation - Yonder'},eventCandidate,{reason:'restaurant_reservation'});
  assert.equal(linked.linked_trip_id,'trip-q');
  assert.equal(eventCalls.some(c=>c[0]==='update'&&c[2].linked_trip_id==='trip-q'),true,'compatible dated/geocoded event should link to existing trip');
  assert.equal(eventCalls.some(c=>c[0]==='activity'&&c[1].entityType==='life_item'&&c[1].fieldName==='linked_trip_id'&&c[1].newValue==='trip-q'),true);
  assert.equal(eventCalls.some(c=>c[0]==='review'),false);

  const ambiguousCalls=[];
  const ambiguous={id:'event2',title:'Dinner reservation',category:'event',status:'upcoming',starts_at:'2026-12-18T08:00:00.000Z',linked_trip_id:null,source_metadata:{source:'gmail',manual_fields:[]}};
  const ambiguousActions=buildGmailLifeAdminActions({
    supabase:{},userId:'user1',
    lifeAdminData:{ensureGmailLifeItem:async()=>({item:ambiguous,created:true}),updateLifeItemFromGmail:async()=>assert.fail('date-only ambiguous event must remain unlinked')},
    tripData:{listTrips:async()=>[{id:'anz',title:'ANZ',start_date:'2026-12-10',end_date:'2027-01-04',destination_label:null,destination_city:null,destination_region:null,destination_country:null,automation_managed:false}]},
    gmailData:{recordGmailActivity:async()=>{}},
    reviewData:{createGmailReviewLink:async(_db,_uid,input)=>{ambiguousCalls.push(input);return input;}}
  });
  const ambiguousResult=await ambiguousActions.createLifeAdminItem({id:'src-a',gmail_message_id:'ma',gmail_thread_id:'ta',source_link:'https://mail.google.com/ma',sender:'Restaurant',subject:'Dinner confirmed'},ambiguous,{reason:'restaurant_reservation'});
  assert.equal(ambiguousResult.linked_trip_id,null);
  assert.equal(ambiguousCalls.length,1,'ambiguous event-to-trip match should create review behavior');
  assert.equal(ambiguousCalls[0].reviewItemId,'event2');
  assert.equal(ambiguousCalls[0].reviewType,'confirm_match');

  const manualCalls=[];
  const manualItem={...storedEvent,id:'event3',linked_trip_id:'trip-manual',source_metadata:{source:'gmail',manual_fields:['linked_trip_id']}};
  const manualActions=buildGmailLifeAdminActions({
    supabase:{},userId:'user1',
    lifeAdminData:{ensureGmailLifeItem:async()=>({item:manualItem,created:false}),updateLifeItemFromGmail:async(_db,_user,_id,patch)=>{manualCalls.push(patch);return {...manualItem,...patch};}},
    tripData:{listTrips:async()=>[{id:'trip-q',start_date:'2026-08-15',end_date:'2026-08-22',destination_city:'Queenstown',destination_region:'Otago',destination_country:'New Zealand',automation_managed:false}]},
    gmailData:{recordGmailActivity:async()=>{}},reviewData:{createGmailReviewLink:async()=>{}}
  });
  const manualResult=await manualActions.createLifeAdminItem({id:'src-m',gmail_message_id:'mm',gmail_thread_id:'ty',source_link:'https://mail.google.com/mm',sender:'Yonder',subject:'Reservation reminder'},eventCandidate,{reason:'restaurant_reservation'});
  assert.equal(manualResult.linked_trip_id,'trip-manual','manual trip link must never be replaced by Gmail');
  assert.equal(manualCalls.some(p=>Object.hasOwn(p,'linked_trip_id')),false);

  const duplicateCalls=[];
  const duplicateActions=buildGmailLifeAdminActions({
    supabase:{},userId:'user1',
    lifeAdminData:{
      ensureGmailLifeItem:async()=>({item:{id:'existing-life',...candidate,source_metadata:{source:'gmail',manual_fields:[]}},created:false}),
      createGmailLifeItem:async()=>assert.fail('existing Gmail thread must not insert another Life Admin item'),
      updateLifeItemFromGmail:async()=>assert.fail('unchanged follow-up must not create a redundant update')
    },
    gmailData:{recordGmailActivity:async()=>duplicateCalls.push('activity')},
    reviewData:{createGmailReviewLink:async()=>duplicateCalls.push('reviewLink')}
  });
  const duplicateSource={id:'src3',gmail_message_id:'m3',gmail_thread_id:'thread1',source_link:'https://mail.google.com/m3',sender:'Physio',subject:'Reminder: appointment'};
  assert.equal((await duplicateActions.createLifeAdminItem(duplicateSource,candidate,{reason:'health_appointment'})).id,'existing-life');
  assert.equal((await duplicateActions.createReviewItem(duplicateSource,{reason:'ambiguous_booking'})).id,'existing-life');
  assert.deepEqual(duplicateCalls,[],'idempotent reprocessing must not duplicate activity or review links');

  console.log('gmail Life Admin action tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
