import cron from 'node-cron';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { PrismaClient } from '@prisma/client';
import { connection } from './solana';

// Distribution percentages for top 3
const DISTRIBUTION = [
    { rank: 1, percent: 0.50 }, // 50% to 1st place
    { rank: 2, percent: 0.30 }, // 30% to 2nd place
    { rank: 3, percent: 0.20 }, // 20% to 3rd place
];

const REWARD_POOL_PERCENT = 0.50; // 50% of house wallet balance
const MIN_REWARD_POOL = 0.01;     // Minimum SOL to trigger distribution

let houseWalletKeypair: Keypair | null = null;

// Load house wallet from mnemonic
function loadHouseWallet(): Keypair | null {
    const mnemonic = process.env.HOUSE_WALLET_MNEMONIC;
    if (!mnemonic) {
        console.warn('⚠️ HOUSE_WALLET_MNEMONIC not set — reward distribution disabled');
        return null;
    }

    try {
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        // Derive using Solana's standard path (m/44'/501'/0'/0')
        const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
        const keypair = Keypair.fromSeed(derivedSeed);
        console.log('🏦 House wallet loaded from mnemonic:', keypair.publicKey.toBase58());
        return keypair;
    } catch (e) {
        console.error('❌ Failed to load house wallet from mnemonic:', e);
        return null;
    }
}

// Get the reward pool amount (50% of house wallet balance)
export async function getRewardPoolBalance(): Promise<{ balance: number; rewardPool: number; houseWallet: string | null }> {
    if (!houseWalletKeypair) {
        return { balance: 0, rewardPool: 0, houseWallet: null };
    }

    try {
        const balanceLamports = await connection.getBalance(houseWalletKeypair.publicKey);
        const balance = balanceLamports / LAMPORTS_PER_SOL;
        const rewardPool = balance * REWARD_POOL_PERCENT;
        return {
            balance,
            rewardPool,
            houseWallet: houseWalletKeypair.publicKey.toBase58(),
        };
    } catch (e) {
        console.error('Error getting house wallet balance:', e);
        return { balance: 0, rewardPool: 0, houseWallet: null };
    }
}

// Get daily leaderboard (bets from today only)
async function getDailyLeaderboard(prisma: PrismaClient): Promise<{ wallet: string; score: number; wins: number }[]> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const bets = await prisma.bet.findMany({
        where: {
            result: { not: null },
            createdAt: { gte: todayStart },
        },
        select: {
            walletAddress: true,
            amount: true,
            result: true,
        },
    });

    const walletStats = new Map<string, { wins: number; losses: number; totalBets: number; score: number }>();

    for (const bet of bets) {
        const stats = walletStats.get(bet.walletAddress) || { wins: 0, losses: 0, totalBets: 0, score: 0 };
        stats.totalBets++;

        if (bet.result === 'win') {
            stats.wins++;
        } else {
            stats.losses++;
        }

        // Same weighted score as main leaderboard
        stats.score = (stats.wins * 3) + (stats.totalBets * 0.5) - (stats.losses * 1);
        walletStats.set(bet.walletAddress, stats);
    }

    return Array.from(walletStats.entries())
        .map(([wallet, stats]) => ({ wallet, score: stats.score, wins: stats.wins }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
}

// Distribute rewards to top 3
async function distributeRewards(prisma: PrismaClient) {
    if (!houseWalletKeypair) {
        console.log('⏭️ Reward distribution skipped — no house wallet keypair');
        return;
    }

    console.log('🏆 Starting daily reward distribution...');

    try {
        // 1. Get house wallet balance
        const { balance, rewardPool } = await getRewardPoolBalance();
        console.log(`🏦 House wallet balance: ${balance.toFixed(4)} SOL, reward pool: ${rewardPool.toFixed(4)} SOL`);

        if (rewardPool < MIN_REWARD_POOL) {
            console.log(`⏭️ Reward pool too small (${rewardPool.toFixed(4)} SOL < ${MIN_REWARD_POOL} SOL minimum)`);
            return;
        }

        // 2. Get daily top 3
        const top3 = await getDailyLeaderboard(prisma);
        if (top3.length === 0) {
            console.log('⏭️ No daily bettors — skipping distribution');
            return;
        }

        console.log(`📊 Daily top ${top3.length}:`, top3.map(e => `${e.wallet.slice(0, 8)}... (score: ${e.score})`));

        // 3. Build transfer transaction
        const tx = new Transaction();
        const transfers: { wallet: string; rank: number; amount: number }[] = [];

        for (let i = 0; i < Math.min(top3.length, DISTRIBUTION.length); i++) {
            const entry = top3[i];
            const dist = DISTRIBUTION[i];
            const amount = rewardPool * dist.percent;

            // Skip tiny amounts (less than tx fee)
            if (amount < 0.001) continue;

            const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
            tx.add(
                SystemProgram.transfer({
                    fromPubkey: houseWalletKeypair.publicKey,
                    toPubkey: new PublicKey(entry.wallet),
                    lamports,
                })
            );

            transfers.push({ wallet: entry.wallet, rank: dist.rank, amount });
        }

        if (transfers.length === 0) {
            console.log('⏭️ No transfers to make (amounts too small)');
            return;
        }

        // 4. Sign and send
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = houseWalletKeypair.publicKey;
        tx.sign(houseWalletKeypair);

        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, 'confirmed');

        console.log(`✅ Rewards distributed! TX: ${sig}`);

        // 5. Log to database
        for (const transfer of transfers) {
            await prisma.rewardDistribution.create({
                data: {
                    walletAddress: transfer.wallet,
                    rank: transfer.rank,
                    amount: transfer.amount,
                    txSignature: sig,
                },
            });
        }

        console.log(`💾 ${transfers.length} reward distributions saved to DB`);
        for (const t of transfers) {
            console.log(`  🏅 #${t.rank}: ${t.wallet.slice(0, 8)}... → ${t.amount.toFixed(4)} SOL`);
        }

    } catch (e) {
        console.error('❌ Reward distribution failed:', e);
    }
}

// Initialize and start the cron job
export function startRewardDistributor(prisma: PrismaClient) {
    houseWalletKeypair = loadHouseWallet();

    if (!houseWalletKeypair) {
        console.warn('⚠️ Reward distributor not started (no house wallet)');
        return;
    }

    // Run every day at 00:00 UTC
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ CRON: Midnight UTC — triggering reward distribution');
        await distributeRewards(prisma);
    }, { timezone: 'UTC' });

    console.log('✅ Reward distributor scheduled: daily at 00:00 UTC');
}
