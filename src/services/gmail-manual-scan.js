const {decodeCredentialKey}=require('../security/credential-crypto');
const {getGmailConnection}=require('../data/gmail-connections');
const {startGmailScanRun,updateGmailScanProgress,finishGmailScanRun,failGmailScanRun}=require('../data/gmail-scans');
const {findGmailSourceRecord,upsertGmailSourceRecord,updateGmailSourceStatus,upsertGmailAttachmentRecord,updateGmailAttachmentStatus,insertExtractedFacts,recordGmailActivity}=require('../data/gmail-sources');
const {listTrips}=require('../data/trips');
const {createGmailProvider}=require('./gmail-provider');
const {runGmailScan}=require('./gmail-scan-runner');
const {buildGmailBookingActions}=require('./gmail-booking-actions');
const {buildGmailLifeAdminActions}=require('./gmail-life-admin-actions');
const {resolveGmailAccessToken}=require('./gmail-access-token');

function normalizeDecryptedAccessToken(value){if(typeof value==='string')return value;if(value&&typeof value.accessToken==='string')return value.accessToken;if(value&&typeof value.access_token==='string')return value.access_token;throw new Error('Decrypted Gmail credential is missing access token');}
function keyFor(config,overrides={}){if(overrides.credentialKey)return overrides.credentialKey;if(overrides.decodeCredentialKey)return overrides.decodeCredentialKey(config.calendarCredentialKey);return decodeCredentialKey(config.calendarCredentialKey);}
function createGmailPersistenceAdapters(bound={}){const supabase=bound.supabase,userId=bound.userId,connection=bound.connection;return{startScan:startGmailScanRun,updateScanProgress:async(scanRunId,patch)=>updateGmailScanProgress(supabase,userId,scanRunId,patch),finishScan:finishGmailScanRun,failScan:failGmailScanRun,findExistingSource:async(accountEmail,messageId)=>findGmailSourceRecord(supabase,userId,accountEmail,messageId),upsertSource:async(normalized,scanRunId)=>upsertGmailSourceRecord(supabase,userId,connection.id,scanRunId,normalized),updateSourceStatus:async(sourceRecordId,patch)=>updateGmailSourceStatus(supabase,userId,sourceRecordId,patch.processing_status,patch.processing_reason||null),upsertAttachment:async(sourceRecordId,attachment)=>upsertGmailAttachmentRecord(supabase,userId,sourceRecordId,attachment),updateAttachmentStatus:async(attachmentRecordId,patch)=>updateGmailAttachmentStatus(supabase,userId,attachmentRecordId,patch.processing_status,patch.processing_reason||null),insertFacts:async(facts)=>insertExtractedFacts(supabase,userId,facts)};}

async function startManualGmailScan(supabase,userId,config,options={}){
  const getConnection=options.getGmailConnection||getGmailConnection,connection=await getConnection(supabase,userId);if(!connection||connection.status==='disconnected')throw new Error('No connected Gmail account');if(!connection.access_token_ciphertext&&!connection.refresh_token_ciphertext)throw new Error('Connected Gmail account is missing access token');
  const resolver=options.resolveGmailAccessToken||resolveGmailAccessToken;const accessToken=await resolver({supabase,userId,connection,config,credentialKey:keyFor(config,options),decryptCredential:options.decryptCredential,refreshGmailAccessToken:options.refreshGmailAccessToken,encryptCredential:options.encryptCredential,updateGmailAccessToken:options.updateGmailAccessToken,fetchImpl:options.fetch||global.fetch});
  const provider=(options.createGmailProvider||createGmailProvider)({fetch:options.fetch||global.fetch,accessToken}),existingTrips=await(options.listTrips||listTrips)(supabase,{id:userId}),persistence=options.persistence||createGmailPersistenceAdapters({supabase,userId,connection});
  const lifeAdminActions=options.lifeAdminActions||buildGmailLifeAdminActions({supabase,userId,lifeAdminData:options.lifeAdminData,gmailData:options.gmailData||{recordGmailActivity},reviewData:options.reviewLinkData});
  const bookingReviewData=options.bookingReviewData||{createReviewItem:async(source,decision)=>lifeAdminActions.createReviewItem(source,{reason:decision.reasons&&decision.reasons[0]||'confirm_match'})};
  const bookingActions=options.bookingActions||buildGmailBookingActions({supabase,userId,bookingData:options.bookingData,bookingSourceData:options.bookingSourceData,tripData:options.tripData,gmailData:options.gmailData||{recordGmailActivity},reviewData:bookingReviewData});
  return(options.runGmailScan||runGmailScan)({supabase,userId,connection,provider,config:config.gmail,existingTrips,persistence,bookingActions,lifeAdminActions,pdfParse:options.pdfParse});
}
function createGmailManualScanDeps(config,options={}){return{startScanNow(supabase,userId){return startManualGmailScan(supabase,userId,config,options);}};}
module.exports={normalizeDecryptedAccessToken,createGmailPersistenceAdapters,startManualGmailScan,createGmailManualScanDeps};
