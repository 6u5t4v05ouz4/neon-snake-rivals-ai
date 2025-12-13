import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Snake, GameStatus, Direction, Point } from '../types';
import { BOARD_WIDTH, BOARD_HEIGHT, SNAKE_1_START, SNAKE_2_START, MIN_SPEED, START_GAME_SPEED, SPEED_DECREMENT } from '../constants';
import { getBestMove } from '../services/aiLogic';

const getRandomFreePoint = (occupiedBodies: Point[][]): Point => {
  while (true) {
    const p = {
      x: Math.floor(Math.random() * BOARD_WIDTH),
      y: Math.floor(Math.random() * BOARD_HEIGHT),
    };
    const isOccupied = occupiedBodies.some(body =>
      body.some(segment => segment.x === p.x && segment.y === p.y)
    );
    if (!isOccupied) return p;
  }
};

const createInitialState = (): GameState => {
  const s1Body = [SNAKE_1_START, { x: SNAKE_1_START.x, y: SNAKE_1_START.y - 1 }];
  const s2Body = [SNAKE_2_START, { x: SNAKE_2_START.x, y: SNAKE_2_START.y + 1 }];
  const now = Date.now();

  return {
    snakes: [
      {
        id: 's1',
        name: 'Cyan Viper',
        body: s1Body,
        direction: Direction.DOWN,
        color: '#22d3ee',
        score: 0,
        eliminated: false,
        colorClass: 'cyan',
        lastMoveTime: now,
      },
      {
        id: 's2',
        name: 'Magenta Python',
        body: s2Body,
        direction: Direction.UP,
        color: '#d946ef',
        score: 0,
        eliminated: false,
        colorClass: 'magenta',
        lastMoveTime: now,
      },
    ],
    // Randomize food position instead of center to prevent simultaneous arrival
    food: getRandomFreePoint([s1Body, s2Body]),
    status: GameStatus.IDLE,
    tick: 0,
    winner: null,
  };
};

export const useSnakeGame = () => {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spawnFood = (currentSnakes: Snake[]): Point => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * BOARD_WIDTH),
        y: Math.floor(Math.random() * BOARD_HEIGHT),
      };
      // Check collision with snakes
      const collision = currentSnakes.some(s =>
        s.body.some(b => b.x === newFood.x && b.y === newFood.y)
      );
      if (!collision) break;
    }
    return newFood;
  };

  const calculateSnakeSpeed = (score: number) => {
    return Math.max(MIN_SPEED, START_GAME_SPEED - (score * SPEED_DECREMENT));
  };

  const tick = useCallback(() => {
    setGameState(prev => {
      if (prev.status !== GameStatus.PLAYING) return prev;

      const now = Date.now();
      let nextSnakes = prev.snakes.map(snake => ({ ...snake, body: [...snake.body] }));
      let nextFood = prev.food;
      let winner = prev.winner;
      let newStatus = prev.status;
      let stateChanged = false;

      // 1. Move Snakes independently
      nextSnakes.forEach(snake => {
        if (snake.eliminated) return;

        const speed = calculateSnakeSpeed(snake.score);
        if (now - snake.lastMoveTime >= speed) {
          stateChanged = true;
          snake.lastMoveTime = now;

          // AI Logic
          snake.direction = getBestMove(snake, prev.snakes, prev.food);

          const head = snake.body[0];
          let newHead = { ...head };

          switch (snake.direction) {
            case Direction.UP: newHead.y -= 1; break;
            case Direction.DOWN: newHead.y += 1; break;
            case Direction.LEFT: newHead.x -= 1; break;
            case Direction.RIGHT: newHead.x += 1; break;
          }

          snake.body.unshift(newHead); // Add new head

          // Check Food
          if (newHead.x === nextFood.x && newHead.y === nextFood.y) {
            snake.score += 1;
            nextFood = spawnFood(nextSnakes);
            // Don't pop tail (grow)
          } else {
            snake.body.pop(); // Remove tail
          }
        }
      });

      if (!stateChanged) return prev; // Optimization: Skip render if nobody moved

      // 2. Check Collisions (Walls & Bodies)
      // Check ALL snakes against current positions (some might have moved, some not)
      nextSnakes.forEach(snake => {
        if (snake.eliminated) return;
        const head = snake.body[0];

        // Wall Collision
        if (head.x < 0 || head.x >= BOARD_WIDTH || head.y < 0 || head.y >= BOARD_HEIGHT) {
          snake.eliminated = true;
        }

        // Body Collision (Self & Others)
        nextSnakes.forEach(otherSnake => {
          // If checking self, skip head (index 0)
          const segmentsToCheck = otherSnake.id === snake.id ? otherSnake.body.slice(1) : otherSnake.body;
          if (segmentsToCheck.some(seg => seg.x === head.x && seg.y === head.y)) {
            snake.eliminated = true;
          }

          // Head-to-Head Collision
          if (otherSnake.id !== snake.id && !otherSnake.eliminated) {
            if (head.x === otherSnake.body[0].x && head.y === otherSnake.body[0].y) {
              snake.eliminated = true;
              otherSnake.eliminated = true;
            }
          }
        });
      });

      // 3. Determine Winner
      const aliveSnakes = nextSnakes.filter(s => !s.eliminated);
      if (aliveSnakes.length === 0) {
        newStatus = GameStatus.GAME_OVER;
        const s1 = nextSnakes[0];
        const s2 = nextSnakes[1];
        if (s1.eliminated && s2.eliminated) {
          winner = s1.score > s2.score ? s1.name : (s2.score > s1.score ? s2.name : "Draw");
        } else {
          winner = "Draw";
        }
      } else if (aliveSnakes.length === 1 && prev.snakes.length > 1) {
        newStatus = GameStatus.GAME_OVER;
        winner = aliveSnakes[0].name;
      }

      return {
        ...prev,
        snakes: nextSnakes,
        food: nextFood,
        status: newStatus,
        winner,
        tick: prev.tick + 1
      };
    });
  }, []);

  useEffect(() => {
    if (gameState.status === GameStatus.PLAYING) {
      gameLoopRef.current = setInterval(tick, 16); // ~60 FPS fixed tick rate
    } else {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState.status, tick]);

  const startGame = () => setGameState(prev => ({ ...prev, status: GameStatus.PLAYING }));
  const pauseGame = () => setGameState(prev => ({ ...prev, status: GameStatus.PAUSED }));
  const resetGame = () => setGameState(createInitialState());

  return { gameState, startGame, pauseGame, resetGame };
};