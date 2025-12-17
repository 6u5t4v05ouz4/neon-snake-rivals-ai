import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import fs from "fs";
import path from "path";

// Config
const PROGRAM_ID = new PublicKey("4Mw572DpPh5UWWx9ic4sZBtG8UJRBujJPXrE2pcwvBzw");
export const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// Helpers to load wallet
function loadWallet(): Keypair {
    try {
        // First try to load from BACKEND_WALLET_KEY env var (JSON array)
        if (process.env.BACKEND_WALLET_KEY) {
            console.log("Loading wallet from BACKEND_WALLET_KEY env var...");
            const secretKey = Uint8Array.from(JSON.parse(process.env.BACKEND_WALLET_KEY));
            const kp = Keypair.fromSecretKey(secretKey);
            console.log("Backend wallet loaded:", kp.publicKey.toBase58());
            return kp;
        }

        // Fallback to file
        const keypairPath = process.env.BACKEND_WALLET || path.resolve("backend-keypair.json");
        if (fs.existsSync(keypairPath)) {
            console.log("Loading wallet from file:", keypairPath);
            const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
            return Keypair.fromSecretKey(secretKey);
        }

        // Generate new if nothing found
        console.log("WARNING: Generating new backend wallet (no funds!)...");
        const kp = Keypair.generate();
        console.log("Generated wallet:", kp.publicKey.toBase58());
        return kp;
    } catch (e) {
        console.error("Failed to load backend wallet:", e);
        throw e; // Don't silently fail
    }
}

const backendWallet = loadWallet();

// House wallet for receiving 3% fee - can be different from backend wallet
let houseWalletPubkey: PublicKey;
if (process.env.HOUSE_WALLET_ADDRESS) {
    houseWalletPubkey = new PublicKey(process.env.HOUSE_WALLET_ADDRESS);
    console.log("House wallet (for 3% fee):", houseWalletPubkey.toBase58());
} else {
    houseWalletPubkey = backendWallet.publicKey;
    console.log("House wallet not set, using backend wallet for 3% fee:", houseWalletPubkey.toBase58());
}
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(backendWallet), { commitment: "confirmed" });
anchor.setProvider(provider);

// Load IDL
const idlPath = path.resolve("idl/snake_betting.json");
export let program: anchor.Program;
try {
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
    program = new anchor.Program(idl as anchor.Idl, provider);
} catch (e) {
    console.error("Failed to load IDL:", e);
}

let currentGameId = Date.now();
let currentPoolPda: PublicKey | null = null;

// Track last settled pool for claims
let lastSettledPool: {
    poolPda: PublicKey;
    winner: string;
} | null = null;

export async function getPoolInfo() {
    if (!currentPoolPda || !program) {
        return {
            gameId: currentGameId,
            poolPda: null,
            cyanBets: 0,
            magentaBets: 0,
            totalBets: 0,
            status: null,
            winner: null
        };
    }

    try {
        // Fetch pool account data from chain
        const poolAccount = await (program.account as any).gamePool.fetch(currentPoolPda);

        return {
            gameId: currentGameId,
            poolPda: currentPoolPda.toBase58(),
            cyanBets: poolAccount.cyanBets.toNumber() / 1e9, // Convert lamports to SOL
            magentaBets: poolAccount.magentaBets.toNumber() / 1e9,
            totalBets: poolAccount.totalBets.toNumber() / 1e9,
            status: poolAccount.status.open ? 'open' : 'settled',
            winner: poolAccount.winner ? (poolAccount.winner.cyan ? 'cyan' : 'magenta') : null
        };
    } catch (e) {
        // Pool might not exist yet (before creation) or after settle - this is expected
        console.log("Pool info unavailable (pool may not exist yet or was closed)");
        return {
            gameId: currentGameId,
            poolPda: currentPoolPda?.toBase58() || null,
            cyanBets: 0,
            magentaBets: 0,
            totalBets: 0,
            status: null,
            winner: null
        };
    }
}

export async function getUserBet(userPubkey: string) {
    if (!currentPoolPda || !program) return null;

    try {
        const user = new PublicKey(userPubkey);
        const [userBetPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("bet"), currentPoolPda.toBuffer(), user.toBuffer()],
            program.programId
        );

        const userBetAccount = await (program.account as any).userBet.fetch(userBetPda);

        return {
            side: userBetAccount.side.cyan ? 'cyan' : 'magenta',
            amount: userBetAccount.amount.toNumber() / 1e9 // SOL
        };
    } catch (e) {
        // User hasn't bet yet - this is expected
        return null;
    }
}

// Keep backwards compatibility
export function getCurrentPoolInfo() {
    return {
        gameId: currentGameId,
        poolPda: currentPoolPda?.toBase58() || null
    };
}

export async function createNewPool() {
    if (!program) return;
    currentGameId = Date.now();
    console.log(`Creating new pool for Game ID: ${currentGameId}`);

    try {
        const [poolPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("pool"), new BN(currentGameId).toArrayLike(Buffer, "le", 8)],
            program.programId
        );
        currentPoolPda = poolPda;

        // In a real scenario, you'd confirm this transaction logic matches your smart contract exactly.
        // This matches the user's provided snippet.
        await program.methods.initializePool(new BN(currentGameId))
            .accountsPartial({
                pool: poolPda,
                houseWallet: houseWalletPubkey,
            })
            .rpc();

        console.log("Novo pool criado! Game ID:", currentGameId);
        return { gameId: currentGameId, poolPda: poolPda.toBase58() };
    } catch (err) {
        console.error("Error creating pool:", err);
    }
}

export async function settleGame(winnerColor: "cyan" | "magenta") {
    if (!currentPoolPda || !program) return;

    console.log(`Settling game for winner: ${winnerColor}`);
    const color = winnerColor === "cyan" ? { cyan: {} } : { magenta: {} };

    // Save settled pool info FIRST (before async RPC) so claim can work immediately
    lastSettledPool = {
        poolPda: currentPoolPda,
        winner: winnerColor
    };
    console.log("Saved last settled pool:", lastSettledPool.poolPda.toBase58(), "winner:", winnerColor);

    try {
        await program.methods.settleGame(color)
            .accountsPartial({
                pool: currentPoolPda,
                houseWallet: houseWalletPubkey,
                authority: backendWallet.publicKey,
            })
            .rpc();

        console.log(winnerColor.toUpperCase() + " venceu! Pool settled.");
    } catch (err) {
        console.error("Error settling game:", err);
        // Keep lastSettledPool even on error so users can still try to claim
    }
}

// Export function to get last settled pool for claims
export function getLastSettledPool() {
    if (!lastSettledPool) return null;
    return {
        poolPda: lastSettledPool.poolPda.toBase58(),
        winner: lastSettledPool.winner
    };
}
