import React, { useState } from 'react';
import { Plus, CheckCircle, Circle, Trash2, Calendar, Tag } from 'lucide-react';
import { useWallyAuth } from '../../context/WallyAuthContext';

interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'med' | 'high';
  due?: string;
}

export const TasksModule: React.FC = () => {
  const { user } = useWallyAuth();
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

  const saveTasks = (updated: TaskItem[]) => {
    setTasks(updated);
    try {
      localStorage.setItem('wally_tasks_cache', JSON.stringify(updated));
    } catch {}
  };

  const toggleTask = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTasks(updated);
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newTask: TaskItem = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      completed: false,
      priority: 'med'
    };
    saveTasks([newTask, ...tasks]);
    setNewTitle('');
  };

  const deleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    saveTasks(updated);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 16px 40px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
            WallyTasks
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0 0' }}>
            Lightweight task queue and project tracker
          </p>
        </div>
      </div>

      {/* Quick Add Bar */}
      <form onSubmit={addTask} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a new task..."
          style={{
            flex: 1,
            backgroundColor: '#0d1829',
            border: '1px solid #1e3a5f',
            borderRadius: '10px',
            padding: '12px 16px',
            color: '#f8fafc',
            fontSize: '14px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          style={{
            backgroundColor: '#0284c7',
            border: 'none',
            borderRadius: '10px',
            padding: '0 18px',
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
          <span>Add</span>
        </button>
      </form>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              backgroundColor: '#0d1829',
              border: '1px solid #1e2d42',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease'
            }}
          >
            <button
              onClick={() => toggleTask(task.id)}
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
              {task.completed ? <CheckCircle size={22} /> : <Circle size={22} />}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: task.completed ? '#64748b' : '#f8fafc',
                  textDecoration: task.completed ? 'line-through' : 'none'
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
                alignItems: 'center'
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
