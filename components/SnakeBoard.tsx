import React, { useMemo } from 'react';
import { GameState, GameStatus } from '../types';
import { BOARD_WIDTH, BOARD_HEIGHT, THEME } from '../constants';

interface Props {
  gameState: GameState;
}

const SnakeBoard: React.FC<Props> = ({ gameState }) => {
  // Create grid cells
  const grid = useMemo(() => {
    const cells = [];
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        cells.push({ x, y });
      }
    }
    return cells;
  }, []);

  const getCellClass = (x: number, y: number) => {
    // Check Food
    if (gameState.food.x === x && gameState.food.y === y) {
      return THEME.foodColor;
    }

    // Check Snake 1
    const s1 = gameState.snakes[0];
    const s1Index = s1.body.findIndex(p => p.x === x && p.y === y);
    if (s1Index !== -1) {
      return `${THEME.snake1Color} ${s1.eliminated ? 'opacity-30 grayscale' : 'opacity-100'} ${s1Index === 0 ? 'z-10 scale-110' : ''}`;
    }

    // Check Snake 2
    const s2 = gameState.snakes[1];
    const s2Index = s2.body.findIndex(p => p.x === x && p.y === y);
    if (s2Index !== -1) {
      return `${THEME.snake2Color} ${s2.eliminated ? 'opacity-30 grayscale' : 'opacity-100'} ${s2Index === 0 ? 'z-10 scale-110' : ''}`;
    }

    return 'bg-slate-900/50';
  };

  return (
    <div
      className="relative grid bg-slate-950 border-4 border-slate-800 rounded-lg shadow-2xl shadow-black overflow-hidden"
      style={{
        gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
        gridTemplateRows: `repeat(${BOARD_HEIGHT}, 1fr)`,
        aspectRatio: `${BOARD_WIDTH}/${BOARD_HEIGHT}`,
        width: '100%',
        maxWidth: '1000px',
      }}
    >
      {/* Scanline effect overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_4px,6px_100%] opacity-20"></div>

      {grid.map((cell) => (
        <div
          key={`${cell.x}-${cell.y}`}
          className={`relative border-[0.5px] ${THEME.gridColor} transition-all duration-75 ${getCellClass(cell.x, cell.y)}`}
        >
          {/* Eyes for head */}
          {/* This could be refined, but just color blocks for now is cleaner for the grid size */}
        </div>
      ))}

      {gameState.status === 'GAME_OVER' && (
        <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-8 backdrop-blur-sm">
          <h2 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-4 animate-pulse">
            GAME OVER
          </h2>
          <div className="text-2xl text-white mb-8 font-mono tracking-wider">
            WINNER: <span className="text-yellow-400 font-bold">{gameState.winner || 'DRAW'}</span>
          </div>

          {/* Countdown Display */}
          {gameState.nextMatchCountdown !== null && (
            <div className="text-slate-400 font-mono text-sm mt-4">
              NEXT MATCH IN <span className="text-white font-bold text-xl">{gameState.nextMatchCountdown}</span> SECONDS
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition hidden"
          >
            RESTART SIMULATION
          </button>
        </div>
      )}
    </div>
  );
};

export default SnakeBoard;
