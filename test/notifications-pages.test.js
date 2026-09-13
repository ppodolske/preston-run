const assert=require('node:assert/strict');
const {renderNotificationsPage}=require('../src/pages/notifications');

const html=renderNotificationsPage({
  settings:{timezone:'Australia/Sydney',morning_summary_time:'07:05:00',quiet_hours_start:'22:00:00',quiet_hours_end:'07:00:00',birthday_offsets:[30,14,7,1],renewal_offsets:[60,30,14,7,1],deadline_offsets:[14,7,3,0],appointment_offsets:[7,1,0],trip_offsets:[14,7,1]},
  vapidPublicKey:'PUBLIC_ONLY',
  subscriptions:[{id:'s1',device_label:'iPhone',active:true,last_used_at:'2026-09-13T00:00:00Z',endpoint:'https://secret.example',p256dh:'secret-key',auth_secret:'secret-auth'}],
  history:[{id:'d1',status:'delivered',attempted_at:'2026-09-13T00:00:00Z',error_category:null}]
});
assert.match(html,/Notifications/);
assert.match(html,/href="\/preston\.css"/);
assert.match(html,/class="site-header"/);
assert.match(html,/Enable notifications on this device/);
assert.match(html,/data-enable-notifications/);
assert.match(html,/data-vapid-public-key="PUBLIC_ONLY"/);
assert.match(html,/07:05/);
assert.match(html,/12:00/);
assert.match(html,/18:00/);
assert.match(html,/Australia\/Sydney/);
assert.match(html,/iPhone/);
assert.match(html,/Birthday/);
assert.match(html,/class="offset-chip"/);
assert.match(html,/name="birthday_offsets"[^>]*value="30"/);
assert.match(html,/name="birthday_offsets"[^>]*value="1"/);
assert.doesNotMatch(html,/30, 14, 7, 1/,'offsets should not be a comma-separated text field');
const quietStart=html.match(/<input[^>]*name="quiet_hours_start"[^>]*>/)?.[0]||'';
const quietEnd=html.match(/<input[^>]*name="quiet_hours_end"[^>]*>/)?.[0]||'';
assert.match(quietStart,/type="time"/);assert.match(quietStart,/value="22:00"/);
assert.match(quietEnd,/type="time"/);assert.match(quietEnd,/value="07:00"/);
assert.doesNotMatch(html,/https:\/\/secret\.example|secret-key|secret-auth/);
assert.match(html,/\/notifications\.js/);
console.log('notifications page tests passed');
