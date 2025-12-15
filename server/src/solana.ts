import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import fs from "fs";
import path from "path";

// Config
const PROGRAM_ID = new PublicKey("4Mw572DpPh5UWWx9ic4sZBtG8UJRBujJPXrE2pcwvBzw");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// Helpers to load wallet
function loadWallet() {
    try {
        const keypairPath = process.env.BACKEND_WALLET || path.resolve("backend-keypair.json");
        if (!fs.existsSync(keypairPath)) {
            console.log("Generating new backend wallet...");
            const kp = Keypair.generate();
            fs.writeFileSync(keypairPath, JSON.stringify(Array.from(kp.secretKey)));
            return kp;
        }
        const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
        return Keypair.fromSecretKey(secretKey);
    } catch (e) {
        console.error("Failed to load backend wallet:", e);
        return Keypair.generate(); // Fallback to avoid crash, but won't be able to sign real txs if no funds
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
    program = new anchor.Program(idl, PROGRAM_ID, provider);
} catch (e) {
    console.error("Failed to load IDL:", e);
}

let currentGameId = Date.now();
let currentPoolPda: PublicKey | null = null;

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
