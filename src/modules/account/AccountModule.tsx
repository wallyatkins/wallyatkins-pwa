import React, { useState } from 'react';
import { useWallyAuth } from '../../context/WallyAuthContext';
import { Bell, Shield, Smartphone, Globe, CheckCircle2, Clock, Mail, MessageSquare, AlertCircle } from 'lucide-react';

const CARRIERS = [
  { name: 'Google Fi (msg.fi.google.com)', gateway: 'msg.fi.google.com' },
  { name: 'Verizon (vtext.com)', gateway: 'vtext.com' },
  { name: 'AT&T (txt.att.net)', gateway: 'txt.att.net' },
  { name: 'T-Mobile (tmomail.net)', gateway: 'tmomail.net' },
  { name: 'Sprint (messaging.sprintpcs.com)', gateway: 'messaging.sprintpcs.com' },
  { name: 'US Cellular (email.uscc.net)', gateway: 'email.uscc.net' },
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC'
];

export const AccountModule: React.FC = () => {
  const { user, notificationPrefs, saveNotificationPrefs, detectedTimezone, logout } = useWallyAuth();
  
  const [formData, setFormData] = useState({
    timezone: notificationPrefs.timezone || detectedTimezone,
    phone_number: notificationPrefs.phone_number || '',
    carrier_gateway: notificationPrefs.carrier_gateway || 'msg.fi.google.com',
    email_pick_reminders: notificationPrefs.email_pick_reminders ?? false,
    sms_pick_reminders: notificationPrefs.sms_pick_reminders ?? false,
    push_pick_reminders: notificationPrefs.push_pick_reminders ?? false,
    mud_tells: notificationPrefs.mud_tells ?? false,
    mud_combat: notificationPrefs.mud_combat ?? false,
    task_due_reminders: notificationPrefs.task_due_reminders ?? false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleToggle = (field: keyof typeof formData) => {
    setFormData(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    const success = await saveNotificationPrefs(formData);
    setIsSaving(false);
    if (success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const initials = user?.username ? user.username.substring(0, 2).toUpperCase() : 'WA';

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 16px 40px 16px' }}>
      {/* Profile Card */}
      <div
        style={{
          backgroundColor: '#0d1829',
          border: '1px solid #1e3a5f',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '9999px',
              border: '2px solid #38bdf8',
              backgroundColor: '#1e293b',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8' }}>{initials}</span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              {user ? user.username : 'Guest User'}
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              {user?.email || 'Sign in to sync your picks, character, and preferences'}
            </p>
            {user?.roles && user.roles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {user.roles.map(r => (
                  <span
                    key={r}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#1e293b',
                      color: '#38bdf8',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid #1e3a5f'
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {!user ? (
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px', display: 'flex', gap: '10px' }}>
            <a
              href="https://auth.wallyatkins.com/oauth/authorize?client_id=wallyatkins_pwa&response_type=code&scope=openid+profile+email+roles"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                padding: '10px 18px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '14px',
                textDecoration: 'none'
              }}
            >
              <Shield size={16} />
              Sign In via WallyAuth
            </a>
          </div>
        ) : (
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={logout}
              style={{
                backgroundColor: '#1e293b',
                color: '#ef4444',
                border: '1px solid #334155',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Notifications Management Matrix */}
      <form onSubmit={handleSave}>
        <div
          style={{
            backgroundColor: '#0d1829',
            border: '1px solid #1e3a5f',
            borderRadius: '20px',
            padding: '24px',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Bell size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Per-App Notification Settings
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0' }}>
            You are in full control. By default, alerts are turned off until you explicitly choose to enable them.
          </p>

          {/* Timezone & Delivery Routing */}
          <div
            style={{
              backgroundColor: '#070d17',
              border: '1px solid #1e2d42',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px'
            }}
          >
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                <Clock size={15} color="#38bdf8" />
                Time Zone
              </label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: '#0d1829',
                  border: '1px solid #1e3a5f',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>
                    {tz} {tz === detectedTimezone ? '(Detected)' : ''}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                All scheduled reminders are calculated in this time zone.
              </span>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                <Smartphone size={15} color="#38bdf8" />
                Mobile Number (for SMS)
              </label>
              <input
                type="tel"
                placeholder="757-555-0199"
                value={formData.phone_number}
                onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: '#0d1829',
                  border: '1px solid #1e3a5f',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                <Globe size={15} color="#38bdf8" />
                SMS Carrier Gateway
              </label>
              <select
                value={formData.carrier_gateway}
                onChange={(e) => setFormData(prev => ({ ...prev, carrier_gateway: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: '#0d1829',
                  border: '1px solid #1e3a5f',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                {CARRIERS.map(c => (
                  <option key={c.gateway} value={c.gateway}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Module 1: Football */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '18px' }}>🏈</span>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                NFL Pick'em Alerts
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#070d17',
                  border: '1px solid #1e2d42',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.email_pick_reminders}
                  onChange={() => handleToggle('email_pick_reminders')}
                  style={{ width: '18px', height: '18px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc' }}>
                    Email Pick Reminders
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Sent Thursday at 5:00 PM and Sunday at 10:30 AM (skipped if all picks are in).
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#070d17',
                  border: '1px solid #1e2d42',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.sms_pick_reminders}
                  onChange={() => handleToggle('sms_pick_reminders')}
                  style={{ width: '18px', height: '18px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc' }}>
                    SMS Pick Reminders
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Text message sent to your phone before lock time if your picks are incomplete.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#070d17',
                  border: '1px solid #1e2d42',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.push_pick_reminders}
                  onChange={() => handleToggle('push_pick_reminders')}
                  style={{ width: '18px', height: '18px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc' }}>
                    Device Push Notifications
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Instant notification on your iPhone or Android lock screen.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Module 2: WallyMUD */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '18px' }}>⚔️</span>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                WallyMUD Alerts
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#070d17',
                  border: '1px solid #1e2d42',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.mud_tells}
                  onChange={() => handleToggle('mud_tells')}
                  style={{ width: '18px', height: '18px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc' }}>
                    Direct Tells & In-Game Pages
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Receive a notification when another player sends you a private tell while backgrounded.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#070d17',
                  border: '1px solid #1e2d42',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.mud_combat}
                  onChange={() => handleToggle('mud_combat')}
                  style={{ width: '18px', height: '18px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc' }}>
                    Combat & Character Health Critical Alerts
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    High-priority alert if your character is attacked or enters critical health.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Module 3: WallyTasks */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '18px' }}>📋</span>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                WallyTasks Alerts
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#070d17',
                  border: '1px solid #1e2d42',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.task_due_reminders}
                  onChange={() => handleToggle('task_due_reminders')}
                  style={{ width: '18px', height: '18px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc' }}>
                    Upcoming Task Due Date Alerts
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Reminder before scheduled tasks and project deadlines expire.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Save Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid #1e293b', paddingTop: '18px' }}>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 24px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: isSaving ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isSaving ? 'Saving...' : 'Save Notification Preferences'}
            </button>

            {savedSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '13px', fontWeight: 600 }}>
                <CheckCircle2 size={16} />
                <span>Preferences saved successfully!</span>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
