self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch{data={title:'preston.ai',body:event.data?event.data.text():'',url:'/'};}
  const title=data.title||'preston.ai';
  const options={body:data.body||'',icon:'/icons/icon-192.png',badge:'/icons/favicon-32.png',tag:data.tag||undefined,data:{url:data.url||'/'}};
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=(event.notification.data&&event.notification.data.url)||'/';
  event.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if('focus' in client){
        if('navigate' in client)await client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow(target);
  })());
});
