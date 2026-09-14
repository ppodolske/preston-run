'use strict';

const bookingDataDefault=require('../data/bookings');
const bookingSourceDataDefault=require('../data/booking-sources');
const tripDataDefault=require('../data/trips');
const {recordGmailActivity}=require('../data/gmail-sources');
const {proposeTripLink:proposeTripLinkDefault}=require('../domain/trip-linker');

function bookingInput(candidate={}){
  return {
    trip_id:candidate.trip_id||null,
    segment_id:null,
    position:1,
    booking_type:candidate.booking_type||'other',
    title:candidate.title||'Travel booking',
    provider:candidate.provider||null,
    confirmation_reference:candidate.confirmation_reference||null,
    status:candidate.status||'confirmed',
    starts_at:candidate.starts_at||null,
    ends_at:candidate.ends_at||null,
    time_zone:candidate.time_zone||'Australia/Sydney',
    location:candidate.location||null,
    origin:candidate.origin||null,
    destination:candidate.destination||null,
    booking_url:candidate.booking_url||null,
    notes:null
  };
}
function extractionMetadata(candidate={},ruleVersion){return{source:'gmail',manual_fields:[],extractor_version:ruleVersion,extraction_confidence:candidate.confidence??null,geography:candidate.geography||null,evidence:Array.isArray(candidate.evidence)?candidate.evidence:[]};}
function manualTripLock(booking={}){const fields=new Set(Array.isArray(booking.source_metadata&&booking.source_metadata.manual_fields)?booking.source_metadata.manual_fields:[]);return{locked:fields.has('trip_id'),tripId:booking.trip_id||null};}

function buildGmailBookingActions({supabase,userId,bookingData=bookingDataDefault,bookingSourceData=bookingSourceDataDefault,tripData=tripDataDefault,gmailData={recordGmailActivity},reviewData=null,proposeTripLink=proposeTripLinkDefault,ruleVersion='gmail-booking-actions-v0.13.0'}={}){
  const user={id:userId};
  async function activity(entry){if(!gmailData||typeof gmailData.recordGmailActivity!=='function')return null;return gmailData.recordGmailActivity(supabase,userId,{...entry,ruleVersion:entry.ruleVersion||ruleVersion});}
  return {
    async processBooking({source,candidate,facts=[],trips=[],relatedBookings=[]}){
      const existing=await bookingSourceData.findCanonicalBookingForGmailCandidate(supabase,user,candidate,source);
      const tripLock=manualTripLock(existing||{});
      const input=bookingInput(candidate);
      if(tripLock.locked)delete input.trip_id;
      const metadata=extractionMetadata(candidate,ruleVersion);
      let booking;
      let created=false;
      if(existing){
        booking=await bookingData.updateBookingFromGmail(supabase,user,existing.id,input,metadata);
        await activity({sourceRecordId:source.id,entityType:'booking',entityId:existing.id,action:'update',oldValue:existing,newValue:booking});
      }else{
        booking=await bookingData.createBookingFromGmail(supabase,user,input,metadata);
        created=true;
        await activity({sourceRecordId:source.id,entityType:'booking',entityId:booking&&booking.id,action:'create',oldValue:null,newValue:booking});
      }
      await bookingSourceData.linkBookingSource(supabase,user,booking.id,source.id);

      if(tripLock.locked){
        const linkDecision=tripLock.tripId
          ?{kind:'link',tripId:tripLock.tripId,score:100,reasons:['manual_trip_assignment'],proposedTrip:null}
          :{kind:'none',tripId:null,score:100,reasons:['manual_trip_assignment'],proposedTrip:null};
        return{booking,created,linkDecision,facts};
      }

      const linkDecision=proposeTripLink({subjectType:'booking',subject:{...candidate,...booking},trips,relatedBookings});
      if(linkDecision.kind==='link'&&linkDecision.tripId){
        const before=booking;
        booking=await bookingData.updateBookingFromGmail(supabase,user,booking.id,{trip_id:linkDecision.tripId},{trip_link_reasons:linkDecision.reasons,trip_link_score:linkDecision.score});
        await activity({sourceRecordId:source.id,entityType:'booking',entityId:booking.id,fieldName:'trip_id',action:'update',oldValue:before&&before.trip_id||null,newValue:linkDecision.tripId});
      }else if(linkDecision.kind==='create'&&linkDecision.proposedTrip){
        const trip=await tripData.createGeneratedTrip(supabase,user,linkDecision.proposedTrip);
        await activity({sourceRecordId:source.id,entityType:'trip',entityId:trip&&trip.id,action:'create',oldValue:null,newValue:trip});
        const before=booking;
        booking=await bookingData.updateBookingFromGmail(supabase,user,booking.id,{trip_id:trip.id},{trip_link_reasons:linkDecision.reasons,trip_link_score:linkDecision.score});
        await activity({sourceRecordId:source.id,entityType:'booking',entityId:booking.id,fieldName:'trip_id',action:'update',oldValue:before&&before.trip_id||null,newValue:trip.id});
      }else if(linkDecision.kind==='review'){
        if(reviewData&&typeof reviewData.createReviewItem==='function')await reviewData.createReviewItem(source,linkDecision,{booking,candidate,facts});
        else await activity({sourceRecordId:source.id,entityType:'gmail_review',entityId:null,action:'skip',oldValue:null,newValue:{booking_id:booking.id,reasons:linkDecision.reasons,trip_id:linkDecision.tripId||null}});
      }
      return{booking,created,linkDecision,facts};
    }
  };
}

module.exports={buildGmailBookingActions,bookingInput,extractionMetadata,manualTripLock};
