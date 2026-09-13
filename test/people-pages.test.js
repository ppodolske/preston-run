const assert = require('node:assert/strict');
const { renderPeoplePage, renderPersonFormPage } = require('../src/pages/people');

const people = [
  {id:'1',name:'Alice <Admin>',relationship:'Friend',birthday_month:5,birthday_day:12,birth_year:null,notes:'Likes & tea',active:true},
  {id:'2',name:'Bob',relationship:null,birthday_month:1,birthday_day:2,birth_year:1990,notes:null,active:false}
];
const upcoming = [{person:people[1],daysAway:1,ageTurning:37,date:new Date('2027-01-02T00:00:00Z')}];

const html = renderPeoplePage({people, upcoming, flash:'Changes saved.'});
assert.match(html, /preston-ai-logo\.png/);
assert.match(html, /People/);
assert.match(html, /Add person/);
assert.match(html, /Alice &lt;Admin&gt;/);
assert.match(html, /Likes &amp; tea/);
assert.match(html, /year unknown/);
assert.match(html, /turning 37/);
assert.match(html, /Inactive/);
assert.match(html, /\/people\/1\/edit/);
assert.doesNotMatch(html, /ppodolske@gmail\.com/);

const form = renderPersonFormPage({person:{id:'1',name:'Alice',relationship:'Friend',birthday_month:5,birthday_day:12,birth_year:'',notes:'Hello',active:false},mode:'edit',error:'Bad birthday'});
assert.match(form, /action="\/people\/1"/);
assert.match(form, /value="Alice"/);
assert.match(form, /value="5"/);
assert.match(form, /Bad birthday/);
assert.doesNotMatch(form, /name="active" value="1" checked/);
console.log('people page tests passed');
