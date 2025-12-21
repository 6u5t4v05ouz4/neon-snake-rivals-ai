import React from 'react';
import { X, Gamepad2, Coins, Trophy, Clock, Wallet, HelpCircle } from 'lucide-react';

interface HowItWorksProps {
    isOpen: boolean;
    onClose: () => void;
}

const HowItWorks: React.FC<HowItWorksProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <HelpCircle className="text-indigo-400" size={24} />
                        How It Works
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Game Section */}
                    <section>
                        <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2 mb-3">
                            <Gamepad2 size={20} />
                            The Game
                        </h3>
                        <ul className="space-y-2 text-slate-300 text-sm">
                            <li>• Two AI-controlled snakes battle autonomously</li>
                            <li>• <span className="text-cyan-400 font-semibold">CYAN</span> vs <span className="text-fuchsia-400 font-semibold">MAGENTA</span></li>
                            <li>• First snake to reach <strong className="text-yellow-400">25 points</strong> wins the round</li>
                            <li>• Snakes earn points by eating food</li>
                            <li>• If a snake hits a wall or another snake, it loses</li>
                        </ul>
                    </section>

                    {/* Betting Section */}
                    <section>
                        <h3 className="text-lg font-semibold text-green-400 flex items-center gap-2 mb-3">
                            <Coins size={20} />
                            Betting
                        </h3>
                        <ul className="space-y-2 text-slate-300 text-sm">
                            <li>• Connect your Solana wallet (Phantom recommended)</li>
                            <li>• Minimum bet: <strong className="text-yellow-400">0.005 SOL</strong></li>
                            <li>• Place bets during the <strong className="text-indigo-400">countdown</strong> before each round</li>
                            <li>• Choose CYAN or MAGENTA to win</li>
                            <li>• Use quick bet buttons: 0.005, 0.01, 0.1, or 1 SOL</li>
                        </ul>
                    </section>

                    {/* Winnings Section */}
                    <section>
                        <h3 className="text-lg font-semibold text-yellow-400 flex items-center gap-2 mb-3">
                            <Trophy size={20} />
                            Winnings
                        </h3>
                        <ul className="space-y-2 text-slate-300 text-sm">
                            <li>• If your snake wins, you share the prize pool!</li>
                            <li>• Payout is <strong>proportional</strong> to your bet amount</li>
                            <li>• Less people on winning side = higher payout</li>
                            <li>• <strong className="text-red-400">3% house fee</strong> is deducted from pool</li>
                            <li>• Click "CLAIM" after winning to receive SOL</li>
                        </ul>
                    </section>

                    {/* Timing Section */}
                    <section>
                        <h3 className="text-lg font-semibold text-orange-400 flex items-center gap-2 mb-3">
                            <Clock size={20} />
                            Timing
                        </h3>
                        <ul className="space-y-2 text-slate-300 text-sm">
                            <li>• New betting pool opens after each round</li>
                            <li>• You have <strong className="text-indigo-400">15 seconds</strong> to place bets</li>
                            <li>• Bets are locked once the game starts</li>
                            <li>• Claim winnings anytime after your snake wins</li>
                        </ul>
                    </section>

                    {/* Wallet Section */}
                    <section>
                        <h3 className="text-lg font-semibold text-purple-400 flex items-center gap-2 mb-3">
                            <Wallet size={20} />
                            Wallet
                        </h3>
                        <ul className="space-y-2 text-slate-300 text-sm">
                            <li>• Currently on <strong className="text-yellow-400">Solana Devnet</strong></li>
                            <li>• Get free Devnet SOL from faucets for testing</li>
                            <li>• Make sure wallet is set to Devnet network</li>
                        </ul>
                    </section>

                    {/* AI Intelligence Section */}
                    <section>
                        <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2 mb-3">
                            🧠 AI Intelligence
                        </h3>
                        <p className="text-slate-400 text-sm mb-3">
                            Both snakes use advanced AI with multiple strategies:
                        </p>
                        <ul className="space-y-2 text-slate-300 text-sm">
                            <li>• <strong className="text-cyan-300">2-Move Lookahead</strong> - Simulates future moves before deciding</li>
                            <li>• <strong className="text-cyan-300">Trap Detection</strong> - Avoids dead ends by checking 2-3 moves ahead</li>
                            <li>• <strong className="text-yellow-300">Rival Prediction</strong> - Predicts where opponent will move next</li>
                            <li>• <strong className="text-yellow-300">Speed Awareness</strong> - Calculates who is faster based on score</li>
                            <li>• <strong className="text-green-400">Food Interception</strong> - Estimates time to reach food vs rival</li>
                            <li>• <strong className="text-red-400">Collision Avoidance</strong> - Heavy penalty for head-to-head positions</li>
                        </ul>
                        <p className="text-slate-500 text-xs mt-3 italic">
                            Snakes adapt strategy based on speed advantage and rival position!
                        </p>
                    </section>

                    {/* Footer */}
                    <div className="pt-4 border-t border-slate-700 text-center">
                        <p className="text-slate-500 text-xs">
                            🎮 Good luck and have fun betting on AI snakes! 🐍
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HowItWorks;
