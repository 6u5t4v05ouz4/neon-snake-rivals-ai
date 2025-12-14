import React, { useEffect, useState } from 'react';
import { useSnakeGame } from './hooks/useSnakeGame';
import SnakeBoard from './components/SnakeBoard';
import StatsPanel from './components/StatsPanel';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';
import { MIN_SPEED } from './constants';
import { GameStatus } from './types';

const App: React.FC = () => {
  const { gameState, startGame, pauseGame, resetGame } = useSnakeGame();

  // Removed speed effect logic

  // Removed Gemini init logic

  // Toggle Play/Pause
  const togglePlay = () => {
    if (gameState.status === GameStatus.PLAYING) {
      pauseGame();
    } else {
      startGame();
    }
  };

  // Calculate stats
  const s1 = gameState.snakes[0];
  const s2 = gameState.snakes[1];

  return (
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

      {/* Main Content Grid */}
      <main className="relative z-10 w-full max-w-7xl mx-auto flex flex-col items-center justify-center p-4 min-h-screen">
        <StatsPanel currentScores={{ cyan: s1.score, magenta: s2.score }} />

        {/* Game Board (Full Width) */}
        <div className="w-full flex flex-col gap-4 items-center">
          <SnakeBoard gameState={gameState} />

          {/* Status Indicator (Auto-Pilot) */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-full border border-slate-800">
              <Zap size={16} className="text-yellow-400" />
              <span className="text-xs text-slate-400 uppercase tracking-widest pl-2">AUTONOMOUS MODE • FIRST TO 50 Wins</span>
            </div>
          </div>
        </div>

      </main>

    </div>
  );
};

export default App;
