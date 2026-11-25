import { useEffect, useRef, useState } from 'react';
import { useWallyAuth } from '../../context/WallyAuthContext';
interface Conversation {id:string;title:string;created:number}
interface Turn {id:string;input:string;output:string;status:string}
const done=new Set(['completed','failed','cancelled','interrupted']);
export function AssistantModule(){
 const {request,assistantReady}=useWallyAuth();
 const [conversations,setConversations]=useState<Conversation[]>([]),[selected,setSelected]=useState('');
 const [turns,setTurns]=useState<Turn[]>([]),[text,setText]=useState(''),[error,setError]=useState(''),[sending,setSending]=useState(false);
 const pending=useRef<{id:string;text:string;conversation:string}|null>(null);
 const bottom=useRef<HTMLDivElement>(null);
 async function json(url:string,init?:RequestInit){const r=await request(url,init);const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d;}
 useEffect(()=>{let live=true;json('/api/assistant/conversations').then(d=>{if(live){setConversations(d.conversations);setSelected(d.conversations[0]?.id||'');}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[request]);
 useEffect(()=>{
  if(!selected){setTurns([]);return;}let live=true;
  const refresh=()=>json('/api/assistant/conversations/'+selected).then(d=>{if(live)setTurns(d.turns);}).catch(e=>{if(live)setError(e.message);});
  setTurns([]);refresh();const timer=setInterval(refresh,2500);return()=>{live=false;clearInterval(timer);};
 },[selected,request]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'end'});},[turns.length,turns[turns.length-1]?.output]);
 const busy=sending||turns.some(t=>!done.has(t.status));
 async function newConversation(){if(pending.current){setError('Retry the uncertain message before starting another conversation.');return;}try{const c=await json('/api/assistant/conversations',{method:'POST',body:'{}'});setConversations(v=>[{...c,title:'New conversation',created:Date.now()},...v]);setSelected(c.id);setTurns([]);setError('');}catch(e){setError((e as Error).message);}}
 async function send(){
  if(!text.trim()||sending)return;setSending(true);setError('');
  try{
   let id=selected;
   if(!id){const c=await json('/api/assistant/conversations',{method:'POST',body:'{}'});id=c.id;setSelected(id);setConversations(v=>[{...c,title:text.slice(0,65),created:Date.now()},...v]);}
   if(!pending.current)pending.current={id:crypto.randomUUID(),text:text.trim(),conversation:id};
   const p=pending.current;
   await json('/api/assistant/conversations/'+p.conversation+'/messages',{method:'POST',body:JSON.stringify({text:p.text,requestId:p.id})});
   pending.current=null;setText('');const d=await json('/api/assistant/conversations/'+id);setTurns(d.turns);
  }catch(e){setError((e as Error).message);}finally{setSending(false);}
 }
 async function stop(){try{await json('/api/assistant/conversations/'+selected+'/stop',{method:'POST',body:'{}'});}catch(e){setError((e as Error).message);}}
 return <section className="wa-chat" aria-label="Personal assistant"><header className="wa-chat-header"><div><p className="wa-eyebrow">Private workspace</p><h1>Your assistant</h1></div><button onClick={newConversation} disabled={sending}>New chat</button></header>
 <label className="wa-chat-picker">Conversation<select value={selected} onChange={e=>{if(!pending.current)setSelected(e.target.value);}}><option value="">New conversation</option>{conversations.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
 {!assistantReady&&<p className="wa-notice" role="status">Your assistant workspace is ready. Chat will open once the model connection and spending limit are configured.</p>}
 <div className="wa-messages" role="log" aria-label="Conversation messages">{!turns.length&&<div className="wa-empty"><h2>What’s on your mind?</h2><p>A place to think, plan, and work things through.</p></div>}{turns.map(t=><div key={t.id}><article className="wa-message wa-you"><strong>You</strong><p>{t.input}</p></article><article className="wa-message"><strong>Assistant</strong><p>{t.output||(['running','started','queued','submitting'].includes(t.status)?'Working…':`Request status: ${t.status}`)}</p>{!done.has(t.status)&&<small role="status">{t.status==='unknown'?'Connection recovery needs review; this request will not be repeated automatically.':t.status}</small>}</article></div>)}<div ref={bottom}/></div>
 {error&&<p className="wa-error" role="alert">{error}</p>}
 <form className="wa-composer" onSubmit={e=>{e.preventDefault();send();}}><label htmlFor="assistant-message">Message your assistant</label><textarea id="assistant-message" value={text} maxLength={12000} onChange={e=>{if(!pending.current)setText(e.target.value);}} placeholder="Ask, explore, or plan…" rows={3} disabled={!assistantReady}/><div><span className="wa-muted">Only your account can access this workspace.</span>{busy&&!pending.current?<button type="button" onClick={stop}>Stop request</button>:<button type="submit" disabled={!assistantReady||!text.trim()||sending}>{sending?'Sending…':pending.current?'Retry same message':'Send'}</button>}</div></form></section>;
}
