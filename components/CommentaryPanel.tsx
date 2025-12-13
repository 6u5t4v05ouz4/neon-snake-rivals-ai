import React, { useEffect, useState, useRef } from 'react';
import { GameState, CommentaryMessage, GameStatus } from '../types';
import { generateCommentary } from '../services/geminiService';
import { MessageSquare, Mic, Activity } from 'lucide-react';

interface Props {
  gameState: GameState;
}

const CommentaryPanel: React.FC<Props> = ({ gameState }) => {
  const [messages, setMessages] = useState<CommentaryMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const lastCommentTime = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Trigger commentary periodically or on major events
  useEffect(() => {
    const shouldComment =
      gameState.status === GameStatus.GAME_OVER ||
      (gameState.status === GameStatus.PLAYING && Date.now() - lastCommentTime.current > 30000);

    if (shouldComment && !isGenerating) {
      lastCommentTime.current = Date.now();

      const fetchCommentary = async () => {
        setIsGenerating(true);
        const text = await generateCommentary(gameState);
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            text,
            timestamp: new Date(),
            type: gameState.status === GameStatus.GAME_OVER ? 'shoutout' : 'play-by-play'
          }
        ]);
        setIsGenerating(false);
      };

      fetchCommentary();
    }
  }, [gameState.tick, gameState.status]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-lg">
      <div className="bg-slate-800 p-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-cyan-400">
          <Mic size={18} className={isGenerating ? "animate-pulse text-red-500" : ""} />
          <h3 className="font-bold text-sm tracking-wider uppercase">Live Commentary</h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Activity size={14} />
          <span>Gemini-2.5-Flash</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm h-[300px] md:h-auto"
      >
        {messages.length === 0 && (
          <div className="text-slate-500 text-center italic mt-10">
            Waiting for match start...
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <span className="text-xs text-slate-500 mr-2 block mb-1">
              [{msg.timestamp.toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit' })}]
            </span>
            <div className={`p-2 rounded-md ${msg.type === 'shoutout' ? 'bg-yellow-900/20 text-yellow-200 border border-yellow-700/50' : 'bg-slate-800/50 text-slate-200'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex gap-1 items-center text-xs text-slate-500 p-2">
            <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
            <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-75"></span>
            <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150"></span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentaryPanel;
