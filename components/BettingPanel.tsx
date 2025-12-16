import React, { useEffect, useState } from 'react';
import { SERVER_URL } from '../constants';
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from 'bn.js';
import * as anchor from '@coral-xyz/anchor';
import idl from '../src/idl/snake_betting.json';

const PROGRAM_ID = new PublicKey("4Mw572DpPh5UWWx9ic4sZBtG8UJRBujJPXrE2pcwvBzw");

interface BettingPanelProps {
    isCountdown: boolean;
}

const BettingPanel: React.FC<BettingPanelProps> = ({ isCountdown }) => {
    const { publicKey, connected, sendTransaction } = useWallet();
    const anchorWallet = useAnchorWallet();
    const { connection } = useConnection();
    const [betAmount, setBetAmount] = useState(0.1);

    // Pool and bet state
    const [poolInfo, setPoolInfo] = useState<{
        poolPda: string | null;
        cyanBets: number;
        magentaBets: number;
        totalBets: number;
        status: string | null;
        winner: string | null;
    } | null>(null);
    const [userBet, setUserBet] = useState<{ side: string; amount: number } | null>(null);
    const [isBetting, setIsBetting] = useState(false);

    // Save userBet to localStorage
    const saveUserBet = (poolPda: string, bet: { side: string; amount: number }) => {
        localStorage.setItem(`bet_${poolPda}`, JSON.stringify(bet));
        setUserBet(bet);
    };

    // Load userBet from localStorage
    const loadUserBet = (poolPda: string) => {
        const saved = localStorage.getItem(`bet_${poolPda}`);
        if (saved) {
            try {
                const bet = JSON.parse(saved);
                setUserBet(bet);
                return bet;
            } catch (e) {
                return null;
            }
        }
        return null;
    };

    // Clear userBet when pool changes
    const clearUserBet = () => {
        setUserBet(null);
    };

    // Fetch pool info
    const fetchPoolInfo = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/pool-info`);
            if (res.ok) {
                const data = await res.json();
                console.log("Pool info:", data);
                setPoolInfo(data);
            }
        } catch (e) {
            console.error("Failed to fetch pool info", e);
        }
    };

    useEffect(() => {
        // Poll pool info when connected
        if (!connected) return;

        const poll = async () => {
            await fetchPoolInfo();
        };

        poll();
        const interval = setInterval(poll, 3000);
        return () => clearInterval(interval);
    }, [connected]);

    // Load userBet from localStorage when pool changes
    useEffect(() => {
        if (poolInfo?.poolPda) {
            console.log("Loading bet for pool:", poolInfo.poolPda);
            loadUserBet(poolInfo.poolPda);
        } else {
            clearUserBet();
        }
    }, [poolInfo?.poolPda]);

    const placeBet = async (color: "cyan" | "magenta") => {
        if (!connected || !publicKey) {
            alert("Connect Wallet first!");
            return;
        }

        setIsBetting(true);
        try {
            if (!anchorWallet) {
                alert("Wallet not ready!");
                setIsBetting(false);
                return;
            }

            const poolRes = await fetch(`${SERVER_URL}/current-pool`);
            const poolData = await poolRes.json();

            if (!poolData.poolPda) {
                alert("No active betting pool! Wait for next match countdown.");
                setIsBetting(false);
                return;
            }

            const provider = new anchor.AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
            anchor.setProvider(provider);
            const program = new anchor.Program(idl as unknown as anchor.Idl, provider);

            const currentPoolPda = new PublicKey(poolData.poolPda);
            const amount = new BN(betAmount * LAMPORTS_PER_SOL);
            const side = color === "cyan" ? { cyan: {} } : { magenta: {} };

            const tx = await program.methods.placeBet(side, amount)
                .accounts({
                    pool: currentPoolPda,
                    user: publicKey,
                })
                .transaction();

            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = publicKey;

            const simulation = await connection.simulateTransaction(tx);
            if (simulation.value.err) {
                console.error("Simulation failed:", simulation.value.logs);
                alert(`Simulation failed: ${simulation.value.logs?.join('\n')}`);
                setIsBetting(false);
                return;
            }

            const sig = await sendTransaction(tx, connection);
            await connection.confirmTransaction(sig, "confirmed");

            // Save bet to localStorage for persistence
            saveUserBet(poolData.poolPda, { side: color, amount: betAmount });
            console.log("Bet saved:", { side: color, amount: betAmount });
            alert(`Bet placed on ${color.toUpperCase()}! TX: ${sig.slice(0, 8)}...`);

        } catch (e: any) {
            console.error("Bet error:", e);
            alert(`Failed: ${e?.message || 'Unknown error'}`);
        } finally {
            setIsBetting(false);
        }
    };

    const [isClaiming, setIsClaiming] = useState(false);

    const claimWinnings = async () => {
        if (!connected || !publicKey || !anchorWallet || !poolInfo?.poolPda) {
            alert("Cannot claim: missing wallet or pool");
            return;
        }

        setIsClaiming(true);
        try {
            const provider = new anchor.AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
            anchor.setProvider(provider);
            const program = new anchor.Program(idl as unknown as anchor.Idl, provider);

            const poolPda = new PublicKey(poolInfo.poolPda);

            const tx = await program.methods.claimWinnings()
                .accounts({
                    pool: poolPda,
                    user: publicKey,
                })
                .transaction();

            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = publicKey;

            const sig = await sendTransaction(tx, connection);
            await connection.confirmTransaction(sig, "confirmed");

            alert(`Winnings claimed! TX: ${sig.slice(0, 8)}...`);
            setUserBet(null); // Clear after claim

        } catch (e: any) {
            console.error("Claim error:", e);
            alert(`Claim failed: ${e?.message || 'Unknown error'}`);
        } finally {
            setIsClaiming(false);
        }
    };

    // Check if user can claim (pool settled, user bet on winner)
    const canClaim = poolInfo?.status === 'settled' &&
        poolInfo?.winner &&
        userBet &&
        userBet.side === poolInfo.winner;

    console.log("Claim check:", { status: poolInfo?.status, winner: poolInfo?.winner, userBetSide: userBet?.side, canClaim });

    return (
        <div className="fixed top-4 left-4 bg-slate-900/90 border border-slate-700 p-4 rounded-lg shadow-xl backdrop-blur-md z-30 w-72">
            {/* Wallet Connect */}
            <div className="mb-4 flex justify-center">
                <WalletMultiButton />
            </div>

            {/* Betting Pool UI */}
            {(isCountdown || poolInfo?.status === 'open') && connected && (
                <div className="p-3 bg-gradient-to-b from-indigo-900/50 to-purple-900/30 rounded-lg border border-indigo-500/50">
                    <h3 className="text-sm font-bold text-indigo-300 mb-3 text-center">
                        🎲 BETTING POOL
                    </h3>

                    {/* Pool Totals */}
                    {poolInfo && poolInfo.poolPda && (
                        <div className="grid grid-cols-2 gap-2 mb-3 text-center">
                            <div className="bg-cyan-900/30 p-2 rounded border border-cyan-500/30">
                                <div className="text-[10px] text-cyan-400 font-semibold">CYAN</div>
                                <div className="text-lg font-bold text-cyan-300">{poolInfo.cyanBets.toFixed(2)} SOL</div>
                                <div className="text-[10px] text-cyan-500">
                                    {poolInfo.totalBets > 0 ? Math.round(poolInfo.cyanBets / poolInfo.totalBets * 100) : 0}%
                                </div>
                            </div>
                            <div className="bg-fuchsia-900/30 p-2 rounded border border-fuchsia-500/30">
                                <div className="text-[10px] text-fuchsia-400 font-semibold">MAGENTA</div>
                                <div className="text-lg font-bold text-fuchsia-300">{poolInfo.magentaBets.toFixed(2)} SOL</div>
                                <div className="text-[10px] text-fuchsia-500">
                                    {poolInfo.totalBets > 0 ? Math.round(poolInfo.magentaBets / poolInfo.totalBets * 100) : 0}%
                                </div>
                            </div>
                        </div>
                    )}

                    {/* User's Bet Status */}
                    {userBet ? (
                        <div className={`p-2 rounded text-center ${userBet.side === 'cyan'
                            ? 'bg-cyan-900/50 border border-cyan-500/50'
                            : 'bg-fuchsia-900/50 border border-fuchsia-500/50'
                            }`}>
                            <div className="text-xs text-white/70">YOUR BET</div>
                            <div className={`text-lg font-bold ${userBet.side === 'cyan' ? 'text-cyan-300' : 'text-fuchsia-300'}`}>
                                {userBet.amount.toFixed(2)} SOL on {userBet.side.toUpperCase()} ✓
                            </div>
                        </div>
                    ) : isCountdown ? (
                        <>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0.01"
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-right"
                                    value={betAmount}
                                    onChange={e => setBetAmount(Number(e.target.value))}
                                    disabled={isBetting}
                                />
                                <span className="text-slate-400 self-center">SOL</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => placeBet("cyan")}
                                    disabled={isBetting}
                                    className="bg-cyan-900/80 hover:bg-cyan-700 disabled:opacity-50 text-cyan-200 text-xs py-2 px-1 rounded border border-cyan-500/30 transition-colors"
                                >
                                    {isBetting ? '...' : 'BET CYAN'}
                                </button>
                                <button
                                    onClick={() => placeBet("magenta")}
                                    disabled={isBetting}
                                    className="bg-fuchsia-900/80 hover:bg-fuchsia-700 disabled:opacity-50 text-fuchsia-200 text-xs py-2 px-1 rounded border border-fuchsia-500/30 transition-colors"
                                >
                                    {isBetting ? '...' : 'BET MAGENTA'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-slate-500 text-xs py-2">
                            ⏳ Bets closed - game in progress
                        </div>
                    )}
                </div>
            )}

            {/* Wallet not connected message */}
            {!connected && (
                <p className="text-center text-slate-500 text-xs">Connect wallet to bet</p>
            )}

            {/* Settled Pool - Claim Winnings UI */}
            {poolInfo?.status === 'settled' && connected && userBet && (
                <div className="mt-4 p-3 bg-gradient-to-b from-amber-900/30 to-orange-900/20 rounded-lg border border-amber-500/50">
                    <h3 className="text-sm font-bold text-amber-300 mb-2 text-center">
                        🏆 GAME SETTLED
                    </h3>
                    <div className={`text-center mb-3 p-2 rounded ${poolInfo.winner === 'cyan' ? 'bg-cyan-900/40' : 'bg-fuchsia-900/40'
                        }`}>
                        <div className="text-xs text-white/70">WINNER</div>
                        <div className={`text-xl font-bold ${poolInfo.winner === 'cyan' ? 'text-cyan-300' : 'text-fuchsia-300'
                            }`}>
                            {poolInfo.winner?.toUpperCase()}
                        </div>
                    </div>

                    {canClaim ? (
                        <button
                            onClick={claimWinnings}
                            disabled={isClaiming}
                            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg border border-amber-400/50 transition-all shadow-lg"
                        >
                            {isClaiming ? 'Claiming...' : '💰 CLAIM WINNINGS'}
                        </button>
                    ) : userBet ? (
                        <div className="text-center text-slate-400 text-sm py-2">
                            😢 Better luck next time!
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default BettingPanel;
