const assert=require('node:assert/strict');
const {buildFact}=require('../src/domain/gmail-facts');
const {upsertGmailSourceRecord,upsertGmailAttachmentRecord,insertExtractedFacts}=require('../src/data/gmail-sources');

function fakeSupabase(){
  const calls=[];
  const chain={
    upsert(row,opts){calls.push(['upsert',row,opts]);return chain;},
    insert(rows){calls.push(['insert',rows]);return chain;},
    select(cols){calls.push(['select',cols]);return chain;},
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
  console.log('gmail source/fact data tests passed');
})();
