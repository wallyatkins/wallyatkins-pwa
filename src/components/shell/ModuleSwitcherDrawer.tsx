import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { useWallyAuth } from '../../context/WallyAuthContext';
import { ModuleIcon } from './ModuleIcon';
import { ModuleId } from '../../types';

interface ModuleSwitcherDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModuleSwitcherDrawer: React.FC<ModuleSwitcherDrawerProps> = ({ isOpen, onClose }) => {
  const { activeModule, setActiveModule, availableModules } = useWallyAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (id: ModuleId) => {
    setActiveModule(id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Application Switcher"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#0d1829',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          border: '1px solid #1e3a5f',
          borderBottom: 'none',
          paddingTop: '20px',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
          maxHeight: '90dvh',
          overflowY: 'auto',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <div style={{ width: '40px', height: '4px', backgroundColor: '#334155', borderRadius: '9999px' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Wally Atkins
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Switch Application Module
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close switcher"
            style={{
              background: '#1e293b',
              border: 'none',
              borderRadius: '9999px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modules List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {availableModules.map((mod) => {
            const isActive = mod.id === activeModule;
            return (
              <button
                key={mod.id}
                onClick={() => handleSelect(mod.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  backgroundColor: isActive ? 'rgba(56, 189, 248, 0.12)' : '#070d17',
                  border: isActive ? '1px solid #38bdf8' : '1px solid #1e2d42',
                  color: '#f8fafc',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  width: '100%'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: isActive ? '#0284c7' : '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isActive ? '#ffffff' : '#38bdf8',
                    flexShrink: 0
                  }}
                >
                  <ModuleIcon name={mod.iconName} size={22} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc' }}>
                      {mod.name}
                    </span>
                    {mod.badge && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '6px',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          textTransform: 'uppercase'
                        }}
                      >
                        {mod.badge}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      margin: '2px 0 0 0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {mod.description}
                  </p>
                </div>

                {isActive && (
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '9999px',
                      backgroundColor: '#38bdf8',
                      color: '#070d17',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Check size={16} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
