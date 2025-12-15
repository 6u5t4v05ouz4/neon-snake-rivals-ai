import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import fs from "fs";
import path from "path";

// Config
const PROGRAM_ID = new PublicKey("4Mw572DpPh5UWWx9ic4sZBtG8UJRBujJPXrE2pcwvBzw");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

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
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(backendWallet), { commitment: "confirmed" });
anchor.setProvider(provider);

// Load IDL
const idlPath = path.resolve("idl/snake_betting.json");
let program: anchor.Program;
try {
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
    program = new anchor.Program(idl as anchor.Idl, provider);
} catch (e) {
    console.error("Failed to load IDL:", e);
}

let currentGameId = Date.now();
let currentPoolPda: PublicKey | null = null;

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
                houseWallet: backendWallet.publicKey,
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

    try {
        await program.methods.settleGame(color)
            .accountsPartial({
                pool: currentPoolPda,
                houseWallet: backendWallet.publicKey,
                authority: backendWallet.publicKey,
            })
            .rpc();

        console.log(winnerColor.toUpperCase() + " venceu! Pool settled.");
        currentPoolPda = null; // Reset
    } catch (err) {
        console.error("Error settling game:", err);
    }
}
