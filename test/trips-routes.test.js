const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {handleTripsRoute}=require('../src/routes/trips');

function res(){return{status:null,headers:{},body:'',writeHead(s,h={}){this.status=s;this.headers={...this.headers,...h};},end(b=''){this.body+=b||'';}};}
function req(method,url,body=''){const r=Readable.from([Buffer.from(body)]);r.method=method;r.url=url;r.headers=method==='POST'?{'content-type':'application/x-www-form-urlencoded',origin:'https://preston.run'}:{};return r;}
function store(owner=true){
  const data={
    trips:[{id:'t1',user_id:'u1',title:'Chicago',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10',destination_label:'Chicago, IL',destination_city:'Chicago',destination_region:'IL',destination_country:'USA',notes:null},{id:'t2',user_id:'u1',title:'Other',status:'planning',start_date:null,end_date:null,notes:null}],
    trip_segments:[{id:'s1',user_id:'u1',trip_id:'t1',position:1,segment_type:'travel',title:'Flight',origin:'Sydney',destination:'Chicago',starts_at:'2026-10-01T00:00:00.000Z',ends_at:'2026-10-01T14:00:00.000Z',time_zone:'Australia/Sydney',notes:null},{id:'s2',user_id:'u1',trip_id:'t2',position:1,segment_type:'travel',title:'Other flight',origin:null,destination:null,starts_at:null,ends_at:null,time_zone:'Australia/Sydney',notes:null}],
    bookings:[{id:'b1',user_id:'u1',trip_id:'t1',segment_id:'s1',position:1,booking_type:'flight',title:'Qantas',provider:'Qantas',confirmation_reference:'ABC',status:'confirmed',starts_at:'2026-10-01T00:00:00.000Z',ends_at:'2026-10-01T14:00:00.000Z',time_zone:'Australia/Sydney',location:'ORD',booking_url:null,notes:null,source_metadata:{source:'manual'}}],
    life_items:[{id:'e1',user_id:'u1',linked_trip_id:'t1',title:'Dinner at Yonder',category:'event',status:'upcoming',priority:'normal',starts_at:'2026-10-02T08:00:00.000Z',ends_at:'2026-10-02T10:00:00.000Z',time_zone:'America/Chicago',location:'West Loop'}],
    tasks:[{id:'task1',user_id:'u1',title:'Pack',status:'open',priority:'normal',linked_trip_id:'t1'}]
  };
  function builder(table){let mode='select',payload=null,filters=[],orders=[];const b={select(){return b;},order(k,o){orders.push([k,o]);return b;},insert(v){mode='insert';payload=v;return b;},update(v){mode='update';payload=v;return b;},delete(){mode='delete';return b;},eq(k,v){filters.push([k,v]);return b;},is(k,v){filters.push([k,v]);return b;},single(){if(mode==='insert'){const row={id:`new-${table}`,...payload};data[table].push(row);return Promise.resolve({data:row,error:null});}return Promise.resolve({data:null,error:null});},maybeSingle(){let row=data[table].find(x=>filters.every(([k,v])=>x[k]===v))||null;if(mode==='update'&&row)Object.assign(row,payload);if(mode==='delete'&&row){if(table==='trips'&&(data.tasks.some(t=>t.linked_trip_id===row.id)||data.life_items.some(x=>x.linked_trip_id===row.id)||data.bookings.some(x=>x.trip_id===row.id)||data.trip_segments.some(x=>x.trip_id===row.id)))return Promise.resolve({data:null,error:{code:'23503'}});if(table==='trip_segments'&&data.bookings.some(x=>x.segment_id===row.id))return Promise.resolve({data:null,error:{code:'23503'}});data[table].splice(data[table].indexOf(row),1);}return Promise.resolve({data:row,error:null});},then(resolve,reject){let rows=data[table].filter(x=>filters.every(([k,v])=>x[k]===v));for(const [k,o] of orders.slice().reverse())rows=rows.slice().sort((a,b)=>{const av=a[k],bv=b[k];if(av==null)return o&&o.nullsFirst?-1:1;if(bv==null)return o&&o.nullsFirst?1:-1;return(av>bv?1:av<bv?-1:0)*(o&&o.ascending===false?-1:1);});return Promise.resolve({data:rows,error:null}).then(resolve,reject);}};return b;}
  return{data,auth:{getUser:async()=>owner?{data:{user:{id:'u1',email:'owner@example.com'}},error:null}:{data:{user:null},error:null},signOut:async()=>{}},from:t=>builder(t)};
}
const config={siteUrl:'https://preston.run',ownerGoogleEmail:'owner@example.com'};

(async()=>{
  let s=store(false),r=res();await handleTripsRoute(req('GET','/trips'),r,{supabase:s,config});assert.equal(r.status,302);assert.equal(r.headers.location,'/');
  s=store(true);r=res();await handleTripsRoute(req('GET','/trips'),r,{supabase:s,config});assert.equal(r.status,200);assert.match(r.body,/Chicago/);assert.match(r.body,/Chicago, IL/);assert.equal(r.headers['cache-control'],'private, no-store');
  r=res();await handleTripsRoute(req('GET','/trips/t1'),r,{supabase:s,config});assert.equal(r.status,200);assert.match(r.body,/Qantas/);assert.match(r.body,/Dinner at Yonder/);assert.match(r.body,/Pack/);
  r=res();await handleTripsRoute(req('GET','/trips/missing'),r,{supabase:s,config});assert.equal(r.status,404);

  r=res();const bad=req('POST','/trips','title=Bad&status=planning');bad.headers.origin='https://evil.example';await handleTripsRoute(bad,r,{supabase:s,config});assert.equal(r.status,403);assert.equal(s.data.trips.length,2);
  r=res();await handleTripsRoute(req('POST','/trips','title=Milwaukee&status=upcoming&start_date=2026-10-11&end_date=2026-10-15&destination_label=Milwaukee%2C+WI&destination_city=Milwaukee&destination_region=WI&destination_country=USA'),r,{supabase:s,config});assert.equal(r.status,302);assert.match(r.headers.location,/\/trips\/new-trips/);assert.equal(s.data.trips.length,3);assert.equal(s.data.trips[2].user_id,'u1');assert.equal(s.data.trips[2].destination_city,'Milwaukee');

  r=res();await handleTripsRoute(req('POST','/trips/t1/segments','title=Train&segment_type=travel&position=2&starts_at=2026-10-03T10%3A00&time_zone=America%2FChicago'),r,{supabase:s,config});assert.equal(r.status,302);assert.equal(r.headers.location,'/trips/t1');assert.equal(s.data.trip_segments.length,3);
  r=res();await handleTripsRoute(req('POST','/trips/t1/bookings','title=Hotel&booking_type=accommodation&status=confirmed&position=2&segment_id=s2&time_zone=America%2FChicago'),r,{supabase:s,config});assert.equal(r.status,400);assert.equal(s.data.bookings.length,1);assert.match(r.body,/selected segment/i);
  r=res();await handleTripsRoute(req('POST','/trips/t1/bookings','title=Hotel&booking_type=accommodation&status=confirmed&position=2&segment_id=s1&time_zone=America%2FChicago'),r,{supabase:s,config});assert.equal(r.status,302);assert.equal(r.headers.location,'/trips/t1');assert.equal(s.data.bookings.length,2);assert.equal(s.data.bookings[1].source_metadata.source,'manual');assert.ok(s.data.bookings[1].source_metadata.manual_fields.includes('title'));assert.ok(s.data.bookings[1].source_metadata.manual_fields.includes('trip_id'));

  r=res();await handleTripsRoute(req('POST','/segments/s1/delete'),r,{supabase:s,config});assert.equal(r.status,409);assert.match(r.body,/linked bookings/i);
  r=res();await handleTripsRoute(req('POST','/trips/t1/delete'),r,{supabase:s,config});assert.equal(r.status,409);assert.match(r.body,/linked tasks/i);
  s.data.tasks[0].linked_trip_id=null;s.data.bookings=[];s.data.trip_segments=[];
  r=res();await handleTripsRoute(req('POST','/trips/t1/delete'),r,{supabase:s,config});assert.equal(r.status,409);assert.match(r.body,/life admin/i);

  r=res();await handleTripsRoute(req('GET','/segments/missing/edit'),r,{supabase:s,config});assert.equal(r.status,404);
  console.log('trips route tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
