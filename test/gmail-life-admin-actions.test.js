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

  const source={id:'src1',gmail_message_id:'m1',source_link:'https://mail.google.com/mail/u/0/#all/m1',sender:'Physio <noreply@nookal.com>',subject:'Booking Confirmation - Physiotherapy'};
  const candidate={title:'Physiotherapy appointment',category:'appointment',status:'upcoming',due_at:null,starts_at:null,recurrence_rule:null,priority:'normal',notes:'From Gmail.',linked_person_id:null};
  const created=await actions.createLifeAdminItem(source,candidate,{reason:'health_appointment'});
  assert.equal(created.id,'life1');
  const createCall=calls.find(c=>c[0]==='createLifeItem');
  assert.equal(createCall[3].source,'gmail');
  assert.equal(createCall[3].source_record_id,'src1');
  assert.equal(createCall[3].gmail_message_id,'m1');
  assert.equal(createCall[3].classification_reason,'health_appointment');
  assert.equal(calls.some(c=>c[0]==='activity'&&c[2].entityType==='life_item'&&c[2].entityId==='life1'&&c[2].action==='create'),true);

  const review=await actions.createReviewItem({id:'src2',gmail_message_id:'m2',source_link:'https://mail.google.com/m2',sender:'Uber <no-reply@uber.com>',subject:'Reservation confirmed for Sunday 5 July'},{reason:'ambiguous_booking'});
  assert.equal(review.id,'life1');
  const reviewCreate=calls.filter(c=>c[0]==='createLifeItem').at(-1);
  assert.equal(reviewCreate[2].category,'other');
  assert.equal(reviewCreate[2].status,'needs_action');
  assert.match(reviewCreate[2].title,/Review Gmail/i);
  assert.equal(calls.some(c=>c[0]==='reviewLink'&&c[2].sourceRecordId==='src2'&&c[2].reviewItemId==='life1'&&c[2].reviewType==='ambiguous_booking'),true);
  assert.equal(calls.some(c=>c[0]==='activity'&&c[2].entityType==='gmail_review'&&c[2].entityId==='life1'&&c[2].action==='create'),true);

  console.log('gmail Life Admin action tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
