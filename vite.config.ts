import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      nodePolyfills(),
    ],
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@solana/codecs-strings': path.resolve(__dirname, 'node_modules/@solana/codecs-strings/dist/index.browser.cjs'),
      }
    },
    optimizeDeps: {
      include: [
        '@solana/wallet-adapter-react',
        '@solana/wallet-adapter-react-ui',
        '@solana/wallet-adapter-wallets',
        '@solana/web3.js',
        '@coral-xyz/anchor',
        'buffer'
      ]
    }
  };
});
