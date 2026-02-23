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
    score: number;
}

interface LeaderboardPanelProps {
    currentWallet: string | null;
}

const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({ currentWallet }) => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [rewardPool, setRewardPool] = useState<{ balance: number; rewardPool: number } | null>(null);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await fetch(`${SERVER_URL}/leaderboard?period=daily`);
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

        const fetchRewardPool = async () => {
            try {
                const res = await fetch(`${SERVER_URL}/reward-pool`);
                if (res.ok) {
                    const data = await res.json();
                    setRewardPool(data);
                }
            } catch (e) {
                console.error('Failed to fetch reward pool:', e);
            }
        };

        fetchLeaderboard();
        fetchRewardPool();
        const interval = setInterval(() => {
            fetchLeaderboard();
            fetchRewardPool();
        }, 30000);
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
            {/* Prize Pool Banner */}
            {rewardPool && rewardPool.rewardPool > 0 && (
                <div className="mb-3 p-2 bg-gradient-to-r from-amber-900/40 to-yellow-900/30 rounded-lg border border-amber-500/40 text-center">
                    <div className="text-[10px] text-amber-400/80 font-semibold uppercase tracking-wider">Today's Prize Pool</div>
                    <div className="text-xl font-bold text-amber-300">
                        {rewardPool.rewardPool.toFixed(3)} SOL
                    </div>
                    <div className="flex justify-center gap-3 mt-1 text-[9px] text-slate-400">
                        <span>🥇 50%</span>
                        <span>🥈 30%</span>
                        <span>🥉 20%</span>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Distributes daily at 00:00 UTC</div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-2 mb-3 border-b border-slate-700 pb-2">
                <Trophy size={18} className="text-yellow-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Daily Top Bettors</h3>
                <span className="ml-auto text-[9px] bg-indigo-900/50 text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-500/30">24H</span>
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

                                {/* Stats - Score only */}
                                <div className="flex items-center text-right">
                                    <span className={`font-mono font-semibold ${entry.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {entry.score >= 0 ? '+' : ''}{entry.score.toFixed(1)} pts
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
