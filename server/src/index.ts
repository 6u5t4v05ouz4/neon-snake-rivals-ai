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
