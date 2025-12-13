export type Point = {
  x: number;
  y: number;
};

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

export interface Snake {
  id: string;
  name: string;
  body: Point[];
  direction: Direction;
  color: string;
  score: number;
  eliminated: boolean;
  colorClass: string; // Tailwind class for coloring
  lastMoveTime: number; // For independent speed tracking
}

export interface GameState {
  snakes: Snake[];
  food: Point;
  status: GameStatus;
  tick: number;
  winner: string | null;
  nextMatchCountdown: number | null; // Seconds until restart
}

export interface CommentaryMessage {
  id: string;
  text: string;
  timestamp: Date;
  type: 'play-by-play' | 'analysis' | 'shoutout';
}