const assert=require('node:assert/strict');
const {classifyGmailIntent}=require('../src/domain/gmail-intent');

function classify(sender,subject,text=''){
  return classifyGmailIntent({sender,subject,text});
}

assert.deepEqual(classify('Booking Confirmation from Physiotherapy. <noreply@nookal.com>','Booking Confirmation - Physiotherapy'),{
  intent:'life_admin',category:'appointment',confidence:0.95,reason:'health_appointment'
});

assert.deepEqual(classify('Cafe Sydney <message@sevenrooms.com>','Your Reservation at Cafe Sydney | Preston on 12/12/2026'),{
  intent:'life_admin',category:'event',confidence:0.9,reason:'restaurant_reservation'
});

assert.equal(classify('Virgin Australia <no-reply@virginaustralia.com>','Your Virgin Australia Travel Reminder','Flight VA123 to Melbourne').intent,'trip');
assert.equal(classify('Hertz <reservations@emails.hertz.com>','My Hertz Reservation L5920779422').intent,'trip');
assert.equal(classify('Airbnb <automated@airbnb.com>','Reservation reminder - July 3, 2026').intent,'trip');
assert.equal(classify('Searoad Ferries <travel@searoad.com.au>','Confirmation for PRESTON - Reference # 4936812').intent,'trip');

assert.deepEqual(classify('Commonwealth Bank <No-reply@edm.cba.com.au>','Preston, book your next holiday with your CommBank credit card'),{
  intent:'ignore',confidence:0.99,reason:'marketing'
});

assert.deepEqual(classify('Uber <no-reply@uber.com>','Reservation confirmed for Sunday 5 July'),{
  intent:'review',confidence:0.6,reason:'ambiguous_booking'
});

assert.deepEqual(classify('unknown@example.com','Booking confirmation'),{
  intent:'review',confidence:0.6,reason:'ambiguous_booking'
});

assert.deepEqual(classify('billing@example.com','Your annual membership renewal is due 30 September 2026'),{
  intent:'life_admin',category:'membership',confidence:0.9,reason:'membership_renewal'
});

assert.deepEqual(classify('billing@example.com','Invoice 4412 payment due 30 September 2026'),{
  intent:'life_admin',category:'bill',confidence:0.9,reason:'bill_due'
});

console.log('gmail intent tests passed');
