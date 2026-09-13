const LIFE_CATEGORIES = ['renewal','deadline','bill','appointment','government','property','subscription','membership','event','other'];
const LIFE_STATUSES = ['upcoming','needs_action','waiting','completed','ignored'];
const TASK_STATUSES = ['open','in_progress','waiting','completed','ignored'];
const PRIORITIES = ['low','normal','high','urgent'];
const PRIORITY_RANK = { urgent:0, high:1, normal:2, low:3 };

function requiredText(value, label, max = 240) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required`);
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return text;
}
function optionalText(value) { const text = String(value ?? '').trim(); return text || null; }
function oneOf(value, allowed, label, fallback) { const normalized = String(value || fallback || '').trim(); if (!allowed.includes(normalized)) throw new Error(`${label} is invalid`); return normalized; }
function parseLocalDateInput(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Date must use YYYY-MM-DD');
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Date is invalid');
  return date.toISOString();
}
function validateLifeItemInput(input = {}) { return { title:requiredText(input.title,'Title'), category:oneOf(input.category,LIFE_CATEGORIES,'Category','other'), status:oneOf(input.status,LIFE_STATUSES,'Status','upcoming'), due_at:parseLocalDateInput(input.due_at), starts_at:parseLocalDateInput(input.starts_at), recurrence_rule:optionalText(input.recurrence_rule), priority:oneOf(input.priority,PRIORITIES,'Priority','normal'), notes:optionalText(input.notes), linked_person_id:optionalText(input.linked_person_id) }; }
function validateTaskInput(input = {}) { return { title:requiredText(input.title,'Title'), status:oneOf(input.status,TASK_STATUSES,'Status','open'), due_at:parseLocalDateInput(input.due_at), priority:oneOf(input.priority,PRIORITIES,'Priority','normal'), linked_life_item_id:optionalText(input.linked_life_item_id), linked_person_id:optionalText(input.linked_person_id), notes:optionalText(input.notes) }; }
function activeStatus(status) { return status !== 'completed' && status !== 'ignored'; }
function dateKeyInTimeZone(value, timeZone='Australia/Sydney') { const parts=new Intl.DateTimeFormat('en-AU',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${map.year}-${map.month}-${map.day}`; }
function storedDateKey(value) { return value ? String(value).slice(0,10) : null; }
function keyMs(key) { const [y,m,d]=key.split('-').map(Number); return Date.UTC(y,m-1,d); }
function isOverdue(record, now = new Date()) { if (!record || !activeStatus(record.status) || !record.due_at) return false; return storedDateKey(record.due_at) < dateKeyInTimeZone(now); }
function sortAttention(a,b){const rank=(PRIORITY_RANK[a.record.priority||'normal']??2)-(PRIORITY_RANK[b.record.priority||'normal']??2);if(rank)return rank;if(a.overdue!==b.overdue)return a.overdue?-1:1;const ad=a.record.due_at?keyMs(storedDateKey(a.record.due_at)):Infinity;const bd=b.record.due_at?keyMs(storedDateKey(b.record.due_at)):Infinity;if(ad!==bd)return ad-bd;return String(a.record.title).localeCompare(String(b.record.title));}
function getNeedsAttention({ lifeItems = [], tasks = [], now = new Date() } = {}) { const life=lifeItems.filter(item=>activeStatus(item.status)&&(item.status==='needs_action'||isOverdue(item,now)||item.priority==='urgent')).map(record=>({type:'life_item',record,overdue:isOverdue(record,now)})); const taskRows=tasks.filter(task=>activeStatus(task.status)&&(isOverdue(task,now)||task.priority==='urgent')).map(record=>({type:'task',record,overdue:isOverdue(record,now)})); return life.concat(taskRows).sort(sortAttention); }
function lifeItemDate(item){return item.starts_at||item.due_at||null;}
function getComingUpLifeItems(lifeItems=[],now=new Date(),days=90){const nowKey=dateKeyInTimeZone(now),startMs=keyMs(nowKey),endMs=startMs+days*86400000;return lifeItems.filter(item=>activeStatus(item.status)).map(item=>{const raw=lifeItemDate(item);if(!raw)return null;const key=storedDateKey(raw),ms=keyMs(key);return {item,date:new Date(raw),daysAway:Math.round((ms-startMs)/86400000),dayMs:ms};}).filter(Boolean).filter(row=>row.dayMs>=startMs&&row.dayMs<=endMs).sort((a,b)=>a.dayMs-b.dayMs||String(a.item.title).localeCompare(String(b.item.title)));}
module.exports={LIFE_CATEGORIES,LIFE_STATUSES,TASK_STATUSES,PRIORITIES,parseLocalDateInput,validateLifeItemInput,validateTaskInput,isOverdue,getNeedsAttention,getComingUpLifeItems,dateKeyInTimeZone};
