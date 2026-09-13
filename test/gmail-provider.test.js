const assert=require('node:assert/strict');
const {buildEligibleMessagesQuery,createGmailProvider}=require('../src/services/gmail-provider');

assert.equal(buildEligibleMessagesQuery({after:'2025/09/13',before:'2026/09/14'}),'after:2025/09/13 before:2026/09/14 -in:sent -in:drafts -in:spam -in:trash');

(async()=>{
  const calls=[];
  const provider=createGmailProvider({
    accessToken:'token1',
    fetch:async(url,opts)=>{
      calls.push({url,opts});
      return {ok:true,json:async()=>({messages:[{id:'m1'}]})};
    }
  });
  const result=await provider.listMessages('after:2025/09/13',null);
  assert.equal(result.messages[0].id,'m1');
  assert.match(calls[0].url,/gmail\/v1\/users\/me\/messages/);
  assert.equal(calls[0].opts.headers.Authorization,'Bearer token1');
  assert.equal(calls[0].opts.method,'GET');
  console.log('gmail provider tests passed');
})();
