import { createApp } from './app.mjs';
import { openStore } from './store.mjs';
const e=process.env;
const db=openStore(e.DB_PATH||'/data/pwa.sqlite');
const extraRuntimes=e.ASSISTANT_RUNTIMES_JSON?JSON.parse(e.ASSISTANT_RUNTIMES_JSON):{};
const assistantRuntimes={...extraRuntimes};
if(e.ASSISTANT_OWNER_SUBJECT&&!assistantRuntimes[e.ASSISTANT_OWNER_SUBJECT]){
  assistantRuntimes[e.ASSISTANT_OWNER_SUBJECT]={url:e.HERMES_URL||'http://hermes:8642',key:e.HERMES_API_KEY};
}
const app=createApp({db,config:{origin:e.PUBLIC_ORIGIN||'https://app.wallyatkins.com',issuer:e.OIDC_ISSUER||'https://auth.wallyatkins.com',clientId:e.OIDC_CLIENT_ID,clientSecret:e.OIDC_CLIENT_SECRET,encryptionKey:e.SESSION_ENCRYPTION_KEY,ownerSubject:e.ASSISTANT_OWNER_SUBJECT,assistantRuntimes,assistantEnabled:e.ASSISTANT_ENABLED==='true',hermesUrl:e.HERMES_URL||'http://hermes:8642',hermesKey:e.HERMES_API_KEY,vapidPublicKey:e.VAPID_PUBLIC_KEY||'',vapidPrivateKey:e.VAPID_PRIVATE_KEY||'',vapidSubject:e.VAPID_SUBJECT||'mailto:wallyatkins@gmail.com',notifyInternalToken:e.NOTIFY_INTERNAL_TOKEN||'',staticDir:'/app/dist'}});
app.listen(Number(e.PORT||3000),'0.0.0.0',()=>console.log('Wally PWA backend listening'));
