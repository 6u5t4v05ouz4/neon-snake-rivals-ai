import React, { useMemo, useState, useEffect } from 'react';
import { useSnakeGame } from './hooks/useSnakeGame';
import SnakeBoard from './components/SnakeBoard';
import StatsPanel from './components/StatsPanel';
import BettingPanel from './components/BettingPanel';
import ChatPanel from './components/ChatPanel';
import HowItWorks from './components/HowItWorks';
import { HelpCircle } from 'lucide-react';
import { GameStatus } from './types';
import { SERVER_URL } from './constants';

// Solana Imports
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { useWallet } from '@solana/wallet-adapter-react';
import '@solana/wallet-adapter-react-ui/styles.css';

// Inner component to use wallet hooks
const AppContent: React.FC = () => {
  const { gameState } = useSnakeGame();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const { publicKey, connected } = useWallet();
  const [userHasBet, setUserHasBet] = useState(false);

  const s1 = gameState.snakes[0];
  const s2 = gameState.snakes[1];
  const isCountdown = gameState.nextMatchCountdown !== null && gameState.nextMatchCountdown > 0;

  // Check if user has bet in current session
  // Once user bets, chat stays active until session resets
  useEffect(() => {
    if (!connected || !publicKey) {
      setUserHasBet(false);
      return;
    }

    const checkBet = async () => {
      try {
        const betsRes = await fetch(`${SERVER_URL}/my-bets/${publicKey.toBase58()}`);
        const bets = await betsRes.json();

        if (bets.length === 0) {
          setUserHasBet(false);
          return;
        }

        // Get the most recent bet
        const latestBet = bets[0]; // Already ordered by createdAt desc
        const betTime = new Date(latestBet.createdAt).getTime();
        const now = Date.now();
        const twoHoursAgo = now - (2 * 60 * 60 * 1000);

        // If user has a bet from the last 2 hours, allow chat
        // This covers the entire session duration
        if (betTime > twoHoursAgo) {
          setUserHasBet(true);
          return;
        }

        // Fallback: check current pool
        const poolRes = await fetch(`${SERVER_URL}/current-pool`);
        const poolData = await poolRes.json();
        const currentBet = poolData.poolPda ? bets.find((b: any) => b.poolPda === poolData.poolPda) : null;

        setUserHasBet(!!currentBet);
      } catch (e) {
        console.error('Error checking bet:', e);
        // Don't reset to false on error - keep current state
      }
    };

    checkBet();
    const interval = setInterval(checkBet, 5000);
    return () => clearInterval(interval);
  }, [connected, publicKey]);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center">

      {/* Header */}
      <header className="w-full max-w-6xl mb-8 flex flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-white to-fuchsia-500 brand-font tracking-tighter">
            SNAKE SOL ARENA
          </h1>
          <p className="text-slate-400 text-sm mt-1 font-mono">
            <span className="text-cyan-400">AUTONOMOUS_AI</span> // POWERED_BY_GEMINI 3
          </p>
        </div>
      </header>

      {/* Left Panel - Betting */}
      <BettingPanel isCountdown={isCountdown} />

      {/* Right Panel - Stats */}
      <StatsPanel currentScores={{ cyan: s1.score, magenta: s2.score }} />

      {/* Right Panel - Chat (below Stats) */}
      <div className="fixed top-[380px] right-4 w-72 h-[320px] z-30">
        <ChatPanel
          walletAddress={publicKey?.toBase58() || null}
          userHasBet={userHasBet}
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

