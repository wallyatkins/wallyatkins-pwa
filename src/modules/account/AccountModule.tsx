import { useState } from 'react';
import { useWallyAuth } from '../../context/WallyAuthContext';
export function AccountModule(){
 const {user,logout,isLoading}=useWallyAuth(); const [error,setError]=useState('');
 return <section className="wa-panel"><p className="wa-eyebrow">Wally Atkins</p><h1>{isLoading?'Connecting…':user?'Your account':'Your apps. One sign-in.'}</h1>
 <p>{user?`Signed in as ${user.username}. Your available apps follow your WallyAuth permissions.`:'Sign in with WallyAuth to see your apps and personal workspace.'}</p>
 {new URLSearchParams(location.search).has('authError')&&<p role="alert">Sign-in could not be completed. Please try again.</p>}
 {user?<><p>{user.email}</p><div className="wa-tags">{user.roles?.map(r=><span key={r}>{r}</span>)}</div><button onClick={()=>logout().catch(()=>setError('Could not sign out. Please try again.'))}>Sign out of this app</button><p className="wa-muted">Your WallyAuth session is managed separately.</p></>:<a className="wa-button" href="/auth/login">Continue with WallyAuth</a>}
 {error&&<p role="alert">{error}</p>}</section>;
}
