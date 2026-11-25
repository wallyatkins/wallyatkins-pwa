import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as oidc from 'openid-client';
import { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { capabilities, terminalStatuses } from './policy.mjs';
const random = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest('hex');
export function createApp({db, config, oidcAdapter=oidc, fetcher=fetch}) {
  const app = express();
  const origin = new URL(config.origin).origin;
  const key = Buffer.from(config.encryptionKey,'hex');
  if (key.length !== 32) throw new Error('SESSION_ENCRYPTION_KEY must be 32 random bytes in hex');
  if (config.issuer !== 'https://auth.wallyatkins.com') throw new Error('WallyAuth is required');
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
    if (!configurationPromise) configurationPromise=oidcAdapter.discovery(new URL(config.issuer),config.clientId,{client_secret:config.clientSecret},oidcAdapter.ClientSecretBasic(config.clientSecret)).catch(e=>{configurationPromise=null;throw e;});
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
  app.get('/auth/login',async(_req,res,next)=>{
    try {
      const c=await getOidc(), state=random(), nonce=random(), verifier=oidcAdapter.randomPKCECodeVerifier();
      db.prepare('DELETE FROM oauth WHERE expires < ?').run(Date.now());
      db.prepare('INSERT INTO oauth VALUES (?,?,?)').run(digest(state),JSON.stringify({nonce,verifier}),Date.now()+600000);
      res.cookie('__Host-pwa-oidc',state,{...cookie,maxAge:600000});
      res.redirect(oidcAdapter.buildAuthorizationUrl(c,{redirect_uri:origin+'/auth/callback',response_type:'code',scope:'openid profile email roles',state,nonce,code_challenge:await oidcAdapter.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'}).href);
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
      const tokens=await oidcAdapter.authorizationCodeGrant(c,url,{expectedState:state,expectedNonce:pending.nonce,pkceCodeVerifier:pending.verifier});
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
    }catch{return res.redirect('/?authError=failed');}
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
      req.capabilities=capabilities(req.profile,config.ownerSubject);
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
  app.use('/api/assistant',(req,res,next)=>req.capabilities.assistant?next():res.status(403).json({error:'Assistant access has not been enabled for this account.'}));
  function ownConversation(req,res,next){
    const row=db.prepare('SELECT * FROM conversations WHERE id=? AND owner=?').get(req.params.id,req.profile.sub);
    if(!row)return res.status(404).json({error:'Conversation not found.'}); req.conversation=row;next();
  }
  async function hermes(path,init={}){
    return fetcher(config.hermesUrl+path,{...init,headers:{Authorization:'Bearer '+config.hermesKey,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(20000)});
  }
  app.get('/api/assistant/conversations',(req,res)=>res.json({conversations:db.prepare('SELECT id,title,created FROM conversations WHERE owner=? ORDER BY created DESC LIMIT 100').all(req.profile.sub)}));
  app.post('/api/assistant/conversations',(req,res)=>{
    const id=randomUUID();db.prepare('INSERT INTO conversations VALUES (?,?,?,?)').run(id,req.profile.sub,'New conversation',Date.now());res.status(201).json({id});
  });
  app.get('/api/assistant/conversations/:id',ownConversation,async(req,res,next)=>{
    try{
      const active=db.prepare("SELECT * FROM turns WHERE conversation=? AND run_id IS NOT NULL AND status NOT IN ('completed','failed','cancelled','interrupted','unknown')").all(req.conversation.id);
      for(const turn of active){
        const r=await hermes('/v1/runs/'+encodeURIComponent(turn.run_id));
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
      const r=await hermes('/v1/runs',{method:'POST',headers:{'Idempotency-Key':turn.id},body:JSON.stringify({input:turn.input,session_id:'pwa-'+req.conversation.id})});
      if(!r.ok)throw new Error('Upstream refused');
      const run=await r.json(); if(typeof run.run_id!=='string')throw new Error('Missing run identity');
      db.prepare('UPDATE turns SET run_id=?,status=? WHERE id=?').run(run.run_id,'running',turn.id);
      res.status(202).json({id:turn.id});
    }catch{res.status(503).json({error:'Submission status is uncertain. Retry this same message to check it without creating a duplicate.',requestId});}
  });
  app.post('/api/assistant/conversations/:id/stop',ownConversation,async(req,res)=>{
    const turn=db.prepare("SELECT * FROM turns WHERE conversation=? AND status NOT IN ('completed','failed','cancelled','interrupted') ORDER BY created DESC LIMIT 1").get(req.conversation.id);
    if(!turn?.run_id)return res.status(409).json({error:'No stoppable request. An uncertain submission requires status review.'});
    try{const r=await hermes('/v1/runs/'+encodeURIComponent(turn.run_id)+'/stop',{method:'POST',body:'{}'});if(!r.ok)throw new Error();res.json({ok:true});}
    catch{res.status(503).json({error:'Could not confirm cancellation. Check the request status.'});}
  });
  app.use('/api',(_req,res)=>res.status(404).json({error:'Not found.'}));
  if(config.staticDir){app.use(express.static(config.staticDir,{index:false,maxAge:'1h'}));app.get('/{*path}',(_req,res)=>res.sendFile(config.staticDir+'/index.html'));}
  app.use((err,_req,res,_next)=>{console.error('PWA request failed:',err?.name||'Error');res.status(err?.status===400?400:503).json({error:'Service temporarily unavailable.'});});
  return app;
}
