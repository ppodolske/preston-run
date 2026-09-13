const assert=require('node:assert/strict');
const {BACKFILL_CONFIRMATION,assertBackfillConfirmation,normalizeAccessToken,listBackfillSources,createBackfillProvider}=require('../src/jobs/gmail-life-admin-backfill');
const {TARGET_SCAN_IDS}=require('../src/services/gmail-life-admin-backfill');

assert.throws(()=>assertBackfillConfirmation({}),/confirmation/i);
assert.throws(()=>assertBackfillConfirmation({GMAIL_LIFE_ADMIN_BACKFILL_CONFIRM:'wrong'}),/confirmation/i);
assert.doesNotThrow(()=>assertBackfillConfirmation({GMAIL_LIFE_ADMIN_BACKFILL_CONFIRM:BACKFILL_CONFIRMATION}));
assert.equal(normalizeAccessToken('plain'),'plain');
assert.equal(normalizeAccessToken({accessToken:'a'}),'a');
assert.equal(normalizeAccessToken({access_token:'b'}),'b');
assert.throws(()=>normalizeAccessToken({}),/access token/i);

(async()=>{
  const calls=[];
  const chain={
    select(cols){calls.push(['select',cols]);return chain;},
    eq(col,val){calls.push(['eq',col,val]);return chain;},
    in(col,vals){calls.push(['in',col,vals]);return chain;},
    order(col,opts){calls.push(['order',col,opts]);return Promise.resolve({data:[{id:'s1'}],error:null});}
  };
  const rows=await listBackfillSources({from(table){calls.push(['from',table]);return chain;}},'user1');
  assert.deepEqual(rows,[{id:'s1'}]);
  assert.deepEqual(calls.find(c=>c[0]==='in'),['in','scan_run_id',TARGET_SCAN_IDS]);
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='user1'));

  let resolverCalls=0;
  let providerToken=null;
  const provider=await createBackfillProvider({
    supabase:{db:true},
    userId:'user1',
    connection:{id:'conn1',access_token_ciphertext:'enc-old',refresh_token_ciphertext:'enc-refresh'},
    env:{CALENDAR_CREDENTIAL_KEY:'encoded-key',GMAIL_CLIENT_ID:'client1',GMAIL_CLIENT_SECRET:'secret1',GMAIL_REDIRECT_URI:'https://preston.run/me/settings/gmail/callback'},
    fetchImpl:async()=>{},
    decodeCredentialKey:()=> 'key1',
    resolveGmailAccessToken:async args=>{resolverCalls+=1;assert.equal(args.connection.id,'conn1');assert.equal(args.config.gmail.clientId,'client1');return 'fresh-access';},
    createGmailProvider:args=>{providerToken=args.accessToken;return {provider:true};}
  });
  assert.equal(resolverCalls,1);
  assert.equal(providerToken,'fresh-access');
  assert.deepEqual(provider,{provider:true});
  console.log('gmail Life Admin backfill job tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
