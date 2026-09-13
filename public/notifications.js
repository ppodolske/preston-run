function urlBase64ToUint8Array(value){
  const padding='='.repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)));
}

async function enableNotifications(button){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw new Error('Push notifications are not supported on this device');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Notification permission was not granted');
  const registration=await navigator.serviceWorker.register('/sw.js');
  const ready=await navigator.serviceWorker.ready;
  let subscription=await ready.pushManager.getSubscription();
  if(!subscription){
    subscription=await ready.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(button.dataset.vapidPublicKey)});
  }
  const json=subscription.toJSON();
  const labelInput=document.querySelector('[data-device-label]');
  const response=await fetch('/notifications/subscriptions',{
    method:'POST',
    credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({endpoint:json.endpoint,p256dh:json.keys&&json.keys.p256dh,auth_secret:json.keys&&json.keys.auth,device_label:labelInput&&labelInput.value?labelInput.value:'This device'})
  });
  if(!response.ok)throw new Error('Could not save notification subscription');
  window.location.reload();
}

document.addEventListener('DOMContentLoaded',()=>{
  const button=document.querySelector('[data-enable-notifications]');
  if(!button)return;
  button.addEventListener('click',async()=>{
    button.disabled=true;
    const status=document.querySelector('[data-notification-status]');
    try{await enableNotifications(button);}catch(error){if(status)status.textContent=error.message;button.disabled=false;}
  });
});
