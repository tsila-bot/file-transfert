//workers/WorkerPool.ts

interface Task {
    id: string;
    type: 'compress' | 'decompress';
    data: ArrayBuffer;
    resolve: (result: ArrayBuffer) => void;
    reject: (error: Error) => void;
}

export class WorkerPool {
    private workers: Worker[] = [];
    private availableWorkers: Set<Worker> = new Set();
    private taskQueue: Task[] = [];
    private pendingTasks: Map<string, Task> = new Map();
    private taskIdCounter = 0;
    private isTerminated = false;

    constructor(size?: number) {
        // ⚡ OPTIMIZATION: Increase worker pool to 8-12 for better parallelism
        const workerCount = size ?? Math.min(navigator.hardwareConcurrency ?? 4, 12);

        for (let i = 0; i < workerCount; i++) {
            try {
                const worker = new Worker(
                    new URL('../workers/compression.worker.ts', import.meta.url),
                    { type: 'module' }
                );

                worker.onmessage = (e: MessageEvent) => this.handleWorkerMessage(worker, e);
                worker.onerror = (e: ErrorEvent) => this.handleWorkerError(worker, e);

                this.workers.push(worker);
                this.availableWorkers.add(worker);
            } catch (error) {
                console.error(`Failed to create worker ${i}:`, error);
            }
        }

        if (this.workers.length === 0) {
            throw new Error('Failed to create any workers');
        }

        console.log(`✅ WorkerPool initialized with ${this.workers.length} workers`);
    }

    async compress(data: ArrayBuffer): Promise<ArrayBuffer> {
        if (this.isTerminated) {
            throw new Error('WorkerPool has been terminated');
        }
        return this.executeTask('compress', data);
    }

    async decompress(data: ArrayBuffer): Promise<ArrayBuffer> {
        if (this.isTerminated) {
            throw new Error('WorkerPool has been terminated');
        }
        return this.executeTask('decompress', data);
    }

    private async executeTask(type: 'compress' | 'decompress', data: ArrayBuffer): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const id = `task_${this.taskIdCounter++}`;
            const task: Task = { id, type, data, resolve, reject };

            // ⚡ CRITICAL FIX: Reduce timeout from 50-120s to 10-30s to prevent hanging
            // Previous: 50-120s was causing excessive delays and visible UI freezes
            // New: 10-30s with adaptive scaling for better responsiveness
            const basePriority = type === 'compress' ? 10000 : 8000; // Reduced from 50000/30000 ms
            const adaptiveTimeout = basePriority + (this.taskQueue.length * 100);
            const finalTimeout = Math.min(adaptiveTimeout, 30000); // Cap at 30s instead of 2 minutes

            const timeoutId = setTimeout(() => {
                if (this.pendingTasks.has(id)) {
                    console.error(`⏱️ Worker task timeout: ${type} - ${id} (waited ${finalTimeout}ms, queue: ${this.taskQueue.length}, available: ${this.availableWorkers.size})`);
                    this.pendingTasks.delete(id);
                    reject(new Error(`Worker task timeout after ${finalTimeout}ms: ${type}`));
                    this.processQueue();
                }
            }, finalTimeout);

            const wrappedResolve = (result: ArrayBuffer) => {
                clearTimeout(timeoutId);
                resolve(result);
            };

            const wrappedReject = (error: Error) => {
                clearTimeout(timeoutId);
                reject(error);
            };

            const wrappedTask = { ...task, resolve: wrappedResolve, reject: wrappedReject };

            const worker = this.getAvailableWorker();

            if (worker) {
                this.assignTaskToWorker(worker, wrappedTask);
            } else {
                this.taskQueue.push(wrappedTask);
                // Log queue pressure
                if (this.taskQueue.length % 10 === 0) {
                    console.warn(`⚠️ WorkerPool queue growing: ${this.taskQueue.length} tasks pending (${this.availableWorkers.size}/${this.workers.length} workers available)`);
                }
            }
        });
    }

    private getAvailableWorker(): Worker | null {
        const worker = this.availableWorkers.values().next().value;
        if (worker) {
            this.availableWorkers.delete(worker);
            return worker;
        }
        return null;
    }

    private assignTaskToWorker(worker: Worker, task: Task): void {
        this.pendingTasks.set(task.id, task);

        try {
            // ⚡ CRITICAL FIX: Create a DEEP copy of the buffer to prevent shared references
            // ArrayBuffer.slice(0) is unreliable - instead use proper copy
            const originalUint8 = new Uint8Array(task.data);
            const bufferCopy = new ArrayBuffer(originalUint8.byteLength);
            new Uint8Array(bufferCopy).set(originalUint8);
            
            // ✅ CRITICAL: Verify copy is complete BEFORE transfer
            if (bufferCopy.byteLength !== task.data.byteLength) {
              console.error(`❌ CRITICAL: Buffer copy size MISMATCH! Original: ${task.data.byteLength}, Copy: ${bufferCopy.byteLength}`);
              throw new Error(`Buffer copy failed - size mismatch`);
            }
            
            // ⚡ Only log 10% of chunks to reduce overhead
            if (Math.random() < 0.1) {
              console.log(`📤 WorkerPool[${task.id}]: ${task.type}, ${bufferCopy.byteLength} bytes`);
            }
            
            worker.postMessage(
                { id: task.id, type: task.type, data: bufferCopy },
                [bufferCopy]  // Transfer ownership to worker
            );
        } catch (error) {
            this.pendingTasks.delete(task.id);
            this.availableWorkers.add(worker);
            task.reject(error instanceof Error ? error : new Error('Failed to post message to worker'));
            this.processQueue();
        }
    }

    private handleWorkerMessage(worker: Worker, e: MessageEvent): void {
        const { id, result, error } = e.data;
        const task = this.pendingTasks.get(id);

        if (!task) {
            console.warn(`Received message for unknown task: ${id}`);
            return;
        }

        this.pendingTasks.delete(id);

        if (error) {
            task.reject(new Error(error));
        } else if (result) {
            task.resolve(result);
        } else {
            task.reject(new Error('No result from worker'));
        }

        this.availableWorkers.add(worker);
        this.processQueue();
    }

    private handleWorkerError(worker: Worker, e: ErrorEvent): void {
        console.error('Worker error:', e.message);

        const tasksToReject: Task[] = [];
        for (const [id, task] of this.pendingTasks.entries()) {
            tasksToReject.push(task);
            this.pendingTasks.delete(id);
        }

        for (const task of tasksToReject) {
            task.reject(new Error(`Worker error: ${e.message}`));
        }

        this.availableWorkers.add(worker);
        this.processQueue();
    }

    private processQueue(): void {
        while (this.taskQueue.length > 0 && this.availableWorkers.size > 0) {
            const task = this.taskQueue.shift();
            const worker = this.getAvailableWorker();

            if (task && worker) {
                this.assignTaskToWorker(worker, task);
            } else {
                if (task) this.taskQueue.unshift(task);
                break;
            }
        }
    }

    get size(): number {
        return this.workers.length;
    }

    get availableCount(): number {
        return this.availableWorkers.size;
    }

    get queueLength(): number {
        return this.taskQueue.length;
    }

    terminate(): void {
        if (this.isTerminated) return;

        this.isTerminated = true;

        for (const task of this.pendingTasks.values()) {
            task.reject(new Error('WorkerPool terminated'));
        }
        this.pendingTasks.clear();

        for (const task of this.taskQueue) {
            task.reject(new Error('WorkerPool terminated'));
        }
        this.taskQueue = [];

        for (const worker of this.workers) {
            worker.terminate();
        }

        this.workers = [];
        this.availableWorkers.clear();

        console.log('✅ WorkerPool terminated');
    }
}