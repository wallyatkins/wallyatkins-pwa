import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle, Circle, Trash2, Calendar, CheckSquare, Sparkles, Filter } from 'lucide-react';
import { useWallyAuth } from '../../context/WallyAuthContext';

interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'med' | 'high';
  due?: string;
  source?: 'cloud' | 'local';
}

export const TasksModule: React.FC = () => {
  const { user } = useWallyAuth();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem('wally_tasks_cache');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: '1', title: 'Submit NFL Week picks before Thursday kickoff', completed: false, priority: 'high', due: 'Thursday 8:15 PM' },
      { id: '2', title: 'Check WallyMUD character training level in Temple', completed: false, priority: 'med' },
      { id: '3', title: 'Configure personal notifications in Account Settings', completed: true, priority: 'low' }
    ];
  });

  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'med' | 'high'>('med');
  const [isLoading, setIsLoading] = useState(false);

  // Sync tasks from WallyTasks cloud API if user is authenticated
  useEffect(() => {
    const fetchCloudTasks = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const res = await fetch('https://tasks.wallyatkins.com/api.php?route=/tasks', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tasks)) {
            const mapped: TaskItem[] = data.tasks.map((t: { task_id?: string; slug?: string; title: string; status?: string; priority?: string }) => ({
              id: t.task_id || t.slug || String(Math.random()),
              title: t.title,
              completed: t.status === 'completed' || t.status === 'done',
              priority: (t.priority === 'high' || t.priority === 'urgent') ? 'high' : t.priority === 'low' ? 'low' : 'med',
              source: 'cloud'
            }));
            setTasks(mapped);
            localStorage.setItem('wally_tasks_cache', JSON.stringify(mapped));
          }
        }
      } catch {
        // Fall back to local storage cache smoothly
      } finally {
        setIsLoading(false);
      }
    };

    fetchCloudTasks();
  }, [user]);

  const saveTasks = (updated: TaskItem[]) => {
    setTasks(updated);
    try {
      localStorage.setItem('wally_tasks_cache', JSON.stringify(updated));
    } catch {}
  };

  const toggleTask = async (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTasks(updated);

    // If cloud task, trigger update
    const target = tasks.find(t => t.id === id);
    if (target && target.source === 'cloud') {
      try {
        await fetch(`https://tasks.wallyatkins.com/api.php?route=/tasks/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: !target.completed ? 'completed' : 'todo' })
        });
      } catch {}
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: TaskItem = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      completed: false,
      priority: newPriority,
      source: user ? 'cloud' : 'local'
    };

    saveTasks([newTask, ...tasks]);
    setNewTitle('');

    if (user) {
      try {
        await fetch('https://tasks.wallyatkins.com/api.php?route=/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title: newTask.title, priority: newTask.priority })
        });
      } catch {}
    }
  };

  const deleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    saveTasks(updated);
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px 14px 40px 14px' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          backgroundColor: '#0d1829',
          border: '1px solid #1e3a5f',
          borderRadius: '16px',
          padding: '14px 18px',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}
          >
            <CheckSquare size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#f8fafc', margin: 0, lineHeight: 1.2 }}>
              WallyTasks
            </h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
              {tasks.filter(t => !t.completed).length} pending tasks
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', backgroundColor: '#070d17', border: '1px solid #1e2d42', borderRadius: '10px', padding: '2px' }}>
          {(['all', 'active', 'completed'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: filter === mode ? '#0284c7' : 'transparent',
                color: filter === mode ? '#ffffff' : '#94a3b8',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'capitalize',
                cursor: 'pointer'
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Add Bar */}
      <form onSubmit={addTask} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a new task..."
          style={{
            flex: 1,
            backgroundColor: '#0d1829',
            border: '1px solid #1e3a5f',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#f8fafc',
            fontSize: '14px',
            outline: 'none'
          }}
        />

        <select
          value={newPriority}
          onChange={(e) => setNewPriority(e.target.value as 'low' | 'med' | 'high')}
          aria-label="Priority"
          style={{
            backgroundColor: '#0d1829',
            border: '1px solid #1e3a5f',
            borderRadius: '12px',
            padding: '0 10px',
            color: newPriority === 'high' ? '#ef4444' : newPriority === 'low' ? '#10b981' : '#f59e0b',
            fontWeight: 700,
            fontSize: '13px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="high" style={{ color: '#ef4444' }}>High</option>
          <option value="med" style={{ color: '#f59e0b' }}>Med</option>
          <option value="low" style={{ color: '#10b981' }}>Low</option>
        </select>

        <button
          type="submit"
          aria-label="Add task"
          style={{
            backgroundColor: '#0284c7',
            border: 'none',
            borderRadius: '12px',
            padding: '0 16px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <Plus size={18} />
          <span style={{ display: 'none' }}>Add</span>
        </button>
      </form>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredTasks.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              backgroundColor: '#0d1829',
              border: '1px solid #1e2d42',
              borderRadius: '16px',
              color: '#94a3b8'
            }}
          >
            <CheckSquare size={36} color="#334155" style={{ margin: '0 auto 10px auto', display: 'block' }} />
            <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '15px' }}>All caught up!</div>
            <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>No tasks found in this view.</p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              style={{
                backgroundColor: '#0d1829',
                border: task.completed ? '1px solid #1e293b' : '1px solid #1e3a5f',
                borderRadius: '14px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.15s ease',
                opacity: task.completed ? 0.65 : 1
              }}
            >
              <button
                onClick={() => toggleTask(task.id)}
                aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: task.completed ? '#10b981' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0
                }}
              >
                {task.completed ? <CheckCircle size={22} color="#10b981" /> : <Circle size={22} />}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: task.completed ? '#64748b' : '#f8fafc',
                    textDecoration: task.completed ? 'line-through' : 'none',
                    lineHeight: 1.35
                  }}
                >
                  {task.title}
                </div>
                {task.due && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
                    <Calendar size={12} />
                    <span>{task.due}</span>
                  </div>
                )}
              </div>

              {/* Priority Chip */}
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: task.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : task.priority === 'low' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: task.priority === 'high' ? '#f87171' : task.priority === 'low' ? '#34d399' : '#fbbf24',
                  border: task.priority === 'high' ? '1px solid rgba(239, 68, 68, 0.3)' : task.priority === 'low' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                  flexShrink: 0
                }}
              >
                {task.priority}
              </span>

              <button
                onClick={() => deleteTask(task.id)}
                aria-label="Delete task"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
