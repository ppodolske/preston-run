const assert = require('node:assert/strict');
const { validateLifeItemInput, validateTaskInput, parseLocalDateInput, isOverdue, getNeedsAttention, getComingUpLifeItems } = require('../src/domain/life-admin');

assert.equal(parseLocalDateInput('2026-09-30'), '2026-09-30T00:00:00.000Z');
assert.equal(parseLocalDateInput(''), null);
assert.throws(()=>parseLocalDateInput('2026-02-30'), /invalid/);
assert.throws(()=>validateLifeItemInput({title:'x',category:'nope'}), /Category/);
assert.throws(()=>validateLifeItemInput({title:'x',status:'open'}), /Status/);
assert.throws(()=>validateLifeItemInput({title:'x',priority:'critical'}), /Priority/);
assert.throws(()=>validateTaskInput({title:'x',status:'upcoming'}), /Status/);
const item=validateLifeItemInput({title:'  Licence renewal ',category:'renewal',status:'upcoming',due_at:'2026-10-01',priority:'high',notes:'  do this ',linked_person_id:''});
assert.equal(item.title,'Licence renewal');assert.equal(item.due_at,'2026-10-01T00:00:00.000Z');assert.equal(item.linked_person_id,null);assert.equal(item.notes,'do this');
const task=validateTaskInput({title:'Renew licence',status:'open',due_at:'2026-09-10',priority:'urgent'});assert.equal(task.priority,'urgent');
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
console.log('Life Admin domain tests passed');
