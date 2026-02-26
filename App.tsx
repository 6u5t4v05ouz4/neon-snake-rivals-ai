import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSnakeGame } from './hooks/useSnakeGame';
import SnakeBoard from './components/SnakeBoard';
import StatsPanel from './components/StatsPanel';
import BettingPanel from './components/BettingPanel';
import ChatPanel from './components/ChatPanel';
import LeaderboardPanel from './components/LeaderboardPanel';
import RewardHistoryPanel from './components/RewardHistoryPanel';
import DraggablePanel from './components/DraggablePanel';
import HowItWorks from './components/HowItWorks';
import { HelpCircle, Volume2, VolumeX, Twitter, Wifi } from 'lucide-react';
import { GameStatus } from './types';
import { SERVER_URL } from './constants';

// Solana Imports
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { useWallet } from '@solana/wallet-adapter-react';
import '@solana/wallet-adapter-react-ui/styles.css';
import { useSoundEffects } from './hooks/useSoundEffects';
import { useRpcPing } from './hooks/useRpcPing';
import { ToastProvider } from './components/Toast';

// Inner component to use wallet hooks
const AppContent: React.FC = () => {
  const { gameState, ping } = useSnakeGame();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showRewardHistory, setShowRewardHistory] = useState(false);
  const { publicKey, connected } = useWallet();
  const [userHasBet, setUserHasBet] = useState(false);
  const { play, enabled: soundEnabled, toggle: toggleSound } = useSoundEffects();
  const rpcPing = useRpcPing('https://api.devnet.solana.com');

  const s1 = gameState.snakes[0];
  const s2 = gameState.snakes[1];
  const isCountdown = gameState.nextMatchCountdown !== null && gameState.nextMatchCountdown > 0;

  // Check if user has bet on current pool AND battle is active
  // Chat only available during battle (not during countdown)
  const isBattleActive = gameState.status === GameStatus.PLAYING;

  useEffect(() => {
    if (!connected || !publicKey) {
      setUserHasBet(false);
      return;
    }

    const checkBet = async () => {
      try {
        // Get current pool
        const poolRes = await fetch(`${SERVER_URL}/current-pool`);
        const poolData = await poolRes.json();

        if (!poolData.poolPda) {
          setUserHasBet(false);
          return;
        }

        // Check if user has bet on this pool
        const betsRes = await fetch(`${SERVER_URL}/my-bets/${publicKey.toBase58()}`);
        const bets = await betsRes.json();

        const currentBet = bets.find((b: any) => b.poolPda === poolData.poolPda);
        setUserHasBet(!!currentBet);
      } catch (e) {
        console.error('Error checking bet:', e);
      }
    };

    checkBet();
    const interval = setInterval(checkBet, 3000);
    return () => clearInterval(interval);
  }, [connected, publicKey]);

  // Chat is enabled only during battle AND if user has bet
  const canAccessChat = isBattleActive && userHasBet;

  // Track previous state for sound triggers
  const prevScores = React.useRef({ cyan: 0, magenta: 0 });
  const prevStatus = React.useRef<string>(gameState.status);
  const prevCountdown = React.useRef<number | null>(null);

  // Sound effects based on game state changes
  useEffect(() => {
    // Score increase = eat sound
    if (s1.score > prevScores.current.cyan || s2.score > prevScores.current.magenta) {
      play('eat');
    }
    prevScores.current = { cyan: s1.score, magenta: s2.score };
  }, [s1.score, s2.score, play]);

  useEffect(() => {
    // Track game status changes (no sound for these events currently)
    prevStatus.current = gameState.status;
  }, [gameState.status]);

  useEffect(() => {
    // Countdown tick sound (only last 3 seconds, only when value changes)
    const countdown = gameState.nextMatchCountdown;
    if (countdown !== null &&
      countdown <= 6 &&
      countdown > 0 &&
      countdown !== prevCountdown.current) {
      play('countdown');
    }
    prevCountdown.current = countdown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.nextMatchCountdown]);

  // ===== DRAGGABLE PANEL SYSTEM =====
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const STORAGE_KEY = 'snakearena-panel-positions';

  // Default positions (matching old fixed layout)
  const DEFAULT_POSITIONS: Record<string, { x: number; y: number }> = {
    betting: { x: 16, y: 80 },
    leaderboard: { x: 16, y: 0 },   // will be calculated
    stats: { x: 0, y: 16 },          // will be calculated
    chat: { x: 0, y: 340 },          // will be calculated
  };

  // Load saved positions or use defaults
  const loadPositions = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {};
  }, []);

  const [panelPositions, setPanelPositions] = useState<Record<string, { x: number; y: number }>>(loadPositions);

  // Calculate right-side default positions based on window width
  const getDefaultPosition = useCallback((id: string) => {
    if (panelPositions[id]) return panelPositions[id];
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    switch (id) {
      case 'betting': return { x: 16, y: 80 };
      case 'leaderboard': return { x: 16, y: typeof window !== 'undefined' ? window.innerHeight - 320 : 400 };
      case 'stats': return { x: w - 304, y: 16 };
      case 'chat': return { x: w - 304, y: 340 };
      default: return { x: 0, y: 0 };
    }
  }, [panelPositions]);

  // Save position on change
  const handlePositionChange = useCallback((id: string, pos: { x: number; y: number }) => {
    setPanelPositions(prev => {
      const next = { ...prev, [id]: pos };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Get bounding rects of all panels except the one being dragged
  const getPanelRects = useCallback((excludeId: string): DOMRect[] => {
    return Object.entries(panelRefs.current)
      .filter(([id, el]) => id !== excludeId && el !== null)
      .map(([, el]) => (el as HTMLDivElement).getBoundingClientRect());
  }, []);

  // Register panel refs
  const registerPanelRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    panelRefs.current[id] = el;
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center">

      {/* Header */}
      <header className="w-full max-w-6xl mb-8 flex flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-white to-fuchsia-500 brand-font tracking-tighter">
            SNAKE SOL ARENA
          </h1>
          <p className="text-slate-400 text-sm mt-1 font-mono">
            <span className="text-cyan-400">AUTONOMOUS_AI // LIVE ON DEVNET</span>
          </p>
        </div>
      </header>

      {/* Draggable Panels */}
      <DraggablePanel
        id="betting"
        defaultPosition={getDefaultPosition('betting')}
        onPositionChange={handlePositionChange}
        getPanelRects={getPanelRects}
        style={{ zIndex: 30 }}
      >
        <div ref={registerPanelRef('betting')}>
          <BettingPanel isCountdown={isCountdown} />
        </div>
      </DraggablePanel>

      <DraggablePanel
        id="leaderboard"
        defaultPosition={getDefaultPosition('leaderboard')}
        position={panelPositions['leaderboard'] || getDefaultPosition('leaderboard')}
        onPositionChange={handlePositionChange}
        getPanelRects={getPanelRects}
        style={{ zIndex: 30 }}
      >
        <div ref={registerPanelRef('leaderboard')}>
          <LeaderboardPanel currentWallet={publicKey?.toBase58() || null} onShowHistory={() => setShowRewardHistory(true)} />
        </div>
      </DraggablePanel>

      {/* Reward History Modal */}
      {showRewardHistory && <RewardHistoryPanel onClose={() => setShowRewardHistory(false)} />}

      <DraggablePanel
        id="stats"
        defaultPosition={getDefaultPosition('stats')}
        position={panelPositions['stats'] || getDefaultPosition('stats')}
        onPositionChange={handlePositionChange}
        getPanelRects={getPanelRects}
        style={{ zIndex: 30 }}
      >
        <div ref={registerPanelRef('stats')}>
          <StatsPanel currentScores={{ cyan: s1.score, magenta: s2.score }} />
        </div>
      </DraggablePanel>

      <DraggablePanel
        id="chat"
        defaultPosition={getDefaultPosition('chat')}
        position={panelPositions['chat'] || getDefaultPosition('chat')}
        onPositionChange={handlePositionChange}
        getPanelRects={getPanelRects}
        style={{ zIndex: 30 }}
      >
        <div ref={registerPanelRef('chat')} className="w-72 h-[420px]">
          <ChatPanel
            walletAddress={publicKey?.toBase58() || null}
            userHasBet={canAccessChat}
          />
        </div>
      </DraggablePanel>

      {/* Main Content - Game Board */}
      <main className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-4">
        <div className="w-full flex flex-col gap-4 items-center">
          <SnakeBoard gameState={gameState} />

          {/* Status Indicator */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-center gap-6">
            <button
              onClick={() => setShowHowItWorks(true)}
              className="flex items-center gap-2 bg-indigo-900/50 hover:bg-indigo-800/60 px-4 py-2 rounded-full border border-indigo-500/50 transition-colors cursor-pointer"
            >
              <HelpCircle size={16} className="text-indigo-400" />
              <span className="text-xs text-indigo-300 uppercase tracking-widest font-semibold">HOW IT WORKS</span>
            </button>
          </div>
        </div>
      </main>

      {/* How It Works Modal */}
      <HowItWorks isOpen={showHowItWorks} onClose={() => setShowHowItWorks(false)} />

      {/* Footer - Controls & Social Links */}
      <footer className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
        {/* RPC Ping Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-800/80 rounded-full border border-slate-600"
          title={rpcPing ? `Solana RPC: ${rpcPing}ms` : 'Connecting to RPC...'}
        >
          <span className="text-[10px] text-slate-500">RPC</span>
          <span className={`text-xs font-mono ${rpcPing !== null ? (rpcPing < 300 ? 'text-green-400' : rpcPing < 600 ? 'text-yellow-400' : 'text-red-400') : 'text-slate-500'}`}>
            {rpcPing !== null ? `${rpcPing}ms` : '--'}
          </span>
        </div>

        {/* WebSocket Ping Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-800/80 rounded-full border border-slate-600"
          title={ping ? `Server: ${ping}ms` : 'Connecting...'}
        >
          <Wifi size={14} className={ping !== null ? (ping < 100 ? 'text-green-400' : ping < 200 ? 'text-yellow-400' : 'text-red-400') : 'text-slate-500'} />
          <span className={`text-xs font-mono ${ping !== null ? (ping < 100 ? 'text-green-400' : ping < 200 ? 'text-yellow-400' : 'text-red-400') : 'text-slate-500'}`}>
            {ping !== null ? `${ping}ms` : '--'}
          </span>
        </div>

        {/* Sound Toggle */}
        <button
          onClick={toggleSound}
          className="flex items-center justify-center w-10 h-10 bg-slate-800/80 hover:bg-slate-700 rounded-full border border-slate-600 transition-colors"
          title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
        >
          {soundEnabled ? (
            <Volume2 size={18} className="text-green-400" />
          ) : (
            <VolumeX size={18} className="text-slate-500" />
          )}
        </button>

        {/* Twitter/X Link */}
        <a
          href="https://x.com/SnakeSolArena"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-10 h-10 bg-slate-800/80 hover:bg-slate-700 rounded-full border border-slate-600 transition-colors"
          title="Follow us on X"
        >
          <Twitter size={18} className="text-white" />
        </a>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  // Solana Config
  const endpoint = "https://api.devnet.solana.com";
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;

