const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {handleTripsRoute}=require('../src/routes/trips');

function res(){return{status:null,headers:{},body:'',writeHead(s,h={}){this.status=s;this.headers={...this.headers,...h};},end(b=''){this.body+=b||'';}};}
function req(method,url,body=''){const r=Readable.from([Buffer.from(body)]);r.method=method;r.url=url;r.headers=method==='POST'?{'content-type':'application/x-www-form-urlencoded',origin:'https://preston.run'}:{};return r;}
function store(owner=true){
  const data={
    trips:[
      {id:'t1',user_id:'u1',title:'October Trip',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10',destination_label:'Chicago, IL',destination_city:'Chicago',destination_region:'IL',destination_country:'USA',notes:null,archived_at:null},
      {id:'past',user_id:'u1',title:'Bowral',status:'completed',start_date:'2026-09-11',end_date:'2026-09-13',destination_label:'Bowral, NSW',archived_at:null},
      {id:'arch',user_id:'u1',title:'Old Trip',status:'completed',start_date:'2026-01-01',end_date:'2026-01-03',destination_label:'Old Place',archived_at:'2026-09-01T00:00:00.000Z'}
    ],
    trip_segments:[{id:'s1',user_id:'u1',trip_id:'t1',position:1,segment_type:'travel',title:'Chicago stage',origin:'Sydney',destination:'Chicago',starts_at:'2026-10-01T00:00:00.000Z',ends_at:'2026-10-01T14:00:00.000Z',time_zone:'Australia/Sydney',notes:null}],
    bookings:[{id:'b1',user_id:'u1',trip_id:'t1',segment_id:null,position:1,booking_type:'flight',title:'Jetstar flight',provider:'Jetstar',confirmation_reference:'QNRY8J',status:'confirmed',starts_at:'2026-10-01T00:00:00.000Z',ends_at:'2026-10-10T00:00:00.000Z',time_zone:'Australia/Sydney',location:'Chicago',booking_url:null,notes:null,source_metadata:{source:'gmail',manual_fields:[]}}],
    booking_legs:[{id:'l1',user_id:'u1',booking_id:'b1',position:1,service_number:'JQ223',origin:'Sydney',destination:'Queenstown',departs_at:'2026-10-01T00:00:00Z',arrives_at:'2026-10-01T03:00:00Z',departure_time_zone:'Australia/Sydney',arrival_time_zone:'Pacific/Auckland'},{id:'l2',user_id:'u1',booking_id:'b1',position:2,service_number:'JQ224',origin:'Queenstown',destination:'Sydney',departs_at:'2026-10-10T00:00:00Z',arrives_at:null,departure_time_zone:'Pacific/Auckland',arrival_time_zone:'Australia/Sydney'}],
    life_items:[{id:'e1',user_id:'u1',linked_trip_id:'t1',title:'Dinner at Yonder',category:'event',status:'upcoming',priority:'normal',starts_at:'2026-10-02T08:00:00.000Z',ends_at:'2026-10-02T10:00:00.000Z',time_zone:'America/Chicago',location:'West Loop'}],
    tasks:[{id:'task1',user_id:'u1',title:'Pack',status:'open',priority:'normal',linked_trip_id:'t1'}]
  };
  function builder(table){let mode='select',payload=null,filters=[],orders=[];const b={select(){return b;},order(k,o){orders.push([k,o]);return b;},insert(v){mode='insert';payload=v;return b;},update(v){mode='update';payload=v;return b;},delete(){mode='delete';return b;},eq(k,v){filters.push(row=>row[k]===v);return b;},is(k,v){filters.push(row=>row[k]===v);return b;},not(k,op,v){assert.equal(op,'is');assert.equal(v,null);filters.push(row=>row[k]!==null&&row[k]!==undefined);return b;},in(k,values){filters.push(row=>values.includes(row[k]));return b;},single(){if(mode==='insert'){const row={id:`new-${table}`,...payload};data[table].push(row);return Promise.resolve({data:row,error:null});}return Promise.resolve({data:null,error:null});},maybeSingle(){let row=data[table].find(x=>filters.every(fn=>fn(x)))||null;if(mode==='update'&&row)Object.assign(row,payload);if(mode==='delete'&&row)data[table].splice(data[table].indexOf(row),1);return Promise.resolve({data:row,error:null});},then(resolve,reject){let rows=data[table].filter(x=>filters.every(fn=>fn(x)));for(const [k,o] of orders.slice().reverse())rows=rows.slice().sort((a,b)=>{const av=a[k],bv=b[k];if(av==null)return o&&o.nullsFirst?-1:1;if(bv==null)return o&&o.nullsFirst?1:-1;return(av>bv?1:av<bv?-1:0)*(o&&o.ascending===false?-1:1);});return Promise.resolve({data:rows,error:null}).then(resolve,reject);}};return b;}
  return{data,auth:{getUser:async()=>owner?{data:{user:{id:'u1',email:'owner@example.com'}},error:null}:{data:{user:null},error:null},signOut:async()=>{}},from:t=>builder(t)};
}
const config={siteUrl:'https://preston.run',ownerGoogleEmail:'owner@example.com'};

(async()=>{
  let s=store(false),r=res();await handleTripsRoute(req('GET','/trips'),r,{supabase:s,config});assert.equal(r.status,302);assert.equal(r.headers.location,'/');
  s=store(true);r=res();await handleTripsRoute(req('GET','/trips'),r,{supabase:s,config});assert.equal(r.status,200);assert.match(r.body,/October Trip/);assert.match(r.body,/Bowral/);assert.doesNotMatch(r.body,/Old Trip/);assert.match(r.body,/Archived Trips/);assert.equal(r.headers['cache-control'],'private, no-store');
  r=res();await handleTripsRoute(req('GET','/trips/archived'),r,{supabase:s,config});assert.equal(r.status,200);assert.match(r.body,/Old Trip/);assert.doesNotMatch(r.body,/October Trip/);
  r=res();await handleTripsRoute(req('GET','/trips/t1'),r,{supabase:s,config});assert.equal(r.status,200);assert.match(r.body,/JQ223/);assert.match(r.body,/JQ224/);assert.match(r.body,/Dinner at Yonder/);assert.match(r.body,/Pack/);assert.match(r.body,/Stage/);
  r=res();await handleTripsRoute(req('GET','/trips/t1/bookings/new'),r,{supabase:s,config});assert.equal(r.status,302);assert.equal(r.headers.location,'/bookings/new?trip_id=t1');

  const linkedCounts={bookings:s.data.bookings.length,events:s.data.life_items.length,tasks:s.data.tasks.length,stages:s.data.trip_segments.length};
  r=res();await handleTripsRoute(req('POST','/trips/t1/archive'),r,{supabase:s,config});assert.equal(r.status,302);assert.equal(r.headers.location,'/trips/t1');const firstStamp=s.data.trips.find(t=>t.id==='t1').archived_at;assert.ok(firstStamp);assert.equal(s.data.trips.find(t=>t.id==='t1').status,'completed');assert.deepEqual({bookings:s.data.bookings.length,events:s.data.life_items.length,tasks:s.data.tasks.length,stages:s.data.trip_segments.length},linkedCounts,'archive must preserve linked records');
  r=res();await handleTripsRoute(req('POST','/trips/t1/archive'),r,{supabase:s,config});assert.equal(r.status,302);assert.equal(s.data.trips.find(t=>t.id==='t1').archived_at,firstStamp,'second archive must be a no-op');
  r=res();await handleTripsRoute(req('POST','/trips/t1/unarchive'),r,{supabase:s,config});assert.equal(r.status,302);assert.equal(s.data.trips.find(t=>t.id==='t1').archived_at,null);assert.equal(s.data.trips.find(t=>t.id==='t1').status,'completed','unarchive must not restore status');
  r=res();await handleTripsRoute(req('POST','/trips/t1/unarchive'),r,{supabase:s,config});assert.equal(r.status,302);assert.equal(s.data.trips.find(t=>t.id==='t1').archived_at,null);

  r=res();const bad=req('POST','/trips/past/archive');bad.headers.origin='https://evil.example';await handleTripsRoute(bad,r,{supabase:s,config});assert.equal(r.status,403);assert.equal(s.data.trips.find(t=>t.id==='past').archived_at,null);
  r=res();await handleTripsRoute(req('GET','/trips/missing'),r,{supabase:s,config});assert.equal(r.status,404);
  console.log('trips route tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
