/**
 * Wallet Manager Script
 * -----------------------
 * Verifica saldos e faz airdrop de SOL devnet para as wallets do projeto.
 * 
 * Uso:
 *   npx ts-node scripts/wallet-manager.ts balances
 *   npx ts-node scripts/wallet-manager.ts airdrop backend
 *   npx ts-node scripts/wallet-manager.ts airdrop cyan
 *   npx ts-node scripts/wallet-manager.ts airdrop magenta
 *   npx ts-node scripts/wallet-manager.ts airdrop house
 */

import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility - get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server folder manually (no dotenv dependency)
function loadEnv() {
    const envPath = path.resolve(__dirname, '../server/.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIndex = trimmed.indexOf('=');
                if (eqIndex > 0) {
                    const key = trimmed.substring(0, eqIndex).trim();
                    const value = trimmed.substring(eqIndex + 1).trim();
                    process.env[key] = value;
                }
            }
        });
        console.log('✅ Loaded environment from server/.env\n');
    } else {
        console.log('⚠️  No server/.env found, using existing environment\n');
    }
}

loadEnv();

const RPC_URL = 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

// Wallet configurations with hardcoded fallback addresses
interface WalletConfig {
    name: string;
    envKey: string;
    isKeypair: boolean;
    fallbackAddress?: string; // Used when env var not set
}

const WALLETS: WalletConfig[] = [
    { name: 'Backend', envKey: 'BACKEND_WALLET_KEY', isKeypair: true, fallbackAddress: 'FWU6iMCo6LP4jFw1EGom38qg5tCmPJvUXoWVS5EnAJk7' },
    { name: 'House', envKey: 'HOUSE_WALLET_ADDRESS', isKeypair: false, fallbackAddress: 'EBQ1uCdz9U77oEFjhieodHg6u7mLUJBFG511VHkdoqtv' },
    { name: 'MM Cyan', envKey: 'MM_WALLET_KEY', isKeypair: true, fallbackAddress: '2fiYVzJRLeGT94io4Yfh8yDRScxoiXigGMdDXVMC4wDS' },
    { name: 'MM Magenta', envKey: 'MM_WALLET_KEY_2', isKeypair: true, fallbackAddress: 'DdoF1f2ayRx351xfAX4DNKgDpJTc1MmD9hWP1XbCKFRo' },
];

function getPublicKey(config: WalletConfig): PublicKey | null {
    const envValue = process.env[config.envKey];

    // Try env var first
    if (envValue) {
        try {
            if (config.isKeypair) {
                const secretKey = Uint8Array.from(JSON.parse(envValue));
                const keypair = Keypair.fromSecretKey(secretKey);
                return keypair.publicKey;
            } else {
                return new PublicKey(envValue);
            }
        } catch (e) {
            console.log(`⚠️ ${config.name}: Failed to parse env var, using fallback`);
        }
    }

    // Use fallback address
    if (config.fallbackAddress) {
        return new PublicKey(config.fallbackAddress);
    }

    console.log(`⚠️  ${config.name}: No address available`);
    return null;
}

async function checkBalances() {
    console.log('🔍 Checking wallet balances on Devnet...\n');
    console.log('═'.repeat(70));

    for (const wallet of WALLETS) {
        const pubkey = getPublicKey(wallet);
        if (!pubkey) continue;

        try {
            const balance = await connection.getBalance(pubkey);
            const solBalance = (balance / LAMPORTS_PER_SOL).toFixed(4);
            const status = balance < 0.1 * LAMPORTS_PER_SOL ? '🔴 LOW' : '🟢 OK';

            console.log(`${wallet.name.padEnd(12)} │ ${pubkey.toBase58().slice(0, 24)}... │ ${solBalance.padStart(10)} SOL │ ${status}`);
        } catch (e) {
            console.log(`${wallet.name.padEnd(12)} │ Error fetching balance`);
        }
    }

    console.log('═'.repeat(70));
    console.log('\n💡 Use "airdrop <wallet>" to fund a wallet with 1 SOL devnet\n');
}

async function airdropToWallet(walletName: string) {
    const wallet = WALLETS.find(w => w.name.toLowerCase().includes(walletName.toLowerCase()));

    if (!wallet) {
        console.log(`❌ Wallet "${walletName}" not found. Available: backend, house, cyan, magenta`);
        return;
    }

    const pubkey = getPublicKey(wallet);
    if (!pubkey) {
        console.log(`❌ Cannot get public key for ${wallet.name}`);
        return;
    }

    console.log(`\n✈️  Requesting airdrop for ${wallet.name}...`);
    console.log(`   Address: ${pubkey.toBase58()}`);

    try {
        const signature = await connection.requestAirdrop(pubkey, 1 * LAMPORTS_PER_SOL);
        console.log(`   TX: ${signature}`);

        console.log('   Waiting for confirmation...');
        await connection.confirmTransaction(signature, 'confirmed');

        const newBalance = await connection.getBalance(pubkey);
        console.log(`\n✅ Airdrop successful! New balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
    } catch (e: any) {
        if (e.message?.includes('429')) {
            console.log('\n⚠️  Rate limited! Wait 30 seconds and try again.');
        } else {
            console.error('\n❌ Airdrop failed:', e.message || e);
        }
    }
}

// Main
async function main() {
    const command = process.argv[2];
    const arg = process.argv[3];

    switch (command) {
        case 'balances':
        case 'balance':
        case 'check':
            await checkBalances();
            break;
        case 'airdrop':
        case 'fund':
            if (!arg) {
                console.log('Usage: npx ts-node scripts/wallet-manager.ts airdrop <backend|house|cyan|magenta>');
                return;
            }
            await airdropToWallet(arg);
            break;
        default:
            console.log(`
Wallet Manager - Snake Sol Arena
================================

Commands:
  balances              Check all wallet balances
  airdrop <wallet>      Airdrop 1 SOL to a wallet

Wallets:
  backend               Backend wallet (creates pools, settles games)
  house                 House wallet (receives 3% fee)
  cyan                  Market Maker wallet for Cyan bets
  magenta               Market Maker wallet for Magenta bets

Examples:
  npx ts-node scripts/wallet-manager.ts balances
  npx ts-node scripts/wallet-manager.ts airdrop backend
  npx ts-node scripts/wallet-manager.ts airdrop cyan
            `);
    }
}

main().catch(console.error);
