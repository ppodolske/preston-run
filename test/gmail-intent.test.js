const assert=require('node:assert/strict');
const {classifyGmailIntent}=require('../src/domain/gmail-intent');

function classify(sender,subject,text=''){
  return classifyGmailIntent({sender,subject,text});
}

assert.deepEqual(classify('Booking Confirmation from Physiotherapy. <noreply@nookal.com>','Booking Confirmation - Physiotherapy'),{
  intent:'life_admin',category:'appointment',confidence:0.95,reason:'health_appointment'
});
assert.deepEqual(classify('HealthShare <no-reply@healthshare.com.au>','Optique Barangaroo Optometry Eye Test appointment confirmed'),{
  intent:'life_admin',category:'appointment',confidence:0.95,reason:'health_appointment'
});

assert.deepEqual(classify('Cafe Sydney <message@sevenrooms.com>','Your Reservation at Cafe Sydney | Preston on 12/12/2026'),{
  intent:'life_admin',category:'event',confidence:0.9,reason:'restaurant_reservation'
});
assert.deepEqual(classify('Yonder <info@nowbookit.com>','Booking confirmation: Yonder'),{
  intent:'life_admin',category:'event',confidence:0.9,reason:'restaurant_reservation'
});

assert.equal(classify('Virgin Australia <no-reply@virginaustralia.com>','Your Virgin Australia Travel Reminder','Flight VA123 to Melbourne').intent,'trip');
assert.equal(classify('Hertz <reservations@emails.hertz.com>','My Hertz Reservation L5920779422').intent,'trip');
assert.equal(classify('DoNotReply@apac.hertz.com','Hertz Car Rental Invoice').intent,'trip','travel-provider invoices must not become Life Admin bills');
assert.equal(classify('Airbnb <automated@airbnb.com>','Reservation reminder - July 3, 2026').intent,'trip');
assert.equal(classify('Searoad Ferries <travel@searoad.com.au>','Confirmation for PRESTON - Reference # 4936812').intent,'trip');

assert.deepEqual(classify('Commonwealth Bank <No-reply@edm.cba.com.au>','Preston, book your next holiday with your CommBank credit card'),{
  intent:'ignore',confidence:0.99,reason:'marketing'
});
assert.equal(classify('pliability <billing@pliability.com>','Save money on your pliability subscription').intent,'ignore');
assert.equal(classify('"Marathon-Photos.com" <subscriptions@updates.marathon-photos.com>','Preston: your ASICS Gold Coast Marathon photos are now online').intent,'ignore','sender address words must not trigger subscription Life Admin');

assert.deepEqual(classify('Uber <no-reply@uber.com>','Reservation confirmed for Sunday 5 July'),{
  intent:'review',confidence:0.6,reason:'ambiguous_booking'
});
assert.deepEqual(classify('unknown@example.com','Booking confirmation'),{
  intent:'review',confidence:0.6,reason:'ambiguous_booking'
});
assert.equal(classify('Gold Coast Marathon <info@goldcoastmarathon.com.au>','Your ASICS Gold Coast Marathon Entry Confirmation').intent,'ignore','confirmation alone is not an actionable review signal');
assert.equal(classify('Ticketmaster <donotreply@mailings.ticketmaster.com.au>','Get ready for the AFC Women’s Asian Cup Australia 2026™').intent,'ignore');

assert.deepEqual(classify('billing@example.com','Your annual membership renewal is due 30 September 2026'),{
  intent:'life_admin',category:'membership',confidence:0.9,reason:'membership_renewal'
});
assert.equal(classify('admin@oneplayground.com.au','Membership Cancellation Request Outcome').intent,'ignore');
assert.equal(classify('CA ANZ <service@example.com>','Preston, thank you for renewing your membership').intent,'ignore','completed membership actions are not future Life Admin');

assert.deepEqual(classify('billing@example.com','Invoice 4412 payment due 30 September 2026'),{
  intent:'life_admin',category:'bill',confidence:0.9,reason:'bill_due'
});
assert.deepEqual(classify('Capital One <capitalone@notification.capitalone.com>','Your Venture X Card statement is ready','Statement balance: $70.00\nMinimum payment: $25.00\nPayment due date: October 07, 2026\nYou are currently enrolled in AutoPay.\nManage your subscription preferences.'),{
  intent:'life_admin',category:'bill',confidence:0.9,reason:'bill_due'
},'statement + due must outrank incidental subscription footer language');
assert.equal(classify('Kmart <orders@example.com>','Your Kmart Invoice #654798138').intent,'ignore','ordinary invoices/receipts are not actionable bills');
assert.equal(classify('Railway <billing@example.com>','Your receipt from Railway Corporation #2565-9473').intent,'ignore');

assert.equal(classify('Healius Pathology <no-reply@medway.com.au>','Your BUPA medical visa services results').intent,'ignore','medical results are not appointments');
assert.equal(classify('Insync Health Clinic <noreply@nookal.com>','Invoice: INV048513 - Preston Podolske').intent,'ignore','health sender identity alone must not create an appointment');
assert.equal(classify('random@gmail.com','message notification from medical portal').intent,'ignore');

assert.equal(classify('Australian Taxation Office <noreply@ato.gov.au>','Your 2025 lodgment receipt [SEC=OFFICIAL]').intent,'ignore');
assert.equal(classify('Service NSW <no-reply@service.nsw.gov.au>','Your Receipt for NSW Driver Licence Renewal').intent,'ignore');
assert.deepEqual(classify('Service NSW <no-reply@service.nsw.gov.au>','Driver licence renewal due 30 September 2026'),{
  intent:'life_admin',category:'government',confidence:0.9,reason:'government_admin'
});

assert.equal(classify('Vincent Wan <vincent@acumenstrata.com.au>','72942 227 Denison Road, Dulwich Hill | Smoking & Cigarette Butts').intent,'ignore');
assert.deepEqual(classify('Josephine <agent@example.com>','Lease Renewal Offer | 7/225 Denison Road'),{
  intent:'life_admin',category:'property',confidence:0.9,reason:'property_admin'
});

console.log('gmail intent tests passed');
