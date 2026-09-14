const lifeAdminDefault=require('../data/life-admin');
const tripDefault=require('../data/trips');
const {recordGmailActivity}=require('../data/gmail-sources');
const reviewDefault=require('../data/gmail-reviews');
const {proposeTripLink}=require('../domain/trip-linker');

const ENRICH_FIELDS=['title','category','status','due_at','starts_at','ends_at','time_zone','recurrence_rule','priority','notes','linked_person_id','location','provider','confirmation_reference','booking_url'];
function sourceMetadata(source={},classification={}){return{source:'gmail',source_record_id:source.id||null,gmail_message_id:source.gmail_message_id||null,gmail_thread_id:source.gmail_thread_id||null,source_link:source.source_link||null,sender:source.sender||null,classification_reason:classification.reason||null};}
function reviewInput(source={},classification={}){const subject=String(source.subject||'Gmail item').trim()||'Gmail item',sender=String(source.sender||'unknown sender').trim();return{title:`Review Gmail: ${subject}`.slice(0,240),category:'other',status:'needs_action',due_at:null,starts_at:null,recurrence_rule:null,priority:'normal',notes:`Gmail could not confidently classify this item from ${sender}. Review the original email before taking action.`,linked_person_id:null};}
function canonicalReviewType(classification={}){const reason=String(classification.reason||'');if(reason==='resolve_conflict')return'resolve_conflict';if(reason==='confirm_match')return'confirm_match';if(reason==='review_unreadable_source'||reason==='unreadable_source')return'review_unreadable_source';return'confirm_new_item';}
async function ensureItem(lifeAdminData,supabase,user,input,metadata){if(typeof lifeAdminData.ensureGmailLifeItem==='function')return lifeAdminData.ensureGmailLifeItem(supabase,user,input,metadata);return{item:await lifeAdminData.createGmailLifeItem(supabase,user,input,metadata),created:true};}
function manualFields(item={}){return new Set(Array.isArray(item.source_metadata&&item.source_metadata.manual_fields)?item.source_metadata.manual_fields:[]);}
function sameValue(a,b){return(a??null)===(b??null);}
function enrichmentPatch(item={},candidate={}){const protectedFields=manualFields(item),patch={};for(const field of ENRICH_FIELDS){if(!Object.hasOwn(candidate,field)||protectedFields.has(field)||sameValue(item[field],candidate[field]))continue;patch[field]=candidate[field];}return patch;}
async function recordActivity(gmailData,supabase,userId,entry){if(gmailData&&typeof gmailData.recordGmailActivity==='function')return gmailData.recordGmailActivity(supabase,userId,entry);return null;}

function buildGmailLifeAdminActions({supabase,userId,lifeAdminData=lifeAdminDefault,tripData=tripDefault,gmailData={recordGmailActivity},reviewData=reviewDefault,tripLinker=proposeTripLink,ruleVersion='gmail-life-admin-actions-v0.14.0'}={}){
  const user={id:userId};
  return {
    async createLifeAdminItem(source,candidate,classification={}){
      const metadata=sourceMetadata(source,classification),ensured=await ensureItem(lifeAdminData,supabase,user,candidate,metadata);let item=ensured.item;
      if(ensured.created){await recordActivity(gmailData,supabase,userId,{sourceRecordId:source.id,entityType:'life_item',entityId:item&&item.id,action:'create',oldValue:null,newValue:item,ruleVersion});}
      else if(item&&typeof lifeAdminData.updateLifeItemFromGmail==='function'){
        const patch=enrichmentPatch(item,candidate);
        if(Object.keys(patch).length){const previous=item;item=await lifeAdminData.updateLifeItemFromGmail(supabase,user,item.id,patch,metadata)||item;await recordActivity(gmailData,supabase,userId,{sourceRecordId:source.id,entityType:'life_item',entityId:item.id,action:'update',oldValue:previous,newValue:patch,ruleVersion});}
      }

      if(!item||candidate.category!=='event')return item;
      const protectedFields=manualFields(item);if(protectedFields.has('linked_trip_id')||item.linked_trip_id)return item;
      const trips=tripData&&typeof tripData.listTrips==='function'?await tripData.listTrips(supabase,user):[];
      const activeTrips=(trips||[]).filter(t=>!t.archived_at);
      const linkDecision=tripLinker({subjectType:'event',subject:candidate,trips:activeTrips});
      if(linkDecision.kind==='link'&&linkDecision.tripId&&typeof lifeAdminData.updateLifeItemFromGmail==='function'){
        const oldTrip=item.linked_trip_id||null;item=await lifeAdminData.updateLifeItemFromGmail(supabase,user,item.id,{linked_trip_id:linkDecision.tripId},metadata)||item;
        await recordActivity(gmailData,supabase,userId,{sourceRecordId:source.id,entityType:'life_item',entityId:item.id,fieldName:'linked_trip_id',action:'update',oldValue:oldTrip,newValue:linkDecision.tripId,ruleVersion});
      }else if(linkDecision.kind==='review'&&ensured.created&&reviewData&&typeof reviewData.createGmailReviewLink==='function'){
        await reviewData.createGmailReviewLink(supabase,userId,{sourceRecordId:source.id,reviewItemId:item.id,reviewType:'confirm_match',recommendedAction:'link_trip',gmailValue:{sender:source.sender||null,subject:source.subject||null,sourceLink:source.source_link||null,tripId:linkDecision.tripId||null,score:linkDecision.score,reasons:linkDecision.reasons||[]}});
      }
      return item;
    },
    async createReviewItem(source,classification={}){
      const input=reviewInput(source,classification),ensured=await ensureItem(lifeAdminData,supabase,user,input,sourceMetadata(source,classification)),item=ensured.item;if(!ensured.created)return item;
      if(reviewData&&typeof reviewData.createGmailReviewLink==='function')await reviewData.createGmailReviewLink(supabase,userId,{sourceRecordId:source.id,reviewItemId:item.id,reviewType:canonicalReviewType(classification),recommendedAction:'review_email',gmailValue:{sender:source.sender||null,subject:source.subject||null,sourceLink:source.source_link||null,classificationReason:classification.reason||null}});
      await recordActivity(gmailData,supabase,userId,{sourceRecordId:source.id,entityType:'gmail_review',entityId:item&&item.id,action:'create',oldValue:null,newValue:item,ruleVersion});return item;
    }
  };
}

module.exports={buildGmailLifeAdminActions,sourceMetadata,reviewInput,canonicalReviewType,ensureItem,manualFields,enrichmentPatch};