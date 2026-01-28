/// <reference lib="webworker" />

import { compress, decompress } from 'fflate';

/**
 * Force TypeScript à utiliser l'API Web Worker
 * (et non Window.postMessage)
 */
const ctx = self as unknown as DedicatedWorkerGlobalScope;

interface WorkerMessage {
  id: string;
  type: 'compress' | 'decompress';
  data: ArrayBuffer;
}

interface WorkerResponse {
  id: string;
  result?: ArrayBufferLike;
  error?: string;
}

ctx.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = e.data;

  try {
    const uint8Data = new Uint8Array(data);

    // 🔍 DEBUG: détecter corruption ou tailles anormales
    if (uint8Data.byteLength === 131072 || uint8Data.byteLength < 1000) {
      console.log(`🔧 Worker[${id}]: ${type} input size = ${uint8Data.byteLength} bytes`);
    }

    if (type === 'compress') {
      const compressed = await new Promise<Uint8Array>((resolve, reject) => {
        compress(uint8Data, { level: 4 }, (err, result) => {
          if (err) reject(err);
          else {
            if (result.byteLength === 177 || result.byteLength < 1000) {
              console.error(`⚠️ Worker[${id}]: suspicious compressed size = ${result.byteLength}`);
            }
            resolve(result);
          }
        });
      });

      /**
       * CRITICAL:
       * on crée une copie propre pour éviter
       * les problèmes de buffer détaché
       */
      const resultCopy = new ArrayBuffer(compressed.byteLength);
      new Uint8Array(resultCopy).set(compressed);

      if (resultCopy.byteLength !== compressed.byteLength) {
        throw new Error(
          `Compression copy failed (${compressed.byteLength} → ${resultCopy.byteLength})`
        );
      }

      const response: WorkerResponse = {
        id,
        result: resultCopy,
      };

      // ✅ Transferable OK
      ctx.postMessage(response, [resultCopy]);
    } else if (type === 'decompress') {
      const decompressed = await new Promise<Uint8Array>((resolve, reject) => {
        decompress(uint8Data, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const resultCopy = new ArrayBuffer(decompressed.byteLength);
      new Uint8Array(resultCopy).set(decompressed);

      if (resultCopy.byteLength !== decompressed.byteLength) {
        throw new Error(
          `Decompression copy failed (${decompressed.byteLength} → ${resultCopy.byteLength})`
        );
      }

      const response: WorkerResponse = {
        id,
        result: resultCopy,
      };

      // ✅ Transferable OK
      ctx.postMessage(response, [resultCopy]);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown worker error';

    const response: WorkerResponse = {
      id,
      error: errorMessage,
    };

    ctx.postMessage(response);
  }
};
