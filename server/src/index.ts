import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { GameEngine } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { getCurrentPoolInfo, connection, program } from './solana';
import { initMarketMaker } from './MarketMaker';
import { registerBetSchema, markClaimedSchema } from './validation';

// ===== DATABASE: Use env var with Railway internal fallback =====
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:bcmQaxDnVtZBzLnvQlwknkEuoWKkPLoG@postgres.railway.internal:5432/railway';
if (!process.env.DATABASE_URL) {
    console.warn("WARNING: DATABASE_URL not set, using Railway internal fallback");
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ===== SECURITY: CORS - Production origins =====
// TODO: Restrict to specific origins after confirming working
const ALLOWED_ORIGINS = [
    'https://neon-snake-rivals-ai.n4r1g4.workers.dev',
    'http://localhost:5173',
    'http://localhost:3000'
];

// For debugging - temporarily allow all (set to false for production)
const CORS_DEBUG_MODE = true;

// ===== SECURITY: Rate Limiting =====
const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute for sensitive endpoints
    message: { error: 'Rate limit exceeded for this action' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Update user bet results after game settles
export async function updateUserBetResults(poolPda: string, winner: string) {
    try {
        // Find all user bets for this pool that don't have a result yet
        const bets = await prisma.bet.findMany({
            where: { poolPda, result: null }
        });

        for (const bet of bets) {
            const result = bet.side === winner ? "win" : "lose";
            await prisma.bet.update({
                where: { id: bet.id },
                data: { result }
            });
            console.log(`Updated user bet ${bet.id} (${bet.walletAddress.slice(0, 8)}...): ${result}`);
        }
        console.log(`Updated ${bets.length} user bet results for pool`);
    } catch (e) {
        console.error("Failed to update user bet results", e);
    }
}

// Initialize Market Maker
initMarketMaker(connection, program, prisma as any);

const app = express();

// ===== SECURITY: Helmet for security headers =====
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin for API
}));

// ===== SECURITY: CORS with restricted origins =====
app.use(cors({
    origin: CORS_DEBUG_MODE ? '*' : (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Apply general rate limiting to all routes
app.use(generalLimiter);

app.use(express.json()); // Parse JSON request bodies

// Current session ID (set on startup)
let currentSessionId: number | null = null;

app.get('/', (req, res) => {
    res.send('Snake Server is Running!');
});

app.get('/stats', async (req, res) => {
    try {
        // All-time stats
        const totalMatches = await prisma.match.count();
        const wins = await prisma.match.groupBy({
            by: ['winner'],
            _count: { winner: true },
        });
        const allTimeWins = wins.reduce((acc: Record<string, number>, curr: any) => {
            if (curr.winner) acc[curr.winner] = curr._count.winner;
            return acc;
        }, {} as Record<string, number>);

        // Current session stats
        let currentSession = null;
        if (currentSessionId) {
            currentSession = await prisma.session.findUnique({
                where: { id: currentSessionId },
            });
        }

        res.json({
            totalMatches,
            wins: allTimeWins,
            currentSession: currentSession ? {
                id: currentSession.id,
                startedAt: currentSession.startedAt,
                cyanWins: currentSession.cyanWins,
                magentaWins: currentSession.magentaWins,
                sessionMatches: currentSession.totalMatches,
            } : null,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Profile statistics for a wallet
app.get('/profile/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;

        // Get all bets for this wallet
        const bets = await prisma.bet.findMany({
            where: { walletAddress },
            orderBy: { createdAt: 'desc' }
        });

        if (bets.length === 0) {
            return res.json({
                walletAddress,
                totalBets: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
                totalWagered: 0,
                totalWon: 0,
                netProfit: 0,
                biggestWin: 0,
                favoriteSide: null,
                recentBets: []
            });
        }

        // Calculate stats
        const totalBets = bets.length;
        const wins = bets.filter(b => b.result === 'win').length;
        const losses = bets.filter(b => b.result === 'lose').length;
        const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

        const totalWagered = bets.reduce((sum, b) => sum + b.amount, 0);

        // Estimate winnings based on claimed bets (simplified)
        const claimedWins = bets.filter(b => b.result === 'win' && b.claimed);
        // Approximate winnings as 1.9x the bet (97% pool / 50% avg share)
        const totalWon = claimedWins.reduce((sum, b) => sum + (b.amount * 1.9), 0);

        const netProfit = totalWon - totalWagered;

        // Biggest single bet that won
        const winningBets = bets.filter(b => b.result === 'win');
        const biggestWin = winningBets.length > 0
            ? Math.max(...winningBets.map(b => b.amount * 1.9))
            : 0;

        // Favorite side
        const cyanCount = bets.filter(b => b.side === 'cyan').length;
        const magentaCount = bets.filter(b => b.side === 'magenta').length;
        const favoriteSide = cyanCount >= magentaCount ? 'cyan' : 'magenta';

        // Recent bets (last 5)
        const recentBets = bets.slice(0, 5).map(b => ({
            side: b.side,
            amount: b.amount,
            result: b.result,
            createdAt: b.createdAt
        }));

        res.json({
            walletAddress,
            totalBets,
            wins,
            losses,
            winRate: winRate.toFixed(1),
            totalWagered: totalWagered.toFixed(3),
            totalWon: totalWon.toFixed(3),
            netProfit: netProfit.toFixed(3),
            biggestWin: biggestWin.toFixed(3),
            favoriteSide,
            recentBets
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile stats' });
    }
});

// Current pool endpoint for betting (basic)
app.get('/current-pool', (req, res) => {
    const poolInfo = getCurrentPoolInfo();
    res.json(poolInfo);
});

// Pool info with on-chain data
app.get('/pool-info', async (req, res) => {
    try {
        const { getPoolInfo } = await import('./solana');
        const poolInfo = await getPoolInfo();
        res.json(poolInfo);
    } catch (e) {
        console.error("Error fetching pool info:", e);
        res.status(500).json({ error: 'Failed to fetch pool info' });
    }
});

// User bet status
app.get('/user-bet/:pubkey', async (req, res) => {
    try {
        const { getUserBet } = await import('./solana');
        const userBet = await getUserBet(req.params.pubkey);
        res.json({ bet: userBet });
    } catch (e) {
        console.error("Error fetching user bet:", e);
        res.status(500).json({ error: 'Failed to fetch user bet' });
    }
});

// Last settled pool for claims
app.get('/last-settled-pool', (req, res) => {
    const { getLastSettledPool } = require('./solana');
    const pool = getLastSettledPool();
    res.json(pool || { poolPda: null, winner: null });
});

// ===== BETTING API ENDPOINTS =====

// Register a bet (called after tx confirmed on frontend)
// SECURITY: Strict rate limit + Zod validation
app.post('/register-bet', strictLimiter, async (req, res) => {
    try {
        // Validate input with Zod
        const validated = registerBetSchema.parse(req.body);
        const { poolPda, walletAddress, side, amount, txSignature } = validated;

        // Upsert - update if exists, create if not
        const bet = await prisma.bet.upsert({
            where: { poolPda_walletAddress: { poolPda, walletAddress } },
            update: { side, amount, txSignature },
            create: { poolPda, walletAddress, side, amount, txSignature }
        });

        console.log('Bet registered:', walletAddress.slice(0, 8), side, amount, 'SOL');
        res.json({ success: true, bet });
    } catch (e) {
        if (e instanceof z.ZodError) {
            console.warn('Invalid bet input:', e.issues);
            return res.status(400).json({ error: 'Invalid input', details: e.issues });
        }
        console.error('Error registering bet:', e);
        res.status(500).json({ error: 'Failed to register bet' });
    }
});

// Get bets for a wallet
app.get('/my-bets/:walletAddress', async (req, res) => {
    try {
        const bets = await prisma.bet.findMany({
            where: { walletAddress: req.params.walletAddress },
            orderBy: { createdAt: 'desc' }
        });
        res.json(bets);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch bets' });
    }
});

// Check if wallet can claim from last settled pool
app.get('/can-claim/:walletAddress', async (req, res) => {
    try {
        const { getLastSettledPool } = require('./solana');
        const lastSettled = getLastSettledPool();

        console.log('Can-claim check:', {
            walletAddress: req.params.walletAddress,
            lastSettled
        });

        if (!lastSettled || !lastSettled.poolPda) {
            return res.json({ canClaim: false, reason: 'No settled pool' });
        }

        // Find bet for this wallet on the settled pool
        const bet = await prisma.bet.findUnique({
            where: {
                poolPda_walletAddress: {
                    poolPda: lastSettled.poolPda,
                    walletAddress: req.params.walletAddress
                }
            }
        });

        console.log('Bet found:', bet);

        if (!bet) {
            return res.json({ canClaim: false, reason: 'No bet on settled pool' });
        }

        if (bet.claimed) {
            return res.json({ canClaim: false, reason: 'Already claimed' });
        }

        const canClaim = bet.side === lastSettled.winner;

        const response = {
            canClaim,
            poolPda: lastSettled.poolPda,
            winner: lastSettled.winner,
            userBet: bet,
            reason: canClaim ? 'Winner!' : 'Did not bet on winner'
        };
        console.log('Can-claim response:', response);
        res.json(response);
    } catch (e) {
        console.error('Error checking claim:', e);
        res.status(500).json({ error: 'Failed to check claim status' });
    }
});

// Mark bet as claimed
// SECURITY: Strict rate limit + Zod validation
app.post('/mark-claimed', strictLimiter, async (req, res) => {
    try {
        // Validate input with Zod
        const validated = markClaimedSchema.parse(req.body);
        const { poolPda, walletAddress } = validated;

        await prisma.bet.update({
            where: { poolPda_walletAddress: { poolPda, walletAddress } },
            data: { claimed: true }
        });

        console.log('Bet marked as claimed:', walletAddress.slice(0, 8));
        res.json({ success: true });
    } catch (e) {
        if (e instanceof z.ZodError) {
            console.warn('Invalid claim input:', e.issues);
            return res.status(400).json({ error: 'Invalid input', details: e.issues });
        }
        console.error('Error marking claimed:', e);
        res.status(500).json({ error: 'Failed to mark as claimed' });
    }
});


const server = http.createServer(app);
// SECURITY: Socket.IO CORS restricted to allowed origins
const io = new Server(server, {
    cors: {
        origin: CORS_DEBUG_MODE ? "*" : ALLOWED_ORIGINS,
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

// Start server and create session
async function startServer() {
    // Create a new session on startup
    const session = await prisma.session.create({ data: {} });
    currentSessionId = session.id;
    console.log(`Created session ${currentSessionId}`);

    // Initialize Game Engine with session ID
    const gameEngine = new GameEngine((gameState) => {
        io.emit('gameState', gameState);
    }, prisma, currentSessionId);

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        socket.emit('gameState', gameEngine.gameState);

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer().catch(console.error);
