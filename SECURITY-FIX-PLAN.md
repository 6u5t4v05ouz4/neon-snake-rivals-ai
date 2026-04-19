# Security Fix Plan

## Vulnerabilities to Fix

| # | Vulnerability | Severity | Status |
|---|---|---|---|
| 1 | `/register-bet` without on-chain tx verification | CRITICAL | Pending |
| 2 | Reward distribution to unverified bettors | CRITICAL | Fixed by #1 |
| 3 | `/mark-claimed` without ownership verification | HIGH | Pending |
| 4 | Chat impersonation (no wallet ownership proof) | MEDIUM | Mitigation |
| 5 | Admin key timing attack | LOW | Pending |
| 6 | House wallet balance exposure | MEDIUM | Intentional |

## Implementation

### New file: `server/src/txVerification.ts`
- `verifyBetTransaction()` — verifies placeBet tx on-chain
- `verifyClaimTransaction()` — verifies claimWinnings tx on-chain

### Modified files
- `server/src/index.ts` — verify bets/claims, timing-safe admin, IP chat rate limit
- `server/src/validation.ts` — add claimTxSignature to markClaimedSchema
- `server/src/rewardDistributor.ts` — transparency comment

## IDL Reference
- place_bet discriminator: `[222,62,67,220,63,166,126,33]`
- claim_winnings discriminator: `[161,215,24,59,14,236,242,221]`
- place_bet accounts: pool(0), user_bet(1), user/signer(2), system_program(3)
- place_bet args: side (1 byte: 0=Cyan, 1=Magenta), amount (u64 LE 8 bytes)
- Instruction data: [8 discriminator][1 side][8 amount] = 17 bytes
