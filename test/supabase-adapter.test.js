const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let capturedOptions;
Module._load = function(request,parent,isMain){
  if(request==='@supabase/ssr') return { createServerClient:(url,key,options)=>{capturedOptions=options;return {url,key,options};} };
  return originalLoad.call(this,request,parent,isMain);
};
const { createRequestSupabase } = require('../src/auth/supabase');
Module._load = originalLoad;
const headers={};
const req={headers:{cookie:'a=1; b=hello%20world'}};
const res={getHeader:name=>headers[name],setHeader:(name,value)=>{headers[name]=value;}};
const config={supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'pub',isProduction:true};
createRequestSupabase(req,res,config);
assert.deepEqual(capturedOptions.cookies.getAll(),[{name:'a',value:'1'},{name:'b',value:'hello world'}]);
capturedOptions.cookies.setAll([{name:'sb-one',value:'a',options:{}},{name:'sb-two',value:'b',options:{}}]);
assert.equal(headers['Set-Cookie'].length,2);
for(const cookie of headers['Set-Cookie']){assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Path=\//);}
capturedOptions.cookies.setAll([{name:'sb-three',value:'c',options:{}}]);
assert.equal(headers['Set-Cookie'].length,3);
console.log('supabase adapter tests passed');
