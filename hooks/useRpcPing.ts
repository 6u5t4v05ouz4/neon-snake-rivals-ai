import { useState, useEffect } from 'react';
import { Connection } from '@solana/web3.js';

const RPC_PING_INTERVAL = 15000; // 15 seconds

export function useRpcPing(endpoint: string) {
    const [rpcPing, setRpcPing] = useState<number | null>(null);

    useEffect(() => {
        const connection = new Connection(endpoint);

        const measureLatency = async () => {
            try {
                const start = Date.now();
                await connection.getLatestBlockhash();
                const latency = Date.now() - start;
                setRpcPing(latency);
            } catch (error) {
                console.error('RPC ping failed:', error);
                setRpcPing(null);
            }
        };

        // Initial measurement
        measureLatency();

        // Periodic measurement every 15 seconds
        const interval = setInterval(measureLatency, RPC_PING_INTERVAL);

        return () => clearInterval(interval);
    }, [endpoint]);

    return rpcPing;
}

export default useRpcPing;
