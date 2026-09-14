const assert=require('node:assert/strict');
const {ensureGmailLifeItem,gmailSourceMetadata,updateLifeItemFromGmail}=require('../src/data/life-admin');

function fakeSupabase(){
  const rows=[];
  return {
    rows,
    from(table){
      assert.equal(table,'life_items');
      const filters=[];
      let insertRow=null,updateRow=null;
      const chain={
        select(){return chain;},
        eq(key,value){filters.push([key,value]);return chain;},
        limit(){return chain;},
        maybeSingle(){
          const found=rows.find(row=>filters.every(([key,value])=>{
            if(key==='user_id')return row.user_id===value;
            const match=key.match(/^source_metadata->>(.+)$/);
            if(match)return row.source_metadata&&row.source_metadata[match[1]]===value;
            return row[key]===value;
          }));
          if(found&&updateRow)Object.assign(found,updateRow);
          return Promise.resolve({data:found||null,error:null});
        },
        insert(row){insertRow=row;return chain;},
        update(row){updateRow=row;return chain;},
        single(){
          const saved={id:`life${rows.length+1}`,...insertRow};
          rows.push(saved);
          return Promise.resolve({data:saved,error:null});
        }
      };
      return chain;
    }
  };
}

(async()=>{
  assert.deepEqual(gmailSourceMetadata({source_record_id:'src1',gmail_message_id:'m1',gmail_thread_id:'thread1'}),{
    source:'gmail',source_record_id:'src1',gmail_message_id:'m1',gmail_thread_id:'thread1',source_link:null,sender:null,classification_reason:null
  });
  const db=fakeSupabase();
  const user={id:'u1'};
  const input={title:'Physiotherapy appointment',category:'appointment',status:'upcoming',priority:'normal'};
  const first=await ensureGmailLifeItem(db,user,input,{source_record_id:'src1',gmail_message_id:'m1',gmail_thread_id:'thread1'});
  assert.equal(first.created,true);
  assert.equal(first.item.id,'life1');
  const second=await ensureGmailLifeItem(db,user,{...input,title:'Reminder appointment'},{source_record_id:'src2',gmail_message_id:'m2',gmail_thread_id:'thread1'});
  assert.equal(second.created,false,'same Gmail thread must reuse its existing Life Admin item');
  assert.equal(second.item.id,'life1');
  assert.equal(db.rows.length,1);
  const third=await ensureGmailLifeItem(db,user,input,{source_record_id:'src3',gmail_message_id:'m3',gmail_thread_id:'thread2'});
  assert.equal(third.created,true);
  assert.equal(third.item.id,'life2');
  assert.equal(db.rows.length,2);

  const yonderInput={title:'Yonder reservation',category:'event',status:'upcoming',priority:'normal',provider:'Yonder',confirmation_reference:'95640384',starts_at:'2026-08-17T08:30:00.000Z'};
  const yonderFirst=await ensureGmailLifeItem(db,user,yonderInput,{source_record_id:'src-y1',gmail_message_id:'m-y1',gmail_thread_id:'thread-y1'});
  assert.equal(yonderFirst.created,true);
  const yonderReminder=await ensureGmailLifeItem(db,user,{...yonderInput,title:'Yonder reminder'},{source_record_id:'src-y2',gmail_message_id:'m-y2',gmail_thread_id:'thread-y2'});
  assert.equal(yonderReminder.created,false,'same event provider/reference must dedupe even when reminder arrives in a different Gmail thread');
  assert.equal(yonderReminder.item.id,yonderFirst.item.id);
  assert.equal(db.rows.filter(row=>row.category==='event'&&row.confirmation_reference==='95640384').length,1);

  db.rows[0].title='My manual event title';
  db.rows[0].linked_trip_id='trip-manual';
  db.rows[0].location=null;
  db.rows[0].provider=null;
  db.rows[0].source_metadata={...db.rows[0].source_metadata,manual_fields:['title','linked_trip_id']};
  const enriched=await updateLifeItemFromGmail(db,user,'life1',{
    title:'Yonder reservation',
    linked_trip_id:'trip-automatic',
    location:'14 Church Street, Queenstown, Otago 9300, New Zealand',
    provider:'Yonder',
    confirmation_reference:'95640384'
  },{source_record_id:'src-followup',gmail_message_id:'m-followup',gmail_thread_id:'thread1'});
  assert.equal(enriched.title,'My manual event title','Gmail must not overwrite manually owned title');
  assert.equal(enriched.linked_trip_id,'trip-manual','Gmail must not replace manually linked trip');
  assert.equal(enriched.location,'14 Church Street, Queenstown, Otago 9300, New Zealand');
  assert.equal(enriched.provider,'Yonder');
  assert.equal(enriched.confirmation_reference,'95640384');
  assert.deepEqual(enriched.source_metadata.manual_fields,['title','linked_trip_id']);
  assert.equal(enriched.source_metadata.gmail_message_id,'m-followup');
  assert.equal(enriched.source_metadata.gmail_thread_id,'thread1');
  assert.equal(db.rows.length,3,'Gmail enrichment must update existing canonical items rather than insert duplicates');

  console.log('gmail Life Admin data idempotency tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
