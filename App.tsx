import React, { useMemo, useState } from 'react';
import { useSnakeGame } from './hooks/useSnakeGame';
import SnakeBoard from './components/SnakeBoard';
import StatsPanel from './components/StatsPanel';
import BettingPanel from './components/BettingPanel';
import HowItWorks from './components/HowItWorks';
import { HelpCircle } from 'lucide-react';
import { GameStatus } from './types';

// Solana Imports
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import '@solana/wallet-adapter-react-ui/styles.css';

const App: React.FC = () => {
  const { gameState, startGame, pauseGame, resetGame } = useSnakeGame();
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const togglePlay = () => {
    if (gameState.status === GameStatus.PLAYING) {
      pauseGame();
    } else {
      startGame();
    }
  };

  // Solana Config
  const endpoint = "https://api.devnet.solana.com";
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  const s1 = gameState.snakes[0];
  const s2 = gameState.snakes[1];
  const isCountdown = gameState.nextMatchCountdown !== null && gameState.nextMatchCountdown > 0;

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center">

            {/* Header */}
            <header className="w-full max-w-6xl mb-8 flex flex-col items-center gap-6 text-center">
              <div>
                <h1 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-white to-fuchsia-500 brand-font tracking-tighter">
                  NEON SNAKE RIVALS
                </h1>
                <p className="text-slate-400 text-sm mt-1 font-mono">
                  <span className="text-cyan-400">AUTONOMOUS_AI</span> // POWERED_BY_GEMINI
                </p>
              </div>
            </header>

            {/* Left Panel - Betting */}
            <BettingPanel isCountdown={isCountdown} />

            {/* Right Panel - Stats */}
            <StatsPanel currentScores={{ cyan: s1.score, magenta: s2.score }} />

            {/* Main Content - Game Board (Center) */}
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

          </div>
        </WalletModalProvider>
      </WalletProvider>

      {/* How It Works Modal */}
      <HowItWorks isOpen={showHowItWorks} onClose={() => setShowHowItWorks(false)} />
    </ConnectionProvider>
  );
};

export default App;
