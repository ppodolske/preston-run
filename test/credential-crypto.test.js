const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {decodeCredentialKey,encryptCredential,decryptCredential}=require('../src/security/credential-crypto');

const keyBytes=crypto.randomBytes(32);
const encoded=keyBytes.toString('base64url');
const key=decodeCredentialKey(encoded);
assert.equal(Buffer.compare(key,keyBytes),0);
assert.throws(()=>decodeCredentialKey(Buffer.alloc(31).toString('base64url')),/32 bytes/i);
assert.throws(()=>decodeCredentialKey('not base64url!'),/credential key/i);

const payload={refresh_token:'refresh-secret',access_token:'access-secret',nested:{password:'apple-secret'},count:3};
const a=encryptCredential(payload,key);
const b=encryptCredential(payload,key);
assert.match(a,/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
assert.notEqual(a,b,'same plaintext must use a fresh IV');
assert.ok(!a.includes('refresh-secret'));
assert.deepEqual(decryptCredential(a,key),payload);

const wrong=crypto.randomBytes(32);
assert.throws(()=>decryptCredential(a,wrong),/decrypt credential/i);
assert.throws(()=>decryptCredential('v2.aa.bb.cc',key),/credential envelope/i);
assert.throws(()=>decryptCredential('v1.aa.bb',key),/credential envelope/i);

const parts=a.split('.');
const tag=Buffer.from(parts[2],'base64url');tag[0]^=1;
assert.throws(()=>decryptCredential([parts[0],parts[1],tag.toString('base64url'),parts[3]].join('.'),key),/decrypt credential/i);
const cipher=Buffer.from(parts[3],'base64url');cipher[0]^=1;
assert.throws(()=>decryptCredential([parts[0],parts[1],parts[2],cipher.toString('base64url')].join('.'),key),/decrypt credential/i);

console.log('credential crypto tests passed');
