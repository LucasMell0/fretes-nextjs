/**
 * Cache em memória com TTL para dados que mudam pouco
 * Usado para evitar queries repetitivas no banco durante alta concorrência
 */
class MemoryCache {
  private cache = new Map<string, { data: unknown; expiresAt: number }>()

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return entry.data as T
  }

  set(key: string, data: unknown, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  /** Invalida todas as chaves que começam com o prefixo */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

// Singleton global (persiste entre requests no mesmo processo)
const globalForCache = globalThis as unknown as { memoryCache: MemoryCache | undefined }
export const cache = globalForCache.memoryCache ?? new MemoryCache()
globalForCache.memoryCache = cache
