const {getAuthorizedOwner}=require('../auth/guard');
const {readForm,isSameOriginRequest}=require('../http/forms');
const {html,redirect,text}=require('../http/respond');
const {getGmailConnection,markGmailDisconnected}=require('../data/gmail-connections');
const {renderGmailSettingsPage}=require('../pages/gmail-settings');

async function owner(supabase,config,res){const auth=await getAuthorizedOwner(supabase,config);if(auth.user)return auth.user;if(auth.reason==='not_owner')await supabase.auth.signOut();redirect(res,'/');return null;}
function privateHtml(res,status,body){html(res,status,body,{'cache-control':'private, no-store'});}
function isGmailPath(path){return path==='/me/settings/gmail'||path==='/me/settings/gmail/connect'||path==='/me/settings/gmail/callback'||path==='/me/settings/gmail/disconnect'||path==='/me/settings/gmail/scan-now'||path==='/me/settings/gmail/retry-failed';}

async function listRecentScans(supabase,userId,limit=10){
  const result=await supabase.from('gmail_scan_runs').select('*').eq('user_id',userId).order('started_at',{ascending:false}).limit(limit);
  if(result.error)throw result.error;
  return result.data||[];
}

async function handleGmailRoute(req,res,context){
  const {supabase,config}=context;let url;try{url=new URL(req.url,config.siteUrl);}catch{return false;}if(!isGmailPath(url.pathname))return false;
  const user=await owner(supabase,config,res);if(!user)return true;
  const deps=context.gmailDeps||{};
  if(req.method==='GET'&&url.pathname==='/me/settings/gmail'){
    try{
      const connection=deps.getGmailConnection?await deps.getGmailConnection(supabase,user.id):await getGmailConnection(supabase,user.id);
      const scanHistory=deps.listRecentScans?await deps.listRecentScans(supabase,user.id):await listRecentScans(supabase,user.id);
      const latestScan=scanHistory[0]||null;
      privateHtml(res,200,renderGmailSettingsPage({connection,scanHistory,latestScan,csrfToken:'',flash:url.searchParams.get('connected')?'Gmail connected. Start the first scan when ready.':url.searchParams.get('scan')?'Gmail scan started.':null}));
    }catch{
      privateHtml(res,500,renderGmailSettingsPage({connection:null,scanHistory:[],latestScan:null,csrfToken:'',flash:'Gmail settings are temporarily unavailable.'}));
    }
    return true;
  }
  if(req.method==='GET'&&url.pathname==='/me/settings/gmail/callback'){
    if(!deps.googleOAuth||!deps.encrypt||!deps.upsertGmailConnection){text(res,501,'Gmail OAuth is not configured',{'cache-control':'no-store'});return true;}
    try{
      const exchanged=await deps.googleOAuth.exchangeCode(url.searchParams.get('code'),{redirectUri:config.gmail&&config.gmail.redirectUri});
      await deps.upsertGmailConnection(supabase,user.id,{gmailAccountEmail:exchanged.accountEmail,googleSubject:exchanged.googleSubject,accessTokenCiphertext:deps.encrypt(exchanged.accessToken),refreshTokenCiphertext:deps.encrypt(exchanged.refreshToken),scope:exchanged.scope});
      redirect(res,'/me/settings/gmail?connected=1');
    }catch{ text(res,500,'Unable to connect Gmail',{'cache-control':'no-store'}); }
    return true;
  }
  if(req.method!=='POST'){text(res,405,'Method not allowed',{'cache-control':'no-store'});return true;}
  if(!isSameOriginRequest(req,config)){text(res,403,'Forbidden',{'cache-control':'no-store'});return true;}
  try{await readForm(req);}catch(e){text(res,e.statusCode||400,e.message||'Invalid request',{'cache-control':'no-store'});return true;}
  if(url.pathname==='/me/settings/gmail/connect'){
    if(!deps.googleOAuth||!deps.googleOAuth.buildAuthUrl){text(res,501,'Gmail OAuth is not configured',{'cache-control':'no-store'});return true;}
    const authUrl=deps.googleOAuth.buildAuthUrl({scope:['https://www.googleapis.com/auth/gmail.readonly'],redirectUri:config.gmail&&config.gmail.redirectUri});
    redirect(res,authUrl);
    return true;
  }
  if(url.pathname==='/me/settings/gmail/disconnect'){
    try{const connection=deps.getGmailConnection?await deps.getGmailConnection(supabase,user.id):await getGmailConnection(supabase,user.id);if(connection)await (deps.markGmailDisconnected||markGmailDisconnected)(supabase,user.id,connection.id);redirect(res,'/me/settings/gmail');}catch{text(res,500,'Unable to disconnect Gmail',{'cache-control':'no-store'});}return true;
  }
  if(url.pathname==='/me/settings/gmail/scan-now'){
    try{if(deps.startScanNow)await deps.startScanNow(supabase,user.id);redirect(res,'/me/settings/gmail?scan=1');}catch{text(res,500,'Unable to start Gmail scan',{'cache-control':'no-store'});}return true;
  }
  if(url.pathname==='/me/settings/gmail/retry-failed'){
    try{if(deps.retryFailedGmailItems)await deps.retryFailedGmailItems(supabase,user.id);redirect(res,'/me/settings/gmail?scan=1');}catch{text(res,500,'Unable to retry Gmail items',{'cache-control':'no-store'});}return true;
  }
  text(res,404,'Not found',{'cache-control':'no-store'});return true;
}

function createGmailRouter(deps={}){return function gmailRouter(req,res){return handleGmailRoute(req,res,deps);};}

module.exports={handleGmailRoute,createGmailRouter,listRecentScans,isGmailPath};
