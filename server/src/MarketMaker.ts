import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import BN from "bn.js";
import { PrismaClient } from "@prisma/client";
const idl = require("../idl/snake_betting.json");

// Configuration from environment
const MM_ENABLED = process.env.MM_ENABLED === "true";
const MM_BALANCE_THRESHOLD = parseFloat(process.env.MM_BALANCE_THRESHOLD || "0.7");
const MM_MAX_BET_SOL = parseFloat(process.env.MM_MAX_BET_SOL || "0.1");
const MM_MIN_BET_SOL = parseFloat(process.env.MM_MIN_BET_SOL || "0.01");
const MM_BET_DELAY_SECONDS = parseInt(process.env.MM_BET_DELAY_SECONDS || "5");

let mmWallet: Keypair | null = null;
let program: anchor.Program | null = null;
let connection: Connection | null = null;
let prisma: PrismaClient | null = null;

export function initMarketMaker(
    conn: Connection,
    prog: anchor.Program,
    db: PrismaClient
) {
    connection = conn;
    program = prog;
    prisma = db;

    if (!MM_ENABLED) {
        console.log("Market Maker: DISABLED");
        return;
    }

    // Load MM wallet from env
    if (process.env.MM_WALLET_KEY) {
        try {
            const secretKey = Uint8Array.from(JSON.parse(process.env.MM_WALLET_KEY));
            mmWallet = Keypair.fromSecretKey(secretKey);
            console.log("Market Maker: ENABLED");
            console.log("MM Wallet:", mmWallet.publicKey.toBase58());
            console.log("MM Config: threshold=" + MM_BALANCE_THRESHOLD + ", maxBet=" + MM_MAX_BET_SOL + " SOL");
        } catch (e) {
            console.error("Market Maker: Failed to load wallet", e);
            mmWallet = null;
        }
    } else {
        console.log("Market Maker: No MM_WALLET_KEY set, disabled");
    }
}

interface PoolBalance {
    poolPda: string;
    cyanBets: number;
    magentaBets: number;
    totalBets: number;
    cyanPercent: number;
    magentaPercent: number;
}

function checkPoolBalance(poolInfo: any): PoolBalance {
    const cyanBets = poolInfo.cyanBets || 0;
    const magentaBets = poolInfo.magentaBets || 0;
    const totalBets = cyanBets + magentaBets;

    return {
        poolPda: poolInfo.poolPda,
        cyanBets,
        magentaBets,
        totalBets,
        cyanPercent: totalBets > 0 ? cyanBets / totalBets : 0.5,
        magentaPercent: totalBets > 0 ? magentaBets / totalBets : 0.5
    };
}

function shouldPlaceBet(balance: PoolBalance): { side: "cyan" | "magenta"; amount: number } | null {
    // If pool is empty, don't bet (let users go first)
    if (balance.totalBets === 0) {
        return null;
    }

    // Check if one side exceeds threshold
    if (balance.cyanPercent > MM_BALANCE_THRESHOLD) {
        // Too much on CYAN, bet on MAGENTA
        const neededToBalance = (balance.cyanBets - balance.magentaBets) / 2;
        const amount = Math.min(neededToBalance, MM_MAX_BET_SOL);
        if (amount >= MM_MIN_BET_SOL) {
            return { side: "magenta", amount };
        }
    } else if (balance.magentaPercent > MM_BALANCE_THRESHOLD) {
        // Too much on MAGENTA, bet on CYAN
        const neededToBalance = (balance.magentaBets - balance.cyanBets) / 2;
        const amount = Math.min(neededToBalance, MM_MAX_BET_SOL);
        if (amount >= MM_MIN_BET_SOL) {
            return { side: "cyan", amount };
        }
    }

    return null;
}

async function placeMakerBet(
    poolPda: PublicKey,
    side: "cyan" | "magenta",
    amountSOL: number
): Promise<string | null> {
    if (!mmWallet || !program || !connection) {
        console.log("MM: Not initialized");
        return null;
    }

    const lamports = Math.floor(amountSOL * anchor.web3.LAMPORTS_PER_SOL);
    const color = side === "cyan" ? { cyan: {} } : { magenta: {} };

    console.log(`MM: Placing ${amountSOL} SOL bet on ${side}`);

    try {
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(mmWallet),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);
        const mmProgram = new anchor.Program(idl as unknown as anchor.Idl, provider);

        const txSig = await mmProgram.methods.placeBet(color, new BN(lamports))
            .accountsPartial({
                pool: poolPda,
                user: mmWallet.publicKey,
            })
            .rpc();

        console.log(`MM: Bet placed! TX: ${txSig}`);
        return txSig;
    } catch (e) {
        console.error("MM: Failed to place bet", e);
        return null;
    }
}

// Called by GameEngine during countdown
export async function scheduleBalancing(
    poolPda: string,
    countdownSecondsRemaining: number,
    poolInfo: any
) {
    if (!MM_ENABLED || !mmWallet) return;

    // Only act when countdown is at the configured delay
    if (countdownSecondsRemaining !== MM_BET_DELAY_SECONDS) return;

    console.log("MM: Checking pool balance...");
    const balance = checkPoolBalance(poolInfo);
    console.log(`MM: Cyan=${(balance.cyanPercent * 100).toFixed(1)}%, Magenta=${(balance.magentaPercent * 100).toFixed(1)}%`);

    const decision = shouldPlaceBet(balance);
    if (!decision) {
        console.log("MM: Pool balanced, no action needed");
        return;
    }

    console.log(`MM: Rebalancing - betting ${decision.amount.toFixed(3)} SOL on ${decision.side}`);

    const txSig = await placeMakerBet(
        new PublicKey(poolPda),
        decision.side,
        decision.amount
    );

    // Record in database
    if (prisma) {
        try {
            await prisma.makerBet.create({
                data: {
                    poolPda,
                    side: decision.side,
                    amount: decision.amount,
                    reason: "rebalance",
                    txSignature: txSig,
                    result: null // Will be updated after game settles
                }
            });
            console.log("MM: Bet recorded in database");
        } catch (e) {
            console.error("MM: Failed to record bet in database", e);
        }
    }
}

// Update MM bet results after game settles
export async function updateMakerBetResults(poolPda: string, winner: string) {
    if (!prisma) return;

    try {
        // Find all MM bets for this pool
        const makerBets = await prisma.makerBet.findMany({
            where: { poolPda, result: null }
        });

        for (const bet of makerBets) {
            const result = bet.side === winner ? "win" : "lose";
            await prisma.makerBet.update({
                where: { id: bet.id },
                data: { result }
            });
            console.log(`MM: Updated bet ${bet.id} result: ${result}`);
        }
    } catch (e) {
        console.error("MM: Failed to update bet results", e);
    }
}
