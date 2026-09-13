const {decodeCredentialKey,decryptCredential,encryptCredential}=require('../security/credential-crypto');
const {refreshGmailAccessToken}=require('./gmail-oauth');
const {updateGmailAccessToken}=require('../data/gmail-connections');

function normalizeAccessToken(value){
  if(typeof value==='string'&&value)return value;
  if(value&&typeof value.accessToken==='string'&&value.accessToken)return value.accessToken;
  if(value&&typeof value.access_token==='string'&&value.access_token)return value.access_token;
  throw new Error('Decrypted Gmail credential is missing access token');
}

function normalizeRefreshToken(value){
  if(typeof value==='string'&&value)return value;
  if(value&&typeof value.refreshToken==='string'&&value.refreshToken)return value.refreshToken;
  if(value&&typeof value.refresh_token==='string'&&value.refresh_token)return value.refresh_token;
  throw new Error('Decrypted Gmail credential is missing refresh token');
}

async function resolveGmailAccessToken({
  supabase,
  userId,
  connection,
  config,
  credentialKey,
  decryptCredential:decrypt=decryptCredential,
  refreshGmailAccessToken:refresh=refreshGmailAccessToken,
  encryptCredential:encrypt=encryptCredential,
  updateGmailAccessToken:update=updateGmailAccessToken,
  fetchImpl=global.fetch
}={}){
  if(!connection||!connection.id)throw new Error('Gmail connection is required');
  const key=credentialKey||decodeCredentialKey(config&&config.calendarCredentialKey);
  if(connection.refresh_token_ciphertext){
    const refreshToken=normalizeRefreshToken(decrypt(connection.refresh_token_ciphertext,key));
    const refreshed=await refresh(config,refreshToken,{fetch:fetchImpl});
    const accessToken=normalizeAccessToken(refreshed);
    const ciphertext=encrypt(accessToken,key);
    await update(supabase,userId,connection.id,ciphertext);
    return accessToken;
  }
  if(!connection.access_token_ciphertext)throw new Error('Connected Gmail account is missing access token');
  return normalizeAccessToken(decrypt(connection.access_token_ciphertext,key));
}

module.exports={normalizeAccessToken,normalizeRefreshToken,resolveGmailAccessToken};
