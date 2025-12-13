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

// Flood fill to calculate available space
const calculateFreeSpace = (start: Point, snakes: Snake[]): number => {
  const visited = new Set<string>();
  const queue: Point[] = [start];
  let count = 0;

  // Limit flood fill depth for performance
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

// Main AI Decision Function
export const getBestMove = (me: Snake, allSnakes: Snake[], food: Point): Direction => {
  const head = me.body[0];
  const possibleMoves = Object.values(Direction);

  // Filter out immediate death
  const safeMoves = possibleMoves.filter(dir => {
    const next = getNextCoord(head, dir);
    // Don't reverse
    const neck = me.body[1];
    if (neck && next.x === neck.x && next.y === neck.y) return false;

    return isValid(next) && !isCollision(next, allSnakes);
  });

  if (safeMoves.length === 0) return me.direction; // Accepted fate

  // Score moves
  const scoredMoves = safeMoves.map(dir => {
    const next = getNextCoord(head, dir);
    let score = 0;

    // 1. Distance to food (Lower is better, so we subtract)
    const distToFood = distance(next, food);
    score -= distToFood * 2;

    // 2. Space availability (Don't get trapped)
    const freeSpace = calculateFreeSpace(next, allSnakes);
    score += freeSpace * 5;

    // 3. Avoid other snake heads (Collision risk)
    const otherSnake = allSnakes.find(s => s.id !== me.id);
    if (otherSnake) {
      const distToOtherHead = distance(next, otherSnake.body[0]);
      if (distToOtherHead < 2) {
        // If we are smaller, RUN AWAY. If bigger, maybe aggressive? Safe play: avoid.
        score -= 50;
      }
    }

    return { dir, score };
  });

  // Sort by score descending
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves[0].dir;
};
