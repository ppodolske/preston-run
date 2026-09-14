'use strict';

const SYDNEY_TZ='Australia/Sydney';

function sydneyParts(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-AU',{
    timeZone:SYDNEY_TZ,
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).formatToParts(now);
  const out={};for(const p of parts)if(p.type!=='literal')out[p.type]=Number(p.value);return out;
}

function withinSydneyWindow(now,hour,minute=0,windowMinutes=15){
  const p=sydneyParts(now),current=p.hour*60+p.minute,start=hour*60+minute;
  return current>=start&&current<start+windowMinutes;
}

function sameSydneyDate(a,b){
  const x=sydneyParts(a),y=sydneyParts(b);
  return x.year===y.year&&x.month===y.month&&x.day===y.day;
}

module.exports={SYDNEY_TZ,sydneyParts,withinSydneyWindow,sameSydneyDate};
