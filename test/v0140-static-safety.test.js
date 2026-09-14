'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const pkg=require('../package.json');
const {VERSION}=require('../src/branding');

const root=path.join(__dirname,'..');
const src=path.join(root,'src');
assert.equal(pkg.version,'0.14.0','package version must be v0.14.0');
assert.equal(VERSION,'0.14.0','runtime branding version must be v0.14.0');

const enrichmentFiles=[
  path.join(src,'services','gmail-booking-enrichment.js'),
  path.join(src,'jobs','gmail-booking-enrichment.js')
];
for(const file of enrichmentFiles){
  const text=fs.readFileSync(file,'utf8');
  for(const forbidden of ['deleteTrip','createGeneratedTrip','createTrip','updateTrip','runGmailTripReconstruction','listLegacyTripCreateActivities','gmail-trip-reconstruction']){
    assert.equal(text.includes(forbidden),false,`${path.basename(file)} must not gain Trip mutation or historical replay capability: ${forbidden}`);
  }
  assert.equal(/\.from\(\s*['"]gmail_source_records['"]\s*\)/.test(text),false,`${path.basename(file)} must only use canonical Booking source links, not query general Gmail history`);
}

const tripRoutes=fs.readFileSync(path.join(src,'routes','trips.js'),'utf8');
assert.equal(/req\.method\s*===\s*['"]GET['"]\s*&&\s*(?:archive|unarchive)\b/.test(tripRoutes),false,'archive mutations must never be GET handlers');
const postGate=tripRoutes.indexOf("if(req.method!=='POST')");
const archiveHandler=tripRoutes.indexOf("const archive=url.pathname.match(/^\\/trips\\/([^/]+)\\/archive$/)");
const unarchiveHandler=tripRoutes.indexOf("const unarchive=url.pathname.match(/^\\/trips\\/([^/]+)\\/unarchive$/)");
assert.ok(postGate>=0&&archiveHandler>postGate&&unarchiveHandler>postGate,'archive and unarchive handlers must sit behind the POST gate');

console.log('v0.14.0 static safety tests passed');
