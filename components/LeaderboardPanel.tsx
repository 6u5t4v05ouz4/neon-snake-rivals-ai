import React, { useEffect, useState } from 'react';
import { SERVER_URL } from '../constants';
import { Trophy } from 'lucide-react';

interface LeaderboardEntry {
    rank: number;
    wallet: string;
    displayName: string;
    wins: number;
    losses: number;
    totalBets: number;
    winRate: number;
    wagered: number;
    profit: number;
}

interface LeaderboardPanelProps {
    currentWallet: string | null;
}

const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({ currentWallet }) => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await fetch(`${SERVER_URL}/leaderboard`);
                if (res.ok) {
                    const data = await res.json();
                    setLeaderboard(data);
                }
            } catch (e) {
                console.error('Failed to fetch leaderboard:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
        // Refresh every 30 seconds
        const interval = setInterval(fetchLeaderboard, 30000);
        return () => clearInterval(interval);
    }, []);

    const getRankColor = (rank: number) => {
        if (rank === 1) return 'text-yellow-400';
        if (rank === 2) return 'text-gray-300';
        if (rank === 3) return 'text-amber-600';
        return 'text-slate-400';
    };

    const getRankEmoji = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    return (
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-3 w-full">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 border-b border-slate-700 pb-2">
                <Trophy size={18} className="text-yellow-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Bettors</h3>
            </div>

            {/* Loading */}
            {loading && (
                <div className="text-center text-slate-500 text-xs py-4">Loading...</div>
            )}

            {/* Empty State */}
            {!loading && leaderboard.length === 0 && (
                <div className="text-center text-slate-500 text-xs py-4">No bets yet</div>
            )}

            {/* Leaderboard List */}
            {!loading && leaderboard.length > 0 && (
                <div className="space-y-1">
                    {leaderboard.map((entry) => {
                        const isCurrentUser = currentWallet === entry.wallet;
                        return (
                            <div
                                key={entry.wallet}
                                className={`flex items-center justify-between py-1.5 px-2 rounded text-xs ${isCurrentUser
                                        ? 'bg-indigo-900/50 border border-indigo-500/50'
                                        : 'hover:bg-slate-800/50'
                                    }`}
                            >
                                {/* Rank & Name */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`font-bold ${getRankColor(entry.rank)}`}>
                                        {getRankEmoji(entry.rank)}
                                    </span>
                                    <span className={`truncate ${isCurrentUser ? 'text-indigo-300 font-semibold' : 'text-slate-300'}`}>
                                        {isCurrentUser ? 'You' : entry.displayName}
                                    </span>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-3 text-right">
                                    <span className="text-slate-500">{entry.winRate}%</span>
                                    <span className={`font-mono font-semibold ${entry.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {entry.profit >= 0 ? '+' : ''}{entry.profit.toFixed(3)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LeaderboardPanel;
