const EXCLUDED_LABELS=new Set(['SENT','DRAFT','SPAM','TRASH']);
function isEligibleReceivedMessage(message){
  const labels=message&&Array.isArray(message.labelIds)?message.labelIds:[];
  return !labels.some(label=>EXCLUDED_LABELS.has(label));
}
module.exports={isEligibleReceivedMessage,EXCLUDED_LABELS};
