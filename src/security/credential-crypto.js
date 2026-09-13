const crypto=require('node:crypto');

function decodeCredentialKey(encoded){
  const text=String(encoded||'').trim();
  if(!text||!/^[A-Za-z0-9_-]+$/.test(text))throw new Error('Invalid credential key');
  let key;
  try{key=Buffer.from(text,'base64url');}catch{throw new Error('Invalid credential key');}
  if(key.length!==32)throw new Error('Credential key must decode to exactly 32 bytes');
  return key;
}

function assertKey(key){
  if(!Buffer.isBuffer(key)||key.length!==32)throw new Error('Credential key must be 32 bytes');
}

function encryptCredential(payload,key){
  assertKey(key);
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const plaintext=Buffer.from(JSON.stringify(payload),'utf8');
  const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  const tag=cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptCredential(envelope,key){
  assertKey(key);
  const text=String(envelope||'');
  const parts=text.split('.');
  if(parts.length!==4||parts[0]!=='v1')throw new Error('Invalid credential envelope');
  let iv,tag,ciphertext;
  try{
    iv=Buffer.from(parts[1],'base64url');
    tag=Buffer.from(parts[2],'base64url');
    ciphertext=Buffer.from(parts[3],'base64url');
    if(iv.length!==12||tag.length!==16||ciphertext.length===0)throw new Error('shape');
  }catch{throw new Error('Invalid credential envelope');}
  try{
    const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);
    decipher.setAuthTag(tag);
    const plaintext=Buffer.concat([decipher.update(ciphertext),decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  }catch{throw new Error('Unable to decrypt credential');}
}

module.exports={decodeCredentialKey,encryptCredential,decryptCredential};
