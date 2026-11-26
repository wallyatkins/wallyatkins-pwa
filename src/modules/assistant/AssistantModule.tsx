import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  BellRing,
  Check,
  Copy,
  Menu,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  Square,
  Trash2,
  X
} from 'lucide-react';
import { useWallyAuth } from '../../context/WallyAuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { MarkdownContent } from './MarkdownContent';

interface Conversation {
  id: string;
  title: string;
  created: number;
  updated?: number;
}

interface Turn {
  id: string;
  input: string;
  output: string;
  status: string;
  created?: number;
}

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const STARTERS = [
  'Help me plan my priorities for today',
  'Remember a few preferences about how I like to work',
  'Brainstorm ideas for my next project sprint',
  'Give me a quick pros and cons breakdown'
];

function formatTime(ts?: number) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };
  return (
    <button type="button" className="wa-msg-action" onClick={onCopy} aria-label="Copy reply" title="Copy reply">
      {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
    </button>
  );
}

export function AssistantModule() {
  const { request, assistantReady } = useWallyAuth();
  const push = usePushNotifications();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [streamDelta, setStreamDelta] = useState('');
  const [liveStatus, setLiveStatus] = useState('');
  const [atBottom, setAtBottom] = useState(true);

  const pending = useRef<{ id: string; text: string; conversation: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const json = useCallback(async (url: string, init?: RequestInit) => {
    const r = await request(url, init);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Request failed');
    return d;
  }, [request]);

  const loadConversations = useCallback(async (preserveSelection = true) => {
    const d = await json('/api/assistant/conversations');
    setConversations(d.conversations);
    setSelected(prev => (preserveSelection && prev && d.conversations.some((c: Conversation) => c.id === prev))
      ? prev
      : (d.conversations[0]?.id || ''));
  }, [json]);

  useEffect(() => {
    let live = true;
    loadConversations(true).catch(e => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [loadConversations]);

  const refreshTurns = useCallback(async (convId: string) => {
    if (!convId) return;
    const d = await json('/api/assistant/conversations/' + convId);
    setTurns(d.turns);
    if (d.conversation?.title) {
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: d.conversation.title } : c));
    }
  }, [json]);

  useEffect(() => {
    setStreamDelta('');
    setLiveStatus('');
    if (!selected) {
      setTurns([]);
      return;
    }
    let live = true;
    setTurns([]);
    refreshTurns(selected).catch(e => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [selected, refreshTurns]);

  const activeTurn = turns.find(t => !TERMINAL.has(t.status) && t.status !== 'unknown');
  const activeTurnId = activeTurn?.id || '';
  const busy = sending || Boolean(activeTurn);

  // Real-time SSE token streaming when a turn is active, with fallback polling
  useEffect(() => {
    if (!selected || !activeTurnId) {
      setStreamDelta('');
      setLiveStatus('');
      return;
    }
    let live = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (pollTimer || !live) return;
      pollTimer = setInterval(() => {
        refreshTurns(selected).catch(() => {});
      }, 2500);
    };

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/assistant/conversations/${encodeURIComponent(selected)}/events`);
      setLiveStatus('Thinking…');

      const handleEvent = (raw: string) => {
        if (!live || !raw) return;
        try {
          const ev = JSON.parse(raw);
          const kind = String(ev.event || ev.type || '');
          if (kind === 'message.delta' && typeof ev.delta === 'string') {
            setLiveStatus('');
            setStreamDelta(prev => prev + ev.delta);
          } else if (kind.startsWith('tool.')) {
            const toolName = String(ev.tool || ev.name || '');
            if (toolName.includes('memory')) setLiveStatus('Updating memory…');
            else if (toolName.includes('session')) setLiveStatus('Searching past chats…');
            else setLiveStatus('Using tool…');
          } else if (['run.completed', 'run.failed', 'run.cancelled', 'run.interrupted'].includes(kind)) {
            es?.close();
            setStreamDelta('');
            setLiveStatus('');
            refreshTurns(selected).catch(() => {});
          }
        } catch {}
      };

      es.onmessage = (m) => handleEvent(m.data);
      for (const name of ['message.delta', 'message.interim', 'tool.start', 'tool.end', 'run.completed', 'run.failed', 'run.cancelled', 'run.interrupted']) {
        es.addEventListener(name, (m) => handleEvent((m as MessageEvent).data));
      }
      es.addEventListener('idle', () => {
        es?.close();
        refreshTurns(selected).catch(() => {});
      });
      es.addEventListener('sync', () => {
        es?.close();
        startPolling();
      });
      es.onerror = () => {
        es?.close();
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      live = false;
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [selected, activeTurnId, refreshTurns]);

  // Smooth auto-scroll only if user is already near bottom
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
  };

  useEffect(() => {
    if (atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [turns.length, turns[turns.length - 1]?.output, streamDelta, atBottom]);

  // Auto-resize composer textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [text]);

  async function newConversation() {
    if (pending.current) {
      setError('Retry the uncertain message before starting another conversation.');
      return;
    }
    try {
      const c = await json('/api/assistant/conversations', { method: 'POST', body: '{}' });
      setConversations(v => [c, ...v]);
      setSelected(c.id);
      setTurns([]);
      setError('');
      setDrawerOpen(false);
      textareaRef.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function send(overrideText?: string) {
    const bodyText = (overrideText ?? text).trim();
    if (!bodyText || sending || !assistantReady) return;
    setSending(true);
    setError('');
    setAtBottom(true);
    try {
      let id = selected;
      if (!id) {
        const c = await json('/api/assistant/conversations', { method: 'POST', body: '{}' });
        id = c.id;
        setSelected(id);
        setConversations(v => [{ ...c, title: bodyText.slice(0, 65) }, ...v]);
      }
      if (!pending.current) pending.current = { id: crypto.randomUUID(), text: bodyText, conversation: id };
      const p = pending.current;
      await json(`/api/assistant/conversations/${p.conversation}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: p.text, requestId: p.id })
      });
      pending.current = null;
      setText('');
      setStreamDelta('');
      await refreshTurns(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function stop() {
    if (!selected) return;
    try {
      await json(`/api/assistant/conversations/${selected}/stop`, { method: 'POST', body: '{}' });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveRename(id: string) {
    const clean = editingTitle.trim();
    setEditingId('');
    if (!clean) return;
    try {
      await json(`/api/assistant/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: clean })
      });
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: clean } : c));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteConversation(id: string) {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await json(`/api/assistant/conversations/${id}`, { method: 'DELETE' });
      const next = conversations.filter(c => c.id !== id);
      setConversations(next);
      if (selected === id) {
        setSelected(next[0]?.id || '');
        setTurns([]);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const activeConversation = conversations.find(c => c.id === selected);

  return (
    <section className="wa-chat-shell" aria-label="Personal assistant">
      {drawerOpen && <div className="wa-drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

      <aside className={`wa-sidebar ${drawerOpen ? 'open' : ''}`} aria-label="Conversations">
        <div className="wa-sidebar-head">
          <button type="button" className="wa-new-btn" onClick={newConversation} disabled={sending}>
            <Plus size={16} /> New chat
          </button>
          <button type="button" className="wa-icon-only wa-mobile-only" onClick={() => setDrawerOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <div className="wa-conv-list">
          {!conversations.length && <p className="wa-conv-empty">No conversations yet.</p>}
          {conversations.map(c => (
            <div key={c.id} className={`wa-conv-item ${c.id === selected ? 'active' : ''}`}>
              {editingId === c.id ? (
                <form className="wa-conv-edit" onSubmit={e => { e.preventDefault(); saveRename(c.id); }}>
                  <input
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onBlur={() => saveRename(c.id)}
                    maxLength={100}
                    autoFocus
                  />
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className="wa-conv-select"
                    onClick={() => { if (!pending.current) { setSelected(c.id); setDrawerOpen(false); } }}
                  >
                    <MessageSquare size={14} className="wa-conv-icon" />
                    <span className="wa-conv-title">{c.title}</span>
                    <span className="wa-conv-time">{formatTime(c.updated || c.created)}</span>
                  </button>
                  <div className="wa-conv-actions">
                    <button
                      type="button"
                      className="wa-icon-only"
                      title="Rename"
                      aria-label={`Rename ${c.title}`}
                      onClick={() => { setEditingId(c.id); setEditingTitle(c.title); }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="wa-icon-only wa-danger-hover"
                      title="Delete"
                      aria-label={`Delete ${c.title}`}
                      onClick={() => deleteConversation(c.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      <div className="wa-chat-main">
        <header className="wa-chat-topbar">
          <div className="wa-topbar-left">
            <button
              type="button"
              className="wa-icon-only wa-mobile-only"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open conversations"
            >
              <Menu size={20} />
            </button>
            <div className="wa-topbar-title">
              <span className="wa-assist-badge"><Sparkles size={13} /> Assist</span>
              <h1>{activeConversation?.title || 'New conversation'}</h1>
            </div>
          </div>
          <div className="wa-topbar-actions">
            {push.supported && push.serverEnabled && (
              <button
                type="button"
                className={`wa-ghost-btn ${push.subscribed ? 'wa-push-on' : ''}`}
                onClick={() => (push.subscribed ? push.disable() : push.enable())}
                disabled={push.busy}
                title={push.subscribed ? 'Push notifications enabled (click to disable)' : 'Enable push notifications'}
              >
                {push.subscribed ? <BellRing size={15} /> : <Bell size={15} />}
                <span>{push.subscribed ? 'Alerts On' : 'Alerts'}</span>
              </button>
            )}
            <button type="button" className="wa-ghost-btn" onClick={newConversation} disabled={sending} title="New chat">
              <Plus size={16} /> <span>New</span>
            </button>
          </div>
        </header>

        {!assistantReady && (
          <p className="wa-notice" role="status">
            Your assistant workspace is ready. Chat will open once the OpenRouter connection is enabled.
          </p>
        )}

        <div className="wa-messages" ref={scrollRef} onScroll={onScroll} role="log" aria-label="Conversation messages">
          {!turns.length && (
            <div className="wa-empty">
              <div className="wa-empty-orb"><Sparkles size={24} /></div>
              <h2>What’s on your mind?</h2>
              <p>Private workspace with persistent memory and cost-aware routing.</p>
              {assistantReady && (
                <div className="wa-starters">
                  {STARTERS.map(prompt => (
                    <button key={prompt} type="button" className="wa-starter-chip" onClick={() => send(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {turns.map(t => {
            const isActive = t.id === activeTurnId;
            const displayOutput = isActive ? (streamDelta || t.output) : t.output;
            return (
              <div key={t.id} className="wa-turn">
                <article className="wa-bubble wa-bubble-you">
                  <div className="wa-bubble-meta">
                    <strong>You</strong>
                    {t.created && <span>{formatTime(t.created)}</span>}
                  </div>
                  <p className="wa-user-text">{t.input}</p>
                </article>

                <article className="wa-bubble wa-bubble-assistant">
                  <div className="wa-bubble-meta">
                    <strong><Sparkles size={12} /> Assist</strong>
                    <div className="wa-bubble-meta-right">
                      {isActive && (
                        <span className="wa-live-pill" role="status">
                          <span className="wa-pulse-dot" />
                          {liveStatus || (streamDelta ? 'Streaming…' : 'Working…')}
                        </span>
                      )}
                      {displayOutput && !isActive && <CopyButton text={displayOutput} />}
                    </div>
                  </div>
                  {displayOutput ? (
                    <div className={isActive ? 'wa-streaming' : ''}>
                      <MarkdownContent content={displayOutput} />
                    </div>
                  ) : isActive ? (
                    <div className="wa-thinking-dots" aria-label="Thinking">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <p className="wa-muted">
                      {t.status === 'unknown'
                        ? 'Connection recovery needs review; this request will not be repeated automatically.'
                        : `Request status: ${t.status}`}
                    </p>
                  )}
                </article>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {!atBottom && turns.length > 0 && (
          <button
            type="button"
            className="wa-jump-bottom"
            onClick={() => { setAtBottom(true); bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }}
            aria-label="Jump to latest"
          >
            <ArrowDown size={15} /> Latest
          </button>
        )}

        {error && <p className="wa-error" role="alert">{error}</p>}

        <form className="wa-composer" onSubmit={e => { e.preventDefault(); send(); }}>
          <textarea
            ref={textareaRef}
            id="assistant-message"
            value={text}
            maxLength={12000}
            rows={1}
            disabled={!assistantReady}
            placeholder={assistantReady ? 'Message Assist… (Enter to send, Shift+Enter for new line)' : 'Assist is not yet enabled'}
            onChange={e => { if (!pending.current) setText(e.target.value); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="wa-composer-bar">
            <span className="wa-muted">
              {text.length > 10000 ? `${text.length.toLocaleString()} / 12,000` : 'Private · Memory enabled'}
            </span>
            {busy && !pending.current ? (
              <button type="button" className="wa-stop-btn" onClick={stop}>
                <Square size={14} /> Stop
              </button>
            ) : (
              <button type="submit" className="wa-send-btn" disabled={!assistantReady || !text.trim() || sending}>
                <ArrowUp size={16} /> {sending ? 'Sending…' : pending.current ? 'Retry' : 'Send'}
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
