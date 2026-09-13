const assert=require('node:assert/strict');
const {renderGmailSettingsPage}=require('../src/pages/gmail-settings');

const html=renderGmailSettingsPage({connection:null,scanHistory:[],latestScan:null,csrfToken:'token1'});
assert.match(html,/preston\.ai Gmail/i);
assert.match(html,/href="\/preston\.css"/);
assert.match(html,/class="site-header"/);
assert.match(html,/Connect Gmail/i);
assert.match(html,/read-only/i);
assert.match(html,/12-month/i);
assert.doesNotMatch(html,/send email/i);

const connected=renderGmailSettingsPage({
  connection:{gmail_account_email:'me@example.com',status:'connected',first_scan_completed_at:null},
  scanHistory:[{scan_type:'initial',status:'succeeded',processed_count:12,relevant_count:3,trip_count:1,life_admin_count:1,ignored_count:9,review_items_created_count:1,started_at:'2026-09-13T00:00:00Z'}],
  latestScan:{id:'scan1',scan_type:'initial',status:'succeeded',processed_count:12,relevant_count:3,trip_count:1,life_admin_count:1,ignored_count:9,review_items_created_count:1,started_at:'2026-09-13T00:00:00Z'},
  csrfToken:'token1'
});
assert.match(connected,/me@example\.com/);
assert.match(connected,/Scan Gmail now/);
assert.match(connected,/data-gmail-scan-button/);
assert.match(connected,/data-gmail-scan-status/);
assert.match(connected,/\/gmail-status\.js/);
assert.match(connected,/Retry failed items/);
assert.match(connected,/Spam, Trash, Drafts, and Sent Mail/i);
assert.match(connected,/12 processed/);
assert.match(connected,/1 Trip/);
assert.match(connected,/1 Life Admin/);
assert.match(connected,/1 Needs review/);
assert.match(connected,/9 ignored/);
assert.doesNotMatch(connected,/\brelevant\b/i,'generic relevant count is misleading and should not be shown');
assert.match(connected,/not a Gmail mirror/i);
assert.doesNotMatch(connected,/Native-text PDF attachments may be read, but PDF files are not stored as source of truth/,'technical implementation detail should be removed from primary settings copy');
console.log('gmail settings page tests passed');
