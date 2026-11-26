import { useState } from 'react';
import { useWallyAuth } from '../../context/WallyAuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export function AccountModule() {
  const { user, logout, isLoading } = useWallyAuth();
  const push = usePushNotifications();
  const [error, setError] = useState('');

  return (
    <section className="wa-panel">
      <p className="wa-eyebrow">Wally Atkins</p>
      <h1>{isLoading ? 'Connecting…' : user ? 'Your account' : 'Your apps. One sign-in.'}</h1>
      <p>
        {user
          ? `Signed in as ${user.username}. Your available apps follow your WallyAuth permissions.`
          : 'Sign in with WallyAuth to see your apps and personal workspace.'}
      </p>
      {new URLSearchParams(location.search).has('authError') && (
        <p role="alert">Sign-in could not be completed. Please try again.</p>
      )}
      {user ? (
        <>
          <p>{user.email}</p>
          <div className="wa-tags">{user.roles?.map(r => <span key={r}>{r}</span>)}</div>

          {push.supported && push.serverEnabled && (
            <div className="wa-notice" style={{ margin: '18px 0' }}>
              <p className="wa-eyebrow" style={{ marginBottom: 6 }}>Push Notifications</p>
              <p style={{ marginBottom: 12, fontSize: '0.9rem' }}>
                {push.subscribed
                  ? 'Enabled on this device — Assist can send you reminders and alerts.'
                  : 'Enable push notifications so Assist can tap you on the shoulder for reminders and briefings.'}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" disabled={push.busy} onClick={() => (push.subscribed ? push.disable() : push.enable())}>
                  {push.subscribed ? 'Disable on this device' : 'Enable push notifications'}
                </button>
                {push.subscribed && (
                  <button type="button" disabled={push.busy} onClick={push.sendTest}>
                    Send test notification
                  </button>
                )}
              </div>
              {push.message && <p className="wa-muted" style={{ marginTop: 10 }}>{push.message}</p>}
            </div>
          )}

          <button onClick={() => logout().catch(() => setError('Could not sign out. Please try again.'))}>
            Sign out of this app
          </button>
          <p className="wa-muted" style={{ marginTop: 12 }}>Your WallyAuth session is managed separately.</p>
        </>
      ) : (
        <a className="wa-button" href="/auth/login">Continue with WallyAuth</a>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
