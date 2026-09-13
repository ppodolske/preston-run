'use strict';

const {
  listCalendarConnections,
  listSelectedCalendarSources,
  listCalendarEventsForDigest
}=require('../data/calendars');
const {
  getMorningCalendarWindow,
  isCalendarEventDigestEligible,
  sortCalendarDigestEvents,
  isConnectionStale
}=require('../domain/calendars');

const defaultDeps={
  listConnections:listCalendarConnections,
  listSelectedSources:listSelectedCalendarSources,
  listEvents:listCalendarEventsForDigest
};

async function getCalendarDigest({supabase,userId,now=new Date(),deps={}}={}){
  if(!userId)throw new Error('userId is required');
  const d={...defaultDeps,...deps};
  const [connections,sources,rows]=await Promise.all([
    d.listConnections(supabase,userId),
    d.listSelectedSources(supabase,userId),
    d.listEvents(supabase,userId)
  ]);
  const selectedSourceIds=new Set((sources||[]).filter(x=>x.selected!==false).map(x=>x.id));
  if(selectedSourceIds.size===0)return{events:[],attentionNeeded:false};
  const connectionById=new Map((connections||[]).map(x=>[x.id,x]));
  const window=getMorningCalendarWindow(now);
  const eligible=(rows||[]).filter(row=>selectedSourceIds.has(row.calendar_source_id)&&isCalendarEventDigestEligible(row,window));
  let attentionNeeded=false;
  const fresh=[];
  for(const row of eligible){
    const connection=connectionById.get(row.connection_id);
    if(!connection||isConnectionStale(connection,now)){attentionNeeded=true;continue;}
    fresh.push(row);
  }
  return{events:sortCalendarDigestEvents(fresh,window),attentionNeeded};
}

module.exports={getCalendarDigest,defaultDeps};
