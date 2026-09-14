'use strict';

const { PRODUCT_NAME, VERSION, APPS, ADMIN } = require('../branding');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function label(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short' }).format(new Date(value));
  } catch { return ''; }
}

function fmtTime(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  } catch { return ''; }
}

function fmtFresh(value) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute:'2-digit' }).format(new Date(value));
  } catch { return null; }
}

function cap(items, n = 5) {
  return Array.isArray(items) ? items.slice(0, n) : [];
}

function empty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

function birthdayHtml(items, unavailable) {
  if (unavailable) return empty('Birthday data is temporarily unavailable.');
  if (!items.length) return empty('No birthdays in the next 90 days.');
  return cap(items).map(x => `<a class="row" href="/people"><div><strong>${escapeHtml(x.person.name)}</strong><span>${x.ageTurning == null ? 'Birthday' : `Turning ${x.ageTurning}`}</span></div><b>${x.daysAway === 0 ? 'Today' : x.daysAway === 1 ? 'Tomorrow' : `${x.daysAway} days`}</b></a>`).join('');
}

function lifeHtml(items, unavailable) {
  if (unavailable) return empty('Life Admin data is temporarily unavailable.');
  if (!items.length) return empty('No Life Admin items coming up.');
  return cap(items).map(x => `<a class="row" href="/life-admin/${encodeURIComponent(x.item.id)}"><div><strong>${escapeHtml(x.item.title)}</strong><span>${escapeHtml(label(x.item.category))}</span></div><b>${escapeHtml(fmtDate(x.date))}</b></a>`).join('');
}

function tripHtml(items, unavailable) {
  if (unavailable) return empty('Trip data is temporarily unavailable.');
  if (!items.length) return empty('No trips in the next 180 days.');
  return cap(items).map(x => `<a class="row" href="/trips/${encodeURIComponent(x.id)}"><div><strong>${escapeHtml(x.title)}</strong><span>${escapeHtml(label(x.status))}</span></div><b>${escapeHtml(fmtDate(x.start_date))}</b></a>`).join('');
}

function travelContext(item={}) {
  const record=item.record||{};
  const kind=item.type==='event'?'Event':label(record.booking_type||item.type||'Travel');
  return [kind,item.status?label(item.status):null].filter(Boolean).join(' · ');
}

function travelTripHtml(items, unavailable, fallbackTrips=[]) {
  if (unavailable) return empty('Trip travel data is temporarily unavailable.');
  if (!items.length) return fallbackTrips.length ? tripHtml(fallbackTrips,false) : empty('No trips in the next 180 days.');
  return cap(items).map(view=>{
    const trip=view.trip||{},inventory=Array.isArray(view.inventory)?view.inventory.filter(Boolean):[],children=Array.isArray(view.items)?view.items:[];
    const dates=[fmtDate(trip.start_date),fmtDate(trip.end_date)].filter(Boolean).join(' – ');
    const meta=[dates,inventory.join(' · ')].filter(Boolean).join(' · ');
    const rows=children.length?children.map(item=>`<div class="travel-item"><span class="travel-context">${escapeHtml(travelContext(item))}</span><strong>${escapeHtml(item.title||'Travel item')}</strong>${Array.isArray(item.tokens)&&item.tokens.length?`<small>${escapeHtml(item.tokens.filter(Boolean).join(' · '))}</small>`:''}</div>`).join(''):empty('No linked travel details yet.');
    return `<article class="travel-trip" data-travel-trip="${escapeHtml(trip.id||'')}"><a class="travel-trip-head" href="/trips/${encodeURIComponent(trip.id||'')}"><strong>${escapeHtml(trip.title||'Trip')}</strong>${meta?`<span>${escapeHtml(meta)}</span>`:''}</a><div class="travel-items">${rows}</div></article>`;
  }).join('');
}

function attentionHtml(items, unavailable, kind) {
  if (unavailable) return empty('Life Admin data is temporarily unavailable.');
  if (!items.length) return empty(kind === 'overdue' ? 'Nothing overdue.' : 'Nothing due today.');
  return cap(items, 6).map(x => {
    const href = x.type === 'task' ? `/tasks/${encodeURIComponent(x.record.id)}/edit` : `/life-admin/${encodeURIComponent(x.record.id)}`;
    return `<a class="row attention" href="${href}"><div><strong>${escapeHtml(x.record.title)}</strong><span>${x.type === 'task' ? 'Task' : escapeHtml(label(x.record.category))}</span></div><b>${escapeHtml(label(x.record.priority))}</b></a>`;
  }).join('');
}

function calendarEventHtml(event) {
  const when = event.allDay ? 'All day' : fmtTime(event.startsAt);
  const day = event.day === 'tomorrow' ? 'Tomorrow' : 'Today';
  return `<div class="cal-event"><span class="cal-when">${day}${when ? ` · ${escapeHtml(when)}` : ''}</span><strong>${escapeHtml(event.title)}</strong>${event.location ? `<small>${escapeHtml(event.location)}</small>` : ''}</div>`;
}

function workoutHtml(workout) {
  const day = workout.day === 'tomorrow' ? 'Tomorrow' : 'Today';
  const meta = [];
  if (workout.sport) meta.push(label(workout.sport));
  if (Number.isFinite(Number(workout.durationMinutes))) meta.push(`${Number(workout.durationMinutes)} min`);
  if (Number.isFinite(Number(workout.distanceKm))) meta.push(`${Number(workout.distanceKm)} km`);
  const state = workout.completed ? 'Completed' : 'Planned';
  return `<div class="cal-event workout${workout.completed ? ' completed' : ''}"><span class="cal-when">${day} · ${escapeHtml(state)}</span><strong>${escapeHtml(workout.title)}</strong>${meta.length ? `<small>${escapeHtml(meta.join(' · '))}</small>` : ''}</div>`;
}

function calendarGroup(title, items, renderer = calendarEventHtml) {
  return `<section class="cal-group"><h3>${escapeHtml(title)}</h3>${items.length ? cap(items, 6).map(renderer).join('') : empty(`No ${title.toLowerCase()} items.`)}</section>`;
}

function calendarDayHtml(calendar, day, calendarUnavailable, fitnessUnavailable) {
  const filter = items => (Array.isArray(items) ? items : []).filter(item => item.day === day);
  const provider = calendarUnavailable
    ? empty('Calendar data is temporarily unavailable.')
    : `${calendarGroup('Personal', filter(calendar.personal))}${calendarGroup('Holidays', filter(calendar.holidays))}${calendarGroup('Reminders', filter(calendar.reminders))}`;
  const workouts = fitnessUnavailable
    ? `<section class="cal-group"><h3>Planned Workouts</h3>${empty('Planned workout data is temporarily unavailable.')}</section>`
    : calendarGroup('Planned Workouts', filter(calendar.plannedWorkouts), workoutHtml);
  return `${provider}${workouts}`;
}

function digestCardHtml(card) {
  const items = Array.isArray(card && card.items) ? card.items : [];
  return `<article class="digest-card digest-${escapeHtml(card && card.id || 'card')}"><h3>${escapeHtml(card && card.title || 'Digest')}</h3><div class="digest-items">${items.length ? items.map(item => `<div class="digest-item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join('') : empty('No details available.')}</div></article>`;
}

function digestInsightHtml(insight) {
  const x = insight && typeof insight === 'object' ? insight : { label: 'Digest note', value: String(insight || '') };
  const state = x.state ? ` state-${String(x.state).replace(/[^a-z0-9_-]/gi, '').toLowerCase()}` : '';
  return `<article class="digest-insight${state}"><span class="digest-insight-label">${escapeHtml(x.label || 'Digest note')}</span><strong class="digest-insight-value">${escapeHtml(x.value || '')}</strong>${x.detail ? `<p class="digest-insight-detail">${escapeHtml(x.detail)}</p>` : ''}</article>`;
}

function morningDigestHtml(digest, fitnessContext, unavailable) {
  const freshness = fmtFresh(fitnessContext && fitnessContext.fetched_at);
  const refresh = '<form method="post" action="/fitness-context/refresh"><button class="button digest-refresh" type="submit">Refresh digest</button></form>';
  if (unavailable) return `<section class="morning-digest"><div class="digest-top"><div><span class="eyebrow">Morning Digest</span><h2>Morning Digest is temporarily unavailable.</h2><p>preston.ai will keep using the last available calendar and life-admin data.</p></div>${refresh}</div></section>`;
  if (!digest) return `<section class="morning-digest"><div class="digest-top"><div><span class="eyebrow">Morning Digest</span><h2>No digest has been generated for today yet.</h2>${freshness ? `<p>Fitness context last refreshed ${escapeHtml(freshness)}.</p>` : ''}</div>${refresh}</div></section>`;
  const generated = fmtFresh(digest.generated_at || digest.generatedAt);
  const garmin = fmtFresh(digest.garmin_sync_at || digest.garminSyncAt);
  const meta = [generated ? `Generated ${generated}` : null, garmin ? `Garmin ${garmin}` : null, freshness ? `Fitness cache ${freshness}` : null].filter(Boolean).join(' · ');
  const cards = Array.isArray(digest.cards) ? digest.cards : [];
  const insights = Array.isArray(digest.insights) ? digest.insights : [];
  const bullets = Array.isArray(digest.bullets) ? digest.bullets : [];
  const displayInsights = insights.length ? insights : bullets.map(text => ({ label: 'Digest note', value: String(text) }));
  return `<section class="morning-digest"><div class="digest-top"><div><div class="digest-title-line"><span class="eyebrow">Morning Digest</span><span class="digest-status ${escapeHtml(digest.status || 'insufficient')}">${escapeHtml(label(digest.status || 'waiting'))}</span></div><h2>${escapeHtml(digest.headline || 'Your morning briefing')}</h2>${meta ? `<p>${escapeHtml(meta)}</p>` : ''}</div>${refresh}</div>${cards.length ? `<div class="digest-grid">${cards.map(digestCardHtml).join('')}</div>` : ''}${displayInsights.length ? `<div class="digest-insights">${displayInsights.map(digestInsightHtml).join('')}</div>` : ''}</section>`;
}

const HOME_CSS = `:root{--bg:#eef2f4;--ink:#122432;--muted:#667781;--card:#fff;--line:#d7e0e4;--blue:#075b8e;--green:#147a4b;--amber:#9b6414;--navy:#162a4c;--red:#a34721;--focus:#2f80ed}*{box-sizing:border-box}body{margin:0;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink)}a{color:inherit}button{font:inherit}:focus-visible{outline:3px solid var(--focus);outline-offset:2px}.skip-link{position:fixed;top:8px;left:8px;z-index:1000;transform:translateY(-160%);background:var(--navy);color:#fff;padding:10px 12px;border-radius:9px;font-size:13px;font-weight:800;text-decoration:none}.skip-link:focus{transform:translateY(0)}main{max-width:1320px;margin:auto;padding:18px 18px 38px}.top{display:flex;justify-content:space-between;align-items:center;gap:18px}.logo{width:230px;max-width:55vw}.top-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.clock{text-align:right;margin-right:4px}.time{font-weight:800;font-size:22px}.date{font-size:11px;color:var(--muted)}.button{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:9px;padding:8px 10px;text-decoration:none;font-weight:750;font-size:12px;cursor:pointer}h1{font-size:34px;letter-spacing:-.035em;margin:20px 0 2px}.sub{color:var(--muted);font-size:13px;margin-bottom:14px}.morning-digest{width:100%;background:linear-gradient(135deg,#162a4c,#203e6c);color:#fff;border-radius:18px;padding:18px;margin-bottom:20px;box-shadow:0 8px 26px rgba(18,36,50,.08)}.digest-top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.digest-title-line{display:flex;align-items:center;gap:8px}.eyebrow{text-transform:uppercase;letter-spacing:.11em;font-size:10px;font-weight:850;color:#b9cce6}.morning-digest h2{font-size:22px;letter-spacing:-.02em;margin:5px 0}.morning-digest p{margin:4px 0;color:#d5e0ef;font-size:11px;line-height:1.45}.digest-status{font-size:9px;font-weight:850;text-transform:uppercase;border:1px solid currentColor;border-radius:999px;padding:3px 7px}.digest-status.good{color:#a9edca}.digest-status.watch{color:#f1cf8c}.digest-status.poor{color:#ffb29b}.digest-status.insufficient{color:#c6d0db}.digest-refresh{background:#fff;color:var(--navy);border-color:#fff;white-space:nowrap}.digest-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:14px}.digest-card{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);border-radius:13px;padding:11px;min-width:0}.digest-card h3{font-size:18px;font-weight:800;line-height:1.15;letter-spacing:-.01em;margin:0 0 10px}.digest-items{display:grid;gap:6px}.digest-item{display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.1);padding-top:6px}.digest-item:first-child{border-top:0;padding-top:0}.digest-item span{font-size:9px;color:#cbd9e9}.digest-item strong{font-size:10px;text-align:right}.digest-insights{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:10px}.digest-insight{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);border-radius:6px;padding:11px 12px;min-width:0}.digest-insight-label{display:block;font-size:9px;font-weight:750;line-height:1.3;text-transform:uppercase;letter-spacing:.08em;color:#cbd9e9}.digest-insight-value{display:block;font-size:20px;font-weight:750;line-height:1.15;letter-spacing:-.01em;color:#fff;margin-top:4px}.digest-insight-detail{margin:5px 0 0!important;font-size:10px!important;line-height:1.4!important;color:#cbd9e9!important}.home-section{margin:0 0 22px}.home-section-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin:0 0 9px}.home-section-head h2{font-size:23px;letter-spacing:-.025em;margin:0}.home-section-head p{font-size:11px;color:var(--muted);margin:0}.section-grid{display:grid;gap:12px;align-items:start}.now-grid{grid-template-columns:minmax(0,34fr) minmax(0,33fr) minmax(0,33fr)}.coming-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.system-grid{display:grid;grid-template-columns:minmax(250px,.8fr) minmax(0,2.2fr);gap:12px;align-items:start}.card{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:13px;min-width:0}.card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:5px}.card-head h2{font-size:16px;margin:0}.card-head a,.card-head span{font-size:11px;font-weight:800;color:var(--blue);text-decoration:none}.weather{background:linear-gradient(135deg,#fff,#e8f4fa);border-top:5px solid var(--blue);padding:15px}.weather-main{display:flex;justify-content:space-between;align-items:end;gap:14px}.temp{font-size:48px;font-weight:850}.condition{color:var(--muted);font-size:13px}.weather-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:11px}.stat{border:1px solid var(--line);background:#fff;border-radius:9px;padding:8px}.stat span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:800}.stat strong{font-size:12px}.row{display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid #edf1f3;padding:9px 0;text-decoration:none}.row:first-of-type{border-top:0}.row strong{display:block;font-size:13px}.row span{display:block;font-size:10px;color:var(--muted);margin-top:1px}.row b{font-size:10px;color:var(--blue);white-space:nowrap}.attention b{color:var(--red)}.travel-trip{border-top:1px solid #edf1f3;padding:10px 0}.travel-trip:first-of-type{border-top:0}.travel-trip-head{display:block;text-decoration:none}.travel-trip-head strong{display:block;font-size:13px}.travel-trip-head span{display:block;font-size:10px;color:var(--muted);margin-top:2px}.travel-items{margin-top:6px}.travel-item{border-left:3px solid var(--blue);padding:6px 0 6px 8px;margin:4px 0}.travel-item strong,.travel-item small,.travel-context{display:block}.travel-item strong{font-size:12px}.travel-item small,.travel-context{font-size:9px;color:var(--muted);line-height:1.35}.travel-context{font-weight:800;text-transform:uppercase;letter-spacing:.05em}.empty{padding:9px 0;color:var(--muted);font-size:11px}.morning-digest .empty{color:#d5e0ef}.calendar-card{padding:0;overflow:hidden}.calendar-link{display:block;text-decoration:none;padding:13px 13px 8px}.calendar-link:hover{background:#fafcfd}.calendar-body{padding:0 13px 13px}.cal-group{border-top:1px solid #edf1f3;padding-top:9px;margin-top:5px}.cal-group h3{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 5px}.cal-event{padding:7px 0;border-top:1px solid #f1f4f5}.cal-event:first-of-type{border-top:0}.cal-event strong,.cal-event small,.cal-when{display:block}.cal-event strong{font-size:13px}.cal-event small,.cal-when{font-size:10px;color:var(--muted)}.cal-event.workout{border-left:3px solid var(--green);padding-left:8px;margin:3px 0}.cal-event.workout.completed strong{text-decoration:line-through;text-decoration-thickness:1px;color:#53656f}.attention-stack{display:grid;gap:12px}.apps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.app-launcher{text-decoration:none;text-align:center;min-width:0}.app-icon-wrap{position:relative;width:58px;height:58px;margin:0 auto 5px}.app-icon{width:58px;height:58px;border-radius:14px;object-fit:cover;background:#e7ecef;border:1px solid var(--line)}.app-launcher strong{font-size:10px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.status{font-size:9px;color:var(--muted)}.status-dot{position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border:2px solid #fff;border-radius:50%;background:#9aa7ae}.status-dot.online{background:var(--green)}.status-dot.issue{background:var(--amber)}.admin-section{background:var(--navy);color:#fff;border-radius:16px;padding:14px}.admin-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px}.admin-head h2{font-size:15px;margin:0}.admin-head span{font-size:9px;color:#aebfd5}.admin-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.admin-card{background:#203b63;border:1px solid #36577f;border-radius:11px;padding:10px;min-width:0}.admin-card strong,.admin-card span{display:block}.admin-card strong{font-size:11px}.admin-card span{font-size:9px;color:#b9c9dd;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.admin-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}.admin-actions a{color:#e7eff9;text-decoration:none;border:1px solid #567396;border-radius:6px;padding:4px 6px;font-size:9px;font-weight:750}.foot{text-align:center;color:#84929a;font-size:9px;margin-top:18px}@media(max-width:950px){.digest-grid,.digest-insights{grid-template-columns:1fr 1fr}.now-grid,.coming-grid{grid-template-columns:1fr 1fr}.system-grid{grid-template-columns:1fr}.weather-stats{grid-template-columns:1fr 1fr}.admin-grid{grid-template-columns:1fr 1fr}}@media(max-width:650px){main{padding:12px 10px 28px}.top{align-items:flex-start}.top-actions{justify-content:flex-end}.clock{display:none}h1{font-size:29px}.morning-digest{padding:14px}.digest-top{display:grid}.digest-grid,.digest-insights,.now-grid,.coming-grid,.system-grid{grid-template-columns:1fr}.card,.morning-digest,.admin-card{width:100%;min-width:0}.weather-stats{grid-template-columns:1fr 1fr}.admin-grid{grid-template-columns:1fr}.logo{width:190px}.button{padding:6px 8px;font-size:10px}.home-section-head{display:block}.home-section-head p{margin-top:3px}}`;

function renderHomePage({ user, upcomingBirthdays = [], birthdayDataUnavailable = false, upcomingLifeItems = [], overdueItems = [], todayItems = [], lifeAdminDataUnavailable = false, calendar = { personal: [], holidays: [], reminders: [], plannedWorkouts: [] }, calendarDataUnavailable = false, morningDigest = null, fitnessContext = null, fitnessUnavailable = false, upcomingTrips = [], tripDataUnavailable = false, travelTrips = [], travelDataUnavailable = false } = {}) {
  const firstName = String(user && (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name) || '')).trim().split(/\s+/)[0];
  const greetingName = firstName ? `, ${firstName}` : '';
  const apps = APPS.map(a => `<a class="app-launcher" href="${a.url}"><div class="app-icon-wrap"><img class="app-icon" src="${a.icon}" alt="" onerror="this.onerror=null;this.src='/icons/icon-192.png'"><span class="status-dot" id="${a.key}Dot"></span></div><strong>${escapeHtml(a.name)}</strong><span class="status" id="${a.key}Status">Checking</span></a>`).join('');
  const admin = ADMIN.map(x => `<article class="admin-card"><div><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.domain)}</span></div><div class="admin-actions"><a href="${x.site}">Site</a><a href="${x.repo}" target="_blank" rel="noopener">GitHub</a><a href="${x.railway}" target="_blank" rel="noopener">Railway</a></div></article>`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#162a4c"><meta name="robots" content="noindex,nofollow"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icons/favicon-32.png"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><title>${PRODUCT_NAME}</title><style>${HOME_CSS}</style></head><body><a class="skip-link" href="#main-content">Skip to content</a><main id="main-content"><header class="top"><img class="logo" src="/assets/preston-ai-logo.png" alt="preston.ai"><div class="top-actions"><div class="clock"><div class="time" id="time">--:--</div><div class="date" id="date">Loading…</div></div><a class="button" href="/notifications">Notifications</a><a class="button" href="/settings/calendars">Calendars</a><a class="button" href="/me/settings/gmail">Gmail</a><form method="post" action="/auth/logout"><button class="button" type="submit">Log out</button></form></div></header><h1 id="greeting">Good morning${greetingName}.</h1><div class="sub">Your day, at a glance.</div>${morningDigestHtml(morningDigest, fitnessContext, fitnessUnavailable)}
<section class="home-section now-section" data-home-section="now"><div class="home-section-head"><h2>Now</h2><p>What needs attention today.</p></div><div class="section-grid now-grid"><section class="card weather"><div class="card-head"><h2>Weather</h2><span>Sydney</span></div><div class="weather-main"><div><div class="temp" id="temp">--°</div><div class="condition" id="condition">Fetching forecast</div></div><strong id="weatherTitle">Loading…</strong></div><div class="weather-stats"><div class="stat"><span>Feels like</span><strong id="feels">--°</strong></div><div class="stat"><span>Rain chance</span><strong id="rain">--%</strong></div><div class="stat"><span>High / Low</span><strong id="range">--° / --°</strong></div><div class="stat"><span>Wind</span><strong id="wind">-- km/h</strong></div></div></section><section class="card calendar-card"><a class="calendar-link" href="/calendar"><div class="card-head"><h2>Calendar</h2><span>View calendar →</span></div></a><div class="calendar-body">${calendarDayHtml(calendar, 'today', calendarDataUnavailable, fitnessUnavailable)}</div></section><div class="attention-stack"><section class="card overdue-card"><div class="card-head"><h2>Overdue</h2><a href="/life-admin">Review all →</a></div>${attentionHtml(overdueItems, lifeAdminDataUnavailable, 'overdue')}</section><section class="card today-card"><div class="card-head"><h2>Today</h2><a href="/life-admin">Review all →</a></div>${attentionHtml(todayItems, lifeAdminDataUnavailable, 'today')}</section></div></div></section>
<section class="home-section coming-section" data-home-section="coming-up"><div class="home-section-head"><h2>Coming Up</h2><p>Tomorrow and the next things on your radar.</p></div><div class="section-grid coming-grid"><section class="card calendar-card"><a class="calendar-link" href="/calendar"><div class="card-head"><h2>Tomorrow</h2><span>View calendar →</span></div></a><div class="calendar-body">${calendarDayHtml(calendar, 'tomorrow', calendarDataUnavailable, fitnessUnavailable)}</div></section><section class="card birthday-card"><div class="card-head"><h2>Birthdays</h2><a href="/people">View all →</a></div>${birthdayHtml(upcomingBirthdays, birthdayDataUnavailable)}</section><section class="card trip-card"><div class="card-head"><h2>Trips</h2><a href="/trips">View all →</a></div>${travelTripHtml(travelTrips,travelDataUnavailable||tripDataUnavailable,upcomingTrips)}</section><section class="card life-card"><div class="card-head"><h2>Life Admin</h2><a href="/life-admin">View all →</a></div>${lifeHtml(upcomingLifeItems, lifeAdminDataUnavailable)}</section></div></section>
<section class="home-section system-section" data-home-section="apps-system"><div class="home-section-head"><h2>Apps &amp; System</h2><p>Launchers, service health and administration.</p></div><div class="system-grid"><section class="card apps-card"><div class="card-head"><h2>Apps</h2></div><div class="apps-grid">${apps}</div></section><section class="admin-section"><div class="admin-head"><h2>Website admin</h2><span>Site · source · deployment</span></div><div class="admin-grid">${admin}</div></section></div></section><div class="foot">${PRODUCT_NAME} · v${VERSION}</div></main><script>const code={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',80:'Rain showers',81:'Rain showers',82:'Heavy showers',95:'Thunderstorms',96:'Thunderstorms',99:'Thunderstorms'};function tick(){const d=new Date(),h=d.getHours(),name=${JSON.stringify(firstName)};document.getElementById('greeting').textContent=(h<12?'Good morning':h<18?'Good afternoon':'Good evening')+(name?', '+name:'')+'.';document.getElementById('time').textContent=d.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'});document.getElementById('date').textContent=d.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}tick();setInterval(tick,30000);async function weather(){try{const u='https://api.open-meteo.com/v1/forecast?latitude=-33.8688&longitude=151.2093&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Australia%2FSydney&forecast_days=1';const r=await fetch(u);if(!r.ok)throw 0;const x=await r.json(),c=x.current,d=x.daily,desc=code[c.weather_code]||'Current conditions';document.getElementById('weatherTitle').textContent=desc;document.getElementById('temp').textContent=Math.round(c.temperature_2m)+'°';document.getElementById('condition').textContent='Sydney · updated '+new Date().toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'});document.getElementById('feels').textContent=Math.round(c.apparent_temperature)+'°';document.getElementById('rain').textContent=Math.round(d.precipitation_probability_max[0]||0)+'%';document.getElementById('range').textContent=Math.round(d.temperature_2m_max[0])+'° / '+Math.round(d.temperature_2m_min[0])+'°';document.getElementById('wind').textContent=Math.round(c.wind_speed_10m)+' km/h';}catch{document.getElementById('weatherTitle').textContent='Weather unavailable';document.getElementById('condition').textContent='Forecast could not be loaded';}}function setStatus(key,online){const el=document.getElementById(key+'Status'),dot=document.getElementById(key+'Dot');if(el)el.textContent=online?'Online':'Unavailable';if(dot)dot.className='status-dot '+(online?'online':'issue');}async function statuses(){try{const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw 0;const x=await r.json();setStatus('dose',!!x.dose?.online);setStatus('parks',!!x.parks?.online);setStatus('archive',!!x.archive?.online);}catch{setStatus('dose',false);setStatus('parks',false);setStatus('archive',false);}}weather();statuses();setInterval(statuses,120000);</script></body></html>`;
}

module.exports = { renderHomePage };
