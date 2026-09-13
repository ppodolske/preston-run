const assert=require('node:assert/strict');
const {ensureGmailLifeItem,gmailSourceMetadata}=require('../src/data/life-admin');

function fakeSupabase(){
  const rows=[];
  return {
    rows,
    from(table){
      assert.equal(table,'life_items');
      const filters=[];
      let insertRow=null;
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
          return Promise.resolve({data:found||null,error:null});
        },
        insert(row){insertRow=row;return chain;},
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
  console.log('gmail Life Admin data idempotency tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
