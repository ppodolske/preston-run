const assert=require('node:assert/strict');
const {startManualGmailScan,createGmailPersistenceAdapters,createGmailManualScanDeps,normalizeDecryptedAccessToken}=require('../src/services/gmail-manual-scan');

(async()=>{
  await assert.rejects(()=>startManualGmailScan({},'user1',{gmail:{},calendarCredentialKey:'key1'},{getGmailConnection:async()=>null,credentialKey:'key1'}),/No connected Gmail account/);
  assert.equal(normalizeDecryptedAccessToken('plain-token'),'plain-token');
  assert.equal(normalizeDecryptedAccessToken({accessToken:'access1'}),'access1');

  let providerToken=null;
  let runnerArgs=null;
  const result=await startManualGmailScan({db:true},'user1',{gmail:{scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},calendarCredentialKey:'key1'}, {
    credentialKey:'key1',
    getGmailConnection:async()=>({id:'conn1',status:'connected',gmail_account_email:'me@example.com',access_token_ciphertext:'enc-access'}),
    decryptCredential:(envelope,key)=>{assert.equal(envelope,'enc-access');assert.equal(key,'key1');return {accessToken:'access1'};},
    createGmailProvider:args=>{providerToken=args.accessToken;return {provider:true};},
    listTrips:async()=>[{id:'trip1',bookingReferences:['ABC123']}],
    runGmailScan:async(args)=>{runnerArgs=args;return {status:'succeeded',processedCount:1};}
  });
  assert.equal(result.status,'succeeded');
  assert.equal(providerToken,'access1');
  assert.equal(runnerArgs.connection.id,'conn1');
  assert.equal(runnerArgs.existingTrips[0].id,'trip1');
  assert.equal(typeof runnerArgs.persistence.startScan,'function');
  assert.equal(typeof runnerArgs.persistence.updateScanProgress,'function');
  assert.equal(typeof runnerArgs.actions.createGmailReviewItem,'function');
  assert.equal(typeof runnerArgs.lifeAdminActions.createLifeAdminItem,'function');
  assert.equal(typeof runnerArgs.lifeAdminActions.createReviewItem,'function');

  const reviewCalls=[];
  const reviewLifeActions={createLifeAdminItem:async()=>null,createReviewItem:async(source,classification)=>{reviewCalls.push({source,classification});return{id:'life-review-1'};}};
  let reviewRunnerArgs=null;
  await startManualGmailScan({db:true},'user1',{gmail:{scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},calendarCredentialKey:'key1'}, {
    credentialKey:'key1',
    getGmailConnection:async()=>({id:'conn1',status:'connected',gmail_account_email:'me@example.com',access_token_ciphertext:'enc-access'}),
    decryptCredential:()=>({accessToken:'access1'}),
    createGmailProvider:()=>({provider:true}),
    listTrips:async()=>[],
    lifeAdminActions:reviewLifeActions,
    runGmailScan:async(args)=>{reviewRunnerArgs=args;await args.actions.createGmailReviewItem({sourceRecordId:'src1',source:{id:'src1',subject:'Possible trip'},reason:'weak_match'});return{status:'succeeded'};}
  });
  assert.equal(reviewRunnerArgs.lifeAdminActions,reviewLifeActions);
  assert.deepEqual(reviewCalls,[{source:{id:'src1',subject:'Possible trip'},classification:{reason:'weak_match'}}]);

  const adapters=createGmailPersistenceAdapters({supabase:{},userId:'user1',connection:{id:'conn1'}});
  for(const key of ['startScan','upsertSource','insertFacts','finishScan','failScan','findExistingSource','updateScanProgress'])assert.equal(typeof adapters[key],'function');
  assert.equal(Object.hasOwn(adapters,'updateProgress'),false,'adapter name must match runner hook updateScanProgress');
  const deps=createGmailManualScanDeps({gmail:{scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},calendarCredentialKey:'key1'},{credentialKey:'key1'});
  assert.equal(typeof deps.startScanNow,'function');
  console.log('gmail manual scan tests passed');
})();
