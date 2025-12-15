import React, { useEffect, useState } from 'react';
import { SERVER_URL } from '../constants';

interface SessionStats {
    id: number;
    startedAt: string;
    cyanWins: number;
    magentaWins: number;
    sessionMatches: number;
}

interface Stats {
    totalMatches: number;
    wins: Record<string, number>;
    currentSession: SessionStats | null;
}

interface StatsPanelProps {
    currentScores: {
        cyan: number;
        magenta: number;
    };
}

const StatsPanel: React.FC<StatsPanelProps> = ({ currentScores }) => {
    const [stats, setStats] = useState<Stats | null>(null);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/stats`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (e) {
            console.error("Failed to fetch stats", e);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    if (!stats) return null;

    const session = stats.currentSession;

    return (
        <div className="fixed top-4 right-4 bg-slate-900/90 border border-slate-700 p-4 rounded-lg shadow-xl backdrop-blur-md z-30 w-72 max-h-[90vh] overflow-y-auto">

            {/* Live Score Board */}
            <div className="flex gap-6 bg-slate-900/80 p-3 rounded-xl border border-slate-800 mb-4 justify-between">
                <div className="text-center min-w-[60px]">
                    <div className="text-[10px] text-cyan-400 font-bold mb-1">CYAN</div>
                    <div className="text-xl font-mono text-white">{currentScores.cyan}</div>
                </div>
                <div className="w-[1px] bg-slate-700"></div>
                <div className="text-center min-w-[60px]">
                    <div className="text-[10px] text-fuchsia-500 font-bold mb-1">MAGENTA</div>
                    <div className="text-xl font-mono text-white">{currentScores.magenta}</div>
                </div>
            </div>

            {/* Session Stats */}
            {session && (
                <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Current Session</h3>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Matches</span>
                            <span className="text-white font-mono">{session.sessionMatches}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-cyan-500">Cyan Wins</span>
                            <span className="text-cyan-300 font-mono">{session.cyanWins}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-fuchsia-500">Magenta Wins</span>
                            <span className="text-fuchsia-300 font-mono">{session.magentaWins}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* All-Time Stats */}
            <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                <h3 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">All-Time</h3>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Total Matches</span>
                        <span className="text-slate-300 font-mono">{stats.totalMatches}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-cyan-600">Cyan Wins</span>
                        <span className="text-cyan-400 font-mono">{stats.wins?.['CYAN VIPER'] || 0}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-fuchsia-600">Magenta Wins</span>
                        <span className="text-fuchsia-400 font-mono">{stats.wins?.['MAGENTA PYTHON'] || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsPanel;
