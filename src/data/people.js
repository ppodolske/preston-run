function nullableText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function nullableNumber(value) {
  if (value === '' || value == null) return null;
  return Number(value);
}

function personPayload(input) {
  return {
    name: String(input.name ?? '').trim(),
    relationship: nullableText(input.relationship),
    birthday_month: nullableNumber(input.birthday_month),
    birthday_day: nullableNumber(input.birthday_day),
    birth_year: nullableNumber(input.birth_year),
    notes: nullableText(input.notes),
    active: input.active !== false
  };
}

async function listPeople(supabase) {
  const result = await supabase.from('people').select('*').order('active', { ascending:false }).order('name', { ascending:true });
  if (result.error) throw result.error;
  return result.data || [];
}

async function getPerson(supabase, id) {
  const result = await supabase.from('people').select('*').eq('id', id).maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

async function createPerson(supabase, user, input) {
  if (!user || !user.id) throw new Error('Authenticated user is required');
  const payload = { ...personPayload(input), user_id:user.id };
  const result = await supabase.from('people').insert(payload).select('*').single();
  if (result.error) throw result.error;
  return result.data;
}

async function updatePerson(supabase, user, id, input) {
  if (!user || !user.id) throw new Error('Authenticated user is required');
  const payload = { ...personPayload(input), updated_at:new Date().toISOString() };
  const result = await supabase.from('people').update(payload).eq('id', id).eq('user_id', user.id).select('*').maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

async function deletePerson(supabase, id) {
  const result = await supabase.from('people').delete().eq('id', id).select('id').maybeSingle();
  if (result.error) throw result.error;
  return Boolean(result.data);
}

module.exports = { listPeople, getPerson, createPerson, updatePerson, deletePerson, personPayload, nullableText, nullableNumber };
