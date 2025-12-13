import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, GameStatus, Direction } from '../types';
import { SERVER_URL, SNAKE_1_START, SNAKE_2_START, BOARD_WIDTH, BOARD_HEIGHT } from '../constants';

// Initial dummy state to render before connection
const createInitialState = (): GameState => ({
  snakes: [
    {
      id: 'snake1',
      name: 'CYAN VIPER',
      body: [SNAKE_1_START],
      direction: Direction.RIGHT,
      color: '#22d3ee',
      score: 0,
      eliminated: false,
      colorClass: 'cyan',
      lastMoveTime: 0,
    },
    {
      id: 'snake2',
      name: 'MAGENTA PYTHON',
      body: [SNAKE_2_START],
      direction: Direction.LEFT,
      color: '#d946ef',
      score: 0,
      eliminated: false,
      colorClass: 'fuchsia',
      lastMoveTime: 0,
    },
  ],
  food: { x: Math.floor(BOARD_WIDTH / 2), y: Math.floor(BOARD_HEIGHT / 2) },
  status: GameStatus.PLAYING,
  tick: 0,
  winner: null,
  nextMatchCountdown: null,
});

export const useSnakeGame = () => {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Connect to specific URL (Railway or Local)
    // For deployment, this should ideally be an env var or the same host if served together.
    // For now we use the constant.
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to game server:', newSocket.id);
    });

    newSocket.on('gameState', (serverState: GameState) => {
      setGameState(serverState);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from game server');
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // No local control functions needed for spectators/simulation view
  const startGame = () => { };
  const pauseGame = () => { };
  const resetGame = () => { };

  return { gameState, startGame, pauseGame, resetGame };
};