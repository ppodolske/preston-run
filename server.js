const http=require('http');

const PORT=process.env.PORT||3000;
const VERSION='0.1.0';

const html=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0e2233">
<title>Preston.run</title>
<style>
:root{--bg:#eef2f4;--ink:#122432;--muted:#667781;--card:#fff;--line:#d7e0e4;--blue:#075b8e;--blue2:#0c74ad;--soft:#eaf4f8}*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink)}main{max-width:960px;margin:auto;padding:28px 18px 48px}.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:22px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--blue)}h1{font-size:42px;letter-spacing:-.04em;line-height:1;margin:6px 0 8px}.sub{color:var(--muted);font-size:15px}.clock{text-align:right;white-space:nowrap}.time{font-size:28px;font-weight:800}.date{font-size:12px;color:var(--muted);margin-top:4px}.weather{background:linear-gradient(135deg,#fff,#eef7fb);border:1px solid var(--line);border-top:5px solid var(--blue);padding:18px;border-radius:14px;margin-bottom:18px;display:grid;grid-template-columns:1.2fr .8fr;gap:18px}.weather h2{margin:4px 0 3px;font-size:23px}.weather-main{display:flex;gap:14px;align-items:center}.temp{font-size:48px;line-height:1;font-weight:800;letter-spacing:-.05em}.condition{font-size:14px;color:var(--muted)}.weather-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.stat{background:#fff;border:1px solid var(--line);padding:10px;border-radius:10px}.stat span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);font-weight:800}.stat strong{font-size:15px}.section-title{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:20px 0 10px}.apps{display:grid;grid-template-columns:1fr 1fr;gap:14px}.app{display:block;text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;min-height:170px;transition:.15s transform,.15s box-shadow}.app:hover{transform:translateY(-2px);box-shadow:0 8px 28px #12243218}.app-kicker{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--blue);font-weight:800}.app h3{font-size:23px;margin:8px 0 6px}.app p{font-size:13px;color:var(--muted);line-height:1.45;margin:0 0 16px}.open{font-size:12px;font-weight:800;color:var(--blue)}.today{background:#fff;border:1px solid var(--line);border-radius:14px;padding:17px}.today-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.today-item{padding:11px;background:#f7f9fa;border-radius:10px}.today-item span{display:block;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.09em;font-weight:800;margin-bottom:4px}.today-item strong{font-size:13px}.foot{text-align:center;color:#84929a;font-size:10px;margin-top:28px}@media(max-width:700px){main{padding-top:20px}.top{display:block}.clock{text-align:left;margin-top:14px}.weather{grid-template-columns:1fr}.apps{grid-template-columns:1fr}.today-grid{grid-template-columns:1fr}.app{min-height:0}h1{font-size:36px}}
</style>
</head>
<body>
<main>
  <header class="top">
    <div><div class="eyebrow">Preston.run</div><h1>Home base.</h1><div class="sub">A quick look at today, then straight into the tools that matter.</div></div>
    <div class="clock"><div class="time" id="time">--:--</div><div class="date" id="date">Loading…</div></div>
  </header>

  <section class="weather">
    <div><div class="eyebrow">Sydney weather</div><h2 id="weatherTitle">Loading current conditions…</h2><div class="weather-main"><div class="temp" id="temp">--°</div><div class="condition" id="condition">Fetching forecast</div></div></div>
    <div class="weather-stats"><div class="stat"><span>Feels like</span><strong id="feels">--°</strong></div><div class="stat"><span>Rain chance</span><strong id="rain">--%</strong></div><div class="stat"><span>High / Low</span><strong id="range">--° / --°</strong></div><div class="stat"><span>Wind</span><strong id="wind">-- km/h</strong></div></div>
  </section>

  <div class="section-title">Apps</div>
  <section class="apps">
    <a class="app" href="https://dose.preston.run"><div class="app-kicker">Health & progress</div><h3>Dose & Scale</h3><p>Open the persistent progress dashboard for weigh-ins, dose tracking, recovery, workouts and Garmin sync.</p><div class="open">Open Dose & Scale →</div></a>
    <a class="app" href="https://parks.preston.run"><div class="app-kicker">Travel & outdoors</div><h3>State Parks</h3><p>Browse Minnesota and Wisconsin parks, build trips, assign days and export the printable trip booklet.</p><div class="open">Open State Parks →</div></a>
  </section>

  <div class="section-title">Today</div>
  <section class="today"><div class="today-grid"><div class="today-item"><span>Weather</span><strong id="todayWeather">Loading…</strong></div><div class="today-item"><span>Dose & Scale</span><strong>Open dashboard for today’s status</strong></div><div class="today-item"><span>Trips</span><strong>Open planner when a trip is active</strong></div></div></section>
  <div class="foot">Preston.run · v${VERSION}</div>
</main>
<script>
const code={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Rain showers',82:'Heavy showers',95:'Thunderstorms',96:'Thunderstorms',99:'Thunderstorms'};
function tick(){const d=new Date();document.getElementById('time').textContent=d.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'});document.getElementById('date').textContent=d.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}tick();setInterval(tick,30000);
async function weather(){try{const u='https://api.open-meteo.com/v1/forecast?latitude=-33.8688&longitude=151.2093&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Australia%2FSydney&forecast_days=1';const r=await fetch(u);if(!r.ok)throw new Error('weather');const x=await r.json(),c=x.current,d=x.daily;const desc=code[c.weather_code]||'Current conditions';document.getElementById('weatherTitle').textContent=desc;document.getElementById('temp').textContent=Math.round(c.temperature_2m)+'°';document.getElementById('condition').textContent='Sydney · updated '+new Date().toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'});document.getElementById('feels').textContent=Math.round(c.apparent_temperature)+'°';document.getElementById('rain').textContent=Math.round(d.precipitation_probability_max[0]||0)+'%';document.getElementById('range').textContent=Math.round(d.temperature_2m_max[0])+'° / '+Math.round(d.temperature_2m_min[0])+'°';document.getElementById('wind').textContent=Math.round(c.wind_speed_10m)+' km/h';document.getElementById('todayWeather').textContent=desc+', '+Math.round(c.temperature_2m)+'° now';}catch(e){document.getElementById('weatherTitle').textContent='Weather unavailable';document.getElementById('condition').textContent='Try again shortly';document.getElementById('todayWeather').textContent='Weather unavailable';}}
weather();
</script>
</body></html>`;

const server=http.createServer((req,res)=>{
  let url;try{url=new URL(req.url,'http://localhost')}catch{res.writeHead(400);return res.end('Bad request')}
  if(url.pathname==='/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,version:VERSION,apps:['dose.preston.run','parks.preston.run'],weather:'Open-Meteo / Sydney'}))}
  if(url.pathname!=='/'){res.writeHead(404,{'content-type':'text/plain'});return res.end('Not found')}
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'});res.end(html)
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Preston.run v${VERSION} on ${PORT}`));
