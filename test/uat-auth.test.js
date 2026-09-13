'use strict';

const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');
const { getAuthorizedOwner } = require('../src/auth/guard');
const { authorizeUatRequest } = require('../src/auth/uat-basic');

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
    end(value='') { this.body += value; }
  };
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
  assert.equal(config.uatBasicUser, 'preston-uat');
  assert.equal(config.uatBasicPassword, 'temporary-secret');
  assert.equal(config.uatUserId, '6b42097c-1fcb-406b-9c8c-1494d34cadb5');
  assert.equal(config.uatUserEmail, 'uat-owner@preston.run');

  for (const missing of ['UAT_BASIC_USER','UAT_BASIC_PASSWORD','UAT_USER_ID','UAT_USER_EMAIL']) {
    const invalid = {...env}; delete invalid[missing];
    assert.throws(() => loadConfig(invalid), new RegExp(missing));
  }

  let res = response();
  assert.equal(authorizeUatRequest({headers:{}}, res, config), false);
  assert.equal(res.statusCode, 401);
  assert.match(String(res.headers['www-authenticate']), /Basic/i);

  res = response();
  const wrong = Buffer.from('preston-uat:wrong').toString('base64');
  assert.equal(authorizeUatRequest({headers:{authorization:`Basic ${wrong}`}}, res, config), false);
  assert.equal(res.statusCode, 401);

  res = response();
  const valid = Buffer.from('preston-uat:temporary-secret').toString('base64');
  assert.equal(authorizeUatRequest({headers:{authorization:`Basic ${valid}`}}, res, config), true);
  assert.equal(res.statusCode, null);

  let authCalls = 0;
  const auth = await getAuthorizedOwner({auth:{getUser:async()=>{authCalls++;return {data:{user:null},error:null};}}}, config);
  assert.equal(authCalls, 0, 'UAT owner should not depend on Supabase Auth sessions');
  assert.equal(auth.reason, null);
  assert.equal(auth.user.id, config.uatUserId);
  assert.equal(auth.user.email, config.uatUserEmail);
  assert.equal(auth.user.user_metadata.full_name, 'UAT Owner');

  console.log('UAT auth tests passed');
})().catch(error => { console.error(error); process.exit(1); });
