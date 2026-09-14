'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function filesUnder(root){const out=[];for(const entry of fs.readdirSync(root,{withFileTypes:true})){const full=path.join(root,entry.name);if(entry.isDirectory())out.push(...filesUnder(full));else if(entry.isFile()&&/\.js$/.test(entry.name))out.push(full);}return out;}
const srcRoot=path.join(__dirname,'..','src');
const sources=filesUnder(srcRoot).map(file=>({file,text:fs.readFileSync(file,'utf8')}));
const joined=sources.map(row=>row.text).join('\n');

for(const forbidden of ['applyCreateTripFromGmail','inferTripInputFromFacts','Trip booking ','([A-Z0-9]{5,10})']){
  assert.equal(joined.includes(forbidden),false,`live source must not contain legacy Gmail trip behavior: ${forbidden}`);
}
for(const forbiddenImport of ["require('./gmail-trip-actions')","require('../domain/gmail-trip-extractor')","require('../domain/gmail-trip-matcher')","require('../domain/gmail-decisions')"]){
  assert.equal(joined.includes(forbiddenImport),false,`legacy Gmail trip module must stay retired: ${forbiddenImport}`);
}

const reconstructionService=fs.readFileSync(path.join(srcRoot,'services','gmail-trip-reconstruction.js'),'utf8');
const reconstructionJob=fs.readFileSync(path.join(srcRoot,'jobs','gmail-trip-reconstruction.js'),'utf8');
for(const text of [reconstructionService,reconstructionJob]){
  assert.equal(/\bdeleteTrip\b/.test(text),false,'reconstruction must not gain a trip deletion path');
  assert.equal(/\.delete\s*\(/.test(text),false,'reconstruction must remain non-deleting');
}

const bookingRoute=fs.readFileSync(path.join(srcRoot,'routes','bookings.js'),'utf8');
assert.equal(bookingRoute.includes('/trips/null'),false,'unlinked bookings must never redirect to /trips/null');

console.log('v0.13.0 static safety tests passed');
