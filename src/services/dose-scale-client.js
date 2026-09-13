'use strict';

function requiredText(value,label){
  const text=String(value||'').trim();
  if(!text)throw new Error(`${label} is required`);
  return text;
}

function validateContext(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Dose & Scale context payload is invalid');
  if(payload.schemaVersion!==1)throw new Error('Dose & Scale context schemaVersion is unsupported');
  if(!Array.isArray(payload.plannedWorkouts))throw new Error('Dose & Scale context plannedWorkouts must be an array');
  return payload;
}

async function fetchDoseScaleContext({fetchImpl=globalThis.fetch,url,token,timeoutMs=10000}={}){
  if(typeof fetchImpl!=='function')throw new Error('fetch implementation is required');
  const endpoint=requiredText(url,'Dose & Scale context URL');
  const serviceToken=requiredText(token,'Dose & Scale service token');
  const timeout=Number(timeoutMs);
  if(!Number.isFinite(timeout)||timeout<=0)throw new Error('Dose & Scale timeout must be positive');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetchImpl(endpoint,{
      method:'GET',
      headers:{Authorization:`Bearer ${serviceToken}`,Accept:'application/json'},
      cache:'no-store',
      signal:controller.signal
    });
    if(!response||!response.ok)throw new Error(`Dose & Scale context HTTP ${response?.status||'error'}`);
    return validateContext(await response.json());
  }finally{
    clearTimeout(timer);
  }
}

module.exports={fetchDoseScaleContext,validateContext};
