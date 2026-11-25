import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, ModuleId, PwaModule, NotificationPreferences } from '../types';
import { PWA_MODULES, LAST_MODULE_STORAGE_KEY } from '../config/modules';
type Capabilities = Partial<Record<ModuleId, boolean>>;
interface AuthContext {
 user: User | null; isLoading: boolean; activeModule: ModuleId;
 setActiveModule: (id: ModuleId) => void; availableModules: PwaModule[];
 isModuleAllowed: (module: PwaModule) => boolean;
 notificationPrefs: NotificationPreferences;
 saveNotificationPrefs: (prefs: Partial<NotificationPreferences>) => Promise<boolean>;
 logout: () => Promise<void>; detectedTimezone: string;
 assistantReady: boolean; request: (url: string, init?: RequestInit) => Promise<Response>;
}
const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
const defaults: NotificationPreferences={timezone,phone_number:'',carrier_gateway:'',email_pick_reminders:false,sms_pick_reminders:false,push_pick_reminders:false,mud_tells:false,mud_combat:false,task_due_reminders:false};
const Context=createContext<AuthContext|undefined>(undefined);
export function WallyAuthProvider({children}:{children:React.ReactNode}) {
 const [user,setUser]=useState<User|null>(null), [isLoading,setLoading]=useState(true);
 const [caps,setCaps]=useState<Capabilities>({account:true});
 const [csrf,setCsrf]=useState(''), [assistantReady,setReady]=useState(false);
 const [activeModule,setActive]=useState<ModuleId>('account');
 const [notificationPrefs,setPrefs]=useState(defaults);
 const request=useCallback(async(url:string,init:RequestInit={})=>{
  const headers=new Headers(init.headers);
  if(init.method && !['GET','HEAD'].includes(init.method.toUpperCase())){headers.set('X-CSRF-Token',csrf);headers.set('Content-Type','application/json');}
  const res=await fetch(url,{...init,headers,credentials:'same-origin',cache:'no-store'});
  if(res.status===401){setUser(null);setCaps({account:true});setActive('account');setReady(false);setPrefs(defaults);}
  return res;
 },[csrf]);
 useEffect(()=>{
  let live=true;
  async function refresh(){
   try{
    const r=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});
    if(!live)return;
    if(!r.ok){setUser(null);setCaps({account:true});setActive('account');return;}
    const d=await r.json();if(!live)return;
    setUser(d.user);setCaps(d.capabilities);setCsrf(d.csrfToken);setReady(d.assistantReady);
    setActive(previous=>{
     const saved=localStorage.getItem(LAST_MODULE_STORAGE_KEY) as ModuleId;
     return d.capabilities[previous] && previous!=='account' ? previous : d.capabilities[saved] ? saved : d.capabilities.assistant ? 'assistant':'account';
    });
   }catch{if(live){setUser(null);setCaps({account:true});setActive('account');}}
   finally{if(live)setLoading(false);}
  }
  refresh();const timer=setInterval(refresh,60000);
  const visibility=()=>{if(document.visibilityState==='visible')refresh();};
  document.addEventListener('visibilitychange',visibility);
  return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 useEffect(()=>{if(!user){setPrefs(defaults);return;}let live=true;request('/api/preferences').then(r=>r.ok?r.json():null).then(d=>{if(live&&d)setPrefs({...defaults,...d.preferences});}).catch(()=>{});return()=>{live=false;};},[user?.wallyauth_id,request]);
 const isModuleAllowed=useCallback((m:PwaModule)=>Boolean(caps[m.id]),[caps]);
 const availableModules=useMemo(()=>PWA_MODULES.filter(isModuleAllowed),[isModuleAllowed]);
 const setActiveModule=(id:ModuleId)=>{if(caps[id]){setActive(id);localStorage.setItem(LAST_MODULE_STORAGE_KEY,id);}};
 const logout=async()=>{
  const r=await request('/api/logout',{method:'POST',body:'{}'});if(!r.ok)throw new Error('Sign out failed');
  // A full navigation destroys private React state on shared devices.
  location.replace('/');
 };
 const saveNotificationPrefs=async(p:Partial<NotificationPreferences>)=>{
  const next={...notificationPrefs,...p};const r=await request('/api/preferences',{method:'PUT',body:JSON.stringify(next)});if(r.ok)setPrefs(next);return r.ok;
 };
 return <Context.Provider value={{user,isLoading,activeModule,setActiveModule,availableModules,isModuleAllowed,notificationPrefs,saveNotificationPrefs,logout,detectedTimezone:timezone,assistantReady,request}}>{children}</Context.Provider>;
}
export function useWallyAuth(){const c=useContext(Context);if(!c)throw new Error('WallyAuthProvider required');return c;}
