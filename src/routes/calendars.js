'use strict';

const crypto=require('node:crypto');
const {getAuthorizedOwner}=require('../auth/guard');
const {readForm,isSameOriginRequest}=require('../http/forms');
const {html,redirect,text}=require('../http/respond');
const data=require('../data/calendars');
const googleProvider=require('../calendar/providers/google');
const appleProvider=require('../calendar/providers/apple-caldav');
const {encryptCredential,decodeCredentialKey}=require('../security/credential-crypto');
const {syncCalendars}=require('../services/calendar-sync');
const {renderCalendarsPage}=require('../pages/calendars');

const STATE_COOKIE='calendar_oauth_state';

function pathMatches(path){return path==='/settings/calendars'||path==='/settings/calendars/google/connect'||path==='/settings/calendars/google/callback'||path==='/settings/calendars/apple/connect'||path==='/settings/calendars/sync'||path==='/settings/calendars/google/disconnect'||path==='/settings/calendars/apple/disconnect'||/^\/settings\/calendars\/sources\/[^/]+\/toggle$/.test(path);}
async function owner(supabase,config,res){const auth=await getAuthorizedOwner(supabase,config);if(auth.user)return auth.user;if(auth.reason==='not_owner')await supabase.auth.signOut();redirect(res,'/');return null;}
function cookieValue(req,name){const header=String(req.headers&&req.headers.cookie||'');for(const pair of header.split(';')){const i=pair.indexOf('=');if(i<0)continue;if(pair.slice(0,i).trim()===name){try{return decodeURIComponent(pair.slice(i+1).trim());}catch{return null;}}}return null;}
function stateCookie(value,config,{clear=false}={}){const parts=[`${STATE_COOKIE}=${clear?'':encodeURIComponent(value)}`,'Path=/settings/calendars/google/callback','HttpOnly','SameSite=Lax'];if(config.isProduction)parts.push('Secure');parts.push(clear?'Max-Age=0':'Max-Age=600');return parts.join('; ');}
function redirectCookie(res,location,cookie){res.writeHead(302,{location,'cache-control':'no-store','set-cookie':cookie});res.end();}
function privateHtml(res,body){html(res,200,body,{'cache-control':'private, no-store'});}
function normalizedSources(rows=[]){return rows.map(row=>({provider_calendar_id:String(row.id||row.href||''),display_name:String(row.name||row.id||row.href||'Calendar'),color:row.color||null,read_only:row.readOnly!==false})).filter(row=>row.provider_calendar_id);}
function keyFor(config){return decodeCredentialKey(config.calendarCredentialKey);}
function providerStatusCode(error){const match=String(error&&error.message||'').match(/\((\d{3})\)\s*$/);return match?Number(match[1]):null;}
function reportCalendarError(provider,stage,error){const status=providerStatusCode(error);console.error(`Calendar callback failed: provider=${provider} stage=${stage}${status?` status=${status}`:''}`);}
function defaultDeps(){return{...data,googleProvider,appleProvider,encryptCredential,syncCalendars,reportCalendarError};}
function mergeDeps(context){return{...defaultDeps(),...(context.calendarDeps||{})};}
function validOAuthState(expected,received){
  if(!expected||!received||expected.length<32)return false;
  const a=Buffer.from(expected),b=Buffer.from(received);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}

async function renderSettings(res,supabase,user,deps,url){
  try{
    const connections=await deps.listCalendarConnections(supabase,user.id);
    const sources=await deps.listCalendarSources(supabase,user.id);
    let flash=null;if(url.searchParams.get('connected'))flash=`${url.searchParams.get('connected')==='apple'?'Apple':'Google'} Calendar connected.`;else if(url.searchParams.get('synced'))flash='Calendars synced.';else if(url.searchParams.get('saved'))flash='Calendar selection saved.';else if(url.searchParams.get('disconnected'))flash='Calendar disconnected.';
    privateHtml(res,renderCalendarsPage({connections,sources,flash}));
  }catch(_error){html(res,500,renderCalendarsPage({connections:[],sources:[],flash:'Calendar settings are temporarily unavailable.'}),{'cache-control':'private, no-store'});}
}

async function handleCalendarsRoute(req,res,context){
  const{supabase,config}=context;let url;try{url=new URL(req.url,config.siteUrl);}catch{return false;}if(!pathMatches(url.pathname))return false;
  const user=await owner(supabase,config,res);if(!user)return true;
  const deps=mergeDeps(context);
  const redirectUri=`${config.siteUrl}/settings/calendars/google/callback`;

  if(req.method==='GET'&&url.pathname==='/settings/calendars'){
    await renderSettings(res,supabase,user,deps,url);return true;
  }
  if(req.method==='GET'&&url.pathname==='/settings/calendars/google/connect'){
    const state=crypto.randomBytes(32).toString('base64url');
    const target=deps.googleProvider.buildAuthorizationUrl({clientId:config.googleCalendarClientId,redirectUri,state});
    redirectCookie(res,target,stateCookie(state,config));return true;
  }
  if(req.method==='GET'&&url.pathname==='/settings/calendars/google/callback'){
    const expected=cookieValue(req,STATE_COOKIE),received=url.searchParams.get('state'),code=url.searchParams.get('code');
    if(!code||!validOAuthState(expected,received)){text(res,400,'Invalid calendar authorization state',{'cache-control':'no-store'});return true;}
    let stage='token_exchange';
    try{
      const tokens=await deps.googleProvider.exchangeAuthorizationCode({code,clientId:config.googleCalendarClientId,clientSecret:config.googleCalendarClientSecret,redirectUri});
      if(!tokens.refreshToken)throw new Error('Google Calendar authorization did not return a refresh token');
      stage='calendar_discovery';
      const calendars=await deps.googleProvider.listCalendars({accessToken:tokens.accessToken});
      stage='account_identity';
      const identity=deps.googleProvider.getAccountIdentity(calendars);
      stage='credential_encryption';
      const ciphertext=deps.encryptCredential({refreshToken:tokens.refreshToken},keyFor(config,deps));
      stage='connection_save';
      const connection=await deps.upsertCalendarConnection(supabase,user.id,{provider:'google',account_external_id:identity.externalId,account_label:identity.label,credential_ciphertext:ciphertext,status:'connected',last_error:null});
      stage='source_save';
      await deps.replaceDiscoveredCalendarSources(supabase,user.id,connection.id,normalizedSources(calendars));
      redirectCookie(res,'/settings/calendars?connected=google',stateCookie('',config,{clear:true}));
    }catch(_error){deps.reportCalendarError('google',stage,_error);redirectCookie(res,'/settings/calendars?error=google',stateCookie('',config,{clear:true}));}
    return true;
  }

  if(req.method!=='POST'){text(res,405,'Method not allowed',{'cache-control':'no-store'});return true;}
  if(!isSameOriginRequest(req,config)){text(res,403,'Forbidden',{'cache-control':'no-store'});return true;}

  if(url.pathname==='/settings/calendars/apple/connect'){
    let form;try{form=await readForm(req);}catch(e){text(res,e.statusCode||400,'Invalid Apple Calendar request',{'cache-control':'no-store'});return true;}
    const email=String(form.get('email')||'').trim(),appSpecificPassword=String(form.get('app_specific_password')||'').trim();if(!email||!appSpecificPassword){text(res,400,'Apple ID email and app-specific password are required',{'cache-control':'no-store'});return true;}
    try{
      const credentials={email,appSpecificPassword};
      const validated=await deps.appleProvider.validateAppleCredentials(credentials);
      const calendars=validated&&Array.isArray(validated.calendars)?validated.calendars:await deps.appleProvider.listCalendars(credentials);
      const ciphertext=deps.encryptCredential(credentials,keyFor(config,deps));
      const connection=await deps.upsertCalendarConnection(supabase,user.id,{provider:'apple',account_external_id:email.toLowerCase(),account_label:email,credential_ciphertext:ciphertext,status:'connected',last_error:null});
      await deps.replaceDiscoveredCalendarSources(supabase,user.id,connection.id,normalizedSources(calendars));
      redirect(res,'/settings/calendars?connected=apple');
    }catch(_error){redirect(res,'/settings/calendars?error=apple');}
    return true;
  }

  const toggle=url.pathname.match(/^\/settings\/calendars\/sources\/([^/]+)\/toggle$/);
  if(toggle){let form;try{form=await readForm(req);}catch(e){text(res,e.statusCode||400,'Invalid calendar selection',{'cache-control':'no-store'});return true;}try{const row=await deps.setCalendarSourceSelected(supabase,user.id,decodeURIComponent(toggle[1]),form.get('selected')==='true');if(!row){text(res,404,'Not found',{'cache-control':'no-store'});return true;}redirect(res,'/settings/calendars?saved=1');}catch(_error){text(res,500,'Unable to save calendar selection',{'cache-control':'no-store'});}return true;}

  if(url.pathname==='/settings/calendars/sync'){
    try{await deps.syncCalendars({supabase,userId:user.id,now:new Date(),credentialKey:keyFor(config,deps),googleConfig:{clientId:config.googleCalendarClientId,clientSecret:config.googleCalendarClientSecret}});redirect(res,'/settings/calendars?synced=1');}catch(_error){redirect(res,'/settings/calendars?error=sync');}return true;
  }

  const disconnect=url.pathname.match(/^\/settings\/calendars\/(google|apple)\/disconnect$/);
  if(disconnect){try{const rows=await deps.listCalendarConnections(supabase,user.id);const connection=rows.find(row=>row.provider===disconnect[1]);if(connection)await deps.deleteCalendarConnection(supabase,user.id,connection.id);redirect(res,`/settings/calendars?disconnected=${disconnect[1]}`);}catch(_error){text(res,500,'Unable to disconnect calendar',{'cache-control':'no-store'});}return true;}

  text(res,404,'Not found',{'cache-control':'no-store'});return true;
}

module.exports={handleCalendarsRoute,STATE_COOKIE,providerStatusCode};