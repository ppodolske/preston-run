const BASE='https://gmail.googleapis.com/gmail/v1/users/me';

function buildEligibleMessagesQuery({after,before}){
  const parts=[];
  if(after)parts.push(`after:${after}`);
  if(before)parts.push(`before:${before}`);
  parts.push('-in:sent','-in:drafts','-in:spam','-in:trash');
  return parts.join(' ');
}

async function readJson(response){
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    const err=new Error(body.error?.message||`Gmail API failed with ${response.status}`);
    err.status=response.status;
    err.body=body;
    throw err;
  }
  return body;
}

function createGmailProvider({fetch,accessToken}){
  if(!fetch)throw new Error('fetch is required');
  if(!accessToken)throw new Error('accessToken is required');
  const request=async(path,params={})=>{
    const url=new URL(`${BASE}${path}`);
    for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null)url.searchParams.set(key,value);
    return readJson(await fetch(url.toString(),{method:'GET',headers:{Authorization:`Bearer ${accessToken}`}}));
  };
  return {
    listMessages(query,pageToken){return request('/messages',{q:query,pageToken,maxResults:100});},
    getMessage(messageId){return request(`/messages/${encodeURIComponent(messageId)}`,{format:'full'});},
    getAttachment(messageId,attachmentId){return request(`/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);}
  };
}

module.exports={buildEligibleMessagesQuery,createGmailProvider};
