import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, ModuleId, PwaModule, NotificationPreferences } from '../types';
import { PWA_MODULES, DEFAULT_MODULE_ID, LAST_MODULE_STORAGE_KEY } from '../config/modules';

interface WallyAuthContextType {
  user: User | null;
  isLoading: boolean;
  activeModule: ModuleId;
  setActiveModule: (id: ModuleId) => void;
  availableModules: PwaModule[];
  isModuleAllowed: (module: PwaModule) => boolean;
  notificationPrefs: NotificationPreferences;
  saveNotificationPrefs: (prefs: Partial<NotificationPreferences>) => Promise<boolean>;
  logout: () => Promise<void>;
  detectedTimezone: string;
}

const DEFAULT_PREFS: NotificationPreferences = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  phone_number: '',
  carrier_gateway: 'msg.fi.google.com',
  // Strict Opt-In Policy (Defaults to unchecked/false)
  email_pick_reminders: false,
  sms_pick_reminders: false,
  push_pick_reminders: false,
  mud_tells: false,
  mud_combat: false,
  task_due_reminders: false,
};

const WallyAuthContext = createContext<WallyAuthContextType | undefined>(undefined);

export const WallyAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);

  const detectedTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    } catch {
      return 'America/New_York';
    }
  }, []);

  // Restore last active module from localStorage or fallback
  const [activeModule, setActiveModuleState] = useState<ModuleId>(() => {
    try {
      const saved = localStorage.getItem(LAST_MODULE_STORAGE_KEY) as ModuleId;
      if (saved && ['football', 'mud', 'tasks', 'account'].includes(saved)) {
        return saved;
      }
    } catch {
      // Ignore localStorage read failures
    }
    return DEFAULT_MODULE_ID;
  });

  const setActiveModule = useCallback((id: ModuleId) => {
    setActiveModuleState(id);
    try {
      localStorage.setItem(LAST_MODULE_STORAGE_KEY, id);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Fetch current user auth status & roles
  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/football_api.php?action=auth_status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.is_authenticated && data.user) {
          const u: User = {
            id: data.user.id,
            wallyauth_id: data.user.wallyauth_id,
            username: data.user.username,
            email: data.user.email,
            role: data.user.role || 'player',
            avatar_url: data.user.avatar_url,
            roles: data.user.roles || (data.user.role ? [data.user.role, 'football-player'] : ['football-player'])
          };
          setUser(u);
        } else {
          setUser(null);
        }
      }
    } catch (e) {
      console.warn('Auth status check skipped or failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch user notification preferences
  const loadNotificationPrefs = useCallback(async () => {
    try {
      const res = await fetch('/football_api.php?action=get_notification_preferences', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.preferences) {
          setNotificationPrefs(prev => ({
            ...prev,
            ...data.preferences,
            timezone: data.preferences.timezone || detectedTimezone
          }));
          return;
        }
      }
      // Fallback: check local storage preferences if backend doesn't have custom record
      const local = localStorage.getItem('wally_notification_prefs');
      if (local) {
        setNotificationPrefs(prev => ({
          ...prev,
          ...JSON.parse(local),
          timezone: detectedTimezone
        }));
      }
    } catch {
      // Keep defaults
    }
  }, [detectedTimezone]);

  // Save notification preferences
  const saveNotificationPrefs = useCallback(async (newPrefs: Partial<NotificationPreferences>): Promise<boolean> => {
    const updated: NotificationPreferences = {
      ...notificationPrefs,
      ...newPrefs
    };
    setNotificationPrefs(updated);

    try {
      localStorage.setItem('wally_notification_prefs', JSON.stringify(updated));
      const res = await fetch('/football_api.php?action=update_notification_preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updated)
      });
      return res.ok;
    } catch (e) {
      console.error('Error saving notification preferences:', e);
      return false;
    }
  }, [notificationPrefs]);

  // Telemetry registration (records install event & timezone)
  useEffect(() => {
    const recordTelemetry = async () => {
      try {
        const APP_VERSION = '2.1.0';
        let clientUuid = localStorage.getItem('wally_client_uuid');
        if (!clientUuid) {
          clientUuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'wally_' + Math.random().toString(36).substring(2, 15);
          localStorage.setItem('wally_client_uuid', clientUuid);
        }

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true;

        const storedVersion = localStorage.getItem('wally_installed_version');
        const alreadySeenInstall = localStorage.getItem('wally_installed_seen') === 'true';

        let eventType = 'web_access';
        let installedVia = 'browser';

        if (isStandalone) {
          if (!alreadySeenInstall) {
            // First time this device has launched the installed PWA
            eventType = 'install';
            installedVia = 'standalone_first_launch';
            localStorage.setItem('wally_installed_seen', 'true');
            localStorage.setItem('wally_installed_version', APP_VERSION);
          } else if (storedVersion && storedVersion !== APP_VERSION) {
            // PWA version update detected!
            eventType = 'update';
            installedVia = 'pwa_update';
            localStorage.setItem('wally_installed_version', APP_VERSION);
          } else {
            // Standard return launch
            eventType = 'launch';
            installedVia = 'standalone_launch';
          }
        }

        await fetch('/football_api.php?action=record_pwa_telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            client_uuid: clientUuid,
            event_type: eventType,
            installed_via: installedVia,
            user_id: user?.id || null,
            username: user?.username || null,
            email: user?.email || null,
            timezone: detectedTimezone,
            platform: /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'desktop',
            browser: /crios/i.test(navigator.userAgent) ? 'chrome_ios' : /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent) ? 'safari' : 'other',
            is_standalone: isStandalone,
            screen_width: window.innerWidth,
            screen_height: window.innerHeight,
            app_version: APP_VERSION
          })
        });
      } catch {
        // Non-blocking telemetry
      }
    };

    recordTelemetry();
  }, [user, detectedTimezone]);

  useEffect(() => {
    refreshUser();
    loadNotificationPrefs();
  }, [refreshUser, loadNotificationPrefs]);

  // Role Gatekeeper
  const isModuleAllowed = useCallback((module: PwaModule): boolean => {
    // Account is always accessible
    if (module.id === 'account') return true;
    
    // If not logged in, we let them see the public/login gateway for the module
    if (!user) return true;

    // Admin has superuser access to all modules
    if (user.role === 'admin' || (user.roles && user.roles.includes('admin'))) {
      return true;
    }

    if (!module.requiredRole) return true;

    if (user.roles && user.roles.includes(module.requiredRole)) {
      return true;
    }

    if (module.id === 'football' && (user.role === 'player' || user.role === 'commish')) {
      return true;
    }

    return true; // Graceful default
  }, [user]);

  const availableModules = useMemo(() => {
    return PWA_MODULES.filter(isModuleAllowed);
  }, [isModuleAllowed]);

  const logout = useCallback(async () => {
    try {
      await fetch('/football_api.php?action=logout', { method: 'POST', credentials: 'include' });
      setUser(null);
    } catch {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    activeModule,
    setActiveModule,
    availableModules,
    isModuleAllowed,
    notificationPrefs,
    saveNotificationPrefs,
    logout,
    detectedTimezone
  }), [
    user,
    isLoading,
    activeModule,
    setActiveModule,
    availableModules,
    isModuleAllowed,
    notificationPrefs,
    saveNotificationPrefs,
    logout,
    detectedTimezone
  ]);

  return (
    <WallyAuthContext.Provider value={value}>
      {children}
    </WallyAuthContext.Provider>
  );
};

export const useWallyAuth = (): WallyAuthContextType => {
  const context = useContext(WallyAuthContext);
  if (!context) {
    throw new Error('useWallyAuth must be used within a WallyAuthProvider');
  }
  return context;
};
