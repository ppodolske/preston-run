'use strict';

const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { loadConfig } = require('../src/config');
const { getAuthorizedOwner } = require('../src/auth/guard');
const { handleUatAuth, hasUatSession } = require('../src/auth/uat-basic');

const base = {
  PORT:'4321', NODE_ENV:'production', SITE_URL:'https://uat.example.test',
  SUPABASE_URL:'https://uat.supabase.co', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_uat',
  OWNER_GOOGLE_EMAIL:'owner@example.com', VAPID_PUBLIC_KEY:'public-key',
  GOOGLE_CALENDAR_CLIENT_ID:'disabled', GOOGLE_CALENDAR_CLIENT_SECRET:'disabled',
  CALENDAR_CREDENTIAL_KEY:'01234567890123456789012345678901'
};

function response() {
  return {
    statusCode: null,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    writeHead(status, headers={}) {
      this.statusCode = status;
      for (const [name,value] of Object.entries(headers)) this.setHeader(name,value);
    },
    end(value='') { this.body += value || ''; }
  };
}

function request({method='GET',path='/',body='',headers={}}={}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  req.method = method;
  req.url = path;
  req.headers = headers;
  return req;
}

(async () => {
  const normal = loadConfig(base);
  assert.equal(normal.uatAuthEnabled, false);
  assert.equal(normal.uatBasicUser, '');
  assert.equal(normal.uatBasicPassword, '');
  assert.equal(normal.uatUserId, '');
  assert.equal(normal.uatUserEmail, '');

  const env = {
    ...base,
    UAT_AUTH_ENABLED:'true',
    UAT_BASIC_USER:'preston-uat',
    UAT_BASIC_PASSWORD:'temporary-secret',
    UAT_USER_ID:'6b42097c-1fcb-406b-9c8c-1494d34cadb5',
    UAT_USER_EMAIL:'uat-owner@preston.run'
  };
  const config = loadConfig(env);
  assert.equal(config.uatAuthEnabled, true);

  for (const missing of ['UAT_BASIC_USER','UAT_BASIC_PASSWORD','UAT_USER_ID','UAT_USER_EMAIL']) {
    const invalid = {...env}; delete invalid[missing];
    assert.throws(() => loadConfig(invalid), new RegExp(missing));
  }

  let res = response();
  let handled = await handleUatAuth(request({path:'/'}), res, new URL('https://uat.example.test/'), config);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, '/uat-login');
  assert.equal(res.headers['www-authenticate'], undefined, 'form auth should not use browser Basic Auth');

  res = response();
  handled = await handleUatAuth(request({path:'/uat-login'}), res, new URL('https://uat.example.test/uat-login'), config);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /<form[^>]+method="post"[^>]+action="\/uat-login"/);
  assert.match(res.body, /name="username"/);
  assert.match(res.body, /name="password"/);

  res = response();
  const body = new URLSearchParams({username:'preston-uat',password:'temporary-secret'}).toString();
  handled = await handleUatAuth(request({method:'POST',path:'/uat-login',body,headers:{'content-type':'application/x-www-form-urlencoded',origin:'https://uat.example.test'}}), res, new URL('https://uat.example.test/uat-login'), config);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, '/');
  assert.match(String(res.headers['set-cookie']), /preston_uat=/);
  assert.match(String(res.headers['set-cookie']), /HttpOnly/i);
  assert.match(String(res.headers['set-cookie']), /Secure/i);
  assert.match(String(res.headers['set-cookie']), /SameSite=Lax/i);

  const cookie = String(res.headers['set-cookie']).split(';')[0];
  assert.equal(hasUatSession(request({headers:{cookie}}), config), true);
  res = response();
  handled = await handleUatAuth(request({path:'/',headers:{cookie}}), res, new URL('https://uat.example.test/'), config);
  assert.equal(handled, false, 'valid UAT session should continue into the app');

  res = response();
  const badBody = new URLSearchParams({username:'preston-uat',password:'wrong'}).toString();
  handled = await handleUatAuth(request({method:'POST',path:'/uat-login',body:badBody,headers:{'content-type':'application/x-www-form-urlencoded',origin:'https://uat.example.test'}}), res, new URL('https://uat.example.test/uat-login'), config);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 401);
  assert.match(res.body, /Incorrect username or password/);

  let authCalls = 0;
  const auth = await getAuthorizedOwner({auth:{getUser:async()=>{authCalls++;return {data:{user:null},error:null};}}}, config);
  assert.equal(authCalls, 0, 'UAT owner should not depend on Supabase Auth sessions');
  assert.equal(auth.reason, null);
  assert.equal(auth.user.id, config.uatUserId);
  assert.equal(auth.user.email, config.uatUserEmail);
  assert.equal(auth.user.user_metadata.full_name, 'UAT Owner');

  console.log('UAT auth tests passed');
})().catch(error => { console.error(error); process.exit(1); });
