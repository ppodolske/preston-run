'use strict';

const {renderShell,escapeHtml:esc}=require('../ui/shell');
const {buttonLink,flashMessage}=require('../ui/components');

function fmt(value){if(!value)return'Never';try{return new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return'Unknown';}}
function connectionFor(connections,provider){return connections.find(x=>x.provider===provider)||null;}
function sourceRows(connection,sources){
  if(!connection)return'';
  const rows=sources.filter(x=>x.connection_id===connection.id);
  if(!rows.length)return'<p class="muted">No calendars discovered yet.</p>';
  return `<div class="sources">${rows.map(row=>`<form class="source" method="post" action="/settings/calendars/sources/${encodeURIComponent(row.id)}/toggle"><div><strong>${esc(row.display_name)}</strong><span>${row.read_only?'Read only':'Calendar'}</span></div><input type="hidden" name="selected" value="${row.selected?'false':'true'}"><button class="button source-toggle" type="submit">${row.selected?'Included':'Excluded'}</button></form>`).join('')}</div>`;
}
function providerCard(provider,title,connection,sources){
  if(!connection){
    if(provider==='google')return `<section class="card calendar-provider"><h2>${title}</h2><p class="muted">Connect one personal Google Calendar account. Calendar access is separate from preston.ai sign-in and is read only.</p>${buttonLink({href:'/settings/calendars/google/connect',text:'Connect Google Calendar',primary:true})}</section>`;
    return `<section class="card calendar-provider"><h2>${title}</h2><p class="muted">Use an Apple app-specific password. preston.ai never needs your normal Apple Account password.</p><form class="calendar-connect-form" method="post" action="/settings/calendars/apple/connect"><div class="field"><label for="apple-email">Apple ID email</label><input id="apple-email" name="email" type="email" autocomplete="username" required></div><div class="field"><label for="apple-app-specific-password">App-specific password</label><input id="apple-app-specific-password" name="app_specific_password" type="password" autocomplete="current-password" required></div><button class="button primary" type="submit">Connect Apple Calendar</button></form></section>`;
  }
  const disconnect=provider==='google'?'Disconnect Google':'Disconnect Apple';
  const guidance=provider==='apple'?'<p class="muted">This connection uses an Apple app-specific password; your normal Apple Account password is never stored.</p>':'';
  return `<section class="card calendar-provider"><div class="card-head"><div><h2>${title}</h2><p class="account">${esc(connection.account_label||'Connected')}</p></div><span class="chip ${connection.status==='connected'?'chip-completed':'chip-urgent'}">${esc(connection.status||'connected')}</span></div>${guidance}<p class="muted">Last successful sync: ${esc(fmt(connection.last_success_at))}</p>${connection.last_error?`<p class="error">${esc(connection.last_error)}</p>`:''}${sourceRows(connection,sources)}<form method="post" action="/settings/calendars/${provider}/disconnect"><button class="button danger" type="submit">${disconnect}</button></form></section>`;
}

function renderCalendarsPage({connections=[],sources=[],flash=null}={}){
  const google=connectionFor(connections,'google'),apple=connectionFor(connections,'apple');
  const body=`<div class="page-heading"><h1>Calendars</h1><p class="sub">Choose exactly which personal calendars preston.ai may use in the morning summary. New calendars are excluded by default.</p></div>${flash?flashMessage(flash):''}<div class="actions calendar-settings-actions"><form method="post" action="/settings/calendars/sync"><button class="button primary" type="submit">Sync calendars</button></form></div>${providerCard('google','Google Calendar',google,sources)}${providerCard('apple','Apple / iCloud Calendar',apple,sources)}`;
  return renderShell({title:'Calendars',activeNav:'Calendar',body});
}

module.exports={renderCalendarsPage};
