const assert=require('node:assert/strict');
const {runGmailLifeAdminBackfill,TARGET_SCAN_IDS}=require('../src/services/gmail-life-admin-backfill');

assert.deepEqual(TARGET_SCAN_IDS,[
  '9a06fdfc-7e7a-42e8-91df-49132cdb4350',
  'fbd21ea9-c07d-4b8a-a725-7f345486562e'
]);

const sources=[
  {id:'s1',gmail_message_id:'m1',gmail_thread_id:'t1',sender:'Booking Confirmation from Physiotherapy. <noreply@nookal.com>',subject:'Booking Confirmation - Physiotherapy',received_at:'2026-09-01T00:00:00Z'},
  {id:'s2',gmail_message_id:'m2',gmail_thread_id:'t1',sender:'HealthShare <no-reply@healthshare.com.au>',subject:'Reminder: Eye Test appointment is coming up',received_at:'2026-09-02T00:00:00Z'},
  {id:'s3',gmail_message_id:'m3',gmail_thread_id:'t3',sender:'Virgin Australia <no-reply@virginaustralia.com>',subject:'Your Virgin Australia Travel Reminder',received_at:'2026-09-03T00:00:00Z'},
  {id:'s4',gmail_message_id:'m4',gmail_thread_id:'t4',sender:'Uber <no-reply@uber.com>',subject:'Reservation confirmed for Sunday 5 July',received_at:'2026-09-04T00:00:00Z'},
  {id:'s5',gmail_message_id:'m5',gmail_thread_id:'t5',sender:'Commonwealth Bank <news@example.com>',subject:'Book your next holiday with your CommBank credit card',received_at:'2026-09-05T00:00:00Z'}
];

(async()=>{
  const handledThreads=new Set();
  const created=[];
  const provider={getMessage:async id=>({id,threadId:sources.find(s=>s.gmail_message_id===id).gmail_thread_id,snippet:id==='m1'?'Appointment 30 September 2026':''})};
  const actions={
    createLifeAdminItem:async(source,candidate)=>{created.push(['life',source.id,candidate]);handledThreads.add(source.gmail_thread_id);return {id:`life-${source.id}`};},
    createReviewItem:async source=>{created.push(['review',source.id]);handledThreads.add(source.gmail_thread_id);return {id:`review-${source.id}`};}
  };
  const isAlreadyHandled=async source=>handledThreads.has(source.gmail_thread_id);

  const first=await runGmailLifeAdminBackfill({sources,provider,actions,isAlreadyHandled,interMessageDelayMs:0});
  assert.deepEqual(first,{total:5,lifeAdminCreated:1,reviewCreated:1,tripSkipped:1,ignored:1,alreadyHandled:1,errors:0});
  assert.equal(created.filter(x=>x[0]==='life').length,1);
  assert.equal(created.filter(x=>x[0]==='review').length,1);
  assert.equal(created.some(x=>x[1]==='s3'),false,'Trip-classified messages must never call a mutating action');

  const second=await runGmailLifeAdminBackfill({sources,provider,actions,isAlreadyHandled,interMessageDelayMs:0});
  assert.deepEqual(second,{total:5,lifeAdminCreated:0,reviewCreated:0,tripSkipped:1,ignored:1,alreadyHandled:3,errors:0});
  assert.equal(created.length,2,'rerunning the backfill must not duplicate Life Admin or review items');

  const brokenAttempts=[];
  const broken=await runGmailLifeAdminBackfill({
    sources:[{id:'bad',gmail_message_id:'missing',gmail_thread_id:'tb',sender:'Physio',subject:'Appointment confirmation'}],
    provider:{getMessage:async()=>{brokenAttempts.push(1);const error=new Error('not found');error.status=404;throw error;}},
    actions,
    isAlreadyHandled,
    interMessageDelayMs:0,
    sleep:async()=>{}
  });
  assert.equal(broken.errors,1);
  assert.equal(broken.total,1);
  assert.equal(brokenAttempts.length,1,'non-retryable Gmail errors should not be retried');

  let throttleAttempts=0;
  let throttleCreates=0;
  const throttleSleeps=[];
  const throttled=await runGmailLifeAdminBackfill({
    sources:[{id:'retry',gmail_message_id:'retry-message',gmail_thread_id:'retry-thread',sender:'HealthShare <no-reply@healthshare.com.au>',subject:'Reminder: Eye Test appointment is coming up',received_at:'2026-09-02T00:00:00Z'}],
    provider:{getMessage:async()=>{throttleAttempts+=1;if(throttleAttempts<3){const error=new Error('rate limited');error.status=429;throw error;}return{threadId:'retry-thread',snippet:'Appointment 30 September 2026'};}},
    actions:{createLifeAdminItem:async()=>{throttleCreates+=1;return{id:'life-retry'};},createReviewItem:async()=>({id:'review-retry'})},
    isAlreadyHandled:async()=>false,
    retryDelaysMs:[1,2,3],
    interMessageDelayMs:0,
    sleep:async ms=>{throttleSleeps.push(ms);}
  });
  assert.equal(throttleAttempts,3,'429 responses should be retried');
  assert.deepEqual(throttleSleeps,[1,2]);
  assert.equal(throttled.errors,0);
  assert.equal(throttled.lifeAdminCreated,1);
  assert.equal(throttleCreates,1);

  let quotaAttempts=0;
  const quotaSleeps=[];
  const quotaResult=await runGmailLifeAdminBackfill({
    sources:[{id:'quota',gmail_message_id:'quota-message',gmail_thread_id:'quota-thread',sender:'HealthShare <no-reply@healthshare.com.au>',subject:'Reminder: Eye Test appointment is coming up',received_at:'2026-09-02T00:00:00Z'}],
    provider:{getMessage:async()=>{quotaAttempts+=1;if(quotaAttempts<2){const error=new Error('Quota exceeded');error.status=403;error.body={error:{status:'PERMISSION_DENIED',errors:[{reason:'rateLimitExceeded'}]}};throw error;}return{threadId:'quota-thread',snippet:'Appointment 30 September 2026'};}},
    actions:{createLifeAdminItem:async()=>({id:'life-quota'}),createReviewItem:async()=>({id:'review-quota'})},
    isAlreadyHandled:async()=>false,
    retryDelaysMs:[17,29],
    interMessageDelayMs:0,
    sleep:async ms=>{quotaSleeps.push(ms);}
  });
  assert.equal(quotaAttempts,2,'Gmail 403 rateLimitExceeded should be retried');
  assert.deepEqual(quotaSleeps,[17]);
  assert.equal(quotaResult.errors,0);

  let permissionAttempts=0;
  const permissionResult=await runGmailLifeAdminBackfill({
    sources:[{id:'forbidden',gmail_message_id:'forbidden-message',gmail_thread_id:'forbidden-thread',sender:'Physio',subject:'Appointment confirmation'}],
    provider:{getMessage:async()=>{permissionAttempts+=1;const error=new Error('Forbidden');error.status=403;error.body={error:{status:'PERMISSION_DENIED',errors:[{reason:'insufficientPermissions'}]}};throw error;}},
    actions,
    isAlreadyHandled:async()=>false,
    retryDelaysMs:[1,2],
    interMessageDelayMs:0,
    sleep:async()=>{}
  });
  assert.equal(permissionAttempts,1,'ordinary permission 403s must not be retried');
  assert.equal(permissionResult.errors,1);

  const paceSleeps=[];
  await runGmailLifeAdminBackfill({
    sources:[
      {id:'p1',gmail_message_id:'pm1',gmail_thread_id:'pt1',sender:'Commonwealth Bank <news@example.com>',subject:'Book your next holiday with your CommBank credit card'},
      {id:'p2',gmail_message_id:'pm2',gmail_thread_id:'pt2',sender:'Commonwealth Bank <news@example.com>',subject:'Book your next holiday with your CommBank credit card'}
    ],
    provider:{getMessage:async id=>({id,threadId:id,snippet:''})},
    actions,
    isAlreadyHandled:async()=>false,
    sleep:async ms=>{paceSleeps.push(ms);}
  });
  assert.deepEqual(paceSleeps,[1000],'backfill should default to one Gmail message read per second');

  console.log('gmail Life Admin backfill tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
