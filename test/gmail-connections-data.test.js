const assert=require('node:assert/strict');
const {
  getGmailConnection,
  upsertGmailConnection,
  markGmailDisconnected,
  updateGmailConnectionStatus
}=require('../src/data/gmail-connections');

function fakeSupabase(){
  const calls=[];
  const chain={
    select(cols){calls.push(['select',cols]);return chain;},
    eq(col,val){calls.push(['eq',col,val]);return chain;},
    maybeSingle(){calls.push(['maybeSingle']);return Promise.resolve({data:{id:'conn1',status:'connected'},error:null});},
    upsert(row,opts){calls.push(['upsert',row,opts]);return chain;},
    update(row){calls.push(['update',row]);return chain;},
    single(){calls.push(['single']);return Promise.resolve({data:{id:'conn1'},error:null});}
  };
  return {calls,from(table){calls.push(['from',table]);return chain;}};
}

(async()=>{
  const supabase=fakeSupabase();
  const row=await getGmailConnection(supabase,'user1');
  assert.equal(row.id,'conn1');
  assert.deepEqual(supabase.calls.slice(0,4),[
    ['from','gmail_connections'],
    ['select','*'],
    ['eq','user_id','user1'],
    ['maybeSingle']
  ]);

  const supabase2=fakeSupabase();
  await upsertGmailConnection(supabase2,'user1',{
    gmailAccountEmail:'me@example.com',
    googleSubject:'sub1',
    accessTokenCiphertext:'enc-access',
    refreshTokenCiphertext:'enc-refresh',
    scope:'gmail.readonly'
  });
  assert.equal(supabase2.calls[1][0],'upsert');
  assert.equal(supabase2.calls[1][1].user_id,'user1');
  assert.equal(supabase2.calls[1][1].gmail_account_email,'me@example.com');
  assert.equal(supabase2.calls[1][1].status,'connected');

  const supabase3=fakeSupabase();
  await markGmailDisconnected(supabase3,'user1','conn1');
  assert.equal(supabase3.calls[1][1].status,'disconnected');

  const supabase4=fakeSupabase();
  await updateGmailConnectionStatus(supabase4,'user1','conn1',{lastError:'boom'});
  assert.equal(supabase4.calls[1][1].last_error,'boom');
  console.log('gmail connection data tests passed');
})();
