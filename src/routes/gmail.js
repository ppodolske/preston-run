const crypto=require('node:crypto');
const {getAuthorizedOwner}=require('../auth/guard');
const {readForm,isSameOriginRequest}=require('../http/forms');
const {html,redirect,json,text}=require('../http/respond');
const {getGmailConnection,markGmailDisconnected}=require('../data/gmail-connections');
const {undoGmailActivity}=require('../data/gmail-sources');
const {renderGmailSettingsPage}=require('../pages/gmail-settings');
const {GMAIL_READONLY_SCOPE}=require('../services/gmail-oauth');

const STATE_COOKIE='gmail_oauth_state';
const ACTIVE_SCAN_STATUSES=new Set(['queued','running','processing']);

async function owner(supabase,config,res){const auth=await getAuthorizedOwner(supabase,config);if(auth.user)return auth.user;if(auth.reason==='not_owner')await supabase.auth.signOut();redirect(res,'/');return null;}
function privateHtml(res,status,body){html(res,status,body,{'cache-control':'private, no-store'});}
function isGmailPath(path){return path==='/me/settings/gmail'||path==='/me/settings/gmail/connect'||path==='/me/settings/gmail/callback'||path==='/me/settings/gmail/disconnect'||path==='/me/settings/gmail/scan-now'||path==='/me/settings/gmail/scan-status'||path==='/me/settings/gmail/retry-failed'||/^\/me\/settings\/gmail\/activity\/[^/]+\/undo$/.test(path);}
function cookieValue(req,name){const header=String(req.headers&&req.headers.cookie||'');for(const pair of header.split(';')){const i=pair.indexOf('=');if(i<0)continue;if(pair.slice(0,i).trim()===name){try{return decodeURIComponent(pair.slice(i+1).trim());}catch{return null;}}}return null;}
function stateCookie(value,config,{clear=false}={}){const parts=[`${STATE_COOKIE}=${clear?'':encodeURIComponent(value)}`,'Path=/me/settings/gmail/callback','HttpOnly','SameSite=Lax'];if(config.isProduction)parts.push('Secure');parts.push(clear?'Max-Age=0':'Max-Age=600');return parts.join('; ');}
function redirectCookie(res,location,cookie){res.writeHead(302,{location,'cache-control':'no-store','set-cookie':cookie});res.end();}
function validOAuthState(expected,received){if(!expected||!received||expected.length<32)return false;const a=Buffer.from(expected),b=Buffer.from(received);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function buildGmailAuthUrl(googleOAuth,config,state){return googleOAuth.buildAuthUrl({scope:[GMAIL_READONLY_SCOPE],redirectUri:config.gmail&&config.gmail.redirectUri,state});}
function logGmailError(label,error){const safe={message:error&&error.message,status:error&&error.status,name:error&&error.name};console.error(`[gmail] ${label}`,safe);}
function tokenEncryptors(deps){const encryptAccessToken=deps.encryptAccessToken||deps.encrypt;const encryptRefreshToken=deps.encryptRefreshToken||deps.encrypt;return {encryptAccessToken,encryptRefreshToken};}
function publicScan(row){if(!row)return null;return {id:row.id||null,status:row.status||null,scan_type:row.scan_type||null,processed_count:Number(row.processed_count||0),relevant_count:Number(row.relevant_count||0),trip_count:Number(row.trip_count||0),life_admin_count:Number(row.life_admin_count||0),ignored_count:Number(row.ignored_count||0),review_items_created_count:Number(row.review_items_created_count||0),pdf_unreadable_count:Number(row.pdf_unreadable_count||0),started_at:row.started_at||null,finished_at:row.finished_at||null,error_summary:row.error_summary||null};}

async function completeGmailOAuthCallback({supabase,userId,code,config,googleOAuth,encrypt,encryptAccessToken,encryptRefreshToken,upsertGmailConnection,startScanNow}){if(startScanNow)void startScanNow;const exchanged=await googleOAuth.exchangeCode(code,{redirectUri:config.gmail&&config.gmail.redirectUri});const accessEncryptor=encryptAccessToken||encrypt;const refreshEncryptor=encryptRefreshToken||encrypt;if(!accessEncryptor||!refreshEncryptor)throw new Error('Gmail token encryption is not configured');return upsertGmailConnection(supabase,userId,{gmailAccountEmail:exchanged.accountEmail,googleSubject:exchanged.googleSubject,accessTokenCiphertext:accessEncryptor(exchanged.accessToken),refreshTokenCiphertext:refreshEncryptor(exchanged.refreshToken),scope:exchanged.scope});}

async function listRecentScans(supabase,userId,limit=10){const result=await supabase.from('gmail_scan_runs').select('*').eq('user_id',userId).order('started_at',{ascending:false}).limit(limit);if(result.error)throw result.error;return result.data||[];}

async function recentScans(deps,supabase,userId,limit=10){return deps.listRecentScans?deps.listRecentScans(supabase,userId,limit):listRecentScans(supabase,userId,limit);}
function launchScan(deps,supabase,userId){let promise;try{promise=deps.startScanNow(supabase,userId);}catch(error){logGmailError('manual scan launch failed',error);return false;}Promise.resolve(promise).catch(error=>logGmailError('manual scan failed',error));return true;}

async function handleGmailRoute(req,res,context){
  const {supabase,config}=context;let url;try{url=new URL(req.url,config.siteUrl);}catch{return false;}if(!isGmailPath(url.pathname))return false;
  const user=await owner(supabase,config,res);if(!user)return true;const deps=context.gmailDeps||{};
  if(req.method==='GET'&&url.pathname==='/me/settings/gmail'){
    try{const connection=deps.getGmailConnection?await deps.getGmailConnection(supabase,user.id):await getGmailConnection(supabase,user.id);const scanHistory=await recentScans(deps,supabase,user.id);const latestScan=scanHistory[0]||null;const flash=url.searchParams.get('connected')?'Gmail connected. Start the first scan when ready.':url.searchParams.get('scan')?'Gmail scan started. This page will update as it runs.':url.searchParams.get('oauth_error')?'Unable to connect Gmail. Please try again.':url.searchParams.get('undo')?'Gmail update undone.':null;privateHtml(res,200,renderGmailSettingsPage({connection,scanHistory,latestScan,csrfToken:'',flash}));}catch(error){logGmailError('settings failed',error);privateHtml(res,500,renderGmailSettingsPage({connection:null,scanHistory:[],latestScan:null,csrfToken:'',flash:'Gmail settings are temporarily unavailable.'}));}return true;
  }
  if(req.method==='GET'&&url.pathname==='/me/settings/gmail/scan-status'){
    try{const rows=await recentScans(deps,supabase,user.id,1);json(res,200,{latestScan:publicScan(rows[0]||null)},{'cache-control':'private, no-store'});}catch(error){logGmailError('scan status failed',error);json(res,503,{latestScan:null,error:'Gmail scan status is temporarily unavailable.'},{'cache-control':'private, no-store'});}return true;
  }
  if(req.method==='GET'&&url.pathname==='/me/settings/gmail/callback'){
    const expected=cookieValue(req,STATE_COOKIE),received=url.searchParams.get('state'),code=url.searchParams.get('code');if(!code||!validOAuthState(expected,received)){text(res,400,'Invalid Gmail authorization state',{'cache-control':'no-store'});return true;}const encryptors=tokenEncryptors(deps);if(!deps.googleOAuth||!deps.upsertGmailConnection||!encryptors.encryptAccessToken||!encryptors.encryptRefreshToken){text(res,501,'Gmail OAuth is not configured',{'cache-control':'no-store'});return true;}
    try{await completeGmailOAuthCallback({supabase,userId:user.id,code,config,googleOAuth:deps.googleOAuth,encryptAccessToken:encryptors.encryptAccessToken,encryptRefreshToken:encryptors.encryptRefreshToken,upsertGmailConnection:deps.upsertGmailConnection,startScanNow:deps.startScanNow});redirectCookie(res,'/me/settings/gmail?connected=1',stateCookie('',config,{clear:true}));}catch(error){logGmailError('callback failed',error);redirectCookie(res,'/me/settings/gmail?oauth_error=1',stateCookie('',config,{clear:true}));}return true;
  }
  if(req.method!=='POST'){text(res,405,'Method not allowed',{'cache-control':'no-store'});return true;}if(!isSameOriginRequest(req,config)){text(res,403,'Forbidden',{'cache-control':'no-store'});return true;}try{await readForm(req);}catch(e){text(res,e.statusCode||400,e.message||'Invalid request',{'cache-control':'no-store'});return true;}
  if(url.pathname==='/me/settings/gmail/connect'){if(!deps.googleOAuth||!deps.googleOAuth.buildAuthUrl){text(res,501,'Gmail OAuth is not configured',{'cache-control':'no-store'});return true;}const state=crypto.randomBytes(32).toString('base64url');redirectCookie(res,buildGmailAuthUrl(deps.googleOAuth,config,state),stateCookie(state,config));return true;}
  if(url.pathname==='/me/settings/gmail/disconnect'){try{const connection=deps.getGmailConnection?await deps.getGmailConnection(supabase,user.id):await getGmailConnection(supabase,user.id);if(connection)await (deps.markGmailDisconnected||markGmailDisconnected)(supabase,user.id,connection.id);redirect(res,'/me/settings/gmail');}catch(error){logGmailError('disconnect failed',error);text(res,500,'Unable to disconnect Gmail',{'cache-control':'no-store'});}return true;}
  if(url.pathname==='/me/settings/gmail/scan-now'){
    if(!deps.startScanNow){text(res,500,'Unable to start Gmail scan',{'cache-control':'no-store'});return true;}
    try{const scans=await recentScans(deps,supabase,user.id,1).catch(()=>[]);if(scans[0]&&ACTIVE_SCAN_STATUSES.has(String(scans[0].status||'').toLowerCase())){redirect(res,'/me/settings/gmail?scan=1');return true;}if(!launchScan(deps,supabase,user.id)){text(res,500,'Unable to start Gmail scan',{'cache-control':'no-store'});return true;}redirect(res,'/me/settings/gmail?scan=1');}catch(error){logGmailError('manual scan failed',error);text(res,500,'Unable to start Gmail scan',{'cache-control':'no-store'});}return true;
  }
  if(url.pathname==='/me/settings/gmail/retry-failed'){try{if(!deps.retryFailedGmailItems)throw new Error('Gmail retry is not configured');Promise.resolve(deps.retryFailedGmailItems(supabase,user.id)).catch(error=>logGmailError('retry failed',error));redirect(res,'/me/settings/gmail?scan=1');}catch(error){logGmailError('retry launch failed',error);text(res,500,'Unable to retry Gmail items',{'cache-control':'no-store'});}return true;}
  const undo=url.pathname.match(/^\/me\/settings\/gmail\/activity\/([^/]+)\/undo$/);if(undo){try{await (deps.undoGmailActivity||undoGmailActivity)(supabase,user.id,decodeURIComponent(undo[1]),deps.undoOptions||{});redirect(res,'/me/settings/gmail?undo=1');}catch(error){logGmailError('undo failed',error);text(res,500,'Unable to undo Gmail update',{'cache-control':'no-store'});}return true;}
  text(res,404,'Not found',{'cache-control':'no-store'});return true;
}

function createGmailRouter(deps={}){return function gmailRouter(req,res){return handleGmailRoute(req,res,deps);};}

module.exports={handleGmailRoute,createGmailRouter,listRecentScans,isGmailPath,buildGmailAuthUrl,completeGmailOAuthCallback,GMAIL_READONLY_SCOPE,tokenEncryptors,STATE_COOKIE,stateCookie,validOAuthState,publicScan,launchScan};