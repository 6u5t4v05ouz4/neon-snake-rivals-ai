import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameEngine } from './GameEngine';

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('Snake Server is Running!');
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
});

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
