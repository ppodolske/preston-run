const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { handlePeopleRoute } = require('../src/routes/people');

function fakeRes(){return {status:null,headers:{},body:'',writeHead(status,headers={}){this.status=status;this.headers={...this.headers,...headers};},end(body=''){this.body+=body||'';}};}
function req(method,url,body=''){const r=Readable.from([Buffer.from(body)]);r.method=method;r.url=url;r.headers=method==='POST'?{'content-type':'application/x-www-form-urlencoded',origin:'https://preston.run'}:{};return r;}
function makeSupabase(owner=true){
  const people=[{id:'p1',user_id:'u1',name:'Alice',relationship:'Friend',birthday_month:5,birthday_day:12,birth_year:null,notes:null,active:true}];
  function builder(){
    let op='select',payload=null,filters=[];
    const b={
      select(){return b;},order(){return b;},insert(value){op='insert';payload=value;return b;},update(value){op='update';payload=value;return b;},delete(){op='delete';return b;},eq(k,v){filters.push([k,v]);return b;},
      single(){if(op==='insert'){const row={id:'p2',...payload};people.push(row);return Promise.resolve({data:row,error:null});}return Promise.resolve({data:null,error:null});},
      maybeSingle(){const match=people.find(p=>filters.every(([k,v])=>p[k]===v));if(op==='update'&&match){Object.assign(match,payload);return Promise.resolve({data:match,error:null});}if(op==='delete'&&match){people.splice(people.indexOf(match),1);return Promise.resolve({data:{id:match.id},error:null});}return Promise.resolve({data:match||null,error:null});},
      then(resolve){const rows=people.slice().sort((a,b)=>a.name.localeCompare(b.name));return Promise.resolve({data:rows,error:null}).then(resolve);}
    };return b;
  }
  return {people,auth:{getUser:async()=>owner?{data:{user:{id:'u1',email:'owner@example.com'}},error:null}:{data:{user:null},error:null},signOut:async()=>{}},from:()=>builder()};
}
const config={siteUrl:'https://preston.run',ownerGoogleEmail:'owner@example.com'};
(async()=>{
  let res=fakeRes(), supabase=makeSupabase(false);
  assert.equal(await handlePeopleRoute(req('GET','/people'),res,{supabase,config}),true);assert.equal(res.status,302);assert.equal(res.headers.location,'/');

  supabase=makeSupabase(true);res=fakeRes();await handlePeopleRoute(req('GET','/people'),res,{supabase,config});assert.equal(res.status,200);assert.match(res.body,/Alice/);assert.equal(res.headers['cache-control'],'private, no-store');

  res=fakeRes();const bad=req('POST','/people','name=Bad&birthday_month=5&birthday_day=12&active=1');bad.headers.origin='https://evil.example';await handlePeopleRoute(bad,res,{supabase,config});assert.equal(res.status,403);assert.equal(supabase.people.length,1);

  res=fakeRes();await handlePeopleRoute(req('POST','/people','name=Bob&relationship=Family&birthday_month=6&birthday_day=4&birth_year=&notes=&active=1'),res,{supabase,config});assert.equal(res.status,302);assert.equal(res.headers.location,'/people?created=1');assert.equal(supabase.people.length,2);assert.equal(supabase.people[1].user_id,'u1');

  res=fakeRes();await handlePeopleRoute(req('GET','/people/p1/edit'),res,{supabase,config});assert.equal(res.status,200);assert.match(res.body,/value="Alice"/);

  res=fakeRes();await handlePeopleRoute(req('POST','/people/p1','name=Alice+Updated&relationship=Friend&birthday_month=5&birthday_day=12&birth_year=&notes=Hi&active=1'),res,{supabase,config});assert.equal(res.status,302);assert.equal(res.headers.location,'/people?saved=1');assert.equal(supabase.people[0].name,'Alice Updated');

  res=fakeRes();await handlePeopleRoute(req('POST','/people/p1/delete',''),res,{supabase,config});assert.equal(res.status,302);assert.equal(res.headers.location,'/people?deleted=1');assert.equal(supabase.people.some(p=>p.id==='p1'),false);

  res=fakeRes();await handlePeopleRoute(req('GET','/people/missing/edit'),res,{supabase,config});assert.equal(res.status,404);
  console.log('people route tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
