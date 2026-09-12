const http=require('http');

const PORT=process.env.PORT||3000;
const VERSION='0.4.0';
const APPS=[
  {key:'dose',name:'Dose & Scale',url:'https://dose.preston.run'},
  {key:'parks',name:'State Parks',url:'https://parks.preston.run'},
  {key:'archive',name:'Archive',url:'https://archive.preston.run'}
];

const ADMIN=[
  {name:'Preston.run',domain:'preston.run',site:'https://preston.run',repo:'https://github.com/ppodolske/preston-run',railway:'https://railway.com/project/52e3a022-86d8-4191-bf3b-e4250d484055'},
  {name:'Dose & Scale',domain:'dose.preston.run',site:'https://dose.preston.run',repo:'https://github.com/ppodolske/dose-and-scale',railway:'https://railway.com/project/8981e7da-5867-484f-b951-39c4a1a60033'},
  {name:'MN & WI State Parks',domain:'parks.preston.run',site:'https://parks.preston.run',repo:'https://github.com/ppodolske/mnwistateparks',railway:'https://railway.com/project/9dfb8103-1ab5-43c1-a90e-5fb5c274889e'},
  {name:'Archive',domain:'archive.preston.run',site:'https://archive.preston.run',repo:'https://github.com/ppodolske/archive',railway:'https://railway.com/project/2bc0b4e2-ca87-4b74-94ff-828b9160444a'}
];

const favicon=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#0e2233"/><path d="M18 48V16h17c9 0 15 5 15 13s-6 13-15 13h-8v6H18zm9-14h8c4 0 7-2 7-5s-3-5-7-5h-8v10z" fill="#fff"/></svg>`;

const html=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0e2233">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<title>Preston.run</title>
<style>
:root{--bg:#eef2f4;--ink:#122432;--muted:#667781;--card:#fff;--line:#d7e0e4;--blue:#075b8e;--blue2:#0c74ad;--soft:#eaf4f8;--green:#147a4b;--amber:#9b6414;--red:#a43a3a}*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink)}main{max-width:1080px;margin:auto;padding:26px 18px 48px}.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:18px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--blue)}h1{font-size:44px;letter-spacing:-.045em;line-height:1;margin:6px 0 8px}.sub{color:var(--muted);font-size:15px}.clock{text-align:right;white-space:nowrap}.time{font-size:27px;font-weight:800}.date{font-size:12px;color:var(--muted);margin-top:4px}.section-title{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:20px 0 10px}.apps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.app{position:relative;display:block;text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;min-height:190px;transition:.15s transform,.15s box-shadow;overflow:hidden}.app:hover{transform:translateY(-2px);box-shadow:0 8px 28px #12243218}.app::after{content:'';position:absolute;inset:auto -40px -70px auto;width:150px;height:150px;border-radius:50%;background:var(--soft)}.app-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{display:flex;align-items:center;gap:11px}.icon{width:44px;height:44px;border-radius:12px;background:#f3f6f7;border:1px solid var(--line);display:grid;place-items:center;overflow:hidden;flex:0 0 auto}.icon img{width:100%;height:100%;object-fit:contain}.pine{font-size:25px;line-height:1}.book-icon svg{width:25px;height:25px;fill:#0e2233}.app-kicker{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--blue);font-weight:800}.app h3{font-size:24px;margin:2px 0 0}.app p{font-size:13px;color:var(--muted);line-height:1.5;margin:18px 0 19px;max-width:88%;position:relative;z-index:1}.open{font-size:12px;font-weight:800;color:var(--blue);position:relative;z-index:1}.status{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;color:var(--muted);white-space:nowrap}.dot{width:8px;height:8px;border-radius:50%;background:#a8b2b8}.status.online{color:var(--green)}.status.online .dot{background:var(--green)}.status.issue{color:var(--amber)}.status.issue .dot{background:var(--amber)}.weather{background:linear-gradient(135deg,#fff,#eef7fb);border:1px solid var(--line);border-top:5px solid var(--blue);padding:18px;border-radius:14px;display:grid;grid-template-columns:1.2fr .8fr;gap:18px}.weather h2{margin:4px 0 3px;font-size:23px}.weather-main{display:flex;gap:14px;align-items:center}.temp{font-size:48px;line-height:1;font-weight:800;letter-spacing:-.05em}.condition{font-size:14px;color:var(--muted)}.weather-note{margin-top:10px;font-size:12px;font-weight:750;color:var(--blue)}.weather-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.stat{background:#fff;border:1px solid var(--line);padding:10px;border-radius:10px}.stat span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);font-weight:800}.stat strong{font-size:15px}.today{background:#fff;border:1px solid var(--line);border-radius:14px;padding:17px}.today-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.today-item{padding:12px;background:#f7f9fa;border-radius:10px;min-height:78px}.today-item span{display:block;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.09em;font-weight:800;margin-bottom:5px}.today-item strong{font-size:13px;line-height:1.35}.tiny{font-size:10px;color:var(--muted);margin-top:5px}.admin{background:#0e2233;color:#fff;border-radius:16px;padding:18px;border:1px solid #17384f}.admin-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:12px}.admin .eyebrow{color:#72b7dc}.admin h2{margin:4px 0 0;font-size:24px}.admin-copy{font-size:11px;color:#a9becb;max-width:430px;text-align:right;line-height:1.4}.admin-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.admin-card{background:#142f43;border:1px solid #26475c;border-radius:11px;padding:12px}.admin-card span{display:block;color:#8fa8b7;font-size:9px;letter-spacing:.08em;text-transform:uppercase}.admin-card strong{display:block;font-size:14px;margin-top:3px}.admin-links{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}.admin-links a{display:inline-block;text-decoration:none;color:#fff;border:1px solid #3c6076;border-radius:7px;padding:7px 8px;font-size:10px;font-weight:800;background:#17384f}.admin-links a:hover{border-color:#72b7dc;background:#1b415a}.foot{text-align:center;color:#84929a;font-size:10px;margin-top:28px}@media(max-width:900px){.apps{grid-template-columns:1fr 1fr}.admin-grid{grid-template-columns:1fr 1fr}}@media(max-width:700px){main{padding:18px 14px 36px}.top{display:block;margin-bottom:12px}.clock{display:flex;gap:10px;align-items:baseline;text-align:left;margin-top:12px}.time{font-size:22px}.date{margin:0}h1{font-size:37px}.section-title{margin-top:17px}.apps{grid-template-columns:1fr}.app{min-height:0;padding:17px}.app p{margin:14px 0 16px}.weather{grid-template-columns:1fr;padding:16px}.today-grid{grid-template-columns:1fr}.weather-stats{gap:6px}.stat{padding:9px}.admin-head{display:block}.admin-copy{text-align:left;margin-top:5px}.admin-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<main>
  <header class="top">
    <div><div class="eyebrow">Preston.run</div><h1 id="greeting">Home base.</h1><div class="sub">Today at a glance, then straight into your tools.</div></div>
    <div class="clock"><div class="time" id="time">--:--</div><div class="date" id="date">Loading…</div></div>
  </header>

  <div class="section-title">Your apps</div>
  <section class="apps">
    <a class="app" href="https://dose.preston.run">
      <div class="app-head"><div class="brand"><div class="icon"><img src="https://dose.preston.run/logo.png" alt=""></div><div><div class="app-kicker">Health & progress</div><h3>Dose & Scale</h3></div></div><div class="status" id="doseStatus"><i class="dot"></i><span>Checking</span></div></div>
      <p>Weigh-ins, dose tracking, recovery, workouts and Garmin sync in one persistent dashboard.</p><div class="open">Open Dose & Scale →</div>
    </a>
    <a class="app" href="https://parks.preston.run">
      <div class="app-head"><div class="brand"><div class="icon"><span class="pine">🌲</span></div><div><div class="app-kicker">Travel & outdoors</div><h3>State Parks</h3></div></div><div class="status" id="parksStatus"><i class="dot"></i><span>Checking</span></div></div>
      <p>Browse Minnesota and Wisconsin parks, build trips, assign days and export the trip booklet.</p><div class="open">Open State Parks →</div>
    </a>
    <a class="app" href="https://archive.preston.run">
      <div class="app-head"><div class="brand"><div class="icon book-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 2H6a2 2 0 0 0-2 2v15.5A2.5 2.5 0 0 0 6.5 22H20V4a2 2 0 0 0-2-2Zm0 18H6.5a.5.5 0 0 1 0-1H18v1Zm0-3H6V4h12v13Z"/></svg></div><div><div class="app-kicker">Stories & private library</div><h3>Archive</h3></div></div><div class="status" id="archiveStatus"><i class="dot"></i><span>Checking</span></div></div>
      <p>Read and search private stories, browse galleries, and track character measurement progression.</p><div class="open">Open Archive →</div>
    </a>
  </section>

  <div class="section-title">Sydney today</div>
  <section class="weather">
    <div><div class="eyebrow">Current conditions</div><h2 id="weatherTitle">Loading…</h2><div class="weather-main"><div class="temp" id="temp">--°</div><div class="condition">Fetching forecast</div></div><div class="weather-note" id="weatherNote">Checking today’s conditions…</div></div>
    <div class="weather-stats"><div class="stat"><span>Feels like</span><strong id="feels">--°</strong></div><div class="stat"><span>Rain chance</span><strong id="rain">--%</strong></div><div class="stat"><span>High / Low</span><strong id="range">--° / --°</strong></div><div class="stat"><span>Wind</span><strong id="wind">-- km/h</strong></div></div>
  </section>

  <div class="section-title">Today</div>
  <section class="today"><div class="today-grid">
    <div class="today-item"><span>Conditions</span><strong id="todayWeather">Loading weather…</strong><div class="tiny" id="todayWeatherDetail"></div></div>
    <div class="today-item"><span>Dose & Scale</span><strong id="todayDose">Checking app…</strong><div class="tiny">Tap the card above for today’s health and training data.</div></div>
    <div class="today-item"><span>State Parks</span><strong id="todayParks">Checking app…</strong><div class="tiny">Open the planner for saved trips and park planning.</div></div>
  </div></section>

  <div class="section-title">Website admin</div>
  <section class="admin">
    <div class="admin-head"><div><div class="eyebrow">CONTROL PANEL</div><h2>Website admin</h2></div><div class="admin-copy">Quick access to the live sites, source repositories and Railway project dashboards.</div></div>
    <div class="admin-grid">
      ${ADMIN.map(x=>`<article class="admin-card"><span>${x.domain}</span><strong>${x.name}</strong><div class="admin-links"><a href="${x.site}">Open site</a><a href="${x.repo}" target="_blank" rel="noopener">GitHub ↗</a><a href="${x.railway}" target="_blank" rel="noopener">Railway ↗</a></div></article>`).join('')}
    </div>
  </section>
  <div class="foot">Preston.run · v${VERSION}</div>
</main>
<script>
const code={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Rain showers',82:'Heavy showers',95:'Thunderstorms',96:'Thunderstorms',99:'Thunderstorms'};
function tick(){const d=new Date(),h=d.getHours();document.getElementById('greeting').textContent=(h<12?'Good morning.':h<18?'Good afternoon.':'Good evening.');document.getElementById('time').textContent=d.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'});document.getElementById('date').textContent=d.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}tick();setInterval(tick,30000);
function outdoorNote(temp,rain,wind){if(rain>=70)return'Wet day likely — plan around rain.';if(wind>=35)return'Windy conditions — exposed routes may feel rough.';if(temp>=30)return'Hot day — earlier or later outdoor time will be more comfortable.';if(rain<=20&&temp>=10&&temp<=26&&wind<25)return'Good general conditions for getting outside.';if(rain<=40)return'Reasonable outdoor conditions; keep an eye on the forecast.';return'Changeable conditions today — check before heading out.'}
async function weather(){try{const u='https://api.open-meteo.com/v1/forecast?latitude=-33.8688&longitude=151.2093&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Australia%2FSydney&forecast_days=1';const r=await fetch(u);if(!r.ok)throw new Error('weather');const x=await r.json(),c=x.current,d=x.daily,desc=code[c.weather_code]||'Current conditions',temp=Math.round(c.temperature_2m),rain=Math.round(d.precipitation_probability_max[0]||0),wind=Math.round(c.wind_speed_10m),note=outdoorNote(temp,rain,wind);document.getElementById('weatherTitle').textContent=desc;document.getElementById('temp').textContent=temp+'°';document.getElementById('condition').textContent='Sydney · updated '+new Date().toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'});document.getElementById('feels').textContent=Math.round(c.apparent_temperature)+'°';document.getElementById('rain').textContent=rain+'%';document.getElementById('range').textContent=Math.round(d.temperature_2m_max[0])+'° / '+Math.round(d.temperature_2m_min[0])+'°';document.getElementById('wind').textContent=wind+' km/h';document.getElementById('weatherNote').textContent=note;document.getElementById('todayWeather').textContent=desc+', '+temp+'° now';document.getElementById('todayWeatherDetail').textContent=note;}catch(e){for(const id of ['weatherTitle','todayWeather'])document.getElementById(id).textContent='Weather unavailable';document.getElementById('condition').textContent='Try again shortly';document.getElementById('weatherNote').textContent='';}}
function setStatus(key,online){const el=document.getElementById(key+'Status');if(!el)return;el.className='status '+(online?'online':'issue');el.querySelector('span').textContent=online?'Online':'Unavailable';const todayId=key==='dose'?'todayDose':key==='parks'?'todayParks':null;if(todayId)document.getElementById(todayId).textContent=online?'Online and ready':'Currently unavailable';}
async function statuses(){try{const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw new Error('status');const x=await r.json();setStatus('dose',!!x.dose?.online);setStatus('parks',!!x.parks?.online);setStatus('archive',!!x.archive?.online);}catch(e){setStatus('dose',false);setStatus('parks',false);setStatus('archive',false);}}
weather();statuses();setInterval(statuses,120000);
</script>
</body></html>`;

async function probe(url){const started=Date.now();try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),3500);const r=await fetch(url,{method:'GET',redirect:'follow',signal:controller.signal,headers:{'user-agent':'Preston.run status/0.4'}});clearTimeout(timer);return {online:r.status<500,status:r.status,ms:Date.now()-started};}catch(e){return {online:false,status:null,ms:Date.now()-started};}}

const server=http.createServer(async(req,res)=>{
  let url;try{url=new URL(req.url,'http://localhost')}catch{res.writeHead(400);return res.end('Bad request')}
  if(url.pathname==='/favicon.svg'){res.writeHead(200,{'content-type':'image/svg+xml','cache-control':'public,max-age=86400'});return res.end(favicon)}
  if(url.pathname==='/health'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:true,version:VERSION,apps:APPS.map(a=>a.url),weather:'Open-Meteo / Sydney',admin:ADMIN.map(a=>({name:a.name,repo:a.repo,railway:a.railway}))}))}
  if(url.pathname==='/api/status'){const results=await Promise.all(APPS.map(a=>probe(a.url)));const statuses=Object.fromEntries(APPS.map((app,index)=>[app.key,results[index]]));res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({checkedAt:new Date().toISOString(),...statuses}))}
  if(url.pathname!=='/'){res.writeHead(404,{'content-type':'text/plain'});return res.end('Not found')}
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'});res.end(html)
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Preston.run v${VERSION} on ${PORT}`));
