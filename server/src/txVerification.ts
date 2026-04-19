import { Connection, PublicKey } from "@solana/web3.js";
import { connection } from "./solana";

const PROGRAM_ID = new PublicKey("4Mw572DpPh5UWWx9ic4sZBtG8UJRBujJPXrE2pcwvBzw");

// Discriminators from IDL
const PLACE_BET_DISCRIMINATOR = Buffer.from([222, 62, 67, 220, 63, 166, 126, 33]);
const CLAIM_WINNINGS_DISCRIMINATOR = Buffer.from([161, 215, 24, 59, 14, 236, 242, 221]);

export interface BetVerificationParams {
    txSignature: string;
    expectedPoolPda: string;
    expectedWallet: string;
    expectedSide: "cyan" | "magenta";
    expectedAmountLamports: number;
}

export interface ClaimVerificationParams {
    txSignature: string;
    expectedPoolPda: string;
    expectedWallet: string;
}

export interface VerificationResult {
    valid: boolean;
    error?: string;
}

function parsePlaceBetInstruction(data: Buffer): { side: "cyan" | "magenta"; amountLamports: bigint } | null {
    if (data.length < 17) return null;
    if (!data.subarray(0, 8).equals(PLACE_BET_DISCRIMINATOR)) return null;

    const sideByte = data[8];
    const side = sideByte === 0 ? "cyan" as const : sideByte === 1 ? "magenta" as const : null;
    if (!side) return null;

    const amountLamports = data.readBigUInt64LE(9);
    return { side, amountLamports };
}

function getAllAccountKeys(tx: any): PublicKey[] {
    const msg = tx.transaction.message;
    // v0 transactions: accountKeys is a MessageAccountKeys object with staticAccountKeys
    if (msg.accountKeys && Array.isArray(msg.accountKeys)) {
        return msg.accountKeys;
    }
    if (msg.staticAccountKeys && Array.isArray(msg.staticAccountKeys)) {
        const loaded = tx.meta?.loadedAddresses;
        if (loaded) {
            const writable = loaded.writable || [];
            const readonly = loaded.readonly || [];
            return [...msg.staticAccountKeys, ...writable, ...readonly];
        }
        return msg.staticAccountKeys;
    }
    // Fallback: try to get accountKeys as-is
    if (typeof msg.accountKeys?.get === 'function') {
        const keys: PublicKey[] = [];
        for (let i = 0; i < (msg.accountKeys.length || 0); i++) {
            keys.push(msg.accountKeys.get(i));
        }
        return keys;
    }
    return msg.accountKeys || [];
}

export async function verifyBetTransaction(params: BetVerificationParams): Promise<VerificationResult> {
    const { txSignature, expectedPoolPda, expectedWallet, expectedSide, expectedAmountLamports } = params;

    let tx: any;
    try {
        tx = await connection.getTransaction(txSignature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });
    } catch (e) {
        console.error("txVerification: fetch error", e);
        return { valid: false, error: "Failed to fetch transaction from chain" };
    }

    if (!tx) return { valid: false, error: "Transaction not found" };
    if (tx.meta?.err) return { valid: false, error: "Transaction failed on-chain" };

    const accountKeys = getAllAccountKeys(tx);
    const instructions = tx.transaction.message.instructions;
    const compiledInstructions = tx.transaction.message.compiledInstructions;

    const allInstructions = compiledInstructions || instructions;

    for (const ix of allInstructions) {
        const programIdIdx = ix.programIdIndex ?? ix.programId;
        const programId = accountKeys[programIdIdx];
        if (!programId || !programId.equals(PROGRAM_ID)) continue;

        const data = Buffer.from(ix.data, "base64");
        const parsed = parsePlaceBetInstruction(data);
        if (!parsed) continue;

        const accountIndices = ix.accounts ?? ix.accountIndices;
        // IDL accounts: pool(0), user_bet(1), user/signer(2), system_program(3)
        const poolKey = accountKeys[accountIndices[0]];
        const userKey = accountKeys[accountIndices[2]];

        if (!poolKey || !poolKey.equals(new PublicKey(expectedPoolPda))) {
            return { valid: false, error: "Transaction pool does not match" };
        }
        if (!userKey || !userKey.equals(new PublicKey(expectedWallet))) {
            return { valid: false, error: "Transaction signer does not match wallet" };
        }
        if (parsed.side !== expectedSide) {
            return { valid: false, error: "Transaction side does not match" };
        }

        // Allow ±1 lamport tolerance for float rounding
        const diff = Math.abs(Number(parsed.amountLamports) - expectedAmountLamports);
        if (diff > 1) {
            return { valid: false, error: "Transaction amount does not match" };
        }

        return { valid: true };
    }

    // Debug: log what we found
    console.log("txVerification: no placeBet found. accountKeys count:", accountKeys.length,
        "instructions:", allInstructions.length,
        "programs:", allInstructions.map((ix: any) => {
            const idx = ix.programIdIndex ?? ix.programId;
            return accountKeys[idx]?.toBase58?.() ?? "unknown";
        }));

    return { valid: false, error: "No valid placeBet instruction found in transaction" };
}

export async function verifyClaimTransaction(params: ClaimVerificationParams): Promise<VerificationResult> {
    const { txSignature, expectedPoolPda, expectedWallet } = params;

    let tx: any;
    try {
        tx = await connection.getTransaction(txSignature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });
    } catch (e) {
        return { valid: false, error: "Failed to fetch claim transaction from chain" };
    }

    if (!tx) return { valid: false, error: "Claim transaction not found" };
    if (tx.meta?.err) return { valid: false, error: "Claim transaction failed on-chain" };

    const accountKeys = getAllAccountKeys(tx);
    const instructions = tx.transaction.message.instructions;
    const compiledInstructions = tx.transaction.message.compiledInstructions;

    const allInstructions = compiledInstructions || instructions;

    for (const ix of allInstructions) {
        const programIdIdx = ix.programIdIndex ?? ix.programId;
        const programId = accountKeys[programIdIdx];
        if (!programId || !programId.equals(PROGRAM_ID)) continue;

        const data = Buffer.from(ix.data, "base64");
        if (data.length < 8 || !data.subarray(0, 8).equals(CLAIM_WINNINGS_DISCRIMINATOR)) continue;

        const accountIndices = ix.accounts ?? ix.accountIndices;
        // IDL accounts: pool(0), user/signer(1), user_bet(2), system_program(3)
        const poolKey = accountKeys[accountIndices[0]];
        const userKey = accountKeys[accountIndices[1]];

        if (!poolKey || !poolKey.equals(new PublicKey(expectedPoolPda))) {
            return { valid: false, error: "Claim transaction is for a different pool" };
        }
        if (!userKey || !userKey.equals(new PublicKey(expectedWallet))) {
            return { valid: false, error: "Claim transaction signer does not match wallet" };
        }

        return { valid: true };
    }

    return { valid: false, error: "No valid claimWinnings instruction found in transaction" };
}
