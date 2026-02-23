import React, { useEffect, useState } from 'react';
import { SERVER_URL } from '../constants';
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from 'bn.js';
import * as anchor from '@coral-xyz/anchor';
import idl from '../src/idl/snake_betting.json';
import { BarChart2 } from 'lucide-react';
import { io } from 'socket.io-client';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useToast } from './Toast';

const PROGRAM_ID = new PublicKey("4Mw572DpPh5UWWx9ic4sZBtG8UJRBujJPXrE2pcwvBzw");

interface BettingPanelProps {
    isCountdown: boolean;
}

const BettingPanel: React.FC<BettingPanelProps> = ({ isCountdown }) => {
    const { publicKey, connected, sendTransaction } = useWallet();
    const anchorWallet = useAnchorWallet();
    const { connection } = useConnection();
    const [betAmount, setBetAmount] = useState(0.005);
    const { play } = useSoundEffects();
    const { showToast } = useToast();

    // Profile stats for inline display
    const [profileStats, setProfileStats] = useState<{
        totalBets: number;
        wins: number;
        losses: number;
        winRate: string;
        netProfit: string;
        favoriteSide: string | null;
    } | null>(null);

    // Pool and bet state
    const [poolInfo, setPoolInfo] = useState<{
        poolPda: string | null;
        cyanBets: number;
        magentaBets: number;
        totalBets: number;
        status: string | null;
        winner: string | null;
    } | null>(null);
    const [userBet, setUserBet] = useState<{ side: string; amount: number; poolPda?: string } | null>(null);
    const [isBetting, setIsBetting] = useState(false);

    // Register bet to server (replaces localStorage)
    const registerBetToServer = async (poolPda: string, bet: { side: string; amount: number }, txSignature: string) => {
        try {

            const res = await fetch(`${SERVER_URL}/register-bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    poolPda,
                    walletAddress: publicKey?.toBase58(),
                    side: bet.side,
                    amount: bet.amount,
                    txSignature
                })
            });
            if (res.ok) {
                const data = await res.json();

                setUserBet({ ...bet, poolPda });
                // Refresh profile stats after betting
                fetchProfileStats();
            } else {
                const errText = await res.text();
                console.error('Failed to register bet:', res.status, errText);
                alert(`Failed to register bet on server: ${errText}`);
            }
        } catch (e) {
            console.error('Failed to register bet on server:', e);
            alert(`Network error registering bet: ${e}`);
        }
    };

    // Fetch profile stats
    const fetchProfileStats = async () => {
        if (!publicKey) return;
        try {
            const res = await fetch(`${SERVER_URL}/profile/${publicKey.toBase58()}`);
            if (res.ok) {
                const data = await res.json();
                setProfileStats(data);
            }
        } catch (e) {
            console.error('Failed to fetch profile stats:', e);
        }
    };

    // Fetch profile stats when wallet connects
    useEffect(() => {
        if (connected && publicKey) {
            fetchProfileStats();
        } else {
            setProfileStats(null);
        }
    }, [connected, publicKey]);

    // Check if user can claim from server
    const checkCanClaimFromServer = async (): Promise<{
        canClaim: boolean;
        poolPda?: string;
        winner?: string;
        userBet?: any;
        reason?: string;
    }> => {
        if (!publicKey) return { canClaim: false };
        try {
            const res = await fetch(`${SERVER_URL}/can-claim/${publicKey.toBase58()}`);
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            console.error('Failed to check claim status:', e);
        }
        return { canClaim: false };
    };

    // Mark bet as claimed on server
    const markClaimedOnServer = async (poolPda: string) => {
        if (!publicKey) return;
        try {
            await fetch(`${SERVER_URL}/mark-claimed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    poolPda,
                    walletAddress: publicKey.toBase58()
                })
            });

        } catch (e) {
            console.error('Failed to mark claimed:', e);
        }
    };


    // Fetch pool info
    const fetchPoolInfo = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/pool-info`);
            if (res.ok) {
                const data = await res.json();

                setPoolInfo(data);
            }
        } catch (e) {
            console.error("Failed to fetch pool info", e);
        }
    };

    // State for last settled pool (for claims)
    const [lastSettledPool, setLastSettledPool] = useState<{ poolPda: string; winner: string } | null>(null);

    // Fetch last settled pool for claims
    const fetchLastSettledPool = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/last-settled-pool`);
            if (res.ok) {
                const data = await res.json();
                if (data.poolPda) {

                    setLastSettledPool(data);
                }
            }
        } catch (e) {
            console.error("Failed to fetch last settled pool", e);
        }
    };

    useEffect(() => {
        // Poll pool info and last settled pool when connected
        if (!connected) return;

        const poll = async () => {
            await fetchPoolInfo();
            await fetchLastSettledPool();
        };

        poll();
        const interval = setInterval(poll, 2000);
        return () => clearInterval(interval);
    }, [connected]);

    // State for claim status from server
    const [claimStatus, setClaimStatus] = useState<{
        canClaim: boolean;
        poolPda?: string;
        winner?: string;
        userBet?: any;
        reason?: string;
    } | null>(null);

    // Check claim status from server when wallet is connected (for settled pool)
    useEffect(() => {
        if (!connected || !publicKey) return;

        const checkClaim = async () => {
            const status = await checkCanClaimFromServer();

            setClaimStatus(status);
            // Don't set userBet here - that's for the settled pool, not current pool
        };

        checkClaim();
        const interval = setInterval(checkClaim, 2000);
        return () => clearInterval(interval);
    }, [connected, publicKey]);

    // Listen for instant game:settled Socket.IO event
    useEffect(() => {
        if (!connected || !publicKey) return;

        const socket = io(SERVER_URL);

        socket.on('game:settled', async (data: { poolPda: string; winner: string }) => {
            console.log('Received game:settled event:', data);

            // Update last settled pool immediately
            setLastSettledPool({ poolPda: data.poolPda, winner: data.winner });

            // Immediately check claim status
            const status = await checkCanClaimFromServer();
            setClaimStatus(status);

            // Play win/lose sound
            if (status.canClaim) {
                play('win');
            } else if (status.reason === 'Did not bet on winner') {
                play('lose');
            }

            // Also refresh pool info
            await fetchPoolInfo();
        });

        return () => {
            socket.disconnect();
        };
    }, [connected, publicKey]);

    // Check for bet on CURRENT pool when pool changes
    useEffect(() => {
        if (!connected || !publicKey) return;

        // If pool was cleared (settled) or doesn't exist yet, reset userBet so user can place new bet
        if (!poolInfo?.poolPda) {
            setUserBet(null);
            return;
        }

        // If userBet is from a DIFFERENT pool (old settled pool), clear it
        if (userBet?.poolPda && userBet.poolPda !== poolInfo.poolPda) {
            setUserBet(null);
        }

        const checkCurrentPoolBet = async () => {
            try {
                const res = await fetch(`${SERVER_URL}/my-bets/${publicKey.toBase58()}`);
                if (res.ok) {
                    const bets = await res.json();
                    // Find bet for current pool
                    const currentBet = bets.find((b: any) => b.poolPda === poolInfo.poolPda);
                    if (currentBet) {
                        setUserBet({ side: currentBet.side, amount: currentBet.amount, poolPda: currentBet.poolPda });
                    } else {
                        setUserBet(null); // No bet on current pool, allow new bet
                    }
                }
            } catch (e) {
                console.error("Failed to check current pool bet:", e);
            }
        };

        checkCurrentPoolBet();
    }, [connected, publicKey, poolInfo?.poolPda]);

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
                // No pool yet — create one on-demand
                showToast('Criando pool de apostas...', 'info');
                try {
                    const ensureRes = await fetch(`${SERVER_URL}/ensure-pool`, { method: 'POST' });
                    const ensureData = await ensureRes.json();
                    if (!ensureData.poolPda) {
                        showToast('Falha ao criar pool. Tente novamente.', 'error');
                        setIsBetting(false);
                        return;
                    }
                    poolData.poolPda = ensureData.poolPda;
                    showToast('Pool criada! Processando aposta...', 'success');
                } catch (e) {
                    showToast('Erro ao criar pool. Tente novamente.', 'error');
                    setIsBetting(false);
                    return;
                }
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
                showToast(`Simulation failed: ${simulation.value.logs?.[0] || 'Unknown'}`, 'error');
                setIsBetting(false);
                return;
            }

            const sig = await sendTransaction(tx, connection);
            await connection.confirmTransaction(sig, "confirmed");

            // Register bet on server (secure, replaces localStorage)
            await registerBetToServer(poolData.poolPda, { side: color, amount: betAmount }, sig);

            play('bet'); // Play bet sound
            showToast(`Bet placed on ${color.toUpperCase()}! TX: ${sig.slice(0, 8)}...`, 'success');

        } catch (e: any) {
            console.error("Bet error:", e);
            showToast(`Bet failed: ${e?.message || 'Unknown error'}`, 'error');
        } finally {
            setIsBetting(false);
        }
    };

    const [isClaiming, setIsClaiming] = useState(false);

    const claimWinnings = async () => {
        if (!connected || !publicKey || !anchorWallet || !claimStatus?.poolPda) {
            alert("Cannot claim: missing wallet or settled pool");
            return;
        }

        setIsClaiming(true);
        try {
            const provider = new anchor.AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
            anchor.setProvider(provider);
            const program = new anchor.Program(idl as unknown as anchor.Idl, provider);

            const poolPda = new PublicKey(claimStatus.poolPda);



            const tx = await program.methods.claimWinnings()
                .accounts({
                    pool: poolPda,
                    user: publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .transaction();

            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = publicKey;

            // Simulate first for better error messages
            const simulation = await connection.simulateTransaction(tx);
            if (simulation.value.err) {
                console.error("Claim simulation failed:", simulation.value.logs);
                showToast(`Claim simulation failed`, 'error');
                setIsClaiming(false);
                return;
            }

            const sig = await sendTransaction(tx, connection);
            await connection.confirmTransaction(sig, "confirmed");

            // Mark as claimed on server
            await markClaimedOnServer(claimStatus.poolPda);

            play('bet'); // Play sound on successful claim
            showToast(`Winnings claimed! TX: ${sig.slice(0, 8)}...`, 'success');
            setUserBet(null);
            setClaimStatus(null);

        } catch (e: any) {
            console.error("Claim error:", e);
            showToast(`Claim failed: ${e?.message || 'Unknown error'}`, 'error');
        } finally {
            setIsClaiming(false);
        }
    };


    // Use server claimStatus for canClaim (secure, validated by server)
    const canClaim = claimStatus?.canClaim || false;



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
                                <div className="text-lg font-bold text-cyan-300">{poolInfo.cyanBets.toFixed(3)} SOL</div>
                                <div className="text-[10px] text-cyan-500">
                                    {poolInfo.totalBets > 0 ? Math.round(poolInfo.cyanBets / poolInfo.totalBets * 100) : 0}%
                                </div>
                            </div>
                            <div className="bg-fuchsia-900/30 p-2 rounded border border-fuchsia-500/30">
                                <div className="text-[10px] text-fuchsia-400 font-semibold">MAGENTA</div>
                                <div className="text-lg font-bold text-fuchsia-300">{poolInfo.magentaBets.toFixed(3)} SOL</div>
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
                                {userBet.amount.toFixed(3)} SOL on {userBet.side.toUpperCase()} ✓
                            </div>
                        </div>
                    ) : isCountdown ? (
                        <>
                            {/* Quick Bet Buttons */}
                            <div className="flex gap-1 mb-2">
                                {[0.005, 0.01, 0.1, 1].map(amount => (
                                    <button
                                        key={amount}
                                        onClick={() => setBetAmount(amount)}
                                        disabled={isBetting}
                                        className={`flex-1 text-xs py-1 rounded border transition-colors ${betAmount === amount
                                            ? 'bg-indigo-600 border-indigo-400 text-white'
                                            : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                                            }`}
                                    >
                                        {amount}
                                    </button>
                                ))}
                            </div>

                            {/* Bet Amount Input */}
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="number"
                                    step="0.005"
                                    min="0.005"
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-right"
                                    value={betAmount}
                                    onChange={e => {
                                        const val = Number(e.target.value);
                                        if (val >= 0.005 || e.target.value === '') {
                                            setBetAmount(val);
                                        }
                                    }}
                                    disabled={isBetting}
                                />
                                <span className="text-slate-400 self-center">SOL</span>
                            </div>

                            {/* Min Bet Notice */}
                            <div className="text-[10px] text-slate-500 text-center mb-2">
                                Min bet: 0.005 SOL
                            </div>

                            {/* Bet Buttons */}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => placeBet("cyan")}
                                    disabled={isBetting || betAmount < 0.005}
                                    className="bg-cyan-900/80 hover:bg-cyan-700 disabled:opacity-50 text-cyan-200 text-xs py-2 px-1 rounded border border-cyan-500/30 transition-colors"
                                >
                                    {isBetting ? '...' : 'BET CYAN'}
                                </button>
                                <button
                                    onClick={() => placeBet("magenta")}
                                    disabled={isBetting || betAmount < 0.005}
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

            {/* Settled Pool - Claim Winnings UI (using server claimStatus) */}
            {claimStatus && connected && claimStatus.userBet && (
                <div className="mt-4 p-3 bg-gradient-to-b from-amber-900/30 to-orange-900/20 rounded-lg border border-amber-500/50">
                    <h3 className="text-sm font-bold text-amber-300 mb-2 text-center">
                        🏆 GAME SETTLED
                    </h3>
                    <div className={`text-center mb-3 p-2 rounded ${claimStatus.winner === 'cyan' ? 'bg-cyan-900/40' : 'bg-fuchsia-900/40'
                        }`}>
                        <div className="text-xs text-white/70">WINNER</div>
                        <div className={`text-xl font-bold ${claimStatus.winner === 'cyan' ? 'text-cyan-300' : 'text-fuchsia-300'
                            }`}>
                            {claimStatus.winner?.toUpperCase()}
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
                    ) : (
                        <div className="text-center text-slate-400 text-sm py-2">
                            😢 {claimStatus.reason || 'Better luck next time!'}
                        </div>
                    )}
                </div>
            )}

            {/* Profile Stats Panel - Always visible when connected */}
            {connected && publicKey && profileStats && (
                <div className="mt-3 p-3 bg-gradient-to-b from-slate-800/60 to-slate-900/60 rounded-lg border border-slate-600/50">
                    <h3 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
                        <BarChart2 size={12} />
                        MY STATS
                    </h3>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-800/50 p-2 rounded">
                            <div className="text-lg font-bold text-green-400">{profileStats.winRate}%</div>
                            <div className="text-[10px] text-slate-500">WIN RATE</div>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded">
                            <div className={`text-lg font-bold ${parseFloat(profileStats.netProfit) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {parseFloat(profileStats.netProfit) >= 0 ? '+' : ''}{profileStats.netProfit}
                            </div>
                            <div className="text-[10px] text-slate-500">NET SOL</div>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded">
                            <div className="text-lg font-bold text-indigo-400">{profileStats.totalBets}</div>
                            <div className="text-[10px] text-slate-500">BETS</div>
                        </div>
                    </div>
                    {profileStats.totalBets > 0 && (
                        <div className="mt-2 text-[10px] text-slate-500 text-center">
                            {profileStats.wins}W / {profileStats.losses}L • Fav: <span className={profileStats.favoriteSide === 'cyan' ? 'text-cyan-400' : 'text-fuchsia-400'}>{profileStats.favoriteSide?.toUpperCase()}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BettingPanel;
