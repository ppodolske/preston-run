const {decodeCredentialKey,decryptCredential}=require('../security/credential-crypto');
const {getGmailConnection}=require('../data/gmail-connections');
const {startGmailScanRun,updateGmailScanProgress,finishGmailScanRun,failGmailScanRun}=require('../data/gmail-scans');
const {findGmailSourceRecord,upsertGmailSourceRecord,updateGmailSourceStatus,upsertGmailAttachmentRecord,updateGmailAttachmentStatus,insertExtractedFacts,recordGmailActivity}=require('../data/gmail-sources');
const {listTrips}=require('../data/trips');
const {createGmailProvider}=require('./gmail-provider');
const {runGmailScan}=require('./gmail-scan-runner');
const {buildGmailTripActions}=require('./gmail-trip-actions');

function normalizeDecryptedAccessToken(value){
  if(typeof value==='string')return value;
  if(value&&typeof value.accessToken==='string')return value.accessToken;
  if(value&&typeof value.access_token==='string')return value.access_token;
  throw new Error('Decrypted Gmail credential is missing access token');
}

function keyFor(config,overrides={}){
  if(overrides.credentialKey)return overrides.credentialKey;
  if(overrides.decodeCredentialKey)return overrides.decodeCredentialKey(config.calendarCredentialKey);
  return decodeCredentialKey(config.calendarCredentialKey);
}

function createGmailPersistenceAdapters(bound={}){
  const supabase=bound.supabase;
  const userId=bound.userId;
  const connection=bound.connection;
  return {
    startScan:startGmailScanRun,
    updateScanProgress:async(scanRunId,patch)=>updateGmailScanProgress(supabase,userId,scanRunId,patch),
    finishScan:finishGmailScanRun,
    failScan:failGmailScanRun,
    findExistingSource:async(accountEmail,messageId)=>findGmailSourceRecord(supabase,userId,accountEmail,messageId),
    upsertSource:async(normalized,scanRunId)=>upsertGmailSourceRecord(supabase,userId,connection.id,scanRunId,normalized),
    updateSourceStatus:async(sourceRecordId,patch)=>updateGmailSourceStatus(supabase,userId,sourceRecordId,patch.processing_status,patch.processing_reason||null),
    upsertAttachment:async(sourceRecordId,attachment)=>upsertGmailAttachmentRecord(supabase,userId,sourceRecordId,attachment),
    updateAttachmentStatus:async(attachmentRecordId,patch)=>updateGmailAttachmentStatus(supabase,userId,attachmentRecordId,patch.processing_status,patch.processing_reason||null),
    insertFacts:async(facts)=>insertExtractedFacts(supabase,userId,facts)
  };
}

async function startManualGmailScan(supabase,userId,config,options={}){
  const getConnection=options.getGmailConnection||getGmailConnection;
  const connection=await getConnection(supabase,userId);
  if(!connection||connection.status==='disconnected')throw new Error('No connected Gmail account');
  if(!connection.access_token_ciphertext)throw new Error('Connected Gmail account is missing access token');
  const decrypt=options.decryptCredential||decryptCredential;
  const key=keyFor(config,options);
  const tokenPayload=decrypt(connection.access_token_ciphertext,key);
  const accessToken=normalizeDecryptedAccessToken(tokenPayload);
  const providerFactory=options.createGmailProvider||createGmailProvider;
  const provider=providerFactory({fetch:options.fetch||global.fetch,accessToken});
  const tripLister=options.listTrips||listTrips;
  const existingTrips=await tripLister(supabase,{id:userId});
  const persistence=options.persistence||createGmailPersistenceAdapters({supabase,userId,connection});
  const actions=options.actions||buildGmailTripActions({supabase,userId,tripData:options.tripData||require('../data/trips'),gmailData:{recordGmailActivity},reviewData:options.reviewData});
  const runner=options.runGmailScan||runGmailScan;
  return runner({supabase,userId,connection,provider,config:config.gmail,existingTrips,persistence,actions,pdfParse:options.pdfParse});
}

function createGmailManualScanDeps(config,options={}){
  return {
    startScanNow(supabase,userId){return startManualGmailScan(supabase,userId,config,options);}
  };
}

module.exports={normalizeDecryptedAccessToken,createGmailPersistenceAdapters,startManualGmailScan,createGmailManualScanDeps};
