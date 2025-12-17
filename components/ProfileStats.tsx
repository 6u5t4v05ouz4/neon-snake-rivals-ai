import React, { useEffect, useState } from 'react';
import { X, User, TrendingUp, TrendingDown, Trophy, Target, Coins, Star, History } from 'lucide-react';
import { SERVER_URL } from '../constants';

interface ProfileStatsProps {
    isOpen: boolean;
    onClose: () => void;
    walletAddress: string;
}

interface ProfileData {
    walletAddress: string;
    totalBets: number;
    wins: number;
    losses: number;
    winRate: string;
    totalWagered: string;
    totalWon: string;
    netProfit: string;
    biggestWin: string;
    favoriteSide: 'cyan' | 'magenta' | null;
    recentBets: Array<{
        side: string;
        amount: number;
        result: string | null;
        createdAt: string;
    }>;
}

const ProfileStats: React.FC<ProfileStatsProps> = ({ isOpen, onClose, walletAddress }) => {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && walletAddress) {
            fetchProfile();
        }
    }, [isOpen, walletAddress]);

    const fetchProfile = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${SERVER_URL}/profile/${walletAddress}`);
            if (!res.ok) throw new Error('Failed to fetch profile');
            const data = await res.json();
            setProfile(data);
        } catch (e) {
            setError('Failed to load profile stats');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const netProfitNum = profile ? parseFloat(profile.netProfit) : 0;
    const isProfit = netProfitNum >= 0;

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <User className="text-indigo-400" size={20} />
                        Profile Stats
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {loading && (
                        <div className="text-center py-8 text-slate-400">
                            Loading stats...
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-8 text-red-400">
                            {error}
                        </div>
                    )}

                    {profile && !loading && (
                        <div className="space-y-4">
                            {/* Wallet Address */}
                            <div className="text-center text-xs text-slate-500 font-mono truncate">
                                {walletAddress}
                            </div>

                            {/* Main Stats Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Win Rate */}
                                <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 p-3 rounded-lg border border-green-500/30">
                                    <div className="flex items-center gap-2 text-green-400 text-xs mb-1">
                                        <Target size={14} />
                                        Win Rate
                                    </div>
                                    <div className="text-2xl font-bold text-green-300">
                                        {profile.winRate}%
                                    </div>
                                    <div className="text-xs text-green-500">
                                        {profile.wins}W / {profile.losses}L
                                    </div>
                                </div>

                                {/* Net Profit */}
                                <div className={`bg-gradient-to-br p-3 rounded-lg border ${isProfit
                                        ? 'from-emerald-900/30 to-emerald-800/20 border-emerald-500/30'
                                        : 'from-red-900/30 to-red-800/20 border-red-500/30'
                                    }`}>
                                    <div className={`flex items-center gap-2 text-xs mb-1 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        Net Profit
                                    </div>
                                    <div className={`text-2xl font-bold ${isProfit ? 'text-emerald-300' : 'text-red-300'}`}>
                                        {isProfit ? '+' : ''}{profile.netProfit}
                                    </div>
                                    <div className={`text-xs ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                                        SOL
                                    </div>
                                </div>

                                {/* Total Bets */}
                                <div className="bg-gradient-to-br from-indigo-900/30 to-indigo-800/20 p-3 rounded-lg border border-indigo-500/30">
                                    <div className="flex items-center gap-2 text-indigo-400 text-xs mb-1">
                                        <Coins size={14} />
                                        Total Bets
                                    </div>
                                    <div className="text-2xl font-bold text-indigo-300">
                                        {profile.totalBets}
                                    </div>
                                    <div className="text-xs text-indigo-500">
                                        games played
                                    </div>
                                </div>

                                {/* Biggest Win */}
                                <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 p-3 rounded-lg border border-yellow-500/30">
                                    <div className="flex items-center gap-2 text-yellow-400 text-xs mb-1">
                                        <Trophy size={14} />
                                        Biggest Win
                                    </div>
                                    <div className="text-2xl font-bold text-yellow-300">
                                        {profile.biggestWin}
                                    </div>
                                    <div className="text-xs text-yellow-500">
                                        SOL
                                    </div>
                                </div>
                            </div>

                            {/* Additional Stats */}
                            <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Total Wagered</span>
                                    <span className="text-white font-mono">{profile.totalWagered} SOL</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Total Won</span>
                                    <span className="text-green-400 font-mono">{profile.totalWon} SOL</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Favorite Side</span>
                                    <span className={`font-semibold ${profile.favoriteSide === 'cyan' ? 'text-cyan-400' : 'text-fuchsia-400'
                                        }`}>
                                        {profile.favoriteSide?.toUpperCase() || 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {/* Recent Bets */}
                            {profile.recentBets.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2 mb-2">
                                        <History size={14} />
                                        Recent Bets
                                    </h3>
                                    <div className="space-y-1">
                                        {profile.recentBets.map((bet, i) => (
                                            <div
                                                key={i}
                                                className={`flex items-center justify-between p-2 rounded text-xs ${bet.side === 'cyan'
                                                        ? 'bg-cyan-900/20 border border-cyan-500/20'
                                                        : 'bg-fuchsia-900/20 border border-fuchsia-500/20'
                                                    }`}
                                            >
                                                <span className={bet.side === 'cyan' ? 'text-cyan-400' : 'text-fuchsia-400'}>
                                                    {bet.side.toUpperCase()}
                                                </span>
                                                <span className="text-white font-mono">{bet.amount} SOL</span>
                                                <span className={`font-semibold ${bet.result === 'win' ? 'text-green-400' :
                                                        bet.result === 'lose' ? 'text-red-400' : 'text-slate-500'
                                                    }`}>
                                                    {bet.result?.toUpperCase() || 'PENDING'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {profile.totalBets === 0 && (
                                <div className="text-center py-6 text-slate-500">
                                    <Star size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>No bets yet!</p>
                                    <p className="text-xs">Place your first bet to start tracking stats</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileStats;
