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
    lastWinner: string | null;
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

            {/* Last Winner Badge */}
            {stats.lastWinner && (
                <div className={`text-center text-xs py-2 px-3 rounded-lg mb-4 border ${stats.lastWinner === 'CYAN VIPER'
                        ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400'
                        : 'bg-fuchsia-900/30 border-fuchsia-500/50 text-fuchsia-400'
                    }`}>
                    🏆 Last Winner: <span className="font-bold">{stats.lastWinner === 'CYAN VIPER' ? 'CYAN' : 'MAGENTA'}</span>
                </div>
            )}

            {/* Unified Stats Table */}
            <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-slate-500 uppercase text-[10px] tracking-wider">
                            <th className="text-left pb-2"></th>
                            <th className="text-right pb-2">Session</th>
                            <th className="text-right pb-2">Total</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-300">
                        <tr>
                            <td className="text-slate-500 py-1">Matches</td>
                            <td className="text-right font-mono">{session?.sessionMatches ?? '-'}</td>
                            <td className="text-right font-mono">{stats.totalMatches}</td>
                        </tr>
                        <tr>
                            <td className="text-cyan-500 py-1">Cyan</td>
                            <td className="text-right font-mono text-cyan-400">{session?.cyanWins ?? '-'}</td>
                            <td className="text-right font-mono text-cyan-400">{stats.wins?.['CYAN VIPER'] || 0}</td>
                        </tr>
                        <tr>
                            <td className="text-fuchsia-500 py-1">Magenta</td>
                            <td className="text-right font-mono text-fuchsia-400">{session?.magentaWins ?? '-'}</td>
                            <td className="text-right font-mono text-fuchsia-400">{stats.wins?.['MAGENTA PYTHON'] || 0}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StatsPanel;
