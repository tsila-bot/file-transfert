// lib/p2p/ChunkStorageOPFS.ts

export class ChunkStorageOPFS {
    private root: FileSystemDirectoryHandle | null = null;
    private initialized = false;
    private readonly STORAGE_DIR = 'p2p-chunks';

    async init(): Promise<void> {
        if (this.initialized) return;

        try {
            if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
                throw new Error('OPFS not supported');
            }

            this.root = await navigator.storage.getDirectory();

            try {
                await this.root.getDirectoryHandle(this.STORAGE_DIR);
            } catch {
                await this.root.getDirectoryHandle(this.STORAGE_DIR, { create: true });
            }

            this.initialized = true;
            console.log('✅ OPFS storage initialized');
        } catch (error) {
            console.warn('⚠️ OPFS initialization failed:', error);
            throw error;
        }
    }

    async writeChunk(index: number, data: ArrayBuffer): Promise<void> {
        if (!this.initialized || !this.root) {
            throw new Error('Storage not initialized');
        }

        try {
            const chunksDir = await this.root.getDirectoryHandle(this.STORAGE_DIR);
            const fileHandle = await chunksDir.getFileHandle(`chunk_${index}.bin`, { create: true });
            const writable = await fileHandle.createWritable();

            await writable.write(data);
            await writable.close();
        } catch (error) {
            throw new Error(`Failed to write chunk ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async readChunk(index: number): Promise<ArrayBuffer> {
        if (!this.initialized || !this.root) {
            throw new Error('Storage not initialized');
        }

        try {
            const chunksDir = await this.root.getDirectoryHandle(this.STORAGE_DIR);
            const fileHandle = await chunksDir.getFileHandle(`chunk_${index}.bin`);
            const file = await fileHandle.getFile();
            return await file.arrayBuffer();
        } catch (error) {
            throw new Error(`Failed to read chunk ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async deleteChunk(index: number): Promise<void> {
        if (!this.initialized || !this.root) {
            return;
        }

        try {
            const chunksDir = await this.root.getDirectoryHandle(this.STORAGE_DIR);
            await chunksDir.removeEntry(`chunk_${index}.bin`);
        } catch (error) {
            console.warn(`Failed to delete chunk ${index}:`, error);
        }
    }

    async cleanup(): Promise<void> {
        if (!this.initialized || !this.root) {
            return;
        }

        try {
            await this.root.removeEntry(this.STORAGE_DIR, { recursive: true });
            this.initialized = false;
            console.log('✅ OPFS storage cleaned up');
        } catch (error) {
            console.warn('⚠️ OPFS cleanup failed:', error);
        }
    }

    isSupported(): boolean {
        return 'storage' in navigator && 'getDirectory' in navigator.storage;
    }
}