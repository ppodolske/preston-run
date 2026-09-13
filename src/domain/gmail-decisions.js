function hasManualConflict(facts,manualFields){
  for(const fact of facts){
    if(fact.fact_type==='trip.flight'&&manualFields.has('flightNumber'))return true;
    if(fact.fact_type==='trip.accommodation'&&manualFields.has('accommodation'))return true;
    if(fact.fact_type==='trip.cancellation'&&manualFields.has('status'))return true;
  }
  return false;
}

function decideGmailTripActions({facts,match,manualFields}){
  if(!facts.length)return [{type:'ignore',reason:'no_trip_facts'}];
  if(match.kind==='automatic'){
    if(hasManualConflict(facts,manualFields))return [{type:'review',reviewType:'resolve_conflict',tripId:match.tripId,recommendedAction:null,reason:'gmail_conflicts_with_manual_field'}];
    return [{type:'update_trip',tripId:match.tripId,facts,automatic:true,reasons:match.reasons}];
  }
  if(match.kind==='review')return [{type:'review',reviewType:'confirm_match',facts,recommendedAction:null,reason:'weak_match'}];
  return [{type:'create_trip',facts,automatic:true,reason:'high_confidence_new_trip'}];
}
module.exports={decideGmailTripActions,hasManualConflict};
