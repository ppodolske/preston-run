const {getAuthorizedOwner}=require('../auth/guard');
const {readForm,isSameOriginRequest}=require('../http/forms');
const {html,redirect,text}=require('../http/respond');
const {DEFAULT_REMINDER_OFFSETS,validateReminderSettings}=require('../domain/reminders');
const {getReminderSettings,upsertReminderSettings,listPushSubscriptions,upsertPushSubscription,setPushSubscriptionActive,listNotificationHistory,cancelFutureInheritedOccurrences,acknowledgeReminder,snoozeReminder}=require('../data/reminders');
const {renderNotificationsPage}=require('../pages/notifications');

async function owner(supabase,config,res){const auth=await getAuthorizedOwner(supabase,config);if(auth.user)return auth.user;if(auth.reason==='not_owner')await supabase.auth.signOut();redirect(res,'/');return null;}
function privateHtml(res,status,body){html(res,status,body,{'cache-control':'private, no-store'});}
function defaults(){return{timezone:'Australia/Sydney',morning_summary_time:'07:05:00',quiet_hours_start:'22:00:00',quiet_hours_end:'07:00:00',birthday_offsets:[...DEFAULT_REMINDER_OFFSETS.birthday],renewal_offsets:[...DEFAULT_REMINDER_OFFSETS.renewal],deadline_offsets:[...DEFAULT_REMINDER_OFFSETS.deadline],appointment_offsets:[...DEFAULT_REMINDER_OFFSETS.appointment],trip_offsets:[...DEFAULT_REMINDER_OFFSETS.trip],noon_urgent_check:true,evening_urgent_check:true};}
function parseOffsets(form,name){const values=typeof form.getAll==='function'?form.getAll(name):[];const raw=values.length>1?values:[form.get(name)];return raw.flatMap(value=>String(value||'').split(',')).map(v=>v.trim()).filter(Boolean).map(Number);}
function normalizeClock(value,fallback){const clock=String(value||fallback||'').trim();if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))throw new Error('Invalid quiet hours time');return `${clock}:00`;}
function settingsFromForm(form){const base=defaults();return validateReminderSettings({...base,quiet_hours_start:normalizeClock(form.get('quiet_hours_start'),base.quiet_hours_start.slice(0,5)),quiet_hours_end:normalizeClock(form.get('quiet_hours_end'),base.quiet_hours_end.slice(0,5)),birthday_offsets:parseOffsets(form,'birthday_offsets'),renewal_offsets:parseOffsets(form,'renewal_offsets'),deadline_offsets:parseOffsets(form,'deadline_offsets'),appointment_offsets:parseOffsets(form,'appointment_offsets'),trip_offsets:parseOffsets(form,'trip_offsets')});}

function readJson(req,{maxBytes=65536}={}){return new Promise((resolve,reject)=>{const type=String(req.headers&&req.headers['content-type']||'').split(';')[0].trim().toLowerCase();if(type!=='application/json'){const e=new Error('Unsupported JSON content type');e.statusCode=415;return reject(e);}let size=0,done=false;const chunks=[];const fail=e=>{if(done)return;done=true;reject(e);};req.on('data',chunk=>{if(done)return;size+=chunk.length;if(size>maxBytes){const e=new Error('JSON body too large');e.statusCode=413;return fail(e);}chunks.push(chunk);});req.on('error',fail);req.on('end',()=>{if(done)return;done=true;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{const e=new Error('Malformed JSON body');e.statusCode=400;reject(e);}});});}

function addSydneyDaysAt0705(days){const now=new Date();const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const m={};for(const p of parts)if(p.type!=='literal')m[p.type]=Number(p.value);const base=new Date(Date.UTC(m.year,m.month-1,m.day+days,7,5));for(let i=0;i<4;i++){const local=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(base);const q={};for(const p of local)if(p.type!=='literal')q[p.type]=Number(p.value);const wanted=Date.UTC(m.year,m.month-1,m.day+days,7,5);const got=Date.UTC(q.year,q.month-1,q.day,q.hour,q.minute);base.setTime(base.getTime()+(wanted-got));}return base.toISOString();}

function isNotificationPath(path){return path==='/notifications'||path==='/notifications/settings'||path==='/notifications/subscriptions'||/^\/notifications\/subscriptions\/[^/]+\/toggle$/.test(path)||/^\/notifications\/reminders\/[^/]+\/(acknowledge|snooze)$/.test(path);}

async function handleNotificationsRoute(req,res,context){
 const{supabase,config}=context;let url;try{url=new URL(req.url,config.siteUrl);}catch{return false;}if(!isNotificationPath(url.pathname))return false;
 const user=await owner(supabase,config,res);if(!user)return true;
 if(req.method==='GET'&&url.pathname==='/notifications'){
   try{const[stored,subscriptions,history]=await Promise.all([getReminderSettings(supabase,user.id),listPushSubscriptions(supabase,user.id),listNotificationHistory(supabase,user.id)]);const flash=url.searchParams.get('saved')?'Settings saved.':null;privateHtml(res,200,renderNotificationsPage({settings:{...defaults(),...(stored||{})},subscriptions,history,vapidPublicKey:config.vapidPublicKey,flash}));}
   catch{privateHtml(res,500,renderNotificationsPage({settings:defaults(),subscriptions:[],history:[],vapidPublicKey:config.vapidPublicKey,flash:'Notification settings are temporarily unavailable.'}));}
   return true;
 }
 if(req.method!=='POST'){text(res,405,'Method not allowed',{'cache-control':'no-store'});return true;}
 if(!isSameOriginRequest(req,config)){text(res,403,'Forbidden',{'cache-control':'no-store'});return true;}
 if(url.pathname==='/notifications/settings'){
   let form,input;try{form=await readForm(req);input=settingsFromForm(form);}catch(e){text(res,e.statusCode||400,e.message||'Invalid settings',{'cache-control':'no-store'});return true;}
   try{await upsertReminderSettings(supabase,user.id,input);await cancelFutureInheritedOccurrences(supabase,user.id,new Date().toISOString());redirect(res,'/notifications?saved=1');}catch{text(res,500,'Unable to save notification settings',{'cache-control':'no-store'});}return true;
 }
 if(url.pathname==='/notifications/subscriptions'){
   let body;try{body=await readJson(req);}catch(e){text(res,e.statusCode||400,'Invalid subscription request',{'cache-control':'no-store'});return true;}
   const endpoint=String(body.endpoint||''),p256dh=String(body.p256dh||(body.keys&&body.keys.p256dh)||''),authSecret=String(body.auth_secret||(body.keys&&body.keys.auth)||'');
   if(!endpoint||!p256dh||!authSecret){text(res,400,'Invalid push subscription',{'cache-control':'no-store'});return true;}
   try{await upsertPushSubscription(supabase,user.id,{endpoint,p256dh,auth_secret:authSecret,device_label:String(body.device_label||'This device').slice(0,80)});text(res,201,'Created',{'cache-control':'no-store'});}catch{text(res,500,'Unable to save push subscription',{'cache-control':'no-store'});}return true;
 }
 const toggle=url.pathname.match(/^\/notifications\/subscriptions\/([^/]+)\/toggle$/);if(toggle){let form;try{form=await readForm(req);}catch(e){text(res,e.statusCode||400,'Invalid request',{'cache-control':'no-store'});return true;}try{const row=await setPushSubscriptionActive(supabase,user.id,decodeURIComponent(toggle[1]),form.get('active')==='true');if(!row){text(res,404,'Not found',{'cache-control':'no-store'});return true;}redirect(res,'/notifications');}catch{text(res,500,'Unable to update device',{'cache-control':'no-store'});}return true;}
 const ack=url.pathname.match(/^\/notifications\/reminders\/([^/]+)\/acknowledge$/);if(ack){try{await readForm(req);const row=await acknowledgeReminder(supabase,user.id,decodeURIComponent(ack[1]));if(!row){text(res,404,'Not found',{'cache-control':'no-store'});return true;}redirect(res,'/notifications');}catch(e){text(res,e.statusCode||500,'Unable to acknowledge reminder',{'cache-control':'no-store'});}return true;}
 const snooze=url.pathname.match(/^\/notifications\/reminders\/([^/]+)\/snooze$/);if(snooze){let form;try{form=await readForm(req);}catch(e){text(res,e.statusCode||400,'Invalid request',{'cache-control':'no-store'});return true;}let until;const choice=form.get('snooze');if(choice==='tomorrow')until=addSydneyDaysAt0705(1);else if(choice==='3days')until=addSydneyDaysAt0705(3);else if(choice==='1week')until=addSydneyDaysAt0705(7);else if(choice==='custom'&&/^\d{4}-\d{2}-\d{2}$/.test(form.get('custom_date')||'')){const [y,m,d]=form.get('custom_date').split('-').map(Number);until=new Date(Date.UTC(y,m-1,d,7,5)).toISOString();}else{text(res,400,'Invalid snooze option',{'cache-control':'no-store'});return true;}try{const row=await snoozeReminder(supabase,user.id,decodeURIComponent(snooze[1]),until);if(!row){text(res,404,'Not found',{'cache-control':'no-store'});return true;}redirect(res,'/notifications');}catch{text(res,500,'Unable to snooze reminder',{'cache-control':'no-store'});}return true;}
 text(res,404,'Not found',{'cache-control':'no-store'});return true;
}

module.exports={handleNotificationsRoute,settingsFromForm,readJson};
