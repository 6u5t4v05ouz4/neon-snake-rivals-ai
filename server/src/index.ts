import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameEngine } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { getCurrentPoolInfo } from './solana';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:bcmQaxDnVtZBzLnvQlwknkEuoWKkPLoG@postgres.railway.internal:5432/railway' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
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
app.post('/register-bet', async (req, res) => {
    try {
        const { poolPda, walletAddress, side, amount, txSignature } = req.body;

        if (!poolPda || !walletAddress || !side || !amount || !txSignature) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Upsert - update if exists, create if not
        const bet = await prisma.bet.upsert({
            where: { poolPda_walletAddress: { poolPda, walletAddress } },
            update: { side, amount, txSignature },
            create: { poolPda, walletAddress, side, amount, txSignature }
        });

        console.log('Bet registered:', walletAddress, side, amount, 'SOL on pool', poolPda);
        res.json({ success: true, bet });
    } catch (e) {
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
app.post('/mark-claimed', async (req, res) => {
    try {
        const { poolPda, walletAddress } = req.body;

        await prisma.bet.update({
            where: { poolPda_walletAddress: { poolPda, walletAddress } },
            data: { claimed: true }
        });

        console.log('Bet marked as claimed:', walletAddress, 'on pool', poolPda);
        res.json({ success: true });
    } catch (e) {
        console.error('Error marking claimed:', e);
        res.status(500).json({ error: 'Failed to mark as claimed' });
    }
});


const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
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
