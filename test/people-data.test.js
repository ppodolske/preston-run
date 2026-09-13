const assert = require('node:assert/strict');
const { createPerson, updatePerson, personPayload } = require('../src/data/people');

function makeBuilder() {
  const calls = [];
  const builder = {
    calls,
    insert(payload){ calls.push(['insert', payload]); return this; },
    update(payload){ calls.push(['update', payload]); return this; },
    select(value){ calls.push(['select', value]); return this; },
    eq(key, value){ calls.push(['eq', key, value]); return this; },
    single(){ return Promise.resolve({data:{id:'p1'},error:null}); },
    maybeSingle(){ return Promise.resolve({data:{id:'p1'},error:null}); }
  };
  return builder;
}

(async () => {
  assert.deepEqual(personPayload({name:'  Jane  ',relationship:'  Friend ',birthday_month:5,birthday_day:12,birth_year:'',notes:'  ',active:true}), {
    name:'Jane',relationship:'Friend',birthday_month:5,birthday_day:12,birth_year:null,notes:null,active:true
  });

  let builder = makeBuilder();
  let supabase = { from(name){ assert.equal(name,'people'); return builder; } };
  await createPerson(supabase, {id:'user-123'}, {name:'Jane',relationship:'Friend',birthday_month:5,birthday_day:12,birth_year:null,notes:null,active:true});
  const inserted = builder.calls.find(call => call[0] === 'insert')[1];
  assert.equal(inserted.user_id, 'user-123');
  assert.equal(inserted.name, 'Jane');

  builder = makeBuilder();
  supabase = { from(){ return builder; } };
  await updatePerson(supabase, {id:'user-123'}, 'person-1', {name:'Jane',birthday_month:null,birthday_day:null,birth_year:null,active:false});
  assert.ok(builder.calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'user-123'));
  const updated = builder.calls.find(call => call[0] === 'update')[1];
  assert.equal(Object.hasOwn(updated, 'user_id'), false);
  assert.equal(updated.active, false);

  await assert.rejects(() => createPerson(supabase, null, {name:'Nope'}), /Authenticated user/);
  console.log('people data tests passed');
})().catch(error => { console.error(error); process.exit(1); });
