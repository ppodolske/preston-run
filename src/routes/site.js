const { html, redirect, json, text } = require('../http/respond');
const { renderLoginPage } = require('../pages/login');
const { renderHomePage } = require('../pages/home-page');
const { getAuthorizedOwner } = require('../auth/guard');
const { listPeople } = require('../data/people');
const { listLifeItems } = require('../data/life-admin');
const { listTasks } = require('../data/tasks');
const { listTrips } = require('../data/trips');
const { listCalendarDashboardData } = require('../data/calendars');
const { getFitnessContext, getMorningDigest } = require('../data/fitness-context');
const { getUpcomingBirthdays, todayInTimeZone } = require('../domain/birthdays');
const { getComingUpLifeItems, getAttentionBuckets, excludeAttentionFromComingUp } = require('../domain/life-admin');
const { buildDashboardCalendar, getDashboardCalendarWindow } = require('../domain/calendars');
const { getUpcomingTrips } = require('../domain/trips');
const { refreshFitnessContext } = require('../services/fitness-context');
const { loadTravelDashboard } = require('../services/travel-dashboard');
const { APPS, VERSION } = require('../branding');

function depsFor(context={}){return{listPeople,listLifeItems,listTasks,listTrips,listCalendarDashboardData,getFitnessContext,getMorningDigest,getUpcomingBirthdays,getComingUpLifeItems,getAttentionBuckets,excludeAttentionFromComingUp,buildDashboardCalendar,getUpcomingTrips,refreshFitnessContext,loadTravelDashboard,renderHomePage,...(context.siteDeps||{})};}

async function probe(url) {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(url, { method:'GET', redirect:'follow', signal:controller.signal, headers:{'user-agent':`preston.ai status/${VERSION}`} });
    clearTimeout(timer);
    return { online:response.status < 500, status:response.status, ms:Date.now()-started };
  } catch {
    return { online:false, status:null, ms:Date.now()-started };
  }
}

async function handleSiteRoute(req, res, context) {
  const { supabase, config } = context;
  const deps=depsFor(context);
  let url;
  try { url = new URL(req.url, config.siteUrl); } catch { text(res, 400, 'Bad request'); return true; }

  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, { ok:true, version:VERSION }, { 'cache-control':'no-store' });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    const auth = await getAuthorizedOwner(supabase, config);
    if (!auth.user) { json(res, 401, { error:'unauthorized' }, { 'cache-control':'no-store' }); return true; }
    const results = await Promise.all(APPS.map(app => probe(app.url)));
    const statuses = Object.fromEntries(APPS.map((app, i) => [app.key, results[i]]));
    json(res, 200, { checkedAt:new Date().toISOString(), ...statuses }, { 'cache-control':'private, no-store' });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/fitness-context/refresh') {
    const auth=await getAuthorizedOwner(supabase,config);
    if(!auth.user){redirect(res,'/');return true;}
    try{
      const result=await deps.refreshFitnessContext({supabase,userId:auth.user.id,now:new Date(),forceDigest:true});
      redirect(res,result&&result.ok?'/?fitness_refresh=ok':'/?fitness_refresh=stale');
    }catch{
      redirect(res,'/?fitness_refresh=stale');
    }
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/') {
    const auth = await getAuthorizedOwner(supabase, config);
    if (auth.user) {
      const now=new Date();
      let upcomingBirthdays = [], birthdayDataUnavailable = false;
      let upcomingLifeItems = [], overdueItems = [], todayItems = [], lifeAdminDataUnavailable = false;
      let upcomingTrips = [], tripDataUnavailable = false, travelTrips = [], travelDataUnavailable = false;
      let providerCalendarData={events:[],sources:[]}, calendarDataUnavailable = false;
      let fitnessContext=null, morningDigest=null, fitnessUnavailable=false;
      try {
        const people = await deps.listPeople(supabase);
        upcomingBirthdays = deps.getUpcomingBirthdays(people, todayInTimeZone('Australia/Sydney'), 90);
      } catch { birthdayDataUnavailable = true; }
      try {
        const [lifeItems, tasks] = await Promise.all([deps.listLifeItems(supabase), deps.listTasks(supabase)]);
        const buckets=deps.getAttentionBuckets({lifeItems,tasks,now});
        overdueItems=buckets.overdue;todayItems=buckets.today;
        upcomingLifeItems = deps.excludeAttentionFromComingUp(deps.getComingUpLifeItems(lifeItems, now, 90),buckets);
      } catch { lifeAdminDataUnavailable = true; }
      try {
        providerCalendarData=await deps.listCalendarDashboardData(supabase,auth.user.id);
      } catch { calendarDataUnavailable = true; }
      try {
        fitnessContext=await deps.getFitnessContext(supabase,auth.user.id);
      } catch { fitnessUnavailable = true; }
      try {
        const today=getDashboardCalendarWindow(now).today;
        morningDigest=await deps.getMorningDigest(supabase,auth.user.id,today);
      } catch { fitnessUnavailable = true; }
      const fitnessPayload=fitnessContext&&fitnessContext.payload&&typeof fitnessContext.payload==='object'?fitnessContext.payload:{};
      let calendar={personal:[],holidays:[],reminders:[],plannedWorkouts:[]};
      try {
        calendar=deps.buildDashboardCalendar({
          ...providerCalendarData,
          plannedWorkouts:Array.isArray(fitnessPayload.plannedWorkouts)?fitnessPayload.plannedWorkouts:[],
          actualActivities:Array.isArray(fitnessPayload.actualActivities)?fitnessPayload.actualActivities:[],
          now
        });
      } catch { calendarDataUnavailable = true; }
      try {
        const trips = await deps.listTrips(supabase, auth.user);
        upcomingTrips = deps.getUpcomingTrips(trips, now, 180);
      } catch { tripDataUnavailable = true; travelDataUnavailable = true; }
      if(!tripDataUnavailable){
        try {
          travelTrips=await deps.loadTravelDashboard({supabase,user:auth.user,trips:upcomingTrips});
        } catch { travelDataUnavailable = true; travelTrips=[]; }
      }
      html(res, 200, deps.renderHomePage({ user:auth.user, upcomingBirthdays, birthdayDataUnavailable, upcomingLifeItems, overdueItems, todayItems, lifeAdminDataUnavailable, calendar, calendarDataUnavailable, morningDigest, fitnessContext, fitnessUnavailable, upcomingTrips, tripDataUnavailable, travelTrips, travelDataUnavailable }), { 'cache-control':'private, no-store' });
      return true;
    }
    if (auth.reason === 'not_owner') {
      await supabase.auth.signOut();
      html(res, 403, renderLoginPage({ error:'This Google account does not have access.' }), { 'cache-control':'no-store' });
      return true;
    }
    const error = url.searchParams.get('auth_error') ? 'Sign-in could not be completed. Please try again.' : null;
    html(res, 200, renderLoginPage({ error }), { 'cache-control':'no-store' });
    return true;
  }

  return false;
}
module.exports = { handleSiteRoute, probe };
