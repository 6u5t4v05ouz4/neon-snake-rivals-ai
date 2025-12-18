import { GameState, Snake, GameStatus, Direction, Point } from './types';
import { PrismaClient } from '@prisma/client';
import { BOARD_WIDTH, BOARD_HEIGHT, SNAKE_1_START, SNAKE_2_START, MIN_SPEED, START_GAME_SPEED, SPEED_DECREMENT, WIN_SCORE, RESTART_DELAY } from './constants';
import { getBestMove } from './aiLogic';
import { createNewPool, settleGame, getPoolInfo, getCurrentPoolInfo } from './solana';
import { scheduleBalancing, updateMakerBetResults, claimMakerWinnings } from './MarketMaker';
import { updateUserBetResults, clearSessionChat } from './index';

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
    const s1Body: Point[] = [SNAKE_1_START];
    const s2Body: Point[] = [SNAKE_2_START];

    return {
        snakes: [
            {
                id: 'snake1',
                name: 'CYAN VIPER',
                body: s1Body,
                direction: Direction.RIGHT,
                color: '#22d3ee',
                score: 0,
                eliminated: false,
                colorClass: 'cyan',
                lastMoveTime: Date.now(),
            },
            {
                id: 'snake2',
                name: 'MAGENTA PYTHON',
                body: s2Body,
                direction: Direction.LEFT,
                color: '#d946ef',
                score: 0,
                eliminated: false,
                colorClass: 'fuchsia',
                lastMoveTime: Date.now(),
            },
        ],
        food: getRandomFreePoint([s1Body, s2Body]),
        status: GameStatus.PLAYING,
        tick: 0,
        winner: null,
        nextMatchCountdown: null,
    };
};

export class GameEngine {
    public gameState: GameState;
    private loopInterval: NodeJS.Timeout | null = null;
    private countdownInterval: NodeJS.Timeout | null = null;
    private ioCallback: (state: GameState) => void;
    private prisma: PrismaClient;
    private sessionId: number;

    constructor(ioCallback: (state: GameState) => void, prisma: PrismaClient, sessionId: number) {
        this.gameState = createInitialState();
        this.ioCallback = ioCallback;
        this.prisma = prisma;
        this.sessionId = sessionId;
        this.startGameLoop();
    }

    private startGameLoop() {
        console.log('Starting game loop...');
        // 60 FPS tick
        this.loopInterval = setInterval(() => this.tick(), 16);
    }

    private calculateSnakeSpeed(score: number): number {
        const reduction = score * SPEED_DECREMENT;
        return Math.max(MIN_SPEED, START_GAME_SPEED - reduction);
    }

    private spawnFood(currentSnakes: Snake[]): Point {
        const bodies = currentSnakes.map(s => s.body);
        return getRandomFreePoint(bodies);
    }

    private tick() {
        try {
            if (this.gameState.status !== GameStatus.PLAYING) return;

            const now = Date.now();
            let nextSnakes = this.gameState.snakes.map(snake => ({ ...snake, body: [...snake.body] }));
            let nextFood = { ...this.gameState.food };
            let newStatus: GameStatus = this.gameState.status;
            let winner: string | null = this.gameState.winner;
            let stateChanged = false;

            // 1. Move Snakes
            nextSnakes.forEach(snake => {
                if (snake.eliminated) return;

                const speed = this.calculateSnakeSpeed(snake.score);
                if (now - snake.lastMoveTime < speed) return;

                stateChanged = true;
                snake.lastMoveTime = now;

                // AI Decision
                snake.direction = getBestMove(snake, nextSnakes, nextFood);

                const head = snake.body[0];
                let newHead = { ...head };

                switch (snake.direction) {
                    case Direction.UP: newHead.y -= 1; break;
                    case Direction.DOWN: newHead.y += 1; break;
                    case Direction.LEFT: newHead.x -= 1; break;
                    case Direction.RIGHT: newHead.x += 1; break;
                }

                // Check Collision with Food
                if (newHead.x === nextFood.x && newHead.y === nextFood.y) {
                    snake.score += 1;
                    snake.body.unshift(newHead); // Grow
                    // Check Win Condition
                    if (snake.score >= WIN_SCORE && !snake.eliminated) {
                        // Trigger win logic strictly in step 3 to avoid double call
                    }
                    nextFood = this.spawnFood(nextSnakes);
                } else {
                    // Move normally
                    snake.body.pop();
                    snake.body.unshift(newHead);
                }
            });

            // 2. Collision Detection
            nextSnakes.forEach(snake => {
                if (snake.eliminated) return;
                const head = snake.body[0];

                // Wall Collision
                if (head.x < 0 || head.x >= BOARD_WIDTH || head.y < 0 || head.y >= BOARD_HEIGHT) {
                    snake.eliminated = true;
                    stateChanged = true;
                }

                // Self/Other Collision
                nextSnakes.forEach(other => {
                    // Head hitting other body
                    if (other.body.some((segment, index) => {
                        // If checking self, ignore head (index 0)
                        if (snake.id === other.id && index === 0) return false;
                        return segment.x === head.x && segment.y === head.y;
                    })) {
                        snake.eliminated = true;
                        stateChanged = true;
                    }

                    // Head-to-Head (Both die?) - Simple version: random or both die. Let's say if positions equal.
                    if (snake.id !== other.id && head.x === other.body[0].x && head.y === other.body[0].y) {
                        snake.eliminated = true;
                        other.eliminated = true;
                        stateChanged = true;
                    }
                });
            });

            // 3. Determine Winner
            const aliveSnakes = nextSnakes.filter(s => !s.eliminated);
            const scoreWinner = nextSnakes.find(s => s.score >= WIN_SCORE);

            if (scoreWinner) {
                newStatus = GameStatus.GAME_OVER;
                winner = scoreWinner.name;
                // Solana Settle - lastSettledPool is saved synchronously before RPC
                const poolPda = getCurrentPoolInfo().poolPda || '';
                if (scoreWinner.colorClass === 'cyan') {
                    settleGame('cyan');
                    updateMakerBetResults(poolPda, 'cyan');
                    updateUserBetResults(poolPda, 'cyan');
                    // Auto-claim MM winnings after settle (wait 2s for tx to confirm)
                    setTimeout(() => claimMakerWinnings(poolPda), 2000);
                } else if (scoreWinner.colorClass === 'fuchsia') {
                    settleGame('magenta');
                    updateMakerBetResults(poolPda, 'magenta');
                    updateUserBetResults(poolPda, 'magenta');
                    setTimeout(() => claimMakerWinnings(poolPda), 2000);
                }
            } else if (aliveSnakes.length === 0) {
                newStatus = GameStatus.GAME_OVER;
                // Tie breaker or Draw
                winner = null;
            } else if (aliveSnakes.length === 1 && nextSnakes.length > 1) {
                // Last man standing
                newStatus = GameStatus.GAME_OVER;
                winner = aliveSnakes[0].name;
                // Winner by elimination - lastSettledPool saved synchronously
                const poolPda = getCurrentPoolInfo().poolPda || '';
                if (aliveSnakes[0].colorClass === "cyan") {
                    settleGame("cyan");
                    updateMakerBetResults(poolPda, 'cyan');
                    updateUserBetResults(poolPda, 'cyan');
                    setTimeout(() => claimMakerWinnings(poolPda), 2000);
                } else if (aliveSnakes[0].colorClass === "fuchsia") {
                    settleGame("magenta");
                    updateMakerBetResults(poolPda, 'magenta');
                    updateUserBetResults(poolPda, 'magenta');
                    setTimeout(() => claimMakerWinnings(poolPda), 2000);
                }
            }

            if (newStatus === GameStatus.GAME_OVER) {
                this.gameState.nextMatchCountdown = RESTART_DELAY;

                // Save Match Result and update session
                this.saveMatchResult(winner, Math.floor(this.gameState.tick * 0.016));

                this.startCountdown();
            }

            this.gameState = {
                ...this.gameState,
                snakes: nextSnakes,
                food: nextFood,
                status: newStatus,
                winner,
                tick: this.gameState.tick + 1,
            };

            // Broadcast only if changed or periodically (e.g. every tick for smoothness on client interpolation)
            // For now, emit every tick to keep 60fps local sync simple
            this.ioCallback(this.gameState);

            if (this.gameState.tick % 60 === 0) {
                console.log(`Tick ${this.gameState.tick}: Status=${this.gameState.status}`);
            }
        } catch (e) {
            console.error('Error in game loop tick:', e);
        }
    }

    private startCountdown() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        // Start new betting pool
        createNewPool();

        // Clear chat messages from previous session
        clearSessionChat();

        this.countdownInterval = setInterval(async () => {
            if (this.gameState.nextMatchCountdown && this.gameState.nextMatchCountdown > 0) {
                // Check if Market Maker should rebalance - use getPoolInfo for on-chain data
                const poolInfo = await getPoolInfo();
                console.log("Countdown tick - poolInfo:", JSON.stringify(poolInfo), "countdown:", this.gameState.nextMatchCountdown);

                // Always call scheduleBalancing (it will handle null/undefined)
                scheduleBalancing(
                    poolInfo.poolPda || '',
                    this.gameState.nextMatchCountdown,
                    poolInfo
                );

                this.gameState.nextMatchCountdown--;
                this.ioCallback(this.gameState);
            } else {
                this.resetGame();
            }
        }, 1000);
    }

    private resetGame() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.countdownInterval = null;
        this.gameState = createInitialState();
        this.ioCallback(this.gameState);
    }

    private async saveMatchResult(winner: string | null, duration: number) {
        try {
            // Create match linked to session
            await this.prisma.match.create({
                data: {
                    winner,
                    duration,
                    sessionId: this.sessionId,
                },
            });

            // Update session stats
            const updateData: any = { totalMatches: { increment: 1 } };
            if (winner?.includes('CYAN')) {
                updateData.cyanWins = { increment: 1 };
            } else if (winner?.includes('MAGENTA')) {
                updateData.magentaWins = { increment: 1 };
            }

            await this.prisma.session.update({
                where: { id: this.sessionId },
                data: updateData,
            });

            console.log('Match saved:', winner);
        } catch (e) {
            console.error('Failed to save match:', e);
        }
    }
}
