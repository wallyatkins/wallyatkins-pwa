import { PwaModule } from '../types';

export const PWA_MODULES: PwaModule[] = [
  {
    id: 'football',
    name: "NFL Pick'em",
    shortName: "Pick'em",
    badge: 'Live',
    iconName: 'Trophy',
    requiredRole: 'football-player',
    description: 'Weekly NFL picks matrix, matchup slider, and survivor pool.'
  },
  {
    id: 'mud',
    name: 'WallyMUD',
    shortName: 'MUD',
    badge: 'Terminal',
    iconName: 'Terminal',
    requiredRole: 'mud-player',
    description: 'Retro multi-user dungeon terminal with mobile quick actions.'
  },
  {
    id: 'tasks',
    name: 'WallyTasks',
    shortName: 'Tasks',
    iconName: 'CheckSquare',
    requiredRole: 'tasks-user',
    description: 'Personal task manager and project tracker.'
  },
  {
    id: 'account',
    name: 'Account & Settings',
    shortName: 'Settings',
    iconName: 'User',
    description: 'Profile, security passkeys, and per-app notification preferences.'
  }
];

export const DEFAULT_MODULE_ID = 'football';
export const LAST_MODULE_STORAGE_KEY = 'wally_pwa_last_module';
