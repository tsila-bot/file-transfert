// workers/compression.worker.ts
import { compress, decompress } from 'fflate';

interface WorkerMessage {
    id: string;
    type: 'compress' | 'decompress';
    data: ArrayBuffer;
}

interface WorkerResponse {
    id: string;
    result?: ArrayBufferLike; // Changé de ArrayBuffer à ArrayBufferLike
    error?: string;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { id, type, data } = e.data;

    try {
        const uint8Data = new Uint8Array(data);

        if (type === 'compress') {
            const compressed = await new Promise<Uint8Array>((resolve, reject) => {
                compress(uint8Data, { level: 6 }, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            const response: WorkerResponse = { id, result: compressed.buffer };
            // ✅ BUG #7 FIX: DON'T transfer buffer back - just send it (copy instead)
            // Transferring causes detached ArrayBuffer errors
            self.postMessage(response);

        } else if (type === 'decompress') {
            const decompressed = await new Promise<Uint8Array>((resolve, reject) => {
                decompress(uint8Data, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            const response: WorkerResponse = { id, result: decompressed.buffer };
            // ✅ BUG #7 FIX: DON'T transfer buffer back - just send it (copy instead)
            // Transferring causes detached ArrayBuffer errors
            self.postMessage(response);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const response: WorkerResponse = { id, error: errorMessage };
        self.postMessage(response);
    }
};