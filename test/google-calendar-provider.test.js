const assert=require('node:assert/strict');

const google=()=>require('../src/calendar/providers/google.js');
const jsonResponse=(body,status=200,headers={})=>({ok:status>=200&&status<300,status,headers:{get:(name)=>headers[String(name).toLowerCase()]||headers[name]||null},json:async()=>body,text:async()=>JSON.stringify(body)});

(async()=>{
  let mod;
  try{mod=google();}catch(error){assert.fail(`Google Calendar provider module required: ${error.message}`);}

  const redirectUri='https://preston.run/settings/calendars/google/callback';
  const authUrl=new URL(mod.buildAuthorizationUrl({clientId:'client-123',redirectUri,state:'state-abc'}));
  assert.equal(authUrl.origin,'https://accounts.google.com');
  assert.equal(authUrl.pathname,'/o/oauth2/v2/auth');
  assert.equal(authUrl.searchParams.get('client_id'),'client-123');
  assert.equal(authUrl.searchParams.get('redirect_uri'),redirectUri);
  assert.equal(authUrl.searchParams.get('response_type'),'code');
  assert.equal(authUrl.searchParams.get('access_type'),'offline');
  assert.equal(authUrl.searchParams.get('prompt'),'consent');
  assert.equal(authUrl.searchParams.get('state'),'state-abc');
  assert.equal(authUrl.searchParams.get('scope'),'https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.readonly');
  assert.equal(authUrl.searchParams.has('openid'),false);

  {
    const calls=[];
    const fetch=async(url,options)=>{calls.push({url:String(url),options});return jsonResponse({access_token:'access-1',refresh_token:'refresh-1',expires_in:3600,token_type:'Bearer'});};
    const tokens=await mod.exchangeAuthorizationCode({code:'code-1',clientId:'client-123',clientSecret:'secret-xyz',redirectUri,fetch});
    assert.equal(tokens.accessToken,'access-1');
    assert.equal(tokens.refreshToken,'refresh-1');
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,'https://oauth2.googleapis.com/token');
    assert.equal(calls[0].options.method,'POST');
    const body=new URLSearchParams(calls[0].options.body);
    assert.equal(body.get('code'),'code-1');
    assert.equal(body.get('client_id'),'client-123');
    assert.equal(body.get('client_secret'),'secret-xyz');
    assert.equal(body.get('redirect_uri'),redirectUri);
    assert.equal(body.get('grant_type'),'authorization_code');
  }

  {
    const calls=[];
    const fetch=async(url,options)=>{calls.push({url:String(url),options});return jsonResponse({access_token:'access-2',expires_in:1800,token_type:'Bearer'});};
    const tokens=await mod.refreshAccessToken({refreshToken:'refresh-secret',clientId:'client-123',clientSecret:'secret-xyz',fetch});
    assert.equal(tokens.accessToken,'access-2');
    const body=new URLSearchParams(calls[0].options.body);
    assert.equal(body.get('refresh_token'),'refresh-secret');
    assert.equal(body.get('grant_type'),'refresh_token');
  }

  {
    const pages=[
      jsonResponse({items:[{id:'primary@example.com',summary:'Personal',primary:true,backgroundColor:'#abc'}],nextPageToken:'page-2'}),
      jsonResponse({items:[{id:'family@example.com',summary:'Family',primary:false,backgroundColor:'#def'}]})
    ];
    const calls=[];
    const fetch=async(url,options)=>{calls.push({url:new URL(url),options});return pages.shift();};
    const calendars=await mod.listCalendars({accessToken:'token-abc',fetch});
    assert.equal(calendars.length,2);
    assert.deepEqual(calendars[0],{id:'primary@example.com',name:'Personal',primary:true,color:'#abc',readOnly:true});
    assert.equal(calls[0].options.headers.Authorization,'Bearer token-abc');
    assert.equal(calls[1].url.searchParams.get('pageToken'),'page-2');
    const identity=mod.getAccountIdentity(calendars);
    assert.deepEqual(identity,{externalId:'primary@example.com',label:'primary@example.com'});
  }

  {
    const pages=[
      jsonResponse({items:[
        {id:'timed-1',summary:'Dentist',status:'confirmed',htmlLink:'https://calendar.google.com/x',location:'Clinic',updated:'2026-09-12T01:00:00.000Z',start:{dateTime:'2026-09-13T08:30:00+10:00',timeZone:'Australia/Sydney'},end:{dateTime:'2026-09-13T09:15:00+10:00',timeZone:'Australia/Sydney'},attendees:[{self:true,responseStatus:'accepted'}],recurringEventId:'series-1',originalStartTime:{dateTime:'2026-09-13T08:30:00+10:00'}},
        {id:'all-day-1',summary:'Birthday',status:'tentative',start:{date:'2026-09-14'},end:{date:'2026-09-15'},attendees:[{self:true,responseStatus:'tentative'}]}
      ],nextPageToken:'next'},
      jsonResponse({items:[{id:'cancelled-1',summary:'Cancelled',status:'cancelled',start:{dateTime:'2026-09-14T08:00:00Z'},end:{dateTime:'2026-09-14T09:00:00Z'},attendees:[{self:true,responseStatus:'declined'}]}]})
    ];
    const calls=[];
    const fetch=async(url,options)=>{calls.push({url:new URL(url),options});return pages.shift();};
    const events=await mod.listEventOccurrences({calendarId:'primary@example.com',accessToken:'token-abc',start:'2026-08-14T00:00:00.000Z',end:'2027-09-13T00:00:00.000Z',fetch});
    assert.equal(events.length,3);
    const first=calls[0].url;
    assert.match(first.pathname,/\/calendars\/primary%40example\.com\/events$/);
    assert.equal(first.searchParams.get('singleEvents'),'true');
    assert.equal(first.searchParams.get('showDeleted'),'true');
    assert.equal(first.searchParams.get('timeMin'),'2026-08-14T00:00:00.000Z');
    assert.equal(first.searchParams.get('timeMax'),'2027-09-13T00:00:00.000Z');
    assert.equal(calls[1].url.searchParams.get('pageToken'),'next');
    assert.deepEqual(events[0],{
      providerEventId:'timed-1',occurrenceKey:'timed-1:2026-09-13T08:30:00+10:00',seriesId:'series-1',title:'Dentist',allDay:false,startsAt:'2026-09-12T22:30:00.000Z',endsAt:'2026-09-12T23:15:00.000Z',startDate:null,endDate:null,timeZone:'Australia/Sydney',location:'Clinic',externalUrl:'https://calendar.google.com/x',providerUpdatedAt:'2026-09-12T01:00:00.000Z',status:'confirmed',ownerResponse:'accepted'
    });
    assert.equal(events[1].allDay,true);
    assert.equal(events[1].startDate,'2026-09-14');
    assert.equal(events[1].endDate,'2026-09-15');
    assert.equal(events[1].status,'tentative');
    assert.equal(events[1].ownerResponse,'tentative');
    assert.equal(events[2].status,'cancelled');
    assert.equal(events[2].ownerResponse,'declined');
  }

  {
    const fetch=async()=>jsonResponse({error:'invalid_grant',error_description:'refresh-secret token-abc was rejected'},400);
    await assert.rejects(
      mod.refreshAccessToken({refreshToken:'refresh-secret',clientId:'client',clientSecret:'client-secret',fetch}),
      error=>{
        assert.match(error.message,/Google Calendar/i);
        assert.doesNotMatch(error.message,/refresh-secret|token-abc|client-secret|invalid_grant/i);
        return true;
      }
    );
  }

  console.log('Google Calendar provider tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
