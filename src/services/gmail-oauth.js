const GMAIL_READONLY_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const GOOGLE_AUTH_URL='https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL='https://www.googleapis.com/oauth2/v4/token';
const GMAIL_PROFILE_URL='https://gmail.googleapis.com/gmail/v1/users/me/profile';

function requireGmailConfig(config){
  const gmail=config&&config.gmail||{};
  for(const key of ['clientId','clientSecret','redirectUri']){
    if(!gmail[key])throw new Error(`Gmail OAuth config missing ${key}`);
  }
  return gmail;
}

function buildGmailAuthUrl(config,options={}){
  const gmail=requireGmailConfig(config);
  const url=new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id',gmail.clientId);
  url.searchParams.set('redirect_uri',gmail.redirectUri);
  url.searchParams.set('response_type','code');
  url.searchParams.set('access_type','offline');
  url.searchParams.set('prompt','consent');
  url.searchParams.set('scope',GMAIL_READONLY_SCOPE);
  if(options.state)url.searchParams.set('state',options.state);
  return url.toString();
}

async function readJson(response,label){
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(body.error_description||body.error?.message||`${label} failed`);
    error.status=response.status;
    error.body=body;
    throw error;
  }
  return body;
}

async function fetchGmailProfile(accessToken,options={}){
  const fetchImpl=options.fetch||global.fetch;
  if(!fetchImpl)throw new Error('fetch is required');
  const body=await readJson(await fetchImpl(GMAIL_PROFILE_URL,{method:'GET',headers:{Authorization:`Bearer ${accessToken}`}}),'Gmail profile lookup');
  return {emailAddress:body.emailAddress||'',messagesTotal:body.messagesTotal||0,threadsTotal:body.threadsTotal||0,id:body.emailAddress||''};
}

async function exchangeGmailCode(config,code,options={}){
  if(!code)throw new Error('OAuth code is required');
  const gmail=requireGmailConfig(config);
  const fetchImpl=options.fetch||global.fetch;
  if(!fetchImpl)throw new Error('fetch is required');
  const body=new URLSearchParams({
    code,
    client_id:gmail.clientId,
    client_secret:gmail.clientSecret,
    redirect_uri:gmail.redirectUri,
    grant_type:'authorization_code'
  });
  const token=await readJson(await fetchImpl(GOOGLE_TOKEN_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:body.toString()}),'Gmail token exchange');
  const profile=await (options.fetchProfile||fetchGmailProfile)(token.access_token,{fetch:fetchImpl});
  return {
    accountEmail:String(profile.emailAddress||'').trim().toLowerCase(),
    googleSubject:profile.id||profile.emailAddress||null,
    accessToken:token.access_token,
    refreshToken:token.refresh_token||'',
    scope:token.scope||GMAIL_READONLY_SCOPE,
    expiresIn:token.expires_in||null,
    tokenType:token.token_type||'Bearer'
  };
}

function createGmailOAuth(config,options={}){
  return {
    buildAuthUrl(args={}){return buildGmailAuthUrl(config,args);},
    exchangeCode(code){return exchangeGmailCode(config,code,options);}
  };
}

module.exports={GMAIL_READONLY_SCOPE,buildGmailAuthUrl,fetchGmailProfile,exchangeGmailCode,createGmailOAuth};
