import { Point, Direction, Snake } from './types';
import { BOARD_WIDTH, BOARD_HEIGHT } from './constants';

// Helper: Check if a point is within bounds
const isValid = (p: Point): boolean => {
  return p.x >= 0 && p.x < BOARD_WIDTH && p.y >= 0 && p.y < BOARD_HEIGHT;
};

// Helper: Check if point collides with any snake body
const isCollision = (p: Point, snakes: Snake[]): boolean => {
  return snakes.some(snake =>
    snake.body.some(segment => segment.x === p.x && segment.y === p.y)
  );
};

// Helper: Get next coordinate for a direction
const getNextCoord = (head: Point, dir: Direction): Point => {
  switch (dir) {
    case Direction.UP: return { x: head.x, y: head.y - 1 };
    case Direction.DOWN: return { x: head.x, y: head.y + 1 };
    case Direction.LEFT: return { x: head.x - 1, y: head.y };
    case Direction.RIGHT: return { x: head.x + 1, y: head.y };
  }
};

// Helper: Manhattan distance
const distance = (a: Point, b: Point): number => {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};

// Helper: Get opposite direction (to prevent reversing)
const getOpposite = (dir: Direction): Direction => {
  switch (dir) {
    case Direction.UP: return Direction.DOWN;
    case Direction.DOWN: return Direction.UP;
    case Direction.LEFT: return Direction.RIGHT;
    case Direction.RIGHT: return Direction.LEFT;
  }
};

// Flood fill to calculate available space
const calculateFreeSpace = (start: Point, snakes: Snake[]): number => {
  const visited = new Set<string>();
  const queue: Point[] = [start];
  let count = 0;

  const MAX_DEPTH = 50;

  while (queue.length > 0 && count < MAX_DEPTH) {
    const current = queue.shift()!;
    const key = `${current.x},${current.y}`;

    if (visited.has(key)) continue;
    visited.add(key);
    count++;

    Object.values(Direction).forEach(dir => {
      const next = getNextCoord(current, dir);
      if (isValid(next) && !isCollision(next, snakes) && !visited.has(`${next.x},${next.y}`)) {
        queue.push(next);
      }
    });
  }
  return count;
};

// Simulate a move and return updated snake state
const simulateMove = (snake: Snake, dir: Direction, allSnakes: Snake[]): { snake: Snake; valid: boolean } => {
  const head = snake.body[0];
  const newHead = getNextCoord(head, dir);

  // Check if move is valid
  if (!isValid(newHead) || isCollision(newHead, allSnakes)) {
    return { snake, valid: false };
  }

  // Create new snake with moved position
  const newBody = [newHead, ...snake.body.slice(0, -1)];
  return {
    snake: { ...snake, body: newBody, direction: dir },
    valid: true
  };
};

// Evaluate a position (higher is better)
const evaluatePosition = (snake: Snake, allSnakes: Snake[], food: Point): number => {
  const head = snake.body[0];
  let score = 0;

  // Distance to food (closer = better)
  const distToFood = distance(head, food);
  score -= distToFood * 2;

  // Free space (more = better, avoid traps)
  const freeSpace = calculateFreeSpace(head, allSnakes);
  score += freeSpace * 5;

  // Avoid other snake heads
  const otherSnake = allSnakes.find(s => s.id !== snake.id);
  if (otherSnake) {
    const distToOtherHead = distance(head, otherSnake.body[0]);
    if (distToOtherHead < 3) {
      score -= (3 - distToOtherHead) * 30; // Closer = more dangerous
    }
  }

  // Bonus for being closer to center (more escape routes)
  const centerX = BOARD_WIDTH / 2;
  const centerY = BOARD_HEIGHT / 2;
  const distToCenter = Math.abs(head.x - centerX) + Math.abs(head.y - centerY);
  score -= distToCenter * 0.5;

  return score;
};

// Get safe moves (not immediate death)
const getSafeMoves = (snake: Snake, allSnakes: Snake[]): Direction[] => {
  const head = snake.body[0];
  const neck = snake.body[1];

  return Object.values(Direction).filter(dir => {
    const next = getNextCoord(head, dir);

    // Don't reverse into neck
    if (neck && next.x === neck.x && next.y === neck.y) return false;

    // Must be valid and not collide
    return isValid(next) && !isCollision(next, allSnakes);
  });
};

// LOOKAHEAD: Evaluate move by simulating 2 moves ahead
const evaluateMoveWithLookahead = (
  snake: Snake,
  dir: Direction,
  allSnakes: Snake[],
  food: Point
): number => {
  // Simulate first move
  const { snake: afterMove1, valid: valid1 } = simulateMove(snake, dir, allSnakes);
  if (!valid1) return -Infinity;

  // Get immediate score
  let score = evaluatePosition(afterMove1, allSnakes, food);

  // Lookahead: simulate second move (best case)
  const secondMoves = getSafeMoves(afterMove1, allSnakes);

  if (secondMoves.length === 0) {
    // Dead end! Heavy penalty
    score -= 200;
  } else {
    // Find best second move score
    let bestSecondScore = -Infinity;

    for (const secondDir of secondMoves) {
      const { snake: afterMove2, valid: valid2 } = simulateMove(afterMove1, secondDir, allSnakes);
      if (valid2) {
        const secondScore = evaluatePosition(afterMove2, allSnakes, food);

        // Also check if third move is possible (avoid 2-move traps)
        const thirdMoves = getSafeMoves(afterMove2, allSnakes);
        const thirdBonus = thirdMoves.length * 10;

        bestSecondScore = Math.max(bestSecondScore, secondScore + thirdBonus);
      }
    }

    // Weight future score less than immediate
    if (bestSecondScore > -Infinity) {
      score += bestSecondScore * 0.5;
    }
  }

  return score;
};

// Main AI Decision Function with 2-Move Lookahead
export const getBestMove = (me: Snake, allSnakes: Snake[], food: Point): Direction => {
  const safeMoves = getSafeMoves(me, allSnakes);

  if (safeMoves.length === 0) return me.direction; // No safe moves, accept fate

  // Score each move with lookahead
  const scoredMoves = safeMoves.map(dir => ({
    dir,
    score: evaluateMoveWithLookahead(me, dir, allSnakes, food)
  }));

  // Sort by score descending
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves[0].dir;
};

