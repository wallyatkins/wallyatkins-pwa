import React from 'react';
import { WallyAuthProvider, useWallyAuth } from './context/WallyAuthContext';
import { PwaHeader } from './components/shell/PwaHeader';
import { FootballModule } from './modules/football/FootballModule';
import { MudTerminal } from './modules/mud/MudTerminal';
import { TasksModule } from './modules/tasks/TasksModule';
import { AccountModule } from './modules/account/AccountModule';
import './styles/index.css';

const ModuleRouter: React.FC = () => {
  const { activeModule } = useWallyAuth();

  const renderModule = () => {
    switch (activeModule) {
      case 'football':
        return <FootballModule />;
      case 'mud':
        return <MudTerminal />;
      case 'tasks':
        return <TasksModule />;
      case 'account':
        return <AccountModule />;
      default:
        return <FootballModule />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <PwaHeader />
      <main style={{ flex: 1, paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        {renderModule()}
      </main>
    </div>
  );
};

export function App() {
  return (
    <WallyAuthProvider>
      <ModuleRouter />
    </WallyAuthProvider>
  );
}

export default App;
