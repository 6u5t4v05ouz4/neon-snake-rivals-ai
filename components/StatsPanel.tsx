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
        <div className="fixed top-4 right-4 bg-slate-900/90 border border-slate-700 p-4 rounded-lg shadow-xl backdrop-blur-md z-30 w-72">
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

            {/* Current Session */}
            {session && (
                <div className="mb-4">
                    <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        Current Session
                    </h3>
                    <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-cyan-400 text-sm">CYAN VIPER</span>
                            <span className="font-mono font-bold text-white text-lg">{session.cyanWins}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-fuchsia-400 text-sm">MAGENTA PYTHON</span>
                            <span className="font-mono font-bold text-white text-lg">{session.magentaWins}</span>
                        </div>
                        <div className="border-t border-slate-700 pt-2 mt-2">
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>Matches</span>
                                <span className="font-mono">{session.sessionMatches}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* All-Time Stats */}
            <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 border-t border-slate-700 pt-3">
                    All-Time Stats
                </h3>
                <div className="space-y-2">
                    <div className="flex justify-between text-slate-300 text-sm">
                        <span>Total Matches:</span>
                        <span className="font-mono font-bold text-white">{stats.totalMatches}</span>
                    </div>
                    <div className="pt-1 space-y-1">
                        {Object.entries(stats.wins).map(([name, count]) => (
                            <div key={name} className="flex justify-between items-center text-xs">
                                <span className={name.includes('CYAN') ? 'text-cyan-400' : 'text-fuchsia-400'}>
                                    {name}
                                </span>
                                <span className="font-mono font-bold text-slate-200">{count} WIN{count !== 1 && 'S'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsPanel;
