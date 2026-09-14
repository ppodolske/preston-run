'use strict';

const JETSTAR_SCHEDULE_DATE_PATTERN=/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/gi;
const JETSTAR_TIME_PAIR_PATTERN=/\b\d{1,2}:\d{2}(?:am|pm)\s*\/\s*\d{1,2}:\d{2}\b/gi;
const JETSTAR_SERVICE_PATTERN=/\bJQ\d{2,4}\b/gi;
const JETSTAR_DATE_TIME_PAIR_PATTERN=/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{1,2}:\d{2}(?:am|pm)\s*\/\s*\d{1,2}:\d{2}\b/gi;
const JETSTAR_TIME_SERVICE_PATTERN=/\b\d{1,2}:\d{2}(?:am|pm)\s*\/\s*\d{1,2}:\d{2}\s+JQ\d{2,4}\b/gi;
const JETSTAR_ROW_PATTERN=/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{1,2}:\d{2}(?:am|pm))(?:\s*\/\s*\d{1,2}:\d{2})?\s+(JQ\d{2,4})\b/gi;
const JETSTAR_ROUTE_PATTERN=/Flight\s*#(\d+)\s*:\s*([A-Za-z][A-Za-z .'-]*?)(?:\s*\([^)]*\))?\s*>\s*([A-Za-z][A-Za-z .'-]*?)(?:\s*\([^)]*\))?(?=\s+Flight\s*#\d+\s*:|\s+Jetstar\b|\s+International\b|\s+Baggage\s+Information\b|$)/gi;

function matches(value,pattern){return [...String(value||'').matchAll(new RegExp(pattern.source,pattern.flags))];}
function countMatches(value,pattern){return matches(value,pattern).length;}
function markerIndex(lower,marker){return lower.indexOf(marker.toLowerCase());}
function previousMatch(value,pattern,beforeIndex){
  let previous=null;
  for(const match of matches(value,pattern)){
    if(match.index>=beforeIndex)break;
    previous=match;
  }
  return previous;
}
function serviceGapDiagnostics(value,serviceIndex){
  if(serviceIndex<0)return{previousDateDistance:-1,previousTimeDistance:-1,previousDateGapHasNonWhitespace:null,previousTimeGapHasNonWhitespace:null};
  const date=previousMatch(value,JETSTAR_SCHEDULE_DATE_PATTERN,serviceIndex);
  const time=previousMatch(value,JETSTAR_TIME_PAIR_PATTERN,serviceIndex);
  return{
    previousDateDistance:date?serviceIndex-date.index:-1,
    previousTimeDistance:time?serviceIndex-time.index:-1,
    previousDateGapHasNonWhitespace:date&&time&&time.index>=date.index+date[0].length?/\S/.test(value.slice(date.index+date[0].length,time.index)):null,
    previousTimeGapHasNonWhitespace:time?/\S/.test(value.slice(time.index+time[0].length,serviceIndex)):null
  };
}
function jetstarDiagnostics(text,{maxLength=null}={}){
  const value=String(text||''),lower=value.toLowerCase(),textLength=value.length;
  const jq223Index=markerIndex(lower,'jq223'),jq224Index=markerIndex(lower,'jq224');
  const jq223Gap=serviceGapDiagnostics(value,jq223Index),jq224Gap=serviceGapDiagnostics(value,jq224Index);
  return{
    textLength,
    atMaxLength:Number.isFinite(Number(maxLength))&&Number(maxLength)>0?textLength>=Number(maxLength):false,
    hasJq223:jq223Index>=0,
    hasJq224:jq224Index>=0,
    hasFlight1:lower.includes('flight #1'),
    hasFlight2:lower.includes('flight #2'),
    hasBaggageInformation:lower.includes('baggage information'),
    flightRowCount:countMatches(value,JETSTAR_ROW_PATTERN),
    routeCount:countMatches(value,JETSTAR_ROUTE_PATTERN),
    scheduleDateCount:countMatches(value,JETSTAR_SCHEDULE_DATE_PATTERN),
    timePairCount:countMatches(value,JETSTAR_TIME_PAIR_PATTERN),
    serviceNumberCount:countMatches(value,JETSTAR_SERVICE_PATTERN),
    dateTimePairCount:countMatches(value,JETSTAR_DATE_TIME_PAIR_PATTERN),
    timeServiceCount:countMatches(value,JETSTAR_TIME_SERVICE_PATTERN),
    jq223PreviousDateDistance:jq223Gap.previousDateDistance,
    jq223PreviousTimeDistance:jq223Gap.previousTimeDistance,
    jq223PreviousDateGapHasNonWhitespace:jq223Gap.previousDateGapHasNonWhitespace,
    jq223PreviousTimeGapHasNonWhitespace:jq223Gap.previousTimeGapHasNonWhitespace,
    jq224PreviousDateDistance:jq224Gap.previousDateDistance,
    jq224PreviousTimeDistance:jq224Gap.previousTimeDistance,
    jq224PreviousDateGapHasNonWhitespace:jq224Gap.previousDateGapHasNonWhitespace,
    jq224PreviousTimeGapHasNonWhitespace:jq224Gap.previousTimeGapHasNonWhitespace,
    jq223Index,
    jq224Index,
    flight1Index:markerIndex(lower,'flight #1'),
    flight2Index:markerIndex(lower,'flight #2'),
    baggageIndex:markerIndex(lower,'baggage information')
  };
}

module.exports={JETSTAR_ROW_PATTERN,JETSTAR_ROUTE_PATTERN,jetstarDiagnostics};
