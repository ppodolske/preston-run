const assert=require('node:assert/strict');

const apple=()=>require('../src/calendar/providers/apple-caldav.js');
const textResponse=(body,status=207,headers={})=>({ok:status>=200&&status<300,status,headers:{get:(name)=>headers[String(name).toLowerCase()]||headers[name]||null},text:async()=>body});

const principalXml=`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/12345/principal/</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>`;
const homeXml=`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/12345/principal/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>/12345/calendars/</d:href></c:calendar-home-set></d:prop></d:propstat></d:response></d:multistatus>`;
const calendarsXml=`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"><d:response><d:href>/12345/calendars/</d:href><d:propstat><d:prop><d:displayname>Calendars</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response><d:response><d:href>/12345/calendars/personal/</d:href><d:propstat><d:prop><d:displayname>Personal</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><a:calendar-color>#FF0000FF</a:calendar-color></d:prop></d:propstat></d:response><d:response><d:href>/12345/calendars/family/</d:href><d:propstat><d:prop><d:displayname>Family</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype></d:prop></d:propstat></d:response></d:multistatus>`;
const reportXml=`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/12345/calendars/personal/one.ics</d:href><d:propstat><d:prop><d:getetag>"1"</d:getetag><c:calendar-data><![CDATA[BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:series-1\r\nRECURRENCE-ID;TZID=Australia/Sydney:20260913T083000\r\nDTSTART;TZID=Australia/Sydney:20260913T083000\r\nDTEND;TZID=Australia/Sydney:20260913T091500\r\nSUMMARY:Dentist\r\nLOCATION:Clinic\r\nSTATUS:CONFIRMED\r\nURL:https://example.com/event\r\nATTENDEE;CN=Owner;PARTSTAT=ACCEPTED:mailto:owner@icloud.com\r\nEND:VEVENT\r\nEND:VCALENDAR]]></c:calendar-data></d:prop></d:propstat></d:response><d:response><d:href>/12345/calendars/personal/two.ics</d:href><d:propstat><d:prop><c:calendar-data><![CDATA[BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:all-day-1\r\nDTSTART;VALUE=DATE:20260914\r\nDTEND;VALUE=DATE:20260915\r\nSUMMARY:Birthday\r\nSTATUS:TENTATIVE\r\nATTENDEE;PARTSTAT=DECLINED:mailto:owner@icloud.com\r\nEND:VEVENT\r\nEND:VCALENDAR]]></c:calendar-data></d:prop></d:propstat></d:response></d:multistatus>`;

(async()=>{
  let mod;
  try{mod=apple();}catch(error){assert.fail(`Apple Calendar provider module required: ${error.message}`);}
  const credentials={email:'owner@icloud.com',appSpecificPassword:'abcd-efgh-ijkl-mnop'};

  {
    const calls=[];
    const responses=[textResponse(principalXml),textResponse(homeXml),textResponse(calendarsXml)];
    const fetch=async(url,options)=>{calls.push({url:String(url),options});return responses.shift();};
    const calendars=await mod.listCalendars(credentials,{fetch});
    assert.equal(calendars.length,2);
    assert.deepEqual(calendars[0],{id:'https://caldav.icloud.com/12345/calendars/personal/',href:'https://caldav.icloud.com/12345/calendars/personal/',name:'Personal',color:'#FF0000FF',readOnly:true});
    assert.equal(calendars[1].name,'Family');
    assert.equal(calls[0].url,'https://caldav.icloud.com/');
    assert.equal(calls[0].options.method,'PROPFIND');
    assert.equal(calls[0].options.headers.Depth,'0');
    assert.match(calls[0].options.body,/current-user-principal/);
    assert.equal(calls[1].url,'https://caldav.icloud.com/12345/principal/');
    assert.match(calls[1].options.body,/calendar-home-set/);
    assert.equal(calls[2].options.headers.Depth,'1');
    assert.match(calls[0].options.headers.Authorization,/^Basic /);
    assert.doesNotMatch(calls[0].options.headers.Authorization,/abcd-efgh/);
  }

  {
    const responses=[textResponse(principalXml),textResponse(homeXml),textResponse(calendarsXml)];
    const fetch=async()=>responses.shift();
    const result=await mod.validateAppleCredentials(credentials,{fetch});
    assert.equal(result.valid,true);
    assert.equal(result.calendars.length,2);
  }

  {
    const fetch=async()=>textResponse('Unauthorized',401);
    await assert.rejects(mod.validateAppleCredentials(credentials,{fetch}),error=>{
      assert.match(error.message,/Apple Calendar/i);
      assert.doesNotMatch(error.message,/owner@icloud\.com|abcd-efgh|Basic/i);
      return true;
    });
  }

  {
    const calls=[];
    const fetch=async(url,options)=>{calls.push({url:String(url),options});return textResponse(reportXml);};
    const events=await mod.listEventOccurrences({calendarHref:'https://caldav.icloud.com/12345/calendars/personal/',start:'2026-08-14T00:00:00.000Z',end:'2027-09-13T00:00:00.000Z',credentials,fetch});
    assert.equal(calls.length,1);
    assert.equal(calls[0].options.method,'REPORT');
    assert.equal(calls[0].options.headers.Depth,'1');
    assert.match(calls[0].options.body,/calendar-query/);
    assert.match(calls[0].options.body,/expand start="20260814T000000Z" end="20270913T000000Z"/);
    assert.match(calls[0].options.body,/time-range start="20260814T000000Z" end="20270913T000000Z"/);
    assert.equal(events.length,2);
    assert.equal(events[0].providerEventId,'series-1');
    assert.match(events[0].occurrenceKey,/series-1:/);
    assert.equal(events[0].seriesId,'series-1');
    assert.equal(events[0].title,'Dentist');
    assert.equal(events[0].allDay,false);
    assert.equal(events[0].timeZone,'Australia/Sydney');
    assert.equal(events[0].location,'Clinic');
    assert.equal(events[0].externalUrl,'https://example.com/event');
    assert.equal(events[0].status,'confirmed');
    assert.equal(events[0].ownerResponse,'accepted');
    assert.equal(events[1].allDay,true);
    assert.equal(events[1].startDate,'2026-09-14');
    assert.equal(events[1].endDate,'2026-09-15');
    assert.equal(events[1].status,'tentative');
    assert.equal(events[1].ownerResponse,'declined');
  }

  {
    const fetch=async()=>textResponse('',302,{location:'https://evil.example/steal'});
    await assert.rejects(mod.listCalendars(credentials,{fetch}),error=>{
      assert.match(error.message,/Apple Calendar/i);
      assert.doesNotMatch(error.message,/abcd-efgh|owner@icloud\.com/i);
      return true;
    });
  }

  {
    await assert.rejects(
      mod.listEventOccurrences({calendarHref:'http://caldav.icloud.com/123/cal/',start:'2026-01-01T00:00:00Z',end:'2026-02-01T00:00:00Z',credentials,fetch:async()=>{throw new Error('must not fetch');}}),
      /Apple Calendar/i
    );
    await assert.rejects(
      mod.listEventOccurrences({calendarHref:'https://evil.example/cal/',start:'2026-01-01T00:00:00Z',end:'2026-02-01T00:00:00Z',credentials,fetch:async()=>{throw new Error('must not fetch');}}),
      /Apple Calendar/i
    );
  }

  console.log('Apple Calendar provider tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
