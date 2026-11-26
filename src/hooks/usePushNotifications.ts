import { useCallback, useEffect, useState } from 'react';
import { useWallyAuth } from '../context/WallyAuthContext';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePushNotifications() {
  const { user, request } = useWallyAuth();
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const [serverEnabled, setServerEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const sync = useCallback(async () => {
    if (!user || !supported) return;
    try {
      const r = await request('/api/push/status');
      if (!r.ok) return;
      const d = await r.json();
      setServerEnabled(Boolean(d.enabled));
      setPublicKey(d.publicKey || null);
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(Boolean(existing) && d.subscribedCount > 0);
    } catch {}
  }, [user, supported, request]);

  useEffect(() => {
    sync();
  }, [sync]);

  const enable = useCallback(async () => {
    if (!supported || !publicKey) return;
    setBusy(true);
    setMessage('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setMessage('Notification permission was not granted.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }
      const r = await request('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(sub.toJSON())
      });
      if (!r.ok) throw new Error('Could not save push subscription.');
      setSubscribed(true);
      setMessage('Push notifications enabled on this device.');
    } catch (e) {
      setMessage((e as Error).message || 'Could not enable push notifications.');
    } finally {
      setBusy(false);
    }
  }, [supported, publicKey, request]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setMessage('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint || '';
      if (sub) await sub.unsubscribe();
      await request('/api/push/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint })
      });
      setSubscribed(false);
      setMessage('Push notifications disabled on this device.');
    } catch (e) {
      setMessage((e as Error).message || 'Could not disable push notifications.');
    } finally {
      setBusy(false);
    }
  }, [supported, request]);

  const sendTest = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      const r = await request('/api/push/test', { method: 'POST', body: '{}' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Test push failed.');
      setMessage(d.sent > 0 ? 'Test notification sent!' : 'No active device subscriptions found.');
    } catch (e) {
      setMessage((e as Error).message || 'Test push failed.');
    } finally {
      setBusy(false);
    }
  }, [request]);

  return { supported, serverEnabled, subscribed, busy, message, enable, disable, sendTest };
}
