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

// Hedge 60/40 Strategy: Always bet on both sides
// 60% opposite to user majority, 40% same side
function calculateHedgeBets(balance: PoolBalance): { cyanBet: number; magentaBet: number } | null {
    // Total bet split between both sides (random slight variation)
    const baseVariation = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
    const totalBetAmount = MM_MAX_BET_SOL * baseVariation;

    // Determine which side has more user bets
    let majorityPercent = 0.6; // 60% to underdog
    let minorityPercent = 0.4; // 40% to favorite

    // Add small randomization to percentages (55-65% range)
    const randomOffset = (Math.random() - 0.5) * 0.1; // -0.05 to +0.05
    majorityPercent += randomOffset;
    minorityPercent -= randomOffset;

    let cyanBet: number;
    let magentaBet: number;

    if (balance.totalBets === 0) {
        // No user bets yet - bet equally (or skip)
        cyanBet = totalBetAmount * 0.5;
        magentaBet = totalBetAmount * 0.5;
    } else if (balance.cyanPercent >= balance.magentaPercent) {
        // More bets on CYAN - bet MORE on MAGENTA (against majority)
        magentaBet = totalBetAmount * majorityPercent;
        cyanBet = totalBetAmount * minorityPercent;
    } else {
        // More bets on MAGENTA - bet MORE on CYAN (against majority)
        cyanBet = totalBetAmount * majorityPercent;
        magentaBet = totalBetAmount * minorityPercent;
    }

    // Ensure minimum bet amounts
    if (cyanBet < MM_MIN_BET_SOL) cyanBet = MM_MIN_BET_SOL;
    if (magentaBet < MM_MIN_BET_SOL) magentaBet = MM_MIN_BET_SOL;

    // Cap at max
    if (cyanBet > MM_MAX_BET_SOL) cyanBet = MM_MAX_BET_SOL;
    if (magentaBet > MM_MAX_BET_SOL) magentaBet = MM_MAX_BET_SOL;

    return { cyanBet, magentaBet };
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

// Track if we already bet on current pool
let lastBetPoolPda: string | null = null;

// Called by GameEngine during countdown
export async function scheduleBalancing(
    poolPda: string,
    countdownSecondsRemaining: number,
    poolInfo: any
) {
    console.log(`MM: scheduleBalancing called - countdown=${countdownSecondsRemaining}, poolPda=${poolPda}`);

    if (!MM_ENABLED) {
        console.log("MM: Not enabled (MM_ENABLED !== 'true')");
        return;
    }

    if (!mmWallet) {
        console.log("MM: No wallet loaded");
        return;
    }

    // Only act when countdown is at or below the configured delay (and only once per pool)
    if (countdownSecondsRemaining > MM_BET_DELAY_SECONDS) {
        return; // Too early
    }

    if (lastBetPoolPda === poolPda) {
        return; // Already bet on this pool
    }

    console.log("MM: Checking pool balance...");
    console.log("MM: poolInfo received:", JSON.stringify(poolInfo));
    const balance = checkPoolBalance(poolInfo);
    console.log(`MM: Cyan=${(balance.cyanPercent * 100).toFixed(1)}%, Magenta=${(balance.magentaPercent * 100).toFixed(1)}%, Total=${balance.totalBets}`);

    // Calculate hedge bets (60/40 strategy - always bet on both sides)
    const hedgeBets = calculateHedgeBets(balance);
    if (!hedgeBets) {
        console.log("MM: Could not calculate hedge bets");
        lastBetPoolPda = poolPda;
        return;
    }

    console.log(`MM: Hedge strategy - betting ${hedgeBets.cyanBet.toFixed(3)} SOL on CYAN, ${hedgeBets.magentaBet.toFixed(3)} SOL on MAGENTA`);

    // Mark as processed BEFORE placing bets
    lastBetPoolPda = poolPda;

    // Place bet on CYAN
    const cyanTxSig = await placeMakerBet(
        new PublicKey(poolPda),
        "cyan",
        hedgeBets.cyanBet
    );

    // Place bet on MAGENTA
    const magentaTxSig = await placeMakerBet(
        new PublicKey(poolPda),
        "magenta",
        hedgeBets.magentaBet
    );

    // Record in database
    if (prisma) {
        try {
            // Record CYAN bet
            if (cyanTxSig) {
                await prisma.makerBet.create({
                    data: {
                        poolPda,
                        side: "cyan",
                        amount: hedgeBets.cyanBet,
                        reason: "hedge",
                        txSignature: cyanTxSig,
                        result: null
                    }
                });
            }
            // Record MAGENTA bet
            if (magentaTxSig) {
                await prisma.makerBet.create({
                    data: {
                        poolPda,
                        side: "magenta",
                        amount: hedgeBets.magentaBet,
                        reason: "hedge",
                        txSignature: magentaTxSig,
                        result: null
                    }
                });
            }
            console.log("MM: Both bets recorded in database");
        } catch (e) {
            console.error("MM: Failed to record bets in database", e);
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

// Auto-claim MM winnings after game settles
export async function claimMakerWinnings(poolPdaStr: string) {
    if (!MM_ENABLED || !mmWallet || !program || !connection) {
        console.log("MM: Cannot claim - not initialized");
        return;
    }

    console.log("MM: Attempting to claim winnings...");

    try {
        const poolPda = new PublicKey(poolPdaStr);

        // Find user bet PDA for MM wallet
        const [userBetPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("bet"), poolPda.toBuffer(), mmWallet.publicKey.toBuffer()],
            program.programId
        );

        // Create a new provider with MM wallet
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(mmWallet),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);
        const mmProgram = new anchor.Program(idl as unknown as anchor.Idl, provider);

        const txSig = await mmProgram.methods.claimWinnings()
            .accountsPartial({
                pool: poolPda,
                user: mmWallet.publicKey,
                userBet: userBetPda,
            })
            .rpc();

        console.log(`MM: Claim successful! TX: ${txSig}`);
    } catch (e: any) {
        // If not winner, this will fail - that's expected
        if (e.message?.includes("NotWinner")) {
            console.log("MM: Did not win this side, no claim needed");
        } else {
            console.error("MM: Claim failed", e.message || e);
        }
    }
}
