import React, { useEffect, useState } from 'react';
import { SERVER_URL } from '../constants';

interface Stats {
    totalMatches: number;
    wins: Record<string, number>;
}

const StatsPanel: React.FC = () => {
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
        // Refresh stats every 10 seconds
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, []);

    if (!stats) return null;

    return (
        <div className="fixed top-4 right-4 bg-slate-900/90 border border-slate-700 p-4 rounded-lg shadow-xl backdrop-blur-md z-30 max-w-xs">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-700 pb-2">
                Season Stats
            </h3>
            <div className="space-y-2">
                <div className="flex justify-between text-slate-300 text-sm">
                    <span>Total Matches:</span>
                    <span className="font-mono font-bold text-white">{stats.totalMatches}</span>
                </div>
                <div className="pt-2 space-y-1">
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
    );
};

export default StatsPanel;
