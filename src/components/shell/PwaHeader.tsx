import React, { useState } from 'react';
import { ChevronDown, LogIn, Bell, Shield, LogOut } from 'lucide-react';
import { useWallyAuth } from '../../context/WallyAuthContext';
import { PWA_MODULES } from '../../config/modules';
import { ModuleIcon } from './ModuleIcon';
import { ModuleSwitcherDrawer } from './ModuleSwitcherDrawer';

export const PwaHeader: React.FC = () => {
  const { user, activeModule, setActiveModule, logout } = useWallyAuth();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const currentMod = PWA_MODULES.find((m) => m.id === activeModule) || PWA_MODULES[0];

  const initials = user?.username
    ? user.username.substring(0, 2).toUpperCase()
    : 'WA';

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: '#070d17',
          borderBottom: '1px solid #1e2d42',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          paddingBottom: '12px',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          {/* Left: Module Switcher Trigger */}
          <button
            onClick={() => setIsSwitcherOpen(true)}
            aria-label="Switch Module"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#0d1829',
              border: '1px solid #1e3a5f',
              borderRadius: '9999px',
              padding: '6px 14px 6px 10px',
              color: '#f8fafc',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '9999px',
                backgroundColor: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <ModuleIcon name={currentMod.iconName} size={15} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.01em' }}>
                {currentMod.name}
              </span>
              <ChevronDown size={14} style={{ color: '#94a3b8' }} />
            </div>
          </button>

          {/* Right: Clean Avatar Circle (Zero Jargon) */}
          <div style={{ position: 'relative' }}>
            {user ? (
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="User Account"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '9999px',
                  border: '2px solid #1e3a5f',
                  backgroundColor: '#0d1829',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s ease'
                }}
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8' }}>
                    {initials}
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={() => setActiveModule('account')}
                aria-label="Sign In"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#0d1829',
                  border: '1px solid #1e3a5f',
                  borderRadius: '9999px',
                  padding: '6px 12px',
                  color: '#38bdf8',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <LogIn size={15} />
                <span>Sign In</span>
              </button>
            )}

            {/* Quick User Dropdown */}
            {isMenuOpen && user && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                  onClick={() => setIsMenuOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '46px',
                    right: 0,
                    width: '240px',
                    backgroundColor: '#0d1829',
                    border: '1px solid #1e3a5f',
                    borderRadius: '16px',
                    padding: '8px',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                    zIndex: 70,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ padding: '8px 12px 10px 12px', borderBottom: '1px solid #1e293b' }}>
                    <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '14px' }}>
                      {user.username}
                    </div>
                    {user.email && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#94a3b8',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {user.email}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setActiveModule('account');
                      setIsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '13px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <Bell size={16} color="#38bdf8" />
                    <span>Notification Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveModule('account');
                      setIsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '13px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <Shield size={16} color="#38bdf8" />
                    <span>Profile & Security</span>
                  </button>

                  <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '4px 0' }} />

                  <button
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '13px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Module Switcher Bottom Sheet */}
      <ModuleSwitcherDrawer
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
      />
    </>
  );
};
