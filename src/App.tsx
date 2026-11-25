import { WallyAuthProvider, useWallyAuth } from './context/WallyAuthContext';
import { PwaHeader } from './components/shell/PwaHeader';
import { AccountModule } from './modules/account/AccountModule';
import { AssistantModule } from './modules/assistant/AssistantModule';
import './styles/index.css';
import './styles/assistant.css';
const links={football:{name:"NFL Pick’em",url:'https://wallyatkins.com/football/'},mud:{name:'WallyMUD',url:'https://mud.wallyatkins.com/'},tasks:{name:'WallyTasks',url:'https://tasks.wallyatkins.com/'}};
function ModuleRouter(){
 const {activeModule,user,isLoading,availableModules}=useWallyAuth();
 const allowed=availableModules.some(m=>m.id===activeModule);
 let content;
 if(isLoading||!user||!allowed||activeModule==='account')content=<AccountModule/>;
 else if(activeModule==='assistant')content=<AssistantModule key={user.wallyauth_id}/>;
 else {const service=links[activeModule]; content=<section className="wa-panel"><p className="wa-eyebrow">Your apps</p><h1>{service.name}</h1><p>Your WallyAuth account has access to this app. Open its full experience below.</p><a className="wa-button" href={service.url} target="_blank" rel="noopener noreferrer">Open {service.name}</a></section>;}
 return <div className="wa-app"><PwaHeader/><main>{content}</main></div>;
}
export function App(){return <WallyAuthProvider><ModuleRouter/></WallyAuthProvider>;}
export default App;
