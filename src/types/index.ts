export interface User {
  id: number | null;
  wallyauth_id?: string | null;
  username: string;
  email?: string | null;
  role: string;
  roles?: string[];
  avatar_url?: string | null;
  timezone?: string;
}

export type ModuleId = 'football' | 'mud' | 'tasks' | 'account';

export interface PwaModule {
  id: ModuleId;
  name: string;
  shortName: string;
  badge?: string;
  iconName: 'Trophy' | 'Terminal' | 'CheckSquare' | 'User';
  requiredRole?: string;
  description: string;
}

export interface NotificationPreferences {
  user_id?: number;
  timezone: string;
  phone_number: string;
  carrier_gateway: string;
  // Football module notifications (Default opt-out: false)
  email_pick_reminders: boolean;
  sms_pick_reminders: boolean;
  push_pick_reminders: boolean;
  // WallyMUD module notifications (Default opt-out: false)
  mud_tells: boolean;
  mud_combat: boolean;
  // WallyTasks module notifications (Default opt-out: false)
  task_due_reminders: boolean;
}

export interface PickemGame {
  id: number;
  game_id: number;
  week: number;
  season: number;
  away_team: string;
  home_team: string;
  kickoff: string;
  away_score: number | null;
  home_score: number | null;
  status: string;
  is_started: boolean;
  is_final: boolean;
  winner: string | null;
  is_active: boolean;
  away_info?: {
    abbr: string;
    name: string;
    nick: string;
    color: string;
    color2: string;
    logo: string;
  };
  home_info?: {
    abbr: string;
    name: string;
    nick: string;
    color: string;
    color2: string;
    logo: string;
  };
}

export interface PickemUser {
  id: number;
  username: string;
  role: string;
  avatar_url: string | null;
  score?: number;
  correct_count?: number;
  pending_count?: number;
  picks_made?: number;
  total_games?: number;
  status?: string;
  survivor_pick?: string | null;
  survivor_status?: string | null;
}

export interface WeekData {
  week: number;
  current_week: number;
  season: number;
  is_current_week: boolean;
  is_pick_window_open: boolean;
  games: PickemGame[];
  users: PickemUser[];
  matrix: Record<string, Record<string, {
    pick: string | null;
    is_correct: boolean | null;
    is_final: boolean;
    is_locked: boolean;
  }>>;
  user_picks: Record<string, string>;
  user_survivor_pick: string | null;
  user_past_survivor_teams: string[];
}
