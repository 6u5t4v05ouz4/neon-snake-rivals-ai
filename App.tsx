import React, { useMemo, useState, useEffect } from 'react';
import { useSnakeGame } from './hooks/useSnakeGame';
import SnakeBoard from './components/SnakeBoard';
import StatsPanel from './components/StatsPanel';
import BettingPanel from './components/BettingPanel';
import ChatPanel from './components/ChatPanel';
import LeaderboardPanel from './components/LeaderboardPanel';
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

// Inner component to use wallet hooks
const AppContent: React.FC = () => {
  const { gameState, ping } = useSnakeGame();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const { publicKey, connected } = useWallet();
  const [userHasBet, setUserHasBet] = useState(false);
  const { play, enabled: soundEnabled, toggle: toggleSound } = useSoundEffects();

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
      countdown <= 3 &&
      countdown > 0 &&
      countdown !== prevCountdown.current) {
      play('countdown');
    }
    prevCountdown.current = countdown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.nextMatchCountdown]);

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

      {/* Left Panel - Betting */}
      <BettingPanel isCountdown={isCountdown} />

      {/* Left Panel - Leaderboard (below Betting) */}
      <div className="fixed bottom-4 left-4 w-72 z-30">
        <LeaderboardPanel currentWallet={publicKey?.toBase58() || null} />
      </div>

      {/* Right Panel - Stats */}
      <StatsPanel currentScores={{ cyan: s1.score, magenta: s2.score }} />

      {/* Right Panel - Chat (below Stats) */}
      <div className="fixed top-[380px] right-4 w-72 h-[320px] z-30">
        <ChatPanel
          walletAddress={publicKey?.toBase58() || null}
          userHasBet={canAccessChat}
        />
      </div>

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
        {/* Ping Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-800/80 rounded-full border border-slate-600"
          title={ping ? `Latency: ${ping}ms` : 'Connecting...'}
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
          <AppContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;

