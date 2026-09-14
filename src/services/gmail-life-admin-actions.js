const lifeAdminDefault=require('../data/life-admin');
const {recordGmailActivity}=require('../data/gmail-sources');
const reviewDefault=require('../data/gmail-reviews');

function sourceMetadata(source={},classification={}){
  return {
    source:'gmail',
    source_record_id:source.id||null,
    gmail_message_id:source.gmail_message_id||null,
    gmail_thread_id:source.gmail_thread_id||null,
    source_link:source.source_link||null,
    sender:source.sender||null,
    classification_reason:classification.reason||null
  };
}

function reviewInput(source={},classification={}){
  const subject=String(source.subject||'Gmail item').trim()||'Gmail item';
  const sender=String(source.sender||'unknown sender').trim();
  return {
    title:`Review Gmail: ${subject}`.slice(0,240),
    category:'other',
    status:'needs_action',
    due_at:null,
    starts_at:null,
    recurrence_rule:null,
    priority:'normal',
    notes:`Gmail could not confidently classify this item from ${sender}. Review the original email before taking action.`,
    linked_person_id:null
  };
}

function canonicalReviewType(classification={}){
  const reason=String(classification.reason||'');
  if(reason==='resolve_conflict')return 'resolve_conflict';
  if(reason==='confirm_match')return 'confirm_match';
  if(reason==='review_unreadable_source'||reason==='unreadable_source')return 'review_unreadable_source';
  return 'confirm_new_item';
}

async function ensureItem(lifeAdminData,supabase,user,input,metadata){
  if(typeof lifeAdminData.ensureGmailLifeItem==='function')return lifeAdminData.ensureGmailLifeItem(supabase,user,input,metadata);
  return {item:await lifeAdminData.createGmailLifeItem(supabase,user,input,metadata),created:true};
}

function buildGmailLifeAdminActions({supabase,userId,lifeAdminData=lifeAdminDefault,gmailData={recordGmailActivity},reviewData=reviewDefault,ruleVersion='gmail-life-admin-actions-v0.12.4'}={}){
  const user={id:userId};
  return {
    async createLifeAdminItem(source,candidate,classification={}){
      const ensured=await ensureItem(lifeAdminData,supabase,user,candidate,sourceMetadata(source,classification));
      const item=ensured.item;
      if(ensured.created&&gmailData&&typeof gmailData.recordGmailActivity==='function'){
        await gmailData.recordGmailActivity(supabase,userId,{sourceRecordId:source.id,entityType:'life_item',entityId:item&&item.id,action:'create',oldValue:null,newValue:item,ruleVersion});
      }
      return item;
    },
    async createReviewItem(source,classification={}){
      const input=reviewInput(source,classification);
      const ensured=await ensureItem(lifeAdminData,supabase,user,input,sourceMetadata(source,classification));
      const item=ensured.item;
      if(!ensured.created)return item;
      if(reviewData&&typeof reviewData.createGmailReviewLink==='function'){
        await reviewData.createGmailReviewLink(supabase,userId,{
          sourceRecordId:source.id,
          reviewItemId:item.id,
          reviewType:canonicalReviewType(classification),
          recommendedAction:'review_email',
          gmailValue:{sender:source.sender||null,subject:source.subject||null,sourceLink:source.source_link||null,classificationReason:classification.reason||null}
        });
      }
      if(gmailData&&typeof gmailData.recordGmailActivity==='function'){
        await gmailData.recordGmailActivity(supabase,userId,{sourceRecordId:source.id,entityType:'gmail_review',entityId:item&&item.id,action:'create',oldValue:null,newValue:item,ruleVersion});
      }
      return item;
    }
  };
}

module.exports={buildGmailLifeAdminActions,sourceMetadata,reviewInput,canonicalReviewType,ensureItem};
