import { PublicKey } from "@solana/web3.js";
import { connection } from "./solana";

const PROGRAM_ID = new PublicKey("4Mw572DpPh5UWWx9ic4sZBtG8UJRBujJPXrE2pcwvBzw");

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

function parsePlaceBetData(data: Buffer): { side: "cyan" | "magenta"; amountLamports: bigint } | null {
    if (data.length < 17) return null;
    if (!data.subarray(0, 8).equals(PLACE_BET_DISCRIMINATOR)) return null;
    const sideByte = data[8];
    const side = sideByte === 0 ? "cyan" as const : sideByte === 1 ? "magenta" as const : null;
    if (!side) return null;
    return { side, amountLamports: data.readBigUInt64LE(9) };
}

function extractAccountIndices(ix: any): number[] {
    // Try all possible field names for account indices
    if (Array.isArray(ix.accountIndices)) return Array.from(ix.accountIndices);
    if (ix.accountIndices instanceof Uint8Array) return Array.from(ix.accountIndices);
    if (Array.isArray(ix.accounts)) return Array.from(ix.accounts);
    if (ix.accounts instanceof Uint8Array) return Array.from(ix.accounts);
    return [];
}

function extractProgramIdIndex(ix: any): number {
    return ix.programIdIndex ?? ix.programId ?? -1;
}

function extractData(ix: any): Buffer {
    if (typeof ix.data === "string") return Buffer.from(ix.data, "base64");
    if (ix.data instanceof Uint8Array || Buffer.isBuffer(ix.data)) return Buffer.from(ix.data);
    return Buffer.alloc(0);
}

function getAllKeys(tx: any): PublicKey[] {
    const msg = tx.transaction.message;
    try {
        // Try v0: staticAccountKeys + loadedAddresses
        const staticKeys = msg.staticAccountKeys;
        const loaded = tx.meta?.loadedAddresses;
        if (Array.isArray(staticKeys) && staticKeys.length > 0) {
            const writable = loaded?.writable || [];
            const readonly = loaded?.readonly || [];
            if (writable.length || readonly.length) {
                return [...staticKeys, ...writable, ...readonly];
            }
            return staticKeys;
        }
    } catch {}
    try {
        // Legacy: accountKeys
        if (Array.isArray(msg.accountKeys)) return msg.accountKeys;
    } catch {}
    return [];
}

function getAllInstructions(tx: any): any[] {
    const msg = tx.transaction.message;
    // compiledInstructions (v0) take priority
    if (Array.isArray(msg.compiledInstructions) && msg.compiledInstructions.length > 0) {
        return msg.compiledInstructions;
    }
    if (Array.isArray(msg.instructions) && msg.instructions.length > 0) {
        return msg.instructions;
    }
    return [];
}

export async function verifyBetTransaction(params: BetVerificationParams): Promise<VerificationResult> {
    const { txSignature, expectedPoolPda, expectedWallet, expectedSide, expectedAmountLamports } = params;

    try {
        const tx = await connection.getTransaction(txSignature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });

        if (!tx) return { valid: false, error: "Transaction not found" };
        if (tx.meta?.err) return { valid: false, error: "Transaction failed on-chain" };

        const accountKeys = getAllKeys(tx);
        const instructions = getAllInstructions(tx);

        console.log("txVerification: keys=", accountKeys.length, "instructions=", instructions.length,
            "firstIxKeys=", Object.keys(instructions[0] || {}));

        for (const ix of instructions) {
            const progIdx = extractProgramIdIndex(ix);
            const programId = accountKeys[progIdx];
            if (!programId || !programId.equals(PROGRAM_ID)) continue;

            const data = extractData(ix);
            const parsed = parsePlaceBetData(data);
            if (!parsed) continue;

            const indices = extractAccountIndices(ix);
            // IDL: pool(0), user_bet(1), user/signer(2), system_program(3)
            const poolKey = accountKeys[indices[0]];
            const userKey = accountKeys[indices[2]];

            if (!poolKey || !poolKey.equals(new PublicKey(expectedPoolPda))) {
                return { valid: false, error: "Transaction pool does not match" };
            }
            if (!userKey || !userKey.equals(new PublicKey(expectedWallet))) {
                return { valid: false, error: "Transaction signer does not match wallet" };
            }
            if (parsed.side !== expectedSide) {
                return { valid: false, error: "Transaction side does not match" };
            }
            const diff = Math.abs(Number(parsed.amountLamports) - expectedAmountLamports);
            if (diff > 1) {
                return { valid: false, error: "Transaction amount does not match" };
            }
            return { valid: true };
        }

        return { valid: false, error: "No valid placeBet instruction found in transaction" };
    } catch (e) {
        console.error("txVerification: unexpected error", e);
        return { valid: false, error: "Failed to verify transaction" };
    }
}

export async function verifyClaimTransaction(params: ClaimVerificationParams): Promise<VerificationResult> {
    const { txSignature, expectedPoolPda, expectedWallet } = params;

    try {
        const tx = await connection.getTransaction(txSignature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });

        if (!tx) return { valid: false, error: "Claim transaction not found" };
        if (tx.meta?.err) return { valid: false, error: "Claim transaction failed on-chain" };

        const accountKeys = getAllKeys(tx);
        const instructions = getAllInstructions(tx);

        for (const ix of instructions) {
            const progIdx = extractProgramIdIndex(ix);
            const programId = accountKeys[progIdx];
            if (!programId || !programId.equals(PROGRAM_ID)) continue;

            const data = extractData(ix);
            if (data.length < 8 || !data.subarray(0, 8).equals(CLAIM_WINNINGS_DISCRIMINATOR)) continue;

            const indices = extractAccountIndices(ix);
            // IDL: pool(0), user/signer(1), user_bet(2), system_program(3)
            const poolKey = accountKeys[indices[0]];
            const userKey = accountKeys[indices[1]];

            if (!poolKey || !poolKey.equals(new PublicKey(expectedPoolPda))) {
                return { valid: false, error: "Claim transaction is for a different pool" };
            }
            if (!userKey || !userKey.equals(new PublicKey(expectedWallet))) {
                return { valid: false, error: "Claim transaction signer does not match wallet" };
            }
            return { valid: true };
        }

        return { valid: false, error: "No valid claimWinnings instruction found in transaction" };
    } catch (e) {
        console.error("txVerification: unexpected claim error", e);
        return { valid: false, error: "Failed to verify claim transaction" };
    }
}
