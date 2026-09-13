const assert=require('node:assert/strict');
const {resolveGmailAccessToken}=require('../src/services/gmail-access-token');

(async()=>{
  const calls=[];
  const config={gmail:{clientId:'client1',clientSecret:'secret1',redirectUri:'https://preston.run/me/settings/gmail/callback'},calendarCredentialKey:'encoded-key'};
  const connection={id:'conn1',access_token_ciphertext:'enc-old',refresh_token_ciphertext:'enc-refresh'};
  const accessToken=await resolveGmailAccessToken({
    supabase:{db:true},
    userId:'user1',
    connection,
    config,
    credentialKey:'key1',
    decryptCredential:(value,key)=>{assert.equal(key,'key1');return value==='enc-refresh'?'refresh1':'old-access';},
    refreshGmailAccessToken:async(receivedConfig,refreshToken)=>{calls.push(['refresh',receivedConfig,refreshToken]);return {accessToken:'fresh-access'};},
    encryptCredential:(value,key)=>{calls.push(['encrypt',value,key]);return 'enc-fresh';},
    updateGmailAccessToken:async(db,userId,connectionId,ciphertext)=>{calls.push(['update',db,userId,connectionId,ciphertext]);return {id:connectionId};}
  });
  assert.equal(accessToken,'fresh-access');
  assert.equal(calls[0][0],'refresh');
  assert.equal(calls[0][2],'refresh1');
  assert.deepEqual(calls.find(c=>c[0]==='encrypt'),['encrypt','fresh-access','key1']);
  assert.deepEqual(calls.find(c=>c[0]==='update'),['update',{db:true},'user1','conn1','enc-fresh']);

  let refreshed=false;
  const fallback=await resolveGmailAccessToken({
    supabase:{},
    userId:'user1',
    connection:{id:'conn1',access_token_ciphertext:'enc-old',refresh_token_ciphertext:null},
    config,
    credentialKey:'key1',
    decryptCredential:()=>({accessToken:'old-access'}),
    refreshGmailAccessToken:async()=>{refreshed=true;return {accessToken:'unexpected'};},
    encryptCredential:()=>{throw new Error('should not encrypt');},
    updateGmailAccessToken:async()=>{throw new Error('should not update');}
  });
  assert.equal(fallback,'old-access');
  assert.equal(refreshed,false);
  console.log('gmail access-token tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
