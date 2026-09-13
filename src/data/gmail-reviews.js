function throwIfError(error){if(error)throw error;}

async function createGmailReviewLink(supabase,userId,input={}){
  if(!userId)throw new Error('Authenticated user is required');
  const row={
    user_id:userId,
    source_record_id:input.sourceRecordId||null,
    fact_id:input.factId||null,
    review_item_id:input.reviewItemId,
    review_type:input.reviewType,
    recommended_action:input.recommendedAction||null,
    current_value:input.currentValue??null,
    gmail_value:input.gmailValue??null
  };
  const {data,error}=await supabase.from('gmail_review_links').insert(row).select('*').single();
  throwIfError(error);
  return data;
}

module.exports={createGmailReviewLink};
