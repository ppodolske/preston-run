const {classifyGmailIntent}=require('../domain/gmail-intent');
const {extractLifeAdminCandidate}=require('../domain/gmail-life-admin-extractor');

const TARGET_SCAN_IDS=Object.freeze([
  '9a06fdfc-7e7a-42e8-91df-49132cdb4350',
  'fbd21ea9-c07d-4b8a-a725-7f345486562e'
]);

function emptyResult(total=0){
  return {total,lifeAdminCreated:0,reviewCreated:0,tripSkipped:0,ignored:0,alreadyHandled:0,errors:0};
}

const defaultSleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function isRetryableGmailError(error){
  const status=Number(error&&error.status||0);
  return status===429||status>=500;
}

async function getMessageWithRetry(provider,messageId,{retryDelaysMs=[250,500,1000,2000],sleep=defaultSleep}={}){
  let retryIndex=0;
  while(true){
    try{return await provider.getMessage(messageId);}
    catch(error){
      if(!isRetryableGmailError(error)||retryIndex>=retryDelaysMs.length)throw error;
      await sleep(retryDelaysMs[retryIndex]);
      retryIndex+=1;
    }
  }
}

async function runGmailLifeAdminBackfill({sources=[],provider,actions,isAlreadyHandled=async()=>false,classify=classifyGmailIntent,extract=extractLifeAdminCandidate,onProgress=null,retryDelaysMs=[250,500,1000,2000],interMessageDelayMs=125,sleep=defaultSleep}={}){
  if(!provider||typeof provider.getMessage!=='function')throw new Error('Gmail provider is required');
  if(!actions||typeof actions.createLifeAdminItem!=='function'||typeof actions.createReviewItem!=='function')throw new Error('Life Admin actions are required');
  const result=emptyResult(sources.length);
  let completed=0;
  for(let index=0;index<sources.length;index+=1){
    const storedSource=sources[index];
    if(index>0&&interMessageDelayMs>0)await sleep(interMessageDelayMs);
    try{
      const message=await getMessageWithRetry(provider,storedSource.gmail_message_id,{retryDelaysMs,sleep});
      const source={...storedSource,gmail_thread_id:storedSource.gmail_thread_id||message.threadId||null};
      const envelope={
        sender:source.sender||null,
        subject:source.subject||null,
        text:message.snippet||'',
        receivedAt:source.received_at||null
      };
      const classification=classify(envelope);
      if(classification.intent==='trip'){
        result.tripSkipped+=1;
      }else if(classification.intent==='ignore'){
        result.ignored+=1;
      }else if(classification.intent==='life_admin'){
        if(await isAlreadyHandled(source,classification))result.alreadyHandled+=1;
        else{
          const candidate=extract(envelope,classification);
          await actions.createLifeAdminItem(source,candidate,classification);
          result.lifeAdminCreated+=1;
        }
      }else if(classification.intent==='review'){
        if(await isAlreadyHandled(source,classification))result.alreadyHandled+=1;
        else{
          await actions.createReviewItem(source,classification);
          result.reviewCreated+=1;
        }
      }else{
        result.ignored+=1;
      }
    }catch(error){
      result.errors+=1;
    }
    completed+=1;
    if(typeof onProgress==='function'&&(completed%25===0||completed===sources.length))await onProgress({...result,completed});
  }
  return result;
}

module.exports={TARGET_SCAN_IDS,runGmailLifeAdminBackfill,emptyResult,isRetryableGmailError,getMessageWithRetry};
