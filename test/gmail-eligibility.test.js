const assert=require('node:assert/strict');
const {isEligibleReceivedMessage}=require('../src/domain/gmail-eligibility');

assert.equal(isEligibleReceivedMessage({labelIds:['INBOX']}),true);
assert.equal(isEligibleReceivedMessage({labelIds:['CATEGORY_PERSONAL']}),true,'archived received mail without INBOX can still be eligible');
assert.equal(isEligibleReceivedMessage({labelIds:['SENT']}),false);
assert.equal(isEligibleReceivedMessage({labelIds:['DRAFT']}),false);
assert.equal(isEligibleReceivedMessage({labelIds:['SPAM']}),false);
assert.equal(isEligibleReceivedMessage({labelIds:['TRASH']}),false);
assert.equal(isEligibleReceivedMessage({labelIds:['INBOX','TRASH']}),false);
console.log('gmail eligibility tests passed');
