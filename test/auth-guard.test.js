const assert = require('node:assert/strict');
const { getAuthorizedOwner } = require('../src/auth/guard');
const config={ownerGoogleEmail:'owner@example.com'};
(async()=>{
  let r=await getAuthorizedOwner({auth:{getUser:async()=>({data:{user:null},error:null})}},config); assert.equal(r.reason,'signed_out');
  const user={email:'OWNER@example.com'}; r=await getAuthorizedOwner({auth:{getUser:async()=>({data:{user},error:null})}},config); assert.equal(r.user,user); assert.equal(r.reason,null);
  r=await getAuthorizedOwner({auth:{getUser:async()=>({data:{user:{email:'other@example.com'}},error:null})}},config); assert.equal(r.reason,'not_owner');
  r=await getAuthorizedOwner({auth:{getUser:async()=>({data:{user:null},error:new Error('x')})}},config); assert.equal(r.reason,'auth_error');
  console.log('auth guard tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
