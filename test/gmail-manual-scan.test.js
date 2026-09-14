const assert=require('node:assert/strict');
const {startManualGmailScan,createGmailPersistenceAdapters,createGmailManualScanDeps,normalizeDecryptedAccessToken}=require('../src/services/gmail-manual-scan');

(async()=>{
  await assert.rejects(()=>startManualGmailScan({},'user1',{gmail:{},calendarCredentialKey:'key1'},{getGmailConnection:async()=>null,credentialKey:'key1'}),/No connected Gmail account/);
  assert.equal(normalizeDecryptedAccessToken('plain-token'),'plain-token');assert.equal(normalizeDecryptedAccessToken({accessToken:'access1'}),'access1');

  let providerToken=null;let runnerArgs=null;
  const result=await startManualGmailScan({db:true},'user1',{gmail:{scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},calendarCredentialKey:'key1'}, {
    credentialKey:'key1',getGmailConnection:async()=>({id:'conn1',status:'connected',gmail_account_email:'me@example.com',access_token_ciphertext:'enc-access'}),decryptCredential:(envelope,key)=>{assert.equal(envelope,'enc-access');assert.equal(key,'key1');return{accessToken:'access1'};},createGmailProvider:args=>{providerToken=args.accessToken;return{provider:true};},listTrips:async()=>[{id:'trip1'}],runGmailScan:async args=>{runnerArgs=args;return{status:'succeeded',processedCount:1};}
  });
  assert.equal(result.status,'succeeded');assert.equal(providerToken,'access1');assert.equal(runnerArgs.connection.id,'conn1');assert.equal(runnerArgs.existingTrips[0].id,'trip1');assert.equal(typeof runnerArgs.persistence.startScan,'function');assert.equal(typeof runnerArgs.bookingActions.processBooking,'function');assert.equal(typeof runnerArgs.lifeAdminActions.createLifeAdminItem,'function');assert.equal(Object.hasOwn(runnerArgs,'actions'),false,'legacy direct-trip actions must not be wired into the runner');

  let freshProviderToken=null;let resolverCalls=0;
  await startManualGmailScan({db:true},'user1',{gmail:{clientId:'client1',clientSecret:'secret1',redirectUri:'https://preston.run/me/settings/gmail/callback',scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},calendarCredentialKey:'key1'}, {credentialKey:'key1',getGmailConnection:async()=>({id:'conn1',status:'connected',gmail_account_email:'me@example.com',access_token_ciphertext:'enc-old',refresh_token_ciphertext:'enc-refresh'}),decryptCredential:()=>({accessToken:'stale-access'}),resolveGmailAccessToken:async args=>{resolverCalls+=1;assert.equal(args.connection.id,'conn1');return'fresh-access';},createGmailProvider:args=>{freshProviderToken=args.accessToken;return{provider:true};},listTrips:async()=>[],runGmailScan:async()=>({status:'succeeded'})});assert.equal(resolverCalls,1);assert.equal(freshProviderToken,'fresh-access');

  const suppliedBookingActions={processBooking:async()=>null};let suppliedArgs=null;
  await startManualGmailScan({db:true},'user1',{gmail:{scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},calendarCredentialKey:'key1'}, {credentialKey:'key1',getGmailConnection:async()=>({id:'conn1',status:'connected',gmail_account_email:'me@example.com',access_token_ciphertext:'enc-access'}),resolveGmailAccessToken:async()=> 'access1',createGmailProvider:()=>({provider:true}),listTrips:async()=>[],bookingActions:suppliedBookingActions,runGmailScan:async args=>{suppliedArgs=args;return{status:'succeeded'};}});assert.equal(suppliedArgs.bookingActions,suppliedBookingActions);

  const adapters=createGmailPersistenceAdapters({supabase:{},userId:'user1',connection:{id:'conn1'}});for(const key of ['startScan','upsertSource','insertFacts','finishScan','failScan','findExistingSource','updateScanProgress'])assert.equal(typeof adapters[key],'function');assert.equal(Object.hasOwn(adapters,'updateProgress'),false);
  const deps=createGmailManualScanDeps({gmail:{scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},calendarCredentialKey:'key1'},{credentialKey:'key1'});assert.equal(typeof deps.startScanNow,'function');
  console.log('gmail manual scan tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
