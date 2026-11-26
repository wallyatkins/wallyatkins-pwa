import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as oidc from 'openid-client';
import * as webpush from 'web-push';
import { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { capabilities, terminalStatuses } from './policy.mjs';
const random = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest('hex');
function safeEqual(a, b) {
  const ba = Buffer.from(String(a || '')), bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}
export function createApp({db, config, oidcAdapter=oidc, fetcher=fetch, pushSender}) {
  const app = express();
  const origin = new URL(config.origin).origin;
  const key = Buffer.from(config.encryptionKey,'hex');
  if (key.length !== 32) throw new Error('SESSION_ENCRYPTION_KEY must be 32 random bytes in hex');
  if (config.issuer !== 'https://auth.wallyatkins.com') throw new Error('WallyAuth is required');
  const runtimes = new Map();
  if (config.ownerSubject && config.hermesUrl && config.hermesKey) {
    runtimes.set(config.ownerSubject, { url: config.hermesUrl, key: config.hermesKey });
  }
  if (config.assistantRuntimes && typeof config.assistantRuntimes === 'object') {
    for (const [sub, rt] of Object.entries(config.assistantRuntimes)) {
      if (sub && rt?.url && rt?.key) runtimes.set(sub, { url: String(rt.url), key: String(rt.key) });
    }
  }
  const allowedAssistantSubjects = new Set(runtimes.keys());
  const pushEnabled = Boolean(config.vapidPublicKey && config.vapidPrivateKey);
  if (pushEnabled && !pushSender) {
    webpush.setVapidDetails(config.vapidSubject || 'mailto:wallyatkins@gmail.com', config.vapidPublicKey, config.vapidPrivateKey);
  }
  const deliverPush = pushSender || ((sub, payload) => webpush.sendNotification(sub, payload, { TTL: 3600 }));
  async function sendPushToSubject(subject, { title, body, url = '/', tag = 'assist' }) {
    if (!pushEnabled) return { sent: 0, failed: 0, total: 0 };
    const rows = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE owner=?').all(subject);
    const payload = JSON.stringify({ title, body, url, tag });
    let sent = 0, failed = 0;
    for (const row of rows) {
      try {
        await deliverPush({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload);
        sent++;
      } catch (err) {
        failed++;
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(row.endpoint);
        }
      }
    }
    return { sent, failed, total: rows.length };
  }
  const seal = value => {
    const iv=randomBytes(12), c=createCipheriv('aes-256-gcm',key,iv);
    const encrypted=Buffer.concat([c.update(value,'utf8'),c.final()]);
    return Buffer.concat([iv,c.getAuthTag(),encrypted]).toString('base64url');
  };
  const unseal = value => {
    const b=Buffer.from(value,'base64url'), d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));
    d.setAuthTag(b.subarray(12,28));
    return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');
  };
  const cookie={httpOnly:true,secure:true,sameSite:'lax',path:'/'};
  let configurationPromise;
  async function getOidc() {
    if (!config.clientId || !config.clientSecret) throw new Error('OIDC configuration incomplete');
    if (!configurationPromise) configurationPromise=oidcAdapter.discovery(new URL(config.issuer),config.clientId,undefined,oidcAdapter.ClientSecretPost(config.clientSecret)).catch(e=>{configurationPromise=null;throw e;});
    return configurationPromise;
  }
  app.disable('x-powered-by');
  app.set('trust proxy',1);
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:'],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],baseUri:["'self'"]}}}));
  app.use(express.json({limit:'32kb'}));
  app.use(cookieParser());
  app.use(['/api','/auth'],(_req,res,next)=>{res.set('Cache-Control','no-store, private');next();});
  const limits=new Map();
  app.use(['/auth','/api'],(req,res,next)=>{
    const now=Date.now(), k=req.ip;
    if(limits.size>10000) for(const [ip,v] of limits) if(v.until<now)limits.delete(ip);
    let entry=limits.get(k);
    if(!entry||entry.until<now){entry={until:now+60000,count:0};limits.set(k,entry);}
    if(++entry.count>300)return res.status(429).json({error:'Please wait a moment.'});
    next();
  });
  app.get('/api/health',(_req,res)=>res.json({ok:true,version:'0.1.0'}));
  app.post('/internal/notify',async(req,res)=>{
    if(req.get('origin'))return res.status(403).json({error:'Forbidden.'});
    if(!config.notifyInternalToken)return res.status(503).json({error:'Push notifications not configured.'});
    const auth=String(req.get('authorization')||'');
    const token=auth.startsWith('Bearer ')?auth.slice(7):'';
    if(!safeEqual(token,config.notifyInternalToken))return res.status(401).json({error:'Unauthorized.'});
    const subject=typeof req.body.subject==='string'?req.body.subject.trim():'';
    const title=typeof req.body.title==='string'?req.body.title.trim().slice(0,120):'';
    const body=typeof req.body.body==='string'?req.body.body.trim().slice(0,500):'';
    const url=typeof req.body.url==='string'&&req.body.url.startsWith('/')?req.body.url:'/';
    const tag=typeof req.body.tag==='string'?req.body.tag.slice(0,64):'assist';
    if(!subject||!title||!body)return res.status(400).json({error:'subject, title, and body are required.'});
    const stats=await sendPushToSubject(subject,{title,body,url,tag});
    res.json({ok:true,...stats});
  });
  app.get('/auth/login',async(_req,res,next)=>{
    try {
      const c=await getOidc(), state=random(), verifier=oidcAdapter.randomPKCECodeVerifier();
      db.prepare('DELETE FROM oauth WHERE expires < ?').run(Date.now());
      db.prepare('INSERT INTO oauth VALUES (?,?,?)').run(digest(state),JSON.stringify({verifier}),Date.now()+600000);
      res.cookie('__Host-pwa-oidc',state,{...cookie,maxAge:600000});
      res.redirect(oidcAdapter.buildAuthorizationUrl(c,{redirect_uri:origin+'/auth/callback',response_type:'code',scope:'openid profile email roles',state,code_challenge:await oidcAdapter.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'}).href);
    }catch(e){next(e);}
  });
  app.get('/auth/callback',async(req,res)=>{
    const state=typeof req.query.state==='string'?req.query.state:'';
    const transaction=state&&db.prepare('SELECT * FROM oauth WHERE id=?').get(digest(state));
    if(state)db.prepare('DELETE FROM oauth WHERE id=?').run(digest(state));
    res.clearCookie('__Host-pwa-oidc',cookie);
    if(!transaction||transaction.expires<Date.now()||req.cookies['__Host-pwa-oidc']!==state)return res.status(400).send('Sign-in expired. Please start again.');
    try {
      const pending=JSON.parse(transaction.payload), c=await getOidc();
      const url=new URL(origin+'/auth/callback'); url.search=new URLSearchParams(req.query).toString();
      const tokens=await oidcAdapter.authorizationCodeGrant(c,url,{expectedState:state,pkceCodeVerifier:pending.verifier});
      const claims=tokens.claims();
      if(!claims?.sub||!tokens.access_token)throw new Error('Missing identity');
      const profile=await oidcAdapter.fetchUserInfo(c,tokens.access_token,claims.sub);
      profile.sub=claims.sub;
      profile.roles=Array.isArray(profile.roles)?profile.roles:[];
      const session=random();
      const expires=Date.now()+Math.min(8*3600,Number(tokens.expires_in)||3600)*1000;
      db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
      if(req.cookies['__Host-pwa-session'])db.prepare('DELETE FROM sessions WHERE id=?').run(digest(req.cookies['__Host-pwa-session']));
      db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?,?)').run(digest(session),profile.sub,JSON.stringify(profile),seal(tokens.access_token),Date.now(),expires,random());
      res.cookie('__Host-pwa-session',session,{...cookie,maxAge:expires-Date.now()});
      return res.redirect('/');
    }catch(err){console.error('OIDC callback failed:',err?.name||'Error',err?.code||'');return res.redirect('/?authError=failed');}
  });
  app.use('/api',async(req,res,next)=>{
    const token=req.cookies['__Host-pwa-session'];
    const session=token&&db.prepare('SELECT * FROM sessions WHERE id=?').get(digest(token));
    if(!session||session.expires<Date.now())return res.status(401).json({error:'Sign in with WallyAuth.'});
    try{
      if(Date.now()-session.checked>300000){
        const profile=await oidcAdapter.fetchUserInfo(await getOidc(),unseal(session.token),session.subject);
        if(profile.sub!==session.subject)throw new Error('Subject mismatch');
        profile.roles=Array.isArray(profile.roles)?profile.roles:[];
        session.profile=JSON.stringify(profile);
        db.prepare('UPDATE sessions SET profile=?,checked=? WHERE id=?').run(session.profile,Date.now(),session.id);
      }
      req.session=session; req.profile=JSON.parse(session.profile);
      req.capabilities=capabilities(req.profile,allowedAssistantSubjects);
      if(!['GET','HEAD','OPTIONS'].includes(req.method)&&
        (req.get('origin')!==origin||req.get('x-csrf-token')!==session.csrf))return res.status(403).json({error:'Request verification failed.'});
      next();
    }catch{
      db.prepare('DELETE FROM sessions WHERE id=?').run(session.id);
      res.clearCookie('__Host-pwa-session',cookie);
      return res.status(401).json({error:'Please sign in again.'});
    }
  });
  app.get('/api/me',(req,res)=>res.json({user:{id:null,wallyauth_id:req.profile.sub,username:req.profile.preferred_username||req.profile.name||'User',email:req.profile.email||null,role:'user',roles:req.profile.roles||[]},capabilities:req.capabilities,csrfToken:req.session.csrf,assistantReady:config.assistantEnabled===true}));
  app.post('/api/logout',(req,res)=>{
    db.prepare('DELETE FROM sessions WHERE id=?').run(req.session.id);
    res.clearCookie('__Host-pwa-session',cookie);res.json({ok:true});
  });
  app.get('/api/preferences',(req,res)=>{
    const p=db.prepare('SELECT value FROM preferences WHERE owner=?').get(req.profile.sub);
    res.json({preferences:p?JSON.parse(p.value):{}});
  });
  app.put('/api/preferences',(req,res)=>{
    const allowed=['timezone','email_pick_reminders','sms_pick_reminders','push_pick_reminders','mud_tells','mud_combat','task_due_reminders'];
    const value={};for(const k of allowed){if(k==='timezone'&&typeof req.body[k]==='string'){try{new Intl.DateTimeFormat('en',{timeZone:req.body[k]});value[k]=req.body[k];}catch{}}else if(typeof req.body[k]==='boolean')value[k]=req.body[k];}
    db.prepare('INSERT INTO preferences VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET value=excluded.value').run(req.profile.sub,JSON.stringify(value));
    res.json({ok:true});
  });
  app.get('/api/push/status',(req,res)=>{
    const count=db.prepare('SELECT count(*) AS n FROM push_subscriptions WHERE owner=?').get(req.profile.sub).n;
    res.json({enabled:pushEnabled,publicKey:pushEnabled?config.vapidPublicKey:null,subscribedCount:count});
  });
  app.post('/api/push/subscribe',(req,res)=>{
    if(!pushEnabled)return res.status(503).json({error:'Push notifications are not configured.'});
    const endpoint=typeof req.body.endpoint==='string'?req.body.endpoint.trim():'';
    const p256dh=typeof req.body.keys?.p256dh==='string'?req.body.keys.p256dh.trim():'';
    const auth=typeof req.body.keys?.auth==='string'?req.body.keys.auth.trim():'';
    if(!endpoint.startsWith('https://')||endpoint.length>2048||!p256dh||!auth)return res.status(400).json({error:'Invalid push subscription.'});
    db.prepare('INSERT INTO push_subscriptions(endpoint,owner,p256dh,auth,created) VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET owner=excluded.owner,p256dh=excluded.p256dh,auth=excluded.auth,created=excluded.created').run(endpoint,req.profile.sub,p256dh,auth,Date.now());
    res.json({ok:true});
  });
  app.post('/api/push/unsubscribe',(req,res)=>{
    const endpoint=typeof req.body.endpoint==='string'?req.body.endpoint.trim():'';
    if(endpoint)db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND owner=?').run(endpoint,req.profile.sub);
    else db.prepare('DELETE FROM push_subscriptions WHERE owner=?').run(req.profile.sub);
    res.json({ok:true});
  });
  app.post('/api/push/test',async(req,res)=>{
    if(!pushEnabled)return res.status(503).json({error:'Push notifications are not configured.'});
    const stats=await sendPushToSubject(req.profile.sub,{title:'Assist Notifications Active',body:'You are all set — Assist can now tap you on the shoulder when needed.',url:'/',tag:'assist-test'});
    res.json({ok:true,...stats});
  });
  app.use('/api/assistant',(req,res,next)=>{
    const rt=runtimes.get(req.profile.sub);
    if(!req.capabilities.assistant||!rt)return res.status(403).json({error:'Assistant access has not been enabled for this account.'});
    req.runtime=rt;next();
  });
  function ownConversation(req,res,next){
    const row=db.prepare('SELECT * FROM conversations WHERE id=? AND owner=?').get(req.params.id,req.profile.sub);
    if(!row)return res.status(404).json({error:'Conversation not found.'}); req.conversation=row;next();
  }
  async function hermes(runtime,path,init={}){
    return fetcher(runtime.url+path,{...init,headers:{Authorization:'Bearer '+runtime.key,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(20000)});
  }
  app.get('/api/assistant/conversations',(req,res)=>res.json({conversations:db.prepare('SELECT c.id,c.title,c.created,COALESCE((SELECT MAX(t.created) FROM turns t WHERE t.conversation=c.id),c.created) AS updated FROM conversations c WHERE c.owner=? ORDER BY updated DESC LIMIT 100').all(req.profile.sub)}));
  app.post('/api/assistant/conversations',(req,res)=>{
    const id=randomUUID();const now=Date.now();db.prepare('INSERT INTO conversations VALUES (?,?,?,?)').run(id,req.profile.sub,'New conversation',now);res.status(201).json({id,title:'New conversation',created:now,updated:now});
  });
  app.patch('/api/assistant/conversations/:id',ownConversation,(req,res)=>{
    const title=typeof req.body.title==='string'?req.body.title.trim().slice(0,100):'';
    if(!title)return res.status(400).json({error:'A conversation title is required.'});
    db.prepare('UPDATE conversations SET title=? WHERE id=? AND owner=?').run(title,req.conversation.id,req.profile.sub);
    res.json({ok:true,id:req.conversation.id,title});
  });
  app.delete('/api/assistant/conversations/:id',ownConversation,(req,res)=>{
    const active=db.prepare("SELECT id FROM turns WHERE conversation=? AND status NOT IN ('completed','failed','cancelled','interrupted','unknown') LIMIT 1").get(req.conversation.id);
    if(active)return res.status(409).json({error:'Stop the active request before deleting this conversation.'});
    db.prepare('DELETE FROM turns WHERE conversation=?').run(req.conversation.id);
    db.prepare('DELETE FROM conversations WHERE id=? AND owner=?').run(req.conversation.id,req.profile.sub);
    res.json({ok:true});
  });
  app.get('/api/assistant/conversations/:id/events',ownConversation,async(req,res)=>{
    const turn=db.prepare("SELECT * FROM turns WHERE conversation=? AND run_id IS NOT NULL AND status NOT IN ('completed','failed','cancelled','interrupted','unknown') ORDER BY created DESC LIMIT 1").get(req.conversation.id);
    res.set({'Content-Type':'text/event-stream','Cache-Control':'no-store, no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.flushHeaders?.();
    if(!turn){res.write('event: idle\ndata: {}\n\n');return res.end();}
    const ac=new AbortController();
    const timeout=setTimeout(()=>ac.abort(),600000);
    req.on('close',()=>{clearTimeout(timeout);ac.abort();});
    let streamed='';
    try{
      const upstream=await fetcher(req.runtime.url+'/v1/runs/'+encodeURIComponent(turn.run_id)+'/events',{headers:{Authorization:'Bearer '+req.runtime.key,Accept:'text/event-stream'},signal:ac.signal});
      if(!upstream.ok||!upstream.body){res.write('event: sync\ndata: {}\n\n');return res.end();}
      const reader=upstream.body.getReader(), decoder=new TextDecoder();
      let buf='';
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        const chunk=decoder.decode(value,{stream:true});
        res.write(chunk);
        buf+=chunk;
        const frames=buf.split(/\r?\n\r?\n/);
        buf=frames.pop()||'';
        for(const frame of frames){
          const dataLine=frame.split(/\r?\n/).find(l=>l.startsWith('data:'));
          if(!dataLine)continue;
          try{
            const ev=JSON.parse(dataLine.slice(5).trim());
            const kind=ev.event||ev.type||'';
            if(kind==='message.delta'&&typeof ev.delta==='string')streamed+=ev.delta;
            else if(['run.completed','run.failed','run.cancelled','run.interrupted'].includes(kind)){
              const st=kind.slice(4);
              const out=typeof ev.output==='string'?ev.output:(streamed||(typeof ev.error==='string'?ev.error:''));
              db.prepare('UPDATE turns SET status=?,output=? WHERE id=?').run(st,out,turn.id);
            }
          }catch{}
        }
      }
    }catch{}finally{clearTimeout(timeout);if(!res.writableEnded)res.end();}
  });
  app.get('/api/assistant/conversations/:id',ownConversation,async(req,res,next)=>{
    try{
      const active=db.prepare("SELECT * FROM turns WHERE conversation=? AND run_id IS NOT NULL AND status NOT IN ('completed','failed','cancelled','interrupted','unknown')").all(req.conversation.id);
      for(const turn of active){
        const r=await hermes(req.runtime,'/v1/runs/'+encodeURIComponent(turn.run_id));
        if(r.ok){const run=await r.json();db.prepare('UPDATE turns SET status=?,output=? WHERE id=?').run(run.status,String(run.output||''),turn.id);}
        else if(r.status===404)db.prepare("UPDATE turns SET status='unknown' WHERE id=?").run(turn.id);
      }
      res.json({conversation:req.conversation,turns:db.prepare('SELECT id,input,output,status,created FROM turns WHERE conversation=? ORDER BY created').all(req.conversation.id)});
    }catch{res.status(503).json({error:'Assistant connection interrupted. Your conversation is saved; reconnect to check its status.'});}
  });
  app.post('/api/assistant/conversations/:id/messages',ownConversation,async(req,res)=>{
    if(!config.assistantEnabled)return res.status(503).json({error:'Assistant is being configured. Chat will open when OpenRouter is connected.'});
    const input=typeof req.body.text==='string'?req.body.text.trim():'';
    const requestId=String(req.body.requestId||'');
    if(!input||input.length>12000||! /^[a-zA-Z0-9-]{16,80}$/.test(requestId))return res.status(400).json({error:'A message and unique request ID are required.'});
    let turn=db.prepare('SELECT * FROM turns WHERE owner=? AND request_id=?').get(req.profile.sub,requestId);
    if(turn&&(turn.input!==input||turn.conversation!==req.conversation.id))return res.status(409).json({error:'Request ID already used.'});
    if(turn?.run_id)return res.status(202).json({id:turn.id});
    if(!turn){
      const busy=db.prepare("SELECT id FROM turns WHERE owner=? AND status NOT IN ('completed','failed','cancelled','interrupted')").get(req.profile.sub);
      if(busy)return res.status(409).json({error:'Wait for the current request, or check its status, before sending another.'});
      const id=randomUUID();db.prepare('INSERT INTO turns(id,conversation,owner,request_id,input,status,created) VALUES (?,?,?,?,?,?,?)').run(id,req.conversation.id,req.profile.sub,requestId,input,'submitting',Date.now());
      db.prepare("UPDATE conversations SET title=? WHERE id=? AND title='New conversation'").run(input.slice(0,65),req.conversation.id);
      turn=db.prepare('SELECT * FROM turns WHERE id=?').get(id);
    }
    if(Date.now()-turn.created>23*3600000)return res.status(409).json({error:'This submission needs operator review; it will not be retried automatically.'});
    try{
      const r=await hermes(req.runtime,'/v1/runs',{method:'POST',headers:{'Idempotency-Key':turn.id},body:JSON.stringify({input:turn.input,session_id:'pwa-'+req.conversation.id})});
      if(!r.ok)throw new Error('Upstream refused');
      const run=await r.json(); if(typeof run.run_id!=='string')throw new Error('Missing run identity');
      db.prepare('UPDATE turns SET run_id=?,status=? WHERE id=?').run(run.run_id,'running',turn.id);
      res.status(202).json({id:turn.id});
    }catch{res.status(503).json({error:'Submission status is uncertain. Retry this same message to check it without creating a duplicate.',requestId});}
  });
  app.post('/api/assistant/conversations/:id/stop',ownConversation,async(req,res)=>{
    const turn=db.prepare("SELECT * FROM turns WHERE conversation=? AND status NOT IN ('completed','failed','cancelled','interrupted') ORDER BY created DESC LIMIT 1").get(req.conversation.id);
    if(!turn?.run_id)return res.status(409).json({error:'No stoppable request. An uncertain submission requires status review.'});
    try{const r=await hermes(req.runtime,'/v1/runs/'+encodeURIComponent(turn.run_id)+'/stop',{method:'POST',body:'{}'});if(!r.ok)throw new Error();res.json({ok:true});}
    catch{res.status(503).json({error:'Could not confirm cancellation. Check the request status.'});}
  });
  app.use('/api',(_req,res)=>res.status(404).json({error:'Not found.'}));
  if(config.staticDir){app.use(express.static(config.staticDir,{index:false,maxAge:'1h'}));app.get('/{*path}',(_req,res)=>res.sendFile(config.staticDir+'/index.html'));}
  app.use((err,_req,res,_next)=>{console.error('PWA request failed:',err?.name||'Error');res.status(err?.status===400?400:503).json({error:'Service temporarily unavailable.'});});
  return app;
}
