const assert=require('node:assert/strict');
const {renderGmailSettingsPage}=require('../src/pages/gmail-settings');

const html=renderGmailSettingsPage({
  connection:null,
  scanHistory:[],
  latestScan:null,
  csrfToken:'token1'
});
assert.match(html,/preston\.ai Gmail/i);
assert.match(html,/Connect Gmail/i);
assert.match(html,/read-only/i);
assert.match(html,/12-month/i);
assert.doesNotMatch(html,/send email/i);

const connected=renderGmailSettingsPage({
  connection:{gmail_account_email:'me@example.com',status:'connected',first_scan_completed_at:null},
  scanHistory:[{scan_type:'initial',status:'succeeded',processed_count:12,relevant_count:3,ignored_count:9,review_items_created_count:1,started_at:'2026-09-13T00:00:00Z'}],
  latestScan:{scan_type:'initial',status:'succeeded',processed_count:12,relevant_count:3,ignored_count:9,review_items_created_count:1,started_at:'2026-09-13T00:00:00Z'},
  csrfToken:'token1'
});
assert.match(connected,/me@example\.com/);
assert.match(connected,/Scan Gmail now/);
assert.match(connected,/Retry failed items/);
assert.match(connected,/Spam, Trash, Drafts, and Sent Mail/i);
assert.match(connected,/12 processed/);
assert.match(connected,/not a Gmail mirror/i);
console.log('gmail settings page tests passed');
