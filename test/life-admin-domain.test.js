const assert = require('node:assert/strict');
const { validateLifeItemInput, validateTaskInput, parseLocalDateInput, isOverdue, getNeedsAttention, getComingUpLifeItems, getAttentionBuckets, excludeAttentionFromComingUp } = require('../src/domain/life-admin');

assert.equal(parseLocalDateInput('2026-09-30'), '2026-09-30T00:00:00.000Z');
assert.equal(parseLocalDateInput(''), null);
assert.throws(()=>parseLocalDateInput('2026-02-30'), /invalid/);
assert.throws(()=>validateLifeItemInput({title:'x',category:'nope'}), /Category/);
assert.throws(()=>validateLifeItemInput({title:'x',status:'open'}), /Status/);
assert.throws(()=>validateLifeItemInput({title:'x',priority:'critical'}), /Priority/);
assert.throws(()=>validateTaskInput({title:'x',status:'upcoming'}), /Status/);
const item=validateLifeItemInput({title:'  Licence renewal ',category:'renewal',status:'upcoming',due_at:'2026-10-01',priority:'high',notes:'  do this ',linked_person_id:''});
assert.equal(item.title,'Licence renewal');assert.equal(item.due_at,'2026-10-01T00:00:00.000Z');assert.equal(item.linked_person_id,null);assert.equal(item.notes,'do this');
const event=validateLifeItemInput({title:'Dinner',category:'event',status:'upcoming',starts_at:'2026-12-12T18:00',ends_at:'2026-12-12T20:00',time_zone:'Australia/Sydney',location:'Circular Quay',provider:'Cafe Sydney',confirmation_reference:'ABC123',booking_url:'https://example.com/reservation',linked_trip_id:'trip1',priority:'normal'});
assert.equal(event.starts_at,'2026-12-12T07:00:00.000Z');
assert.equal(event.ends_at,'2026-12-12T09:00:00.000Z');
assert.equal(event.time_zone,'Australia/Sydney');
assert.equal(event.location,'Circular Quay');
assert.equal(event.provider,'Cafe Sydney');
assert.equal(event.confirmation_reference,'ABC123');
assert.equal(event.booking_url,'https://example.com/reservation');
assert.equal(event.linked_trip_id,'trip1');
assert.throws(()=>validateLifeItemInput({title:'Bad event',category:'event',status:'upcoming',starts_at:'2026-12-12T20:00',ends_at:'2026-12-12T18:00',time_zone:'Australia/Sydney'}),/end/i);
const task=validateTaskInput({title:'Renew licence',status:'open',due_at:'2026-09-10',priority:'urgent',linked_trip_id:'trip1'});assert.equal(task.priority,'urgent');assert.equal(task.linked_trip_id,'trip1');
const emptyTrip=validateTaskInput({title:'No trip',status:'open',priority:'normal',linked_trip_id:''});assert.equal(emptyTrip.linked_trip_id,null);
const now=new Date('2026-09-13T00:00:00Z');
assert.equal(isOverdue({status:'upcoming',due_at:'2026-09-12T00:00:00Z'},now),true);
assert.equal(isOverdue({status:'upcoming',due_at:'2026-09-13T00:00:00Z'},new Date('2026-09-13T10:00:00Z')),false);
assert.equal(isOverdue({status:'completed',due_at:'2026-09-12T00:00:00Z'},now),false);
const attention=getNeedsAttention({lifeItems:[
  {id:'l1',title:'Needs action',status:'needs_action',priority:'normal',due_at:null},
  {id:'l2',title:'Overdue',status:'upcoming',priority:'high',due_at:'2026-09-12T00:00:00Z'},
  {id:'l3',title:'Done',status:'completed',priority:'urgent',due_at:'2026-09-01T00:00:00Z'}
],tasks:[
  {id:'t1',title:'Urgent future',status:'open',priority:'urgent',due_at:'2026-09-20T00:00:00Z'},
  {id:'t2',title:'Ignored',status:'ignored',priority:'urgent',due_at:'2026-09-01T00:00:00Z'}
],now});
assert.deepEqual(attention.map(x=>x.record.id),['t1','l2','l1']);
const coming=getComingUpLifeItems([
  {id:'today',title:'Today',status:'upcoming',priority:'normal',due_at:'2026-09-13T00:00:00Z'},
  {id:'a',title:'Later',status:'upcoming',priority:'normal',starts_at:null,due_at:'2026-10-01T00:00:00Z'},
  {id:'b',title:'Sooner',status:'upcoming',priority:'normal',starts_at:'2026-09-15T00:00:00Z',due_at:null},
  {id:'c',title:'Past',status:'upcoming',priority:'normal',due_at:'2026-09-01T00:00:00Z'},
  {id:'d',title:'Done',status:'completed',priority:'normal',due_at:'2026-09-14T00:00:00Z'}
],now,90);
assert.deepEqual(coming.map(x=>x.item.id),['today','b','a']);
assert.equal(coming[0].daysAway,0);

const bucketLifeItems=[
  {id:'lo-urgent',title:'Urgent overdue',status:'upcoming',priority:'urgent',due_at:'2026-09-11T00:00:00Z'},
  {id:'lo-high',title:'High overdue',status:'upcoming',priority:'high',due_at:'2026-09-12T00:00:00Z'},
  {id:'lt-normal',title:'Normal today',status:'needs_action',priority:'normal',due_at:'2026-09-13T00:00:00Z'},
  {id:'future',title:'Urgent future',status:'upcoming',priority:'urgent',due_at:'2026-09-14T00:00:00Z'},
  {id:'undated',title:'Needs action undated',status:'needs_action',priority:'urgent',due_at:null},
  {id:'done',title:'Done today',status:'completed',priority:'urgent',due_at:'2026-09-13T00:00:00Z'}
];
const bucketTasks=[
  {id:'to-high',title:'Task overdue',status:'open',priority:'high',due_at:'2026-09-10T00:00:00Z'},
  {id:'tt-urgent',title:'Task today urgent',status:'open',priority:'urgent',due_at:'2026-09-13T00:00:00Z'},
  {id:'tt-low',title:'Task today low',status:'open',priority:'low',due_at:'2026-09-13T00:00:00Z'},
  {id:'ignored',title:'Ignored today',status:'ignored',priority:'urgent',due_at:'2026-09-13T00:00:00Z'}
];
const buckets=getAttentionBuckets({lifeItems:bucketLifeItems,tasks:bucketTasks,now:new Date('2026-09-13T10:00:00Z')});
assert.deepEqual(buckets.overdue.map(x=>`${x.type}:${x.record.id}`),['life_item:lo-urgent','task:to-high','life_item:lo-high']);
assert.deepEqual(buckets.today.map(x=>`${x.type}:${x.record.id}`),['task:tt-urgent','life_item:lt-normal','task:tt-low']);
assert.equal(buckets.overdue.some(x=>buckets.today.some(y=>x.type===y.type&&x.record.id===y.record.id)),false,'attention buckets must not overlap');
assert.equal(buckets.overdue.some(x=>x.record.id==='future'),false,'future urgent item is not overdue');
assert.equal(buckets.today.some(x=>x.record.id==='undated'),false,'undated needs-action item is not due today');

const bucketComing=getComingUpLifeItems(bucketLifeItems,now,90);
const dedupedComing=excludeAttentionFromComingUp(bucketComing,buckets);
assert.equal(dedupedComing.some(x=>x.item.id==='lt-normal'),false,'today life item must not duplicate in Coming Up');
assert.equal(dedupedComing.some(x=>x.item.id==='future'),true,'future item remains in Coming Up');
console.log('Life Admin domain tests passed');
