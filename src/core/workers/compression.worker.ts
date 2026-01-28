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
        
        // 🔍 DEBUG: Log input size to detect corruption
        if (uint8Data.byteLength === 131072 || uint8Data.byteLength < 1000) {
          console.log(`🔧 Worker[${id}]: Received ${type} task, input size: ${uint8Data.byteLength} bytes`);
        }

        if (type === 'compress') {
            const compressed = await new Promise<Uint8Array>((resolve, reject) => {
                // ⚡ OPTIMIZATION: Compression level 4 instead of 6 for faster compression
                compress(uint8Data, { level: 4 }, (err, result) => {
                    if (err) reject(err);
                    else {
                      // 🔍 DEBUG: Log if output is suspiciously small
                      if (result.byteLength === 177 || result.byteLength < 1000) {
                        console.error(`⚠️ Worker[${id}]: Compression output SUSPICIOUS: ${result.byteLength} bytes (input: ${uint8Data.byteLength})`);
                      }
                      resolve(result);
                    }
                });
            });

            // 🔴 CRITICAL FIX: Create a proper copy to prevent buffer detachment issues
            // When using `.buffer`, it can reference the original backing store
            const resultCopy = new ArrayBuffer(compressed.byteLength);
            new Uint8Array(resultCopy).set(new Uint8Array(compressed));
            
            // ✅ Validate copy was successful
            if (resultCopy.byteLength !== compressed.byteLength) {
              console.error(`❌ CRITICAL: Compression result copy failed! Original: ${compressed.byteLength}, Copy: ${resultCopy.byteLength}`);
              throw new Error(`Compression result copy size mismatch`);
            }

            const response: WorkerResponse = { id, result: resultCopy };
            self.postMessage(response, [resultCopy]);  // Transfer the copied buffer

        } else if (type === 'decompress') {
            const decompressed = await new Promise<Uint8Array>((resolve, reject) => {
                decompress(uint8Data, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            // 🔴 CRITICAL FIX: Create a proper copy for decompression too
            const resultCopy = new ArrayBuffer(decompressed.byteLength);
            new Uint8Array(resultCopy).set(new Uint8Array(decompressed));
            
            // ✅ Validate copy was successful
            if (resultCopy.byteLength !== decompressed.byteLength) {
              console.error(`❌ CRITICAL: Decompression result copy failed! Original: ${decompressed.byteLength}, Copy: ${resultCopy.byteLength}`);
              throw new Error(`Decompression result copy size mismatch`);
            }

            const response: WorkerResponse = { id, result: resultCopy };
            self.postMessage(response, [resultCopy]);  // Transfer the copied buffer
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const response: WorkerResponse = { id, error: errorMessage };
        self.postMessage(response);
    }
};