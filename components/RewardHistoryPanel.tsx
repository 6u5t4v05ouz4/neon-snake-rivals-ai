import React, { useEffect, useState } from 'react';
import { SERVER_URL } from '../constants';
import { History, ExternalLink, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface RewardEntry {
    id: number;
    walletAddress: string;
    rank: number;
    amount: number;
    txSignature: string;
    distributedAt: string;
}

interface RewardHistoryPanelProps {
    onClose: () => void;
}

const PAGE_SIZE = 15;

const RewardHistoryPanel: React.FC<RewardHistoryPanelProps> = ({ onClose }) => {
    const [rewards, setRewards] = useState<RewardEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${SERVER_URL}/reward-history?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`);
                if (res.ok) {
                    const data = await res.json();
                    setRewards(data.distributions);
                    setTotal(data.total);
                }
            } catch (e) {
                console.error('Failed to fetch reward history:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [page]);

    const getRankEmoji = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    const getRankColor = (rank: number) => {
        if (rank === 1) return 'text-yellow-400';
        if (rank === 2) return 'text-gray-300';
        if (rank === 3) return 'text-amber-600';
        return 'text-slate-400';
    };

    // Group rewards by date
    const groupedByDate = rewards.reduce<Record<string, RewardEntry[]>>((acc, r) => {
        const date = new Date(r.distributedAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
        if (!acc[date]) acc[date] = [];
        acc[date].push(r);
        return acc;
    }, {});

    const totalDistributed = rewards.reduce((sum, r) => sum + r.amount, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <History size={20} className="text-amber-400" />
                        <h2 className="text-lg font-bold text-white">Reward History</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-800"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Summary */}
                <div className="px-4 py-2 bg-slate-800/50 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                        {total} total payouts
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">
                        {totalDistributed.toFixed(3)} SOL on this page
                    </span>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="text-center text-slate-500 py-8">Loading...</div>
                    ) : rewards.length === 0 ? (
                        <div className="text-center text-slate-500 py-8">
                            <History size={32} className="mx-auto mb-2 opacity-50" />
                            No rewards distributed yet
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(groupedByDate).map(([date, entries]: [string, RewardEntry[]]) => (
                                <div key={date}>
                                    <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1.5 flex items-center gap-2">
                                        <div className="h-px flex-1 bg-slate-700" />
                                        {date}
                                        <div className="h-px flex-1 bg-slate-700" />
                                    </div>
                                    <div className="space-y-1">
                                        {entries.map((r) => (
                                            <div
                                                key={r.id}
                                                className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-bold ${getRankColor(r.rank)}`}>
                                                        {getRankEmoji(r.rank)}
                                                    </span>
                                                    <div>
                                                        <div className="text-xs text-slate-300 font-mono">
                                                            {r.walletAddress.slice(0, 6)}...{r.walletAddress.slice(-6)}
                                                        </div>
                                                        <div className="text-[9px] text-slate-500">
                                                            {new Date(r.distributedAt).toLocaleTimeString('en-US', {
                                                                hour: '2-digit', minute: '2-digit',
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-emerald-400 font-mono font-bold text-sm">
                                                        +{r.amount.toFixed(3)} SOL
                                                    </span>
                                                    <a
                                                        href={`https://explorer.solana.com/tx/${r.txSignature}?cluster=devnet`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-slate-500 hover:text-indigo-400 transition-colors p-1 rounded hover:bg-slate-700"
                                                        title="View on Solana Explorer"
                                                    >
                                                        <ExternalLink size={12} />
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t border-slate-700 text-xs">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors px-2 py-1 rounded hover:bg-slate-800"
                        >
                            <ChevronLeft size={14} /> Prev
                        </button>
                        <span className="text-slate-500">
                            Page {page + 1} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors px-2 py-1 rounded hover:bg-slate-800"
                        >
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                )}

                {/* Transparency note */}
                <div className="px-4 py-2 border-t border-slate-700 text-center">
                    <span className="text-[9px] text-slate-500">
                        All rewards are on-chain and verifiable on Solana Explorer 🔗
                    </span>
                </div>
            </div>
        </div>
    );
};

export default RewardHistoryPanel;
