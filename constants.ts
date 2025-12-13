export const BOARD_WIDTH = 50;
export const BOARD_HEIGHT = 50;
export const SERVER_URL = 'https://neon-snake-rivals-ai-production.up.railway.app'; // Production URL
export const INITIAL_SPEED = 100; // ms per tick - Keeping for types/reference, but logic overrides
export const START_GAME_SPEED = 200; // Start slow
export const SPEED_DECREMENT = 5; // -5ms per point
export const MIN_SPEED = 30;

export const WIN_SCORE = 50;
export const RESTART_DELAY = 60; // seconds

export const SNAKE_1_START = { x: 5, y: 5 };
export const SNAKE_2_START = { x: 19, y: 19 };

export const THEME = {
  gridColor: 'border-slate-800',
  snake1Color: 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]',
  snake2Color: 'bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.8)]',
  foodColor: 'bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.9)] animate-pulse',
};
