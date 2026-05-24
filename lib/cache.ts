/**
 * Cache distribuído via Redis (com fallback em memória se Redis cair).
 *
 * - API é async (Promise) — todos os callers usam await.
 * - Em caso de erro de conexão com Redis, cai pra MemoryCache local
 *   (mesma instância do processo, sem sync entre workers — mas mantém
 *   a app funcional). Re-tenta Redis a cada 30s.
 *
 * Config: REDIS_URL no .env (default: redis://localhost:6379)
 */

import Redis from 'ioredis'

// ---------- Fallback em memória ----------
class MemoryCache {
  private map = new Map<string, { data: unknown; expiresAt: number }>()
  get<T>(key: string): T | null {
    const e = this.map.get(key)
    if (!e) return null
    if (Date.now() > e.expiresAt) { this.map.delete(key); return null }
    return e.data as T
  }
  set(key: string, data: unknown, ttlSeconds: number): void {
    this.map.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 })
  }
  delete(key: string): void { this.map.delete(key) }
  invalidatePrefix(prefix: string): void {
    for (const k of this.map.keys()) if (k.startsWith(prefix)) this.map.delete(k)
  }
  clear(): void { this.map.clear() }
}

// Globals pra sobreviver hot reload em dev
const g = globalThis as unknown as {
  __cacheRedis: Redis | null | undefined
  __cacheMem: MemoryCache | undefined
  __cacheRedisFailed: boolean | undefined
}

const mem = g.__cacheMem ?? new MemoryCache()
g.__cacheMem = mem

function getRedis(): Redis | null {
  if (g.__cacheRedisFailed) return null
  if (g.__cacheRedis !== undefined) return g.__cacheRedis

  try {
    const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      reconnectOnError: () => false,
    })
    client.on('error', (err) => {
      if (!g.__cacheRedisFailed) {
        console.error('[cache] Redis error, caindo pra fallback:', err.message)
      }
      g.__cacheRedisFailed = true
      // Re-tenta em 30s
      setTimeout(() => {
        g.__cacheRedisFailed = false
        g.__cacheRedis = undefined
      }, 30_000).unref()
    })
    g.__cacheRedis = client
    return client
  } catch {
    g.__cacheRedis = null
    return null
  }
}

// ---------- API pública ----------
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const r = getRedis()
    if (!r) return mem.get<T>(key)
    try {
      const v = await r.get(key)
      return v ? (JSON.parse(v) as T) : null
    } catch {
      return mem.get<T>(key)
    }
  },

  async set(key: string, data: unknown, ttlSeconds: number): Promise<void> {
    const r = getRedis()
    if (!r) { mem.set(key, data, ttlSeconds); return }
    try {
      await r.set(key, JSON.stringify(data), 'EX', ttlSeconds)
    } catch {
      mem.set(key, data, ttlSeconds)
    }
  },

  async delete(key: string): Promise<void> {
    const r = getRedis()
    if (!r) { mem.delete(key); return }
    try {
      await r.del(key)
    } catch {
      mem.delete(key)
    }
  },

  /** Invalida todas chaves que começam com o prefixo (SCAN — não bloqueia o Redis). */
  async invalidatePrefix(prefix: string): Promise<void> {
    const r = getRedis()
    if (!r) { mem.invalidatePrefix(prefix); return }
    try {
      const stream = r.scanStream({ match: `${prefix}*`, count: 200 })
      const pipeline = r.pipeline()
      let hasKeys = false
      for await (const keys of stream as AsyncIterable<string[]>) {
        if (keys.length > 0) {
          hasKeys = true
          for (const k of keys) pipeline.del(k)
        }
      }
      if (hasKeys) await pipeline.exec()
    } catch {
      mem.invalidatePrefix(prefix)
    }
  },

  async clear(): Promise<void> {
    const r = getRedis()
    if (!r) { mem.clear(); return }
    try {
      await r.flushdb()
    } catch {
      mem.clear()
    }
  },
}

/**
 * Invalida o cache de produtos (e o cache de cotação derivado).
 */
export async function invalidateProdutoCache(usuarioId: number): Promise<void> {
  await Promise.all([
    cache.invalidatePrefix(`produtos:${usuarioId}:`),
    cache.invalidatePrefix(`cotacao:${usuarioId}:`),
  ])
}

/**
 * Invalida o cache de regiões/transportadoras (e o cache de cotação derivado).
 */
export async function invalidateRegiaoCache(usuarioId: number): Promise<void> {
  await Promise.all([
    cache.invalidatePrefix(`regioes:${usuarioId}:`),
    cache.invalidatePrefix(`cotacao:${usuarioId}:`),
  ])
}
