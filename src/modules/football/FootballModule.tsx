import React, { useState, useEffect, useRef } from 'react';
import { useWallyAuth } from '../../context/WallyAuthContext';
import { FootballPickWizard, type FootballGame } from './FootballPickWizard';
import { Calendar, ChevronDown, RefreshCw, Trophy, Zap, Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import './FootballPickem.css';

interface Participant {
  entry_id: number;
  user_id: number;
  username: string;
  is_me: boolean;
  avatar_url?: string;
  correct_count: number;
  graded_count: number;
  mnf_points_prediction: number | null;
  picks: Record<
    string,
    {
      game_id: number;
      selected_team: string | null;
      is_revealed: boolean;
      result: 'correct' | 'incorrect' | 'push' | 'pending';
    }
  >;
}

interface CurrentUserStatus {
  is_authenticated: boolean;
  auth_source?: string | null;
  user: {
    id: number | null;
    username: string;
    email?: string | null;
    role: string;
    avatar_url?: string | null;
  } | null;
  has_submitted: boolean;
  picks_count: number;
  total_games: number;
  missing_picks: boolean;
  user_picks: Record<number, string>;
  mnf_points: number | null;
}

interface WeekDataResponse {
  season: number;
  week: number;
  current_week: number;
  is_current_week: boolean;
  games: FootballGame[];
  tiebreaker_game: FootballGame | null;
  participants: Participant[];
  current_user_status: CurrentUserStatus;
}

export const FootballModule: React.FC = () => {
  const { user } = useWallyAuth();
  const [currentWeek, setCurrentWeek] = useState<number>(10);
  const [selectedWeek, setSelectedWeek] = useState<number>(10);
  const [season, setSeason] = useState<number>(2026);
  const [weekData, setWeekData] = useState<WeekDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'matrix' | 'matchups'>('matrix');
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [hasPromptedWizard, setHasPromptedWizard] = useState<boolean>(false);

  // Fetch season & current week metadata
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await fetch('/football_api.php?action=meta', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.season) setSeason(data.season);
          if (data.current_week) {
            setCurrentWeek(data.current_week);
            setSelectedWeek(data.current_week);
          }
        }
      } catch (err) {
        console.error('Failed to load football meta', err);
      }
    };
    fetchMeta();
  }, []);

  // Fetch matrix data for selected week
  const fetchWeekMatrix = async (weekToLoad: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/football_api.php?action=matrix&week=${weekToLoad}`, { credentials: 'include' });
      if (res.ok) {
        const data: WeekDataResponse = await res.json();
        setWeekData(data);

        // Auto-prompt wizard on current week if picks are incomplete
        if (
          data.is_current_week &&
          data.current_user_status?.is_authenticated &&
          (data.current_user_status.missing_picks || !data.current_user_status.has_submitted) &&
          !hasPromptedWizard
        ) {
          setIsWizardOpen(true);
          setHasPromptedWizard(true);
        }
      }
    } catch (err) {
      console.error('Failed to load matrix data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWeek) {
      fetchWeekMatrix(selectedWeek);
    }
  }, [selectedWeek]);

  const handlePicksSaved = (newPicks: Record<number, string>, mnfPts: number | null) => {
    if (weekData) {
      setWeekData({
        ...weekData,
        current_user_status: {
          ...weekData.current_user_status,
          has_submitted: true,
          missing_picks: false,
          picks_count: Object.keys(newPicks).length,
          user_picks: newPicks,
          mnf_points: mnfPts,
        },
      });
    }
    fetchWeekMatrix(selectedWeek);
  };

  const isCurrentWeekSelected = selectedWeek === currentWeek;
  const userMissingPicks =
    weekData?.current_user_status?.missing_picks || !weekData?.current_user_status?.has_submitted;

  // Build list of selectable weeks up to current week
  const availableWeeks = Array.from({ length: currentWeek }, (_, i) => i + 1);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '12px 14px 40px 14px' }}>
      {/* Sub-Header: Week Controls & Primary Action */}
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
          padding: '12px 16px',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Week Selector Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              aria-label="Select NFL Week"
              style={{
                appearance: 'none',
                backgroundColor: '#070d17',
                border: '1px solid #1e3a5f',
                borderRadius: '10px',
                padding: '8px 34px 8px 14px',
                color: '#f8fafc',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {availableWeeks.map((wk) => (
                <option key={wk} value={wk}>
                  Week {wk} {wk === currentWeek ? '(Current)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}
            />
          </div>

          {/* View Mode Toggle: Matrix vs Matchups */}
          <div style={{ display: 'flex', backgroundColor: '#070d17', border: '1px solid #1e2d42', borderRadius: '10px', padding: '2px' }}>
            <button
              onClick={() => setActiveTab('matrix')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'matrix' ? '#0284c7' : 'transparent',
                color: activeTab === 'matrix' ? '#ffffff' : '#94a3b8',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Matrix
            </button>
            <button
              onClick={() => setActiveTab('matchups')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'matchups' ? '#0284c7' : 'transparent',
                color: activeTab === 'matchups' ? '#ffffff' : '#94a3b8',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Matchups
            </button>
          </div>
        </div>

        {/* Right Action: Make Picks / Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isCurrentWeekSelected && (
            <button
              onClick={() => setIsWizardOpen(true)}
              style={{
                backgroundColor: userMissingPicks ? '#0284c7' : '#1e293b',
                color: '#ffffff',
                border: userMissingPicks ? 'none' : '1px solid #1e3a5f',
                borderRadius: '10px',
                padding: '8px 16px',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Zap size={14} color="#f59e0b" fill="#f59e0b" />
              <span>{userMissingPicks ? 'Make Picks' : 'Edit Picks'}</span>
            </button>
          )}

          <button
            onClick={() => fetchWeekMatrix(selectedWeek)}
            disabled={isLoading}
            title="Refresh Scores & Picks"
            style={{
              backgroundColor: '#070d17',
              border: '1px solid #1e2d42',
              borderRadius: '10px',
              padding: '8px 10px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <div style={{ color: '#38bdf8', fontSize: '14px', fontWeight: 600 }}>Loading Week {selectedWeek} data...</div>
        </div>
      ) : activeTab === 'matrix' ? (
        /* Text-Only Matrix Table (No bulky team logos in cells) */
        <div
          style={{
            backgroundColor: '#0d1829',
            border: '1px solid #1e3a5f',
            borderRadius: '16px',
            overflow: 'hidden'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#070d17', borderBottom: '1px solid #1e3a5f' }}>
                  <th
                    style={{
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#070d17',
                      zIndex: 2,
                      padding: '12px 14px',
                      textAlign: 'left',
                      fontWeight: 700,
                      color: '#f8fafc',
                      minWidth: '150px'
                    }}
                  >
                    Participant
                  </th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#38bdf8', minWidth: '70px' }}>
                    Score
                  </th>
                  {weekData?.games.map((g) => (
                    <th
                      key={g.id}
                      style={{
                        padding: '10px 8px',
                        textAlign: 'center',
                        fontWeight: 600,
                        color: '#94a3b8',
                        minWidth: '85px',
                        borderLeft: '1px solid #1e293b'
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{g.away_team} @ {g.home_team}</div>
                      <div style={{ fontSize: '10px', color: g.is_final ? '#10b981' : g.is_started ? '#f59e0b' : '#64748b' }}>
                        {g.is_final ? 'Final' : g.is_started ? 'Live' : g.kickoff_time?.split(' ')[1] || 'Upcoming'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekData?.participants.map((p) => (
                  <tr
                    key={p.user_id}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      backgroundColor: p.is_me ? 'rgba(56, 189, 248, 0.06)' : 'transparent'
                    }}
                  >
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        backgroundColor: p.is_me ? '#0c1b2f' : '#0d1829',
                        zIndex: 1,
                        padding: '10px 14px',
                        fontWeight: p.is_me ? 700 : 500,
                        color: p.is_me ? '#38bdf8' : '#f8fafc',
                        borderRight: '1px solid #1e3a5f'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{p.username}</span>
                        {p.is_me && (
                          <span style={{ fontSize: '10px', backgroundColor: '#0284c7', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>
                            YOU
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#f8fafc' }}>
                      {p.correct_count}
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>/{p.graded_count}</span>
                    </td>

                    {weekData?.games.map((g) => {
                      const pickInfo = p.picks[g.id];
                      const pickTeam = pickInfo?.selected_team;
                      const isCorrect = pickInfo?.result === 'correct';
                      const isIncorrect = pickInfo?.result === 'incorrect';
                      const isRevealed = pickInfo?.is_revealed;

                      let cellBg = 'transparent';
                      let textColor = '#94a3b8';
                      if (isRevealed && pickTeam) {
                        if (isCorrect) {
                          cellBg = 'rgba(16, 185, 129, 0.15)';
                          textColor = '#34d399';
                        } else if (isIncorrect) {
                          cellBg = 'rgba(239, 68, 68, 0.12)';
                          textColor = '#f87171';
                        } else {
                          textColor = '#f8fafc';
                        }
                      }

                      return (
                        <td
                          key={g.id}
                          style={{
                            padding: '8px',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '12px',
                            backgroundColor: cellBg,
                            color: textColor,
                            borderLeft: '1px solid #1e293b'
                          }}
                        >
                          {!isRevealed ? (
                            <span style={{ color: '#475569' }}>•••</span>
                          ) : (
                            pickTeam || <span style={{ color: '#475569' }}>-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Matchups Card View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {weekData?.games.map((g) => (
            <div
              key={g.id}
              style={{
                backgroundColor: '#0d1829',
                border: '1px solid #1e3a5f',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                <span>{g.kickoff_time}</span>
                <span style={{ fontWeight: 700, color: g.is_final ? '#10b981' : g.is_started ? '#f59e0b' : '#64748b' }}>
                  {g.is_final ? 'FINAL' : g.is_started ? 'LIVE' : 'UPCOMING'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {g.away_logo && <img src={g.away_logo} alt={g.away_team} style={{ width: '28px', height: '28px' }} />}
                  <span style={{ fontWeight: 700, color: '#f8fafc' }}>{g.away_name}</span>
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                  {g.away_score !== null ? g.away_score : ''}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {g.home_logo && <img src={g.home_logo} alt={g.home_team} style={{ width: '28px', height: '28px' }} />}
                  <span style={{ fontWeight: 700, color: '#f8fafc' }}>{g.home_name}</span>
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                  {g.home_score !== null ? g.home_score : ''}
                </span>
              </div>

              {weekData.current_user_status?.user_picks[g.id] && (
                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                  Your Pick: <strong style={{ color: '#38bdf8' }}>{weekData.current_user_status.user_picks[g.id]}</strong>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pick Wizard Modal */}
      {weekData && (
        <FootballPickWizard
          games={weekData.games}
          userPicks={weekData.current_user_status?.user_picks || {}}
          initialMnfPoints={weekData.current_user_status?.mnf_points}
          week={selectedWeek}
          season={season}
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onSaved={handlePicksSaved}
        />
      )}
    </div>
  );
};
