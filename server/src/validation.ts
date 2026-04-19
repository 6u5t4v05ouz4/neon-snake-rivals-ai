import { z } from 'zod';

// Solana public keys are 32-44 characters base58
const solanaAddressSchema = z.string().min(32).max(44);

// Transaction signatures are 88 characters base58
const txSignatureSchema = z.string().min(80).max(100);

export const registerBetSchema = z.object({
    poolPda: solanaAddressSchema,
    walletAddress: solanaAddressSchema,
    side: z.enum(['cyan', 'magenta']),
    amount: z.number().positive().max(100, "Bet amount too large"),
    txSignature: txSignatureSchema
});

export const markClaimedSchema = z.object({
    poolPda: solanaAddressSchema,
    walletAddress: solanaAddressSchema,
    claimTxSignature: txSignatureSchema.optional(),
});

export type RegisterBetInput = z.infer<typeof registerBetSchema>;
export type MarkClaimedInput = z.infer<typeof markClaimedSchema>;
