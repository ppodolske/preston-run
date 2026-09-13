function referenceFromFacts(facts){
  const fact=facts.find(item=>item.fact_type==='trip.booking_reference'&&item.fact_value&&item.fact_value.reference);
  return fact?String(fact.fact_value.reference).toUpperCase():null;
}

function hasCancellation(facts){return facts.some(item=>item.fact_type==='trip.cancellation');}

function inferTripInputFromFacts(facts){
  const reference=referenceFromFacts(facts);
  const cancelled=hasCancellation(facts);
  return {
    title:reference?`Trip booking ${reference}`:'Gmail trip',
    status:cancelled?'cancelled':'planning',
    notes:reference?`Created from Gmail booking reference ${reference}.`:'Created from Gmail evidence.'
  };
}

function buildGmailTripActions({supabase,userId,tripData,gmailData,reviewData,ruleVersion='gmail-trip-actions-v0.12.0'}={}){
  const user={id:userId};
  return {
    async getManualFieldsForMatch(match){
      if(tripData&&typeof tripData.getManualFieldsForTrip==='function'&&match&&match.tripId){
        return tripData.getManualFieldsForTrip(supabase,user,match.tripId);
      }
      return new Set();
    },
    async applyCreateTripFromGmail(decision){
      if(!tripData||typeof tripData.createTrip!=='function')return null;
      const trip=await tripData.createTrip(supabase,user,inferTripInputFromFacts(decision.facts||[]));
      if(gmailData&&typeof gmailData.recordGmailActivity==='function'){
        await gmailData.recordGmailActivity(supabase,userId,{sourceRecordId:decision.sourceRecordId,entityType:'trip',entityId:trip&&trip.id,action:'create',oldValue:null,newValue:trip,ruleVersion});
      }
      return trip;
    },
    async applyUpdateTripFromGmail(decision){
      if(!gmailData||typeof gmailData.recordGmailActivity!=='function')return null;
      return gmailData.recordGmailActivity(supabase,userId,{sourceRecordId:decision.sourceRecordId,entityType:'trip',entityId:decision.tripId,action:'update',oldValue:null,newValue:{facts:decision.facts||[]},ruleVersion});
    },
    async createGmailReviewItem(decision){
      if(reviewData&&typeof reviewData.createGmailReviewItem==='function')return reviewData.createGmailReviewItem(supabase,user,decision);
      if(gmailData&&typeof gmailData.recordGmailActivity==='function'){
        return gmailData.recordGmailActivity(supabase,userId,{sourceRecordId:decision.sourceRecordId,entityType:'gmail_review',entityId:null,action:'skip',oldValue:null,newValue:{reviewType:decision.reviewType,reason:decision.reason},ruleVersion});
      }
      return null;
    },
    async recordGmailActivity(entry){
      if(!gmailData||typeof gmailData.recordGmailActivity!=='function')return null;
      return gmailData.recordGmailActivity(supabase,userId,{...entry,ruleVersion:entry.ruleVersion||ruleVersion});
    }
  };
}

module.exports={buildGmailTripActions,inferTripInputFromFacts,referenceFromFacts};
