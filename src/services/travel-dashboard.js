'use strict';
const bookingDataDefault=require('../data/bookings');
const lifeAdminDataDefault=require('../data/life-admin');
const bookingLegDataDefault=require('../data/booking-legs');
const {bookingSummaryTokens,eventSummaryTokens,travelTypeInventory}=require('../domain/travel-presenter');

function groupBy(rows,key){const map=new Map();for(const row of rows||[]){const id=row&&row[key];if(!id)continue;if(!map.has(id))map.set(id,[]);map.get(id).push(row);}return map;}
function itemTime(item){const value=item&&item.record&&item.record.starts_at;return value?Date.parse(value):Infinity;}
function sortItems(items){return items.sort((a,b)=>itemTime(a)-itemTime(b)||Number(a.record.position||1)-Number(b.record.position||1)||String(a.title||'').localeCompare(String(b.title||'')));}
async function loadTravelDashboard({supabase,user,trips=[],bookingData=bookingDataDefault,lifeAdminData=lifeAdminDataDefault,bookingLegData=bookingLegDataDefault}={}){
  const tripIds=(trips||[]).map(t=>t.id).filter(Boolean);if(!tripIds.length)return[];
  const bookings=await bookingData.listBookingsByTripIds(supabase,user,tripIds);const events=await lifeAdminData.listLifeItemsByTripIds(supabase,user,tripIds);const bookingIds=bookings.map(b=>b.id).filter(Boolean);const legs=await bookingLegData.listBookingLegsByBookingIds(supabase,user,bookingIds);
  const bookingsByTrip=groupBy(bookings,'trip_id'),eventsByTrip=groupBy(events,'linked_trip_id'),legsByBooking=groupBy(legs,'booking_id');
  return trips.map(trip=>{const tripBookings=bookingsByTrip.get(trip.id)||[],tripEvents=eventsByTrip.get(trip.id)||[];const items=[];for(const booking of tripBookings)items.push({type:'booking',id:booking.id,title:booking.title,tokens:bookingSummaryTokens(booking,legsByBooking.get(booking.id)||[]),status:booking.status,record:booking});for(const event of tripEvents)items.push({type:'event',id:event.id,title:event.title,tokens:eventSummaryTokens(event),status:event.status,record:event});return{trip,inventory:travelTypeInventory({bookings:tripBookings,events:tripEvents}),items:sortItems(items)};});
}
module.exports={groupBy,sortItems,loadTravelDashboard};
