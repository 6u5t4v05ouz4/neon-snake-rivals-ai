import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatMessage } from '../types';
import { MessageSquare, Send, AlertCircle } from 'lucide-react';
import { SERVER_URL } from '../constants';

interface Props {
    walletAddress: string | null;
    userHasBet: boolean;
}

const ChatPanel: React.FC<Props> = ({ walletAddress, userHasBet }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Socket connection
    useEffect(() => {
        const socket = io(SERVER_URL, {
            transports: ['websocket', 'polling'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Chat socket connected');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('Chat socket disconnected');
            setIsConnected(false);
        });

        // Receive chat history on connect
        socket.on('chat:history', (history: ChatMessage[]) => {
            setMessages(history.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
            })));
        });

        // Receive new messages
        socket.on('chat:message', (msg: ChatMessage) => {
            setMessages(prev => [...prev, {
                ...msg,
                timestamp: new Date(msg.timestamp)
            }]);
        });

        // Receive errors
        socket.on('chat:error', (data: { error: string }) => {
            setError(data.error);
            setTimeout(() => setError(null), 3000);
        });

        // Clear chat (new session)
        socket.on('chat:clear', () => {
            setMessages([]);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const sendMessage = () => {
        if (!socketRef.current || !walletAddress || !inputMessage.trim()) return;

        socketRef.current.emit('chat:send', {
            walletAddress,
            message: inputMessage.trim()
        });

        setInputMessage('');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const canChat = walletAddress && userHasBet;

    return (
        <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-lg">
            {/* Header */}
            <div className="bg-slate-800 p-3 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400">
                    <MessageSquare size={18} className={isConnected ? "" : "opacity-50"} />
                    <h3 className="font-bold text-sm tracking-wider uppercase">Live Chat</h3>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span>{isConnected ? 'Online' : 'Offline'}</span>
                </div>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm h-[300px] md:h-auto"
            >
                {messages.length === 0 && (
                    <div className="text-slate-500 text-center italic mt-10">
                        No messages yet. Place a bet to join the chat!
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-semibold ${msg.side === 'cyan' ? 'text-cyan-400' : 'text-fuchsia-400'}`}>
                                {msg.displayName}
                            </span>
                            <span className="text-xs text-slate-500">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className={`p-2 rounded-md ${msg.side === 'cyan'
                                ? 'bg-cyan-900/20 text-cyan-100 border border-cyan-700/30'
                                : 'bg-fuchsia-900/20 text-fuchsia-100 border border-fuchsia-700/30'
                            }`}>
                            {msg.message}
                        </div>
                    </div>
                ))}
            </div>

            {/* Error message */}
            {error && (
                <div className="px-4 py-2 bg-red-900/50 border-t border-red-700/50 flex items-center gap-2 text-red-300 text-xs">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-slate-700 bg-slate-800/50">
                {canChat ? (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type a message..."
                            maxLength={200}
                            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!inputMessage.trim()}
                            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="text-center text-slate-500 text-xs py-2">
                        {!walletAddress ? '🔗 Connect wallet to chat' : '🎲 Place a bet to unlock chat'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatPanel;
