const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadConfig}=require('../src/config');
const {classifyPushError}=require('../src/push/web-push');

const base={SITE_URL:'https://preston.run',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'pk',OWNER_GOOGLE_EMAIL:'owner@example.com'};
const config=loadConfig({...base,VAPID_PUBLIC_KEY:'public-key'});
assert.equal(config.vapidPublicKey,'public-key');
assert.equal(Object.hasOwn(config,'vapidPrivateKey'),false,'web config must not expose VAPID private key');
assert.equal(Object.hasOwn(config,'supabaseServiceRoleKey'),false,'web config must not expose service role key');
assert.throws(()=>loadConfig(base),/VAPID_PUBLIC_KEY/);

assert.equal(classifyPushError({statusCode:404}),'permanent');
assert.equal(classifyPushError({statusCode:410}),'permanent');
assert.equal(classifyPushError({statusCode:429}),'transient');
assert.equal(classifyPushError({statusCode:503}),'transient');
assert.equal(classifyPushError(new Error('network')),'transient');

const client=fs.readFileSync(path.join(__dirname,'../public/notifications.js'),'utf8');
assert.match(client,/data-enable-notifications/);
assert.match(client,/Notification\.requestPermission\(\)/);
assert.match(client,/addEventListener\('click',[\s\S]*enableNotifications\(button\)/,'enrollment must be invoked only from explicit click handler');
assert.equal((client.match(/enableNotifications\(button\)/g)||[]).length,2,'helper definition plus one explicit click invocation expected');
assert.doesNotMatch(client,/VAPID_PRIVATE_KEY|SUPABASE_SERVICE_ROLE_KEY/);

console.log('Push tests passed');
