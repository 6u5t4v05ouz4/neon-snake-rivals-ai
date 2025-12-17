<div align="center">

# 🐍 SNAKE SOL ARENA
### Autonomous AI Crypto Battle

![Solana](https://img.shields.io/badge/Solana-Devnet-BF40BF?style=for-the-badge&logo=solana)
![Status](https://img.shields.io/badge/Status-Live-green?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Autonomous-cyan?style=for-the-badge)

</div>

## 🌌 About The Project

**Snake Sol Arena** is a cutting-edge **Autonomous AI eSport** where algorithmically controlled snakes battle for survival and dominance. Built on the **Solana Blockchain**, it allows users to spectate these high-speed logic battles and place real-time cryptocurrency bets on the outcome.

Unlike traditional games where you play, here you **invest** in the AI agent you believe has the superior positioning and logic. The system uses a provably fair betting pool mechanism with automated Market Maker liquidity.

> **Note:** This project is Open Source for **educational and showcase purposes only**. It serves as a portfolio piece demonstrating complex full-stack blockchain integration. 
> **© All Rights Reserved.** Replicating or launching a commercial clone of this specific codebase is not permitted without authorization.

---

## 🚀 Key Features

### 🤖 Autonomous AI Agents
- Two distinct AI entities (**CYAN** vs **MAGENTA**) competing in a 20x20 neon grid.
- Advanced pathfinding algorithms avoid collisions, trap opponents, and optimize food consumption.
- Fully server-authoritative state ensures integrity.

### 💸 Real-Time Solana Betting
- **Non-Custodial Betting**: Connect your Phantom wallet and bet directly on the Solana Devnet.
- **Smart Contract Logic**: Betting pools are managed on-chain via Anchor programs.
- **Instant Settlements**: Winnings are calculated and claimable seconds after the game ends.

### 🏦 Intelligent Market Maker (MM)
- **Dual-Wallet Hedging**: A sophisticated MM bot operates with two distinct wallets to bypass contract limitations.
- **60/40 Strategy**: The MM automatically balances the pool by taking the contrarian side (60%) while hedging (40%) to mitigate risk.
- **Auto-Claiming**: The system automatically claims MM winnings to recycle liquidity for future rounds.

### 📊 Advanced Analytics
- **Live Profile Stats**: Track your Win Rate, Net Profit (SOL), Total Bets, and Biggest Win in real-time.
- **Game History**: Detailed logs of previous matches and outcomes.
- **Visual Feedback**: Dynamic UI showing pool distribution and odds.

---

## 🛠️ Technology Stack

High-performance architecture built for speed and reliability.

| Component | Technology |
|-----------|------------|
| **Frontend** | React 19, Vite, TailwindCSS, Lucide React, Framer Motion |
| **Blockchain** | Solana Web3.js, Anchor Framework, Wallet Adapter |
| **Backend** | Node.js, Express, TypeScript |
| **Realtime** | Socket.IO (60 FPS Game Loop) |
| **Database** | PostgreSQL, Prisma ORM |
| **Hosting** | Vercel (Frontend), Railway (Backend & DB) |

---

## 🎮 How It Works

1.  **Countdown Phase**: A 15-second window opens before each match. A new betting pool is created on-chain.
2.  **Place Your Bet**: Users select a side (CYAN or MAGENTA) and sign a transaction (Min: 0.005 SOL).
3.  **Battle Commences**: Betting closes. The AIs execute their logic on the server.
4.  **Game Over**: The winner is determined (First to 25 points or opponent crash).
5.  **Settlement**: The server triggers the smart contract to settle the pool based on the winner.
6.  **Claim**: Winners can instantly claim their share of the pool directly to their wallet.

---

<div align="center">
  <p><i>Building the future of decentralized autonomous gaming.</i></p>
</div>
