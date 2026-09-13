const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {renderReminderOverridePage}=require('../src/pages/reminder-overrides');
const {handleReminderOverrideRoute}=require('../src/routes/reminder-overrides');

const page=renderReminderOverridePage({entity:{id:'p1',name:'Alice'},entityType:'person',reminderClass:'birthday',defaults:[30,14,7,1],override:null});
assert.match(page,/Use global defaults/);assert.match(page,/30, 14, 7, 1/);assert.match(page,/Custom reminders/);assert.doesNotMatch(page,/Restore defaults/);
const custom=renderReminderOverridePage({entity:{id:'p1',name:'Alice'},entityType:'person',reminderClass:'birthday',defaults:[30,14,7,1],override:{enabled:true,offsets:[21,3,1]}});
assert.match(custom,/21, 3, 1/);assert.match(custom,/Restore defaults/);

function res(){return{status:null,headers:{},body:'',writeHead(s,h={}){this.status=s;this.headers={...this.headers,...h};},end(b=''){this.body+=b||'';}};}
function req(method,url,body=''){const r=Readable.from([Buffer.from(body)]);r.method=method;r.url=url;r.headers=method==='POST'?{'content-type':'application/x-www-form-urlencoded',origin:'https://preston.run'}:{};return r;}
function store(){const db={people:[{id:'p1',user_id:'u1',name:'Alice'}],life_items:[{id:'l1',user_id:'u1',title:'Licence'}],trips:[{id:'t1',user_id:'u1',title:'Chicago'}],reminder_settings:[],reminder_overrides:[]};function builder(table){let mode='select',payload=null,filters=[];const b={select(){return b;},eq(k,v){filters.push([k,v]);return b;},upsert(v){mode='upsert';payload=v;return b;},delete(){mode='delete';return b;},maybeSingle(){let row=db[table].find(x=>filters.every(([k,v])=>x[k]===v))||null;if(mode==='delete'&&row){db[table].splice(db[table].indexOf(row),1);row={id:row.id};}return Promise.resolve({data:row,error:null});},single(){if(mode==='upsert'){let row=db[table].find(x=>x.user_id===payload.user_id&&x.entity_type===payload.entity_type&&x.entity_id===payload.entity_id);if(row)Object.assign(row,payload);else{row={id:'o1',...payload};db[table].push(row);}return Promise.resolve({data:row,error:null});}return b.maybeSingle();},then(resolve,reject){return Promise.resolve({data:db[table].filter(x=>filters.every(([k,v])=>x[k]===v)),error:null}).then(resolve,reject);}};return b;}return{db,auth:{getUser:async()=>({data:{user:{id:'u1',email:'owner@example.com'}},error:null}),signOut:async()=>{}},from:t=>builder(t)};}
const config={siteUrl:'https://preston.run',ownerGoogleEmail:'owner@example.com'};
(async()=>{const s=store();let r=res();await handleReminderOverrideRoute(req('GET','/notifications/items/person/p1'),r,{supabase:s,config});assert.equal(r.status,200);assert.match(r.body,/Alice/);assert.match(r.body,/Use global defaults/);
r=res();await handleReminderOverrideRoute(req('POST','/notifications/items/person/p1','mode=custom&offsets=21%2C3%2C1'),r,{supabase:s,config});assert.equal(r.status,302);assert.deepEqual(s.db.reminder_overrides[0].offsets,[21,3,1]);assert.equal(s.db.reminder_overrides[0].user_id,'u1');
r=res();await handleReminderOverrideRoute(req('POST','/notifications/items/person/p1','mode=custom&offsets=7%2C-1'),r,{supabase:s,config});assert.equal(r.status,400);
r=res();await handleReminderOverrideRoute(req('POST','/notifications/items/person/p1','mode=default'),r,{supabase:s,config});assert.equal(r.status,302);assert.equal(s.db.reminder_overrides.length,0);
r=res();await handleReminderOverrideRoute(req('GET','/notifications/items/person/other-owner'),r,{supabase:s,config});assert.equal(r.status,404);
for(const [type,id,title] of [['life_item','l1','Licence'],['trip','t1','Chicago']]){r=res();await handleReminderOverrideRoute(req('GET',`/notifications/items/${type}/${id}`),r,{supabase:s,config});assert.equal(r.status,200);assert.match(r.body,new RegExp(title));}
console.log('reminder override tests passed');})().catch(e=>{console.error(e);process.exit(1)});
