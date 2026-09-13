function classifyPushError(error){
  const status=Number(error&&error.statusCode);
  return status===404||status===410?'permanent':'transient';
}

function createPushTransport({publicKey,privateKey,subject,webPushModule}={}){
  if(!publicKey||!privateKey||!subject)throw new Error('VAPID public key, private key, and subject are required');
  const webpush=webPushModule||require('web-push');
  webpush.setVapidDetails(subject,publicKey,privateKey);
  return {
    async send(subscription,payload){
      return webpush.sendNotification(subscription,JSON.stringify(payload));
    }
  };
}

module.exports={createPushTransport,classifyPushError};
