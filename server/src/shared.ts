import { Server } from 'socket.io';

// ===== CHAT SYSTEM =====
export interface ChatMessage {
    id: string;
    walletAddress: string;
    displayName: string;
    message: string;
    side: 'cyan' | 'magenta';
    timestamp: Date;
}

export let sessionChatMessages: ChatMessage[] = [];
export const chatRateLimits: Map<string, number> = new Map(); // walletAddress -> lastMessageTime
export const CHAT_RATE_LIMIT_MS = 5000; // 5 seconds between messages
export const MAX_MESSAGE_LENGTH = 200;

// Track the active battle pool (set when game starts, cleared when game ends)
let activeBattlePoolPda: string | null = null;

// Global io instance for emitting events from anywhere
let ioInstance: Server | null = null;

// Set io instance (called during server startup)
export function setIoInstance(io: Server) {
    ioInstance = io;
}

// Export function to set active battle pool (called when game starts)
export function setActiveBattlePool(poolPda: string) {
    activeBattlePoolPda = poolPda;
    console.log('Active battle pool set:', poolPda);
}

// Export function to clear chat and active pool (called when battle ends)
export function clearSessionChat() {
    sessionChatMessages.length = 0;
    activeBattlePoolPda = null;
    console.log('Session chat cleared, active pool reset');
}

// Export function to get active battle pool
export function getActiveBattlePool(): string | null {
    return activeBattlePoolPda;
}

// Emit game settled event to all clients immediately
export function emitGameSettled(poolPda: string, winner: string) {
    if (ioInstance) {
        console.log('Emitting game:settled event:', { poolPda, winner });
        ioInstance.emit('game:settled', { poolPda, winner });
    }
}

// Add message to chat
export function addChatMessage(msg: ChatMessage) {
    sessionChatMessages.push(msg);
    // Keep only last 100 messages
    if (sessionChatMessages.length > 100) {
        sessionChatMessages.splice(0, sessionChatMessages.length - 100);
    }
}
