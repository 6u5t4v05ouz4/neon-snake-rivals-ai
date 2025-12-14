import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameEngine } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('Snake Server is Running!');
});

app.get('/stats', async (req, res) => {
    try {
        const totalMatches = await prisma.match.count();

        // Group by winner
        const wins = await prisma.match.groupBy({
            by: ['winner'],
            _count: {
                winner: true,
            },
        });

        const stats = {
            totalMatches,
            wins: wins.reduce((acc: Record<string, number>, curr: any) => {
                if (curr.winner) acc[curr.winner] = curr._count.winner;
                return acc;
            }, {} as Record<string, number>)
        };

        res.json(stats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for now, lock down later
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

// Initialize Game Engine
const gameEngine = new GameEngine((gameState) => {
    // Broadcast state to all connected clients
    io.emit('gameState', gameState);
}, prisma);

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send immediate catch-up catch-up state
    socket.emit('gameState', gameEngine.gameState);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
