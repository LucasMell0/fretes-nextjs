/**
 * Cache em memória com TTL e deduplicação de requests simultâneos
 * Evita queries repetitivas e cache stampede em alta concorrência
 */
class MemoryCache {
  private cache = new Map<string, { data: unknown; expiresAt: number }>()
  private pending = new Map<string, Promise<unknown>>()

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

  /**
   * Busca no cache ou executa a função. Se já houver uma request
   * pendente para a mesma chave, espera o resultado dela (sem duplicar query).
   */
  async getOrFetch<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T> {
    // 1. Já no cache?
    const cached = this.get<T>(key)
    if (cached) return cached

    // 2. Já tem uma request pendente para essa chave? Espera ela.
    const pendingRequest = this.pending.get(key)
    if (pendingRequest) {
      return pendingRequest as Promise<T>
    }

    // 3. Primeira request: executa e compartilha o resultado
    const promise = fetchFn().then(result => {
      this.set(key, result, ttlSeconds)
      this.pending.delete(key)
      return result
    }).catch(err => {
      this.pending.delete(key)
      throw err
    })

    this.pending.set(key, promise)
    return promise
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
