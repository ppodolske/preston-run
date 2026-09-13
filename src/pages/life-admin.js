'use strict';

const { isOverdue } = require('../domain/life-admin');
const { renderReminderControls, reminderClassForLifeItem } = require('./reminder-controls');
const { renderShell, escapeHtml: esc } = require('../ui/shell');
const { buttonLink, statusChip, emptyState, flashMessage, card, label } = require('../ui/components');
const { textField, selectField, dateField, textareaField } = require('../ui/forms');

function inputDate(v){return v?String(v).slice(0,10):'';}
function fmtDate(v){if(!v)return'';try{return new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',day:'numeric',month:'short',year:'numeric'}).format(new Date(v));}catch{return'Invalid date';}}
function personName(people,id){return people.find(p=>p.id===id)?.name||null;}
function optionPairs(values){return values.map(v=>[v,label(v)]);}
function peopleOptions(people){return [['','None'],...people.map(p=>[p.id,p.name])];}
function lifeOptions(items){return [['','None'],...items.map(i=>[i.id,i.title])];}
function tripOptions(trips){return [['','None'],...trips.map(t=>[t.id,t.title])];}

const PRIMARY_FILTERS=[['active','Active'],['needs_action','Needs attention'],['upcoming','Upcoming'],['completed','Completed']];
const CATEGORY_OPTIONS=[['','All categories'],['renewal','Renewals'],['deadline','Deadlines'],['bill','Bills'],['appointment','Appointments'],['government','Government'],['property','Property'],['subscription','Subscriptions'],['membership','Memberships'],['event','Events'],['other','Other']];

function filterHref(filter,category){const params=new URLSearchParams();if(filter&&filter!=='active')params.set('filter',filter);if(category)params.set('category',category);const qs=params.toString();return `/life-admin${qs?`?${qs}`:''}`;}
function categoryFilter(category){return `<form class="category-filter" method="get" action="/life-admin"><input type="hidden" name="filter" value="active"><label for="category">Category</label><select id="category" name="category" onchange="this.form.submit()">${CATEGORY_OPTIONS.map(([value,text])=>`<option value="${esc(value)}"${String(value)===String(category||'')?' selected':''}>${esc(text)}</option>`).join('')}</select><noscript><button class="button" type="submit">Apply</button></noscript></form>`;}

function itemMeta(item,people=[]){const bits=[label(item.category)];const date=fmtDate(item.starts_at||item.due_at);if(date)bits.push(date);const person=personName(people,item.linked_person_id);if(person)bits.push(person);return bits.map(esc).join(' · ');}
function itemCard(item,people=[]){const overdue=isOverdue(item,new Date());const chips=[statusChip(item.status,{className:item.status}),statusChip(item.priority,{className:item.priority}),overdue?'<span class="chip overdue">Overdue</span>':''].filter(Boolean).join('');return card(`<div class="card-head"><div><a class="title" href="/life-admin/${encodeURIComponent(item.id)}">${esc(item.title)}</a><div class="meta">${itemMeta(item,people)}</div></div><div class="chips">${chips}</div></div>${item.notes?`<div class="notes">${esc(item.notes)}</div>`:''}<div class="actions">${buttonLink({href:`/life-admin/${encodeURIComponent(item.id)}`,text:'Open'})}${buttonLink({href:`/life-admin/${encodeURIComponent(item.id)}/edit`,text:'Edit'})}</div>`,{className:overdue?'attention':''});}
function taskCard(task){const date=fmtDate(task.due_at);return card(`<div class="card-head"><div><div class="title">${esc(task.title)}</div><div class="meta">Task${date?` · ${esc(date)}`:''}</div></div><div class="chips">${statusChip(task.status)}${statusChip(task.priority,{className:task.priority})}</div></div><div class="actions">${buttonLink({href:`/tasks/${encodeURIComponent(task.id)}/edit`,text:'Edit'})}</div>`,{className:'task-card'});}
function attentionRow(x){const isTask=x.type==='task';const href=isTask?`/tasks/${encodeURIComponent(x.record.id)}/edit`:`/life-admin/${encodeURIComponent(x.record.id)}`;const type=isTask?'Task':label(x.record.category);return `<a class="row attention-row${isTask?' task-row':''}" href="${href}"><div><strong>${esc(x.record.title)}</strong><div class="meta">${esc(type)}${x.overdue?' · overdue':''}</div></div><span class="due">${esc(label(x.record.priority))}</span></a>`;}
function comingRow(x){return `<a class="row" href="/life-admin/${encodeURIComponent(x.item.id)}"><div><strong>${esc(x.item.title)}</strong><div class="meta">${esc(label(x.item.category))}</div></div><span class="due">${esc(fmtDate(x.date))}</span></a>`;}

function renderLifeAdminPage({lifeItems=[],tasks=[],people=[],filter='active',category='',needsAttention=[],comingUp=[],flash=null}={}){
  const normalizedFilter=PRIMARY_FILTERS.some(([key])=>key===filter)?filter:'active';
  const cards=lifeItems.length?`<div class="cards">${lifeItems.map(x=>itemCard(x,people)).join('')}</div>`:emptyState('No Life Admin items match this view.');
  const attention=needsAttention.length?`<div class="panel">${needsAttention.slice(0,8).map(attentionRow).join('')}</div>`:emptyState('Nothing needs attention.');
  const upcoming=comingUp.length?`<div class="panel">${comingUp.slice(0,8).map(comingRow).join('')}</div>`:emptyState('Nothing coming up in the next 90 days.');
  const taskCards=tasks.length?`<div class="cards">${tasks.map(taskCard).join('')}</div>`:emptyState('No tasks yet.');
  const body=`<h1>Life Admin</h1><div class="sub">Renewals, deadlines, appointments, bills and the actions attached to them.</div><div class="actions">${buttonLink({href:'/life-admin/new',text:'Add item',primary:true})}${buttonLink({href:'/tasks/new',text:'Add task'})}</div>${flash?flashMessage(flash):''}<div class="filter-bar"><nav class="filters" aria-label="Life Admin views">${PRIMARY_FILTERS.map(([key,text])=>`<a class="button ${normalizedFilter===key?'active':''}" href="${filterHref(key,category)}">${text}</a>`).join('')}</nav>${categoryFilter(category)}</div><div class="section">Needs Attention</div>${attention}<div class="section">Coming Up</div>${upcoming}<div class="section">Items</div>${cards}<div class="section">Tasks</div>${taskCards}`;
  return renderShell({title:'Life Admin',activeNav:'Life Admin',body});
}

function renderLifeItemPage({item,linkedTasks=[],person=null}={}){
  if(!item)return renderShell({title:'Life Admin',activeNav:'Life Admin',body:`<h1>Life Admin</h1>${emptyState('Item not found.')}`});
  const tasks=linkedTasks.length?linkedTasks.map(t=>`<div class="row"><div><strong>${esc(t.title)}</strong><div class="meta">${esc(label(t.status))} · ${esc(label(t.priority))}</div></div>${buttonLink({href:`/tasks/${encodeURIComponent(t.id)}/edit`,text:'Edit'})}</div>`).join(''):emptyState('No tasks linked to this item.');
  const rows=[`<div class="row"><span>Priority</span><strong>${esc(label(item.priority))}</strong></div>`];
  if(item.due_at)rows.push(`<div class="row"><span>Due</span><strong>${esc(fmtDate(item.due_at))}</strong></div>`);
  if(item.starts_at)rows.push(`<div class="row"><span>Starts</span><strong>${esc(fmtDate(item.starts_at))}</strong></div>`);
  if(person)rows.push(`<div class="row"><span>Person</span><strong>${esc(person.name)}</strong></div>`);
  if(item.recurrence_rule)rows.push(`<div class="row"><span>Recurrence</span><strong>${esc(item.recurrence_rule)}</strong></div>`);
  const body=`<h1>${esc(item.title)}</h1><div class="sub">${esc(label(item.category))} · ${esc(label(item.status))}</div><div class="panel">${rows.join('')}${item.notes?`<div class="notes">${esc(item.notes)}</div>`:''}</div><div class="actions life-detail-actions">${buttonLink({href:`/life-admin/${encodeURIComponent(item.id)}/edit`,text:'Edit item',primary:true})}${buttonLink({href:`/tasks/new?life_item_id=${encodeURIComponent(item.id)}`,text:'Add task'})}${buttonLink({href:'/life-admin',text:'Back'})}</div><div class="section">Tasks</div><div class="panel">${tasks}</div>`;
  return renderShell({title:item.title,activeNav:'Life Admin',body});
}

function renderLifeItemFormPage({item={},people=[],mode='create',error=null,reminderSettings={},reminderOverride=null}={}){
  const edit=mode==='edit';const action=edit?`/life-admin/${encodeURIComponent(item.id)}`:'/life-admin';
  const reminderControls=renderReminderControls({reminderClass:reminderClassForLifeItem(item),settings:reminderSettings,override:reminderOverride,edit});
  const fields=`${textField({name:'title',label:'Title',value:item.title||'',maxlength:240,required:true})}<div class="grid2">${selectField({name:'category',label:'Category',value:item.category||'other',options:optionPairs(['renewal','deadline','bill','appointment','government','property','subscription','membership','event','other'])})}${selectField({name:'status',label:'Status',value:item.status||'upcoming',options:optionPairs(['upcoming','needs_action','waiting','completed','ignored'])})}${dateField({name:'due_at',label:'Due date',value:inputDate(item.due_at)})}${dateField({name:'starts_at',label:'Start date',value:inputDate(item.starts_at)})}${selectField({name:'priority',label:'Priority',value:item.priority||'normal',options:optionPairs(['low','normal','high','urgent'])})}${selectField({name:'linked_person_id',label:'Person',value:item.linked_person_id||'',options:peopleOptions(people)})}</div>${textField({name:'recurrence_rule',label:'Recurrence note',value:item.recurrence_rule||'',placeholder:'e.g. annually'})}${textareaField({name:'notes',label:'Notes',value:item.notes||''})}`;
  const body=`<h1>${edit?'Edit item':'Add item'}</h1><div class="sub">Store the obligation or event here. Tasks stay separate.</div>${error?`<div class="error">${esc(error)}</div>`:''}<form class="editor" method="post" action="${action}">${fields}${reminderControls}<div class="actions"><button class="button primary" type="submit">${edit?'Save changes':'Add item'}</button>${buttonLink({href:'/life-admin',text:'Cancel'})}</div></form>`;
  return renderShell({title:edit?'Edit Life Admin item':'Add Life Admin item',activeNav:'Life Admin',body});
}

function renderTaskFormPage({task={},lifeItems=[],people=[],trips=[],mode='create',error=null}={}){
  const edit=mode==='edit';const action=edit?`/tasks/${encodeURIComponent(task.id)}`:'/tasks';
  const fields=`${textField({name:'title',label:'Title',value:task.title||'',maxlength:240,required:true})}<div class="grid2">${selectField({name:'status',label:'Status',value:task.status||'open',options:optionPairs(['open','in_progress','waiting','completed','ignored'])})}${selectField({name:'priority',label:'Priority',value:task.priority||'normal',options:optionPairs(['low','normal','high','urgent'])})}${dateField({name:'due_at',label:'Due date',value:inputDate(task.due_at)})}${selectField({name:'linked_life_item_id',label:'Life Admin item',value:task.linked_life_item_id||'',options:lifeOptions(lifeItems)})}${selectField({name:'linked_person_id',label:'Person',value:task.linked_person_id||'',options:peopleOptions(people)})}${selectField({name:'linked_trip_id',label:'Trip',value:task.linked_trip_id||'',options:tripOptions(trips)})}</div>${textareaField({name:'notes',label:'Notes',value:task.notes||''})}`;
  const body=`<h1>${edit?'Edit task':'Add task'}</h1><div class="sub">Tasks are actions. Link them to Life Admin, a person, or a trip when useful.</div>${error?`<div class="error">${esc(error)}</div>`:''}<form class="editor" method="post" action="${action}">${fields}<div class="actions"><button class="button primary" type="submit">${edit?'Save changes':'Add task'}</button>${buttonLink({href:'/life-admin',text:'Cancel'})}</div></form>`;
  return renderShell({title:edit?'Edit task':'Add task',activeNav:'Life Admin',body});
}

module.exports={renderLifeAdminPage,renderLifeItemPage,renderLifeItemFormPage,renderTaskFormPage};
