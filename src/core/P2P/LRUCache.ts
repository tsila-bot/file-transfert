// lib/p2p/LRUCache.ts

export class LRUCache<K, V> {
    private cache = new Map<K, V>();
    private maxSize: number;
    private hits = 0;
    private misses = 0;

    constructor(maxSize: number) {
        if (maxSize <= 0) {
            throw new Error('Cache size must be greater than 0');
        }
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        if (!this.cache.has(key)) {
            this.misses++;
            return undefined;
        }

        this.hits++;
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);

        return value;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        this.cache.set(key, value);

        if (this.cache.size > this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    get size(): number {
        return this.cache.size;
    }

    getStats(): { hits: number; misses: number; hitRate: number; size: number } {
        const total = this.hits + this.misses;
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            size: this.cache.size,
        };
    }
}