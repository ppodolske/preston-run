const assert=require('node:assert/strict');
const {buildFact}=require('../src/domain/gmail-facts');
const {upsertGmailSourceRecord,upsertGmailAttachmentRecord,insertExtractedFacts,recordGmailActivity,undoGmailActivity}=require('../src/data/gmail-sources');

function fakeSupabase(activityRow=null){
  const calls=[];
  const chain={
    upsert(row,opts){calls.push(['upsert',row,opts]);return chain;},
    insert(rows){calls.push(['insert',rows]);return chain;},
    update(row){calls.push(['update',row]);return chain;},
    select(cols){calls.push(['select',cols]);return chain;},
    eq(col,val){calls.push(['eq',col,val]);return chain;},
    maybeSingle(){calls.push(['maybeSingle']);return Promise.resolve({data:activityRow,error:null});},
    single(){calls.push(['single']);return Promise.resolve({data:{id:'row1'},error:null});}
  };
  return {calls,from(table){calls.push(['from',table]);return chain;}};
}

(async()=>{
  const fact=buildFact({
    sourceRecordId:'src1',
    factType:'trip.flight',
    factValue:{provider:'Qantas',flightNumber:'QF401'},
    parserVersion:'parser1',
    classificationConfidence:0.95,
    extractionConfidence:0.9
  });
  assert.equal(fact.fact_type,'trip.flight');
  assert.equal(fact.fact_schema_version,1);
  assert.equal(fact.parser_version,'parser1');
  assert.equal(fact.classification_confidence,0.95);

  const supabase=fakeSupabase();
  await upsertGmailSourceRecord(supabase,'user1','conn1','scan1',{
    gmail_account_email:'me@example.com',gmail_message_id:'msg1',gmail_thread_id:'thr1',received_at:'2026-09-13T00:00:00Z',label_ids:[],scanner_version:'scanner1'
  });
  assert.equal(supabase.calls[0][1],'gmail_source_records');
  assert.equal(supabase.calls[1][2].onConflict,'user_id,gmail_account_email,gmail_message_id');

  const supabase2=fakeSupabase();
  await upsertGmailAttachmentRecord(supabase2,'user1','src1',{gmailAttachmentId:'att1',filename:'itinerary.pdf',mimeType:'application/pdf'});
  assert.equal(supabase2.calls[1][2].onConflict,'source_record_id,gmail_attachment_id');

  const supabase3=fakeSupabase();
  await insertExtractedFacts(supabase3,'user1',[fact]);
  assert.equal(supabase3.calls[0][1],'gmail_extracted_facts');
  assert.equal(supabase3.calls[1][1][0].user_id,'user1');

  const supabase4=fakeSupabase();
  await recordGmailActivity(supabase4,'user1',{sourceRecordId:'src1',factId:'fact1',entityType:'trip',entityId:'trip1',fieldName:'status',oldValue:{status:'planning'},newValue:{status:'cancelled'},action:'update',ruleVersion:'rule1'});
  assert.equal(supabase4.calls[0][1],'gmail_activity_entries');
  assert.equal(supabase4.calls[1][1].old_value.status,'planning');
  assert.equal(supabase4.calls[1][1].new_value.status,'cancelled');

  const sourceActivity={id:'act1',source_record_id:'src1',fact_id:'fact1',entity_type:'trip',entity_id:'trip1',field_name:'status',old_value:{status:'planning'},new_value:{status:'cancelled'}};
  const restored=[];
  const supabase5=fakeSupabase(sourceActivity);
  await undoGmailActivity(supabase5,'user1','act1',{restoreField:async(input)=>{restored.push(input);return true;}});
  assert.equal(restored[0].entityType,'trip');
  assert.equal(restored[0].fieldName,'status');
  assert.equal(restored[0].value.status,'planning');
  const undoInsert=supabase5.calls.find(call=>call[0]==='insert'&&call[1].action==='undo');
  assert.equal(undoInsert[1].manual_authority,true);
  console.log('gmail source/fact data tests passed');
})();
