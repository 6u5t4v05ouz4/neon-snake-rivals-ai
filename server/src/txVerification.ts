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
    // Layout: [8 discriminator][1 byte Color enum][8 bytes u64 amount] = 17 bytes
    if (data.length < 17) return null;
    if (!data.subarray(0, 8).equals(PLACE_BET_DISCRIMINATOR)) return null;

    const sideByte = data[8];
    const side = sideByte === 0 ? "cyan" as const : sideByte === 1 ? "magenta" as const : null;
    if (!side) return null;

    const amountLamports = data.readBigUInt64LE(9);
    return { side, amountLamports };
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
        return { valid: false, error: "Failed to fetch transaction from chain" };
    }

    if (!tx) return { valid: false, error: "Transaction not found" };
    if (tx.meta?.err) return { valid: false, error: "Transaction failed on-chain" };

    const accountKeys = tx.transaction.message.accountKeys;
    const instructions = tx.transaction.message.instructions;

    for (const ix of instructions) {
        const programId = accountKeys[ix.programIdIndex];
        if (!programId.equals(PROGRAM_ID)) continue;

        const data = Buffer.from(ix.data, "base64");
        const parsed = parsePlaceBetInstruction(data);
        if (!parsed) continue;

        // IDL accounts: pool(0), user_bet(1), user/signer(2), system_program(3)
        const poolKey = accountKeys[ix.accounts[0]];
        const userKey = accountKeys[ix.accounts[2]];

        if (!poolKey.equals(new PublicKey(expectedPoolPda))) {
            return { valid: false, error: "Transaction pool does not match" };
        }
        if (!userKey.equals(new PublicKey(expectedWallet))) {
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

    const accountKeys = tx.transaction.message.accountKeys;
    const instructions = tx.transaction.message.instructions;

    for (const ix of instructions) {
        const programId = accountKeys[ix.programIdIndex];
        if (!programId.equals(PROGRAM_ID)) continue;

        const data = Buffer.from(ix.data, "base64");
        if (data.length < 8 || !data.subarray(0, 8).equals(CLAIM_WINNINGS_DISCRIMINATOR)) continue;

        // IDL accounts: pool(0), user/signer(1), user_bet(2), system_program(3)
        const poolKey = accountKeys[ix.accounts[0]];
        const userKey = accountKeys[ix.accounts[1]];

        if (!poolKey.equals(new PublicKey(expectedPoolPda))) {
            return { valid: false, error: "Claim transaction is for a different pool" };
        }
        if (!userKey.equals(new PublicKey(expectedWallet))) {
            return { valid: false, error: "Claim transaction signer does not match wallet" };
        }

        return { valid: true };
    }

    return { valid: false, error: "No valid claimWinnings instruction found in transaction" };
}
