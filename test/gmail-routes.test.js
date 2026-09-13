const assert=require('node:assert/strict');
const {createGmailRouter,isGmailPath}=require('../src/routes/gmail');

assert.equal(typeof createGmailRouter,'function');
const router=createGmailRouter({});
assert.equal(typeof router,'function');
assert.equal(isGmailPath('/me/settings/gmail'),true);
assert.equal(isGmailPath('/me/settings/gmail/scan-now'),true);
assert.equal(isGmailPath('/me/settings'),false);
console.log('gmail route tests passed');
