import React, { useEffect, useState } from 'react';
import { useSnakeGame } from './hooks/useSnakeGame';
import SnakeBoard from './components/SnakeBoard';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';
import { INITIAL_SPEED, MIN_SPEED, START_GAME_SPEED, SPEED_DECREMENT } from './constants';
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

        {/* Score Board */}
        <div className="flex gap-6 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div className="text-center min-w-[80px]">
            <div className="text-xs text-cyan-400 font-bold mb-1">CYAN VIPER</div>
            <div className="text-2xl font-mono">{s1.score}</div>
          </div>
          <div className="w-[1px] bg-slate-700"></div>
          <div className="text-center min-w-[80px]">
            <div className="text-xs text-fuchsia-500 font-bold mb-1">MAGENTA PYTHON</div>
            <div className="text-2xl font-mono">{s2.score}</div>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="w-full max-w-6xl flex flex-col gap-8 items-center">

        {/* Game Board (Full Width) */}
        <div className="w-full flex flex-col gap-4 items-center">
          <SnakeBoard gameState={gameState} />

          {/* Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-center gap-6">
            <div className="flex gap-2">
              <button
                onClick={togglePlay}
                className={`flex items-center gap-2 px-6 py-2 rounded font-bold transition-all ${gameState.status === GameStatus.PLAYING
                  ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border border-amber-500/50'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50'
                  }`}
              >
                {gameState.status === GameStatus.PLAYING ? <Pause size={20} /> : <Play size={20} />}
                {gameState.status === GameStatus.PLAYING ? 'PAUSE' : 'START SIMULATION'}
              </button>

              <button
                onClick={resetGame}
                className="flex items-center gap-2 px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors text-slate-200"
              >
                <RotateCcw size={18} />
                RESET
              </button>
            </div>

            <div className="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-full border border-slate-800">
              <Zap size={16} className="text-yellow-400" />
              <span className="text-xs text-slate-400 uppercase tracking-widest pl-2">Individual snake speeds active</span>
            </div>
          </div>
        </div>

      </main>

    </div>
  );
};

export default App;
