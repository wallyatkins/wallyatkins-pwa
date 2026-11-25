import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {openStore} from '../store.mjs';
import {createApp} from '../app.mjs';
const origin='https://app.wallyatkins.com';
async function fixture(t){
 const db=openStore(':memory:');let subject='owner',roles=['football-player'],calls=0,revoked=false;
 const adapter={ClientSecretBasic:()=>()=>{},discovery:async()=>({}),randomPKCECodeVerifier:()=>randomUUID(),calculatePKCECodeChallenge:async()=>randomUUID(),buildAuthorizationUrl:(_c,p)=>new URL('https://auth.wallyatkins.com/oauth/authorize?'+new URLSearchParams(p)),authorizationCodeGrant:async(_c,url,checks)=>{assert.equal(url.searchParams.get('state'),checks.expectedState);assert.ok(checks.expectedNonce);assert.ok(checks.pkceCodeVerifier);return {claims:()=>({sub:subject}),access_token:'test-token',expires_in:3600};},fetchUserInfo:async()=>{if(revoked)throw new Error('revoked');return {sub:subject,preferred_username:subject,roles};}};
 const app=createApp({db,oidcAdapter:adapter,config:{origin,issuer:'https://auth.wallyatkins.com',clientId:'test',clientSecret:'test',encryptionKey:randomBytes(32).toString('hex'),ownerSubject:'owner',assistantEnabled:true,hermesUrl:'http://hermes',hermesKey:'private'},fetcher:async(url,init)=>{calls++;if(url.endsWith('/v1/runs'))return Response.json({run_id:'run-'+JSON.parse(init.body).session_id});return Response.json({status:'completed',output:'Hello'});}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 t.after(()=>{server.closeAllConnections();server.close();db.close();});
 async function login(who,userRoles=['football-player']){subject=who;roles=userRoles;const begin=await fetch(base+'/auth/login',{redirect:'manual'});const state=new URL(begin.headers.get('location')).searchParams.get('state');const cb=await fetch(base+'/auth/callback?code=test&state='+state,{redirect:'manual',headers:{cookie:'__Host-pwa-oidc='+state}});assert.equal(cb.status,302);const cookie=cb.headers.getSetCookie().find(x=>x.startsWith('__Host-pwa-session=')).split(';')[0];const me=await fetch(base+'/api/me',{headers:{cookie}}).then(r=>r.json());return {cookie,csrf:me.csrfToken,me};}
 const api=(path,session,body,method='POST')=>fetch(base+path,{method,headers:{cookie:session.cookie,Origin:origin,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 return {base,db,login,api,calls:()=>calls,revoke:()=>{revoked=true;}};
}
test('anonymous requests fail closed; callback must be bound to initiating browser',async t=>{
 const f=await fixture(t);
 assert.equal((await fetch(f.base+'/api/me')).status,401);
 assert.equal((await fetch(f.base+'/api/assistant/conversations')).status,401);
 const begin=await fetch(f.base+'/auth/login',{redirect:'manual'});const state=new URL(begin.headers.get('location')).searchParams.get('state');
 assert.equal((await fetch(f.base+'/auth/callback?code=x&state='+state,{redirect:'manual'})).status,400);
});
test('only immutable owner identity can access assistant; roles do not override owner restriction',async t=>{
 const f=await fixture(t),owner=await f.login('owner'),other=await f.login('other',['admin','football-player']);
 assert.equal(owner.me.capabilities.assistant,true);assert.equal(other.me.capabilities.assistant,false);
 assert.equal(other.me.capabilities.football,true);assert.equal(other.me.capabilities.mud,false);
 assert.equal((await f.api('/api/assistant/conversations',other,{})).status,403);
});
test('CSRF, conversation ownership and message idempotency are enforced',async t=>{
 const f=await fixture(t),owner=await f.login('owner');
 const bad=await fetch(f.base+'/api/assistant/conversations',{method:'POST',headers:{cookie:owner.cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(bad.status,403);
 const c=await f.api('/api/assistant/conversations',owner,{}).then(r=>r.json());
 const foreign=randomUUID();f.db.prepare('INSERT INTO conversations VALUES (?,?,?,?)').run(foreign,'other','Secret',Date.now());
 assert.equal((await f.api('/api/assistant/conversations/'+foreign,owner,null,'GET')).status,404);
 const data={text:'Hello',requestId:randomUUID()},path='/api/assistant/conversations/'+c.id+'/messages';
 assert.equal((await f.api(path,owner,data)).status,202);assert.equal((await f.api(path,owner,data)).status,202);assert.equal(f.calls(),1);
 assert.equal((await f.api(path,owner,{...data,text:'Changed'})).status,409);
 const result=await f.api('/api/assistant/conversations/'+c.id,owner,null,'GET');assert.match(result.headers.get('cache-control'),/no-store/);assert.equal((await result.json()).turns[0].output,'Hello');
 assert.equal((await f.api('/api/logout',owner,{})).status,200);
 assert.equal((await fetch(f.base+'/api/me',{headers:{cookie:owner.cookie}})).status,401);
});
test('expired sessions fail closed',async t=>{
 const f=await fixture(t),owner=await f.login('owner');f.db.exec('UPDATE sessions SET expires=0');
 assert.equal((await fetch(f.base+'/api/me',{headers:{cookie:owner.cookie}})).status,401);
});

test('provider revocation invalidates the local session at revalidation',async t=>{
 const f=await fixture(t),owner=await f.login('owner');f.db.exec('UPDATE sessions SET checked=0');f.revoke();
 assert.equal((await fetch(f.base+'/api/me',{headers:{cookie:owner.cookie}})).status,401);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
});
