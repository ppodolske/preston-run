function factValues(facts,type){return facts.filter(f=>f.fact_type===type).map(f=>f.fact_value);}
function rankTripMatch(facts,existingTrips=[]){
  const refs=factValues(facts,'trip.booking_reference').map(v=>String(v.reference||'').toUpperCase()).filter(Boolean);
  for(const trip of existingTrips){
    const tripRefs=(trip.bookingReferences||[]).map(v=>String(v).toUpperCase());
    if(refs.some(ref=>tripRefs.includes(ref)))return {kind:'automatic',tripId:trip.id,score:0.99,reasons:['exact_booking_reference']};
  }
  return {kind:facts.length?'review':'none',tripId:null,score:facts.length?0.45:0,reasons:facts.length?['weak_trip_evidence']:[]};
}
module.exports={rankTripMatch};
