'use strict';

(function(){
  const active=new Set(['queued','running','processing']);
  function render(scan){
    const host=document.querySelector('[data-gmail-scan-status]');
    if(!host||!scan)return;
    const parts=[`${Number(scan.processed_count||0)} processed`,`${Number(scan.trip_count||0)} Trips`,`${Number(scan.life_admin_count||0)} Life Admin`,`${Number(scan.review_items_created_count||0)} Needs review`,`${Number(scan.ignored_count||0)} ignored`];
    if(Number(scan.pdf_unreadable_count||0)>0)parts.push(`${Number(scan.pdf_unreadable_count)} unreadable PDFs`);
    host.dataset.scanId=scan.id||'';
    host.innerHTML=`<p><strong>${String(scan.status||'').replace(/_/g,' ')}</strong> · ${parts.join(' · ')}</p><p class="muted">${scan.error_summary?String(scan.error_summary):'Status updates automatically while the scan runs.'}</p>`;
    const button=document.querySelector('[data-gmail-scan-button]');
    if(button)button.disabled=active.has(String(scan.status||'').toLowerCase());
  }
  async function poll(){
    try{
      const response=await fetch('/me/settings/gmail/scan-status',{credentials:'same-origin',headers:{accept:'application/json'}});
      if(!response.ok)return false;
      const payload=await response.json();
      if(payload.latestScan)render(payload.latestScan);
      return payload.latestScan&&active.has(String(payload.latestScan.status||'').toLowerCase());
    }catch{return false;}
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    let keep=await poll();
    if(!keep&&!new URLSearchParams(window.location.search).has('scan'))return;
    const timer=setInterval(async()=>{keep=await poll();if(!keep)clearInterval(timer);},2000);
  });
})();
