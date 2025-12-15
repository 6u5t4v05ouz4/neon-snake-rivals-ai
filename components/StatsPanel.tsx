import React, { useEffect, useState } from 'react';
import { SERVER_URL } from '../constants';
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from 'bn.js';
import * as anchor from '@coral-xyz/anchor';
// Import IDL
import idl from '../src/idl/snake_betting.json';

// Constants
const PROGRAM_ID = new PublicKey("4Mw572DpPh5UWWx9ic4sZBtG8UJRBujJPXrE2pcwvBzw");

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
    isCountdown: boolean;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ currentScores, isCountdown }) => {
    const [stats, setStats] = useState<Stats | null>(null);
    const { publicKey, connected, sendTransaction } = useWallet();
    const anchorWallet = useAnchorWallet();
    const { connection } = useConnection();
    const [betAmount, setBetAmount] = useState(0.01);
    const [hasBetOnWinner, setHasBetOnWinner] = useState(false); // To implement claim later if needed

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

    const placeBet = async (color: "cyan" | "magenta") => {
        if (!connected || !publicKey) {
            alert("Connect Wallet first!");
            return;
        }

        try {
            if (!anchorWallet) {
                alert("Wallet not ready!");
                return;
            }

            // Fetch current pool info from backend
            const poolRes = await fetch(`${SERVER_URL}/current-pool`);
            const poolData = await poolRes.json();

            console.log("Pool data from backend:", poolData);

            if (!poolData.poolPda) {
                alert("No active betting pool! Wait for next match countdown.");
                return;
            }

            const provider = new anchor.AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
            anchor.setProvider(provider);
            const program = new anchor.Program(idl as unknown as anchor.Idl, provider);

            const currentPoolPda = new PublicKey(poolData.poolPda);
            console.log("Pool PDA:", currentPoolPda.toBase58());
            console.log("User:", publicKey.toBase58());

            const amount = new BN(betAmount * LAMPORTS_PER_SOL);
            const side = color === "cyan" ? { cyan: {} } : { magenta: {} };

            console.log("Placing bet:", { side, amount: amount.toString() });

            // Let Anchor derive the userBet PDA automatically based on IDL
            const tx = await program.methods.placeBet(side, amount)
                .accounts({
                    pool: currentPoolPda,
                    user: publicKey,
                })
                .transaction();

            console.log("Transaction built, simulating...");

            // Get latest blockhash for simulation
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = publicKey;

            // Simulate to get detailed error
            const simulation = await connection.simulateTransaction(tx);
            console.log("Simulation result:", simulation);

            if (simulation.value.err) {
                console.error("Simulation failed:", simulation.value.logs);
                alert(`Simulation failed: ${simulation.value.logs?.join('\n')}`);
                return;
            }

            console.log("Simulation OK, sending...");

            const sig = await sendTransaction(tx, connection);
            console.log("Transaction sent:", sig);

            await connection.confirmTransaction(sig, "confirmed");

            alert(`Bet placed successfully on ${color.toUpperCase()}! TX: ${sig.slice(0, 8)}...`);

        } catch (e: any) {
            console.error("Bet error details:", e);
            const errorMessage = e?.logs?.join('\n') || e?.message || 'Unknown error';
            alert(`Failed to place bet: ${errorMessage}`);
        }
    };

    if (!stats) return null;

    const session = stats.currentSession;

    return (
        <div className="fixed top-4 right-4 bg-slate-900/90 border border-slate-700 p-4 rounded-lg shadow-xl backdrop-blur-md z-30 w-72 max-h-[90vh] overflow-y-auto">
            {/* Wallet Connect */}
            <div className="mb-4 flex justify-center">
                <WalletMultiButton />
            </div>

            {/* Betting UI (Only during countdown) */}
            {isCountdown && connected && (
                <div className="mb-4 p-3 bg-indigo-900/40 rounded border border-indigo-500/50">
                    <h3 className="text-sm font-bold text-indigo-300 mb-2 text-center">PLACE YOUR BETS</h3>
                    <div className="flex gap-2 mb-2">
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-right"
                            value={betAmount}
                            onChange={e => setBetAmount(Number(e.target.value))}
                        />
                        <span className="text-slate-400 self-center">SOL</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => placeBet("cyan")}
                            className="bg-cyan-900/80 hover:bg-cyan-700 text-cyan-200 text-xs py-2 px-1 rounded border border-cyan-500/30 transition-colors"
                        >
                            CYAN VIPER
                        </button>
                        <button
                            onClick={() => placeBet("magenta")}
                            className="bg-fuchsia-900/80 hover:bg-fuchsia-700 text-fuchsia-200 text-xs py-2 px-1 rounded border border-fuchsia-500/30 transition-colors"
                        >
                            MAGENTA PYTHON
                        </button>
                    </div>
                </div>
            )}

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
