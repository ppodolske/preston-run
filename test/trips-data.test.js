const assert=require('node:assert/strict');
const {listTrips,getTrip,createTrip,createGeneratedTrip,updateTrip,deleteTrip,archiveTrip,unarchiveTrip,listSegments,getSegment,createSegment,updateSegment,deleteSegment}=require('../src/data/trips');
const {listBookings,getBooking,createBooking,updateBooking,updateBookingFromGmail,deleteBooking}=require('../src/data/bookings');

function builder(resultData=[]){const calls=[];let written=null;const b={calls,resultData,select(v){calls.push(['select',v]);return b;},insert(v){written=v;calls.push(['insert',v]);return b;},update(v){written=v;calls.push(['update',v]);return b;},delete(){calls.push(['delete']);return b;},eq(k,v){calls.push(['eq',k,v]);return b;},is(k,v){calls.push(['is',k,v]);return b;},not(k,op,v){calls.push(['not',k,op,v]);return b;},order(k,o){calls.push(['order',k,o]);return b;},limit(v){calls.push(['limit',v]);return b;},single(){return Promise.resolve({data:{id:'new',...written},error:null});},maybeSingle(){const base=Array.isArray(resultData)?resultData[0]||null:resultData;return Promise.resolve({data:written?{...(base||{}),...written}:base,error:null});},then(resolve){resolve({data:Array.isArray(resultData)?resultData:resultData?[resultData]:[],error:null});}};return b;}
function queueSupabase(entries){const used=[];return{used,from(name){const next=entries.shift();assert.ok(next,`unexpected table ${name}`);assert.equal(name,next.name);used.push(next.builder);return next.builder;}};}
function hasOwner(b){return b.calls.some(x=>x[0]==='eq'&&x[1]==='user_id'&&x[2]==='u1');}

(async()=>{
  let b=builder(),supabase={from(name){assert.equal(name,'trips');return b;}};
  await listTrips(supabase,{id:'u1'});assert.equal(hasOwner(b),true);
  b=builder();supabase={from(){return b;}};await listTrips(supabase,{id:'u1'},{archiveState:'active'});assert.ok(b.calls.some(x=>x[0]==='is'&&x[1]==='archived_at'&&x[2]===null));
  b=builder();supabase={from(){return b;}};await listTrips(supabase,{id:'u1'},{archiveState:'archived'});assert.ok(b.calls.some(x=>x[0]==='not'&&x[1]==='archived_at'&&x[2]==='is'&&x[3]===null));
  b=builder({id:'t1'});supabase={from(){return b;}};await getTrip(supabase,{id:'u1'},'t1');assert.equal(hasOwner(b),true);

  b=builder();supabase={from(){return b;}};await createTrip(supabase,{id:'u1'},{title:'Trip',status:'planning',start_date:'2026-10-01',end_date:'2026-10-10',destination_label:'Chicago, IL',destination_city:'Chicago',destination_region:'IL',destination_country:'USA'});let insert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(insert.automation_managed,false);assert.equal(insert.destination_city,'Chicago');
  b=builder();supabase={from(){return b;}};await createGeneratedTrip(supabase,{id:'u1'},{title:'Bowral, NSW',status:'upcoming',start_date:'2026-11-01',end_date:'2026-11-03',destination_city:'Bowral',destination_region:'NSW',destination_country:'Australia'});insert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(insert.automation_managed,true);
  b=builder();supabase={from(){return b;}};await updateTrip(supabase,{id:'u1'},'t1',{title:'Manual',status:'upcoming'});const tripUpdate=b.calls.find(x=>x[0]==='update')[1];assert.equal(tripUpdate.automation_managed,false);
  b=builder();supabase={from(){return b;}};await deleteTrip(supabase,{id:'u1'},'t1');assert.equal(hasOwner(b),true);

  const activeTrip={id:'t1',user_id:'u1',title:'Trip',status:'upcoming',archived_at:null};
  let readTrip=builder(activeTrip),writeTrip=builder(activeTrip);supabase=queueSupabase([{name:'trips',builder:readTrip},{name:'trips',builder:writeTrip}]);
  let archived=await archiveTrip(supabase,{id:'u1'},'t1','2026-09-14T08:00:00.000Z');assert.equal(archived.archived_at,'2026-09-14T08:00:00.000Z');assert.equal(archived.status,'completed');
  const alreadyArchived={...activeTrip,status:'completed',archived_at:'2026-09-14T08:00:00.000Z'};readTrip=builder(alreadyArchived);supabase=queueSupabase([{name:'trips',builder:readTrip}]);archived=await archiveTrip(supabase,{id:'u1'},'t1','2026-09-15T08:00:00.000Z');assert.equal(archived.archived_at,'2026-09-14T08:00:00.000Z','second archive must not change timestamp');
  const cancelled={...activeTrip,status:'cancelled'};readTrip=builder(cancelled);writeTrip=builder(cancelled);supabase=queueSupabase([{name:'trips',builder:readTrip},{name:'trips',builder:writeTrip}]);archived=await archiveTrip(supabase,{id:'u1'},'t1','2026-09-14T08:00:00.000Z');assert.equal(archived.status,'cancelled');
  readTrip=builder(alreadyArchived);writeTrip=builder(alreadyArchived);supabase=queueSupabase([{name:'trips',builder:readTrip},{name:'trips',builder:writeTrip}]);const unarchived=await unarchiveTrip(supabase,{id:'u1'},'t1','2026-09-16T08:00:00.000Z');assert.equal(unarchived.archived_at,null);assert.equal(unarchived.status,'completed');
  const alreadyActive={...activeTrip,status:'completed',archived_at:null};readTrip=builder(alreadyActive);supabase=queueSupabase([{name:'trips',builder:readTrip}]);assert.equal((await unarchiveTrip(supabase,{id:'u1'},'t1')).archived_at,null);

  b=builder();supabase={from(name){assert.equal(name,'trip_segments');return b;}};await listSegments(supabase,{id:'u1'},'t1');assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='trip_id'&&x[2]==='t1'));
  b=builder({id:'s1'});supabase={from(){return b;}};await getSegment(supabase,{id:'u1'},'s1');assert.equal(hasOwner(b),true);
  b=builder();supabase={from(){return b;}};await createSegment(supabase,{id:'u1'},'t1',{title:'Leg',segment_type:'travel',position:2,origin:'A',destination:'B',time_zone:'Australia/Sydney'});insert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(insert.trip_id,'t1');
  b=builder();supabase={from(){return b;}};await updateSegment(supabase,{id:'u1'},'s1',{title:'Leg 2',segment_type:'travel',position:3,time_zone:'Australia/Sydney'});assert.equal(hasOwner(b),true);
  b=builder();supabase={from(){return b;}};await deleteSegment(supabase,{id:'u1'},'s1');assert.equal(hasOwner(b),true);

  b=builder();supabase={from(name){assert.equal(name,'bookings');return b;}};await listBookings(supabase,{id:'u1'},{tripId:'t1'});assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='trip_id'&&x[2]==='t1'));
  b=builder();supabase={from(){return b;}};await listBookings(supabase,{id:'u1'},{unlinked:true});assert.ok(b.calls.some(x=>x[0]==='is'&&x[1]==='trip_id'&&x[2]===null));
  b=builder({id:'b1'});supabase={from(){return b;}};await getBooking(supabase,{id:'u1'},'b1');assert.equal(hasOwner(b),true);

  b=builder();supabase={from(){return b;}};await createBooking(supabase,{id:'u1'},{trip_id:null,title:'Hotel',booking_type:'accommodation',position:1,status:'confirmed',segment_id:'seg1',provider:'Stay Co',confirmation_reference:'ABC',time_zone:'Australia/Sydney',location:'Chicago',origin:'Airport',destination:'Hotel'});insert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(insert.trip_id,null);assert.equal(insert.segment_id,null);assert.equal(insert.source_metadata.source,'manual');assert.ok(insert.source_metadata.manual_fields.includes('trip_id'));assert.ok(insert.source_metadata.manual_fields.includes('title'));

  const existing={id:'b1',user_id:'u1',trip_id:'t1',segment_id:'s1',title:'Gmail hotel',booking_type:'accommodation',position:1,status:'confirmed',time_zone:'Australia/Sydney',source_metadata:{source:'gmail',source_record_id:'src1',manual_fields:['title']}};
  const read=builder(existing),write=builder(existing);supabase=queueSupabase([{name:'bookings',builder:read},{name:'bookings',builder:write}]);
  await updateBooking(supabase,{id:'u1'},'b1',{trip_id:null,title:'My hotel',booking_type:'accommodation',position:1,status:'confirmed',time_zone:'Australia/Sydney',provider:'Stay Co'});
  const manualUpdate=write.calls.find(x=>x[0]==='update')[1];assert.equal(manualUpdate.trip_id,null);assert.equal(manualUpdate.segment_id,null);assert.equal(manualUpdate.source_metadata.source,'gmail');assert.ok(manualUpdate.source_metadata.manual_fields.includes('title'));assert.ok(manualUpdate.source_metadata.manual_fields.includes('trip_id'));

  const autoRead=builder({...existing,title:'My hotel',source_metadata:{...existing.source_metadata,manual_fields:['title']}}),autoWrite=builder(existing);supabase=queueSupabase([{name:'bookings',builder:autoRead},{name:'bookings',builder:autoWrite}]);
  await updateBookingFromGmail(supabase,{id:'u1'},'b1',{title:'Overwrite attempt',status:'changed',provider:'Stay Co'},{parser_version:'v13'});
  const gmailUpdate=autoWrite.calls.find(x=>x[0]==='update')[1];assert.equal(Object.hasOwn(gmailUpdate,'title'),false);assert.equal(gmailUpdate.status,'changed');assert.equal(gmailUpdate.source_metadata.source,'gmail');assert.equal(gmailUpdate.source_metadata.parser_version,'v13');

  b=builder();supabase={from(){return b;}};await deleteBooking(supabase,{id:'u1'},'b1');assert.equal(hasOwner(b),true);
  await assert.rejects(()=>createTrip(supabase,null,{title:'No'}),/Authenticated user/);
  await assert.rejects(()=>listTrips(supabase,null),/Authenticated user/);
  console.log('trips data tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
