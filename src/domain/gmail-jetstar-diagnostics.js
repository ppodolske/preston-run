'use strict';

const JETSTAR_ROW_PATTERN=/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{1,2}:\d{2}(?:am|pm))(?:\s*\/\s*\d{1,2}:\d{2})?\s+(JQ\d{2,4})\b/gi;
const JETSTAR_ROUTE_PATTERN=/Flight\s*#(\d+)\s*:\s*([A-Za-z][A-Za-z .'-]*?)(?:\s*\([^)]*\))?\s*>\s*([A-Za-z][A-Za-z .'-]*?)(?:\s*\([^)]*\))?(?=\s+Flight\s*#\d+\s*:|\s+Jetstar\b|\s+International\b|\s+Baggage\s+Information\b|$)/gi;

function countMatches(value,pattern){return [...String(value||'').matchAll(new RegExp(pattern.source,pattern.flags))].length;}
function markerIndex(lower,marker){return lower.indexOf(marker.toLowerCase());}
function jetstarDiagnostics(text,{maxLength=null}={}){
  const value=String(text||''),lower=value.toLowerCase(),textLength=value.length;
  return{
    textLength,
    atMaxLength:Number.isFinite(Number(maxLength))&&Number(maxLength)>0?textLength>=Number(maxLength):false,
    hasJq223:lower.includes('jq223'),
    hasJq224:lower.includes('jq224'),
    hasFlight1:lower.includes('flight #1'),
    hasFlight2:lower.includes('flight #2'),
    hasBaggageInformation:lower.includes('baggage information'),
    flightRowCount:countMatches(value,JETSTAR_ROW_PATTERN),
    routeCount:countMatches(value,JETSTAR_ROUTE_PATTERN),
    jq223Index:markerIndex(lower,'jq223'),
    jq224Index:markerIndex(lower,'jq224'),
    flight1Index:markerIndex(lower,'flight #1'),
    flight2Index:markerIndex(lower,'flight #2'),
    baggageIndex:markerIndex(lower,'baggage information')
  };
}

module.exports={JETSTAR_ROW_PATTERN,JETSTAR_ROUTE_PATTERN,jetstarDiagnostics};
