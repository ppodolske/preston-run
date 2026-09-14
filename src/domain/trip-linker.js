'use strict';

function text(value){const v=String(value||'').trim();return v||null;}
function lower(value){return text(value)?.toLowerCase()||null;}
function day(value){return value?String(value).slice(0,10):null;}
function msDate(value){const d=day(value);return d?Date.parse(`${d}T00:00:00Z`):null;}
function subjectRange(subject={}){const start=msDate(subject.starts_at||subject.start_date);const end=msDate(subject.ends_at||subject.end_date)||start;return{start,end};}
function tripRange(trip={}){const start=msDate(trip.start_date);const end=msDate(trip.end_date)||start;return{start,end};}
function overlaps(a,b){return a.start!=null&&b.start!=null&&a.start<=b.end&&b.start<=a.end;}
function geoOf(subject={}){const g=subject.geography||{};return{label:text(g.label||subject.destination_label),city:text(g.city||subject.destination_city||subject.destination),region:text(g.region||subject.destination_region),country:text(g.country||subject.destination_country)};}
function tripGeo(trip={}){return{label:text(trip.destination_label),city:text(trip.destination_city),region:text(trip.destination_region),country:text(trip.destination_country)};}
function hasGeo(g){return Boolean(g.city||g.region||g.country||g.label);}
function same(a,b){return Boolean(lower(a)&&lower(b)&&lower(a)===lower(b));}
function geoConflict(subjectGeo,tripDestination){return Boolean(subjectGeo.country&&tripDestination.country&&!same(subjectGeo.country,tripDestination.country));}
function geoScore(subjectGeo,tripDestination){
  let score=0;const reasons=[];
  if(subjectGeo.country&&tripDestination.country&&same(subjectGeo.country,tripDestination.country)){score+=20;reasons.push('country_match');}
  if(subjectGeo.region&&tripDestination.region&&same(subjectGeo.region,tripDestination.region)){score+=15;reasons.push('region_match');}
  if(subjectGeo.city&&tripDestination.city&&same(subjectGeo.city,tripDestination.city)){score+=45;reasons.push('city_match');}
  if(!score&&subjectGeo.label&&tripDestination.label&&same(subjectGeo.label,tripDestination.label)){score+=50;reasons.push('label_match');}
  if(score)reasons.push('geography_match');
  return{score,reasons};
}
function locationLabel(g){if(g.label)return g.label;if(g.city&&g.region)return `${g.city}, ${g.region}`;if(g.city&&g.country)return `${g.city}, ${g.country}`;return g.city||g.region||g.country||null;}
function compatibleGeo(a,b){if(geoConflict(a,b))return false;if(a.city&&b.city&&!same(a.city,b.city))return false;return Boolean((a.city&&b.city&&same(a.city,b.city))||(a.country&&b.country&&same(a.country,b.country))||(a.label&&b.label&&same(a.label,b.label))||(!hasGeo(a)&&!hasGeo(b)));
}
function combinedRange(subject,related=[]){const ranges=[subject,...related].map(subjectRange).filter(r=>r.start!=null);if(!ranges.length)return{start:null,end:null};return{start:Math.min(...ranges.map(r=>r.start)),end:Math.max(...ranges.map(r=>r.end??r.start))};}
function isoDay(ms){return ms==null?null:new Date(ms).toISOString().slice(0,10);}
function buildProposedTrip(subject,related=[],reason='strong_booking_evidence'){
  const g=geoOf(subject);const relatedGeo=related.map(geoOf).find(x=>hasGeo(x));const chosen=hasGeo(g)?g:relatedGeo||g;const range=combinedRange(subject,related);const label=locationLabel(chosen)||'Travel';
  return{title:label,status:'planning',start_date:isoDay(range.start),end_date:isoDay(range.end),destination_label:label,destination_city:chosen.city||null,destination_region:chosen.region||null,destination_country:chosen.country||null,notes:null,automation_managed:true,automation_reason:reason};
}
function isStrongAccommodation(subject){const r=subjectRange(subject),g=geoOf(subject);return subject.booking_type==='accommodation'&&r.start!=null&&r.end!=null&&r.end>r.start&&hasGeo(g);}
function isStrongRoundTrip(subject){const r=subjectRange(subject),g=geoOf(subject);return ['flight','transport'].includes(subject.booking_type)&&r.start!=null&&r.end!=null&&r.end>r.start&&Boolean(subject.destination)&&hasGeo(g);}
function relatedCluster(subject,related=[]){
  if(!related.length)return false;const g=geoOf(subject);const compatible=related.filter(row=>compatibleGeo(g,geoOf(row))||(!hasGeo(g)&&hasGeo(geoOf(row))));if(!compatible.length)return false;
  const range=combinedRange(subject,compatible);return range.start!=null&&range.end!=null&&range.end>range.start;
}

function evaluateTrip(subjectType,subject,trip){
  const sRange=subjectRange(subject),tRange=tripRange(trip),sGeo=geoOf(subject),tGeo=tripGeo(trip);const reasons=[];let score=0;
  if(!overlaps(sRange,tRange))return{trip,score:-100,reasons:['date_mismatch'],eligible:false};
  score+=40;reasons.push('date_overlap');
  if(geoConflict(sGeo,tGeo))return{trip,score:-80,reasons:[...reasons,'country_conflict'],eligible:false,conflict:true};
  if(!hasGeo(tGeo)){
    reasons.push(trip.automation_managed?'generated_trip_missing_geography':'manual_trip_missing_geography');
    return{trip,score,reasons,eligible:false,review:true};
  }
  if(subjectType==='event'&&!hasGeo(sGeo))return{trip,score,reasons:[...reasons,'event_geography_required'],eligible:false,review:true};
  const geo=geoScore(sGeo,tGeo);score+=geo.score;reasons.push(...geo.reasons);
  if(subjectType==='event'&&geo.score<40)return{trip,score,reasons:[...reasons,'event_geography_required'],eligible:false,review:true};
  return{trip,score,reasons,eligible:geo.score>0};
}

function proposeTripLink({subjectType='booking',subject={},trips=[],relatedBookings=[]}={}){
  const evaluations=trips.map(trip=>evaluateTrip(subjectType,subject,trip));
  const conflicts=evaluations.filter(e=>e.conflict);
  const eligible=evaluations.filter(e=>e.eligible).sort((a,b)=>{
    if(Boolean(a.trip.automation_managed)!==Boolean(b.trip.automation_managed))return a.trip.automation_managed?1:-1;
    return b.score-a.score;
  });
  if(eligible.length){const best=eligible[0];return{kind:'link',tripId:best.trip.id,score:best.score,reasons:best.reasons,proposedTrip:null};}
  const reviewMatches=evaluations.filter(e=>e.review).sort((a,b)=>b.score-a.score);
  if(reviewMatches.length){const best=reviewMatches[0];return{kind:'review',tripId:best.trip.id,score:best.score,reasons:best.reasons,proposedTrip:null};}
  if(conflicts.length){const best=conflicts[0];return{kind:'review',tripId:best.trip.id,score:best.score,reasons:best.reasons,proposedTrip:null};}

  if(subjectType==='event')return{kind:'review',tripId:null,score:20,reasons:['no_compatible_trip','event_requires_existing_trip'],proposedTrip:null};
  if(isStrongAccommodation(subject))return{kind:'create',tripId:null,score:90,reasons:['strong_accommodation','strong_geography','strong_trip_dates'],proposedTrip:buildProposedTrip(subject,[],'strong_accommodation')};
  if(isStrongRoundTrip(subject))return{kind:'create',tripId:null,score:90,reasons:['round_trip_itinerary','strong_geography','strong_trip_dates'],proposedTrip:buildProposedTrip(subject,[],'round_trip_itinerary')};
  if(relatedCluster(subject,relatedBookings))return{kind:'create',tripId:null,score:85,reasons:['related_booking_cluster','strong_geography','strong_trip_dates'],proposedTrip:buildProposedTrip(subject,relatedBookings,'related_booking_cluster')};
  if(subject.booking_type==='activity')return{kind:'review',tripId:null,score:25,reasons:['isolated_activity','no_compatible_trip'],proposedTrip:null};
  const r=subjectRange(subject);if(r.start!=null&&r.end===r.start)return{kind:'review',tripId:null,score:30,reasons:['insufficient_trip_dates','no_compatible_trip'],proposedTrip:null};
  return{kind:'none',tripId:null,score:0,reasons:['insufficient_evidence'],proposedTrip:null};
}

module.exports={proposeTripLink,geoOf,tripGeo,subjectRange,overlaps,compatibleGeo};
