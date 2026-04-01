/**
 * Rate Limiter simples usando Map em memória
 * 
 * Para produção com múltiplas instâncias, considere usar:
 * - Upstash Redis (@upstash/ratelimit)
 * - Vercel KV
 * - Redis tradicional
 */

import { NextRequest, NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Armazena contadores em memória
const limitMap = new Map<string, RateLimitEntry>()

// Limpa entradas expiradas a cada 1 minuto
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of limitMap.entries()) {
    if (now > entry.resetAt) {
      limitMap.delete(key)
    }
  }
}, 60000)

export interface RateLimitConfig {
  /**
   * Número máximo de requisições permitidas
   * @default 10
   */
  maxRequests?: number
  
  /**
   * Janela de tempo em segundos
   * @default 60 (1 minuto)
   */
  windowSeconds?: number
  
  /**
   * Identificador customizado (ex: API key, user ID)
   * Se não fornecido, usa IP do cliente
   */
  identifier?: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Verifica rate limit para uma requisição
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = {}
): RateLimitResult {
  const {
    maxRequests = 10,
    windowSeconds = 60,
    identifier
  } = config

  // Identificador: custom > IP (apenas x-real-ip que deve ser setado pelo proxy) > fallback
  // NOTA: x-forwarded-for é facilmente spoofável pelo cliente.
  // x-real-ip deve ser setado pelo reverse proxy (nginx/Coolify) e é mais confiável.
  const key = identifier ||
    request.headers.get('x-real-ip') ||
    request.ip ||
    'global-fallback'

  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const entry = limitMap.get(key)

  // Primeira requisição ou janela expirada
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs
    limitMap.set(key, { count: 1, resetAt })
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: Math.floor(resetAt / 1000)
    }
  }

  // Dentro da janela de tempo
  if (entry.count < maxRequests) {
    entry.count++
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - entry.count,
      reset: Math.floor(entry.resetAt / 1000)
    }
  }

  // Limite excedido
  return {
    success: false,
    limit: maxRequests,
    remaining: 0,
    reset: Math.floor(entry.resetAt / 1000)
  }
}

/**
 * Middleware de rate limiting
 * Retorna response 429 se limite excedido, ou null se OK
 */
export function rateLimitMiddleware(
  request: NextRequest,
  config: RateLimitConfig = {}
): NextResponse | null {
  const result = checkRateLimit(request, config)

  // Headers de rate limit (padrão RateLimit HTTP)
  const headers = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  }

  if (!result.success) {
    const retryAfter = result.reset - Math.floor(Date.now() / 1000)
    
    return NextResponse.json(
      {
        erro: 'Muitas requisições',
        mensagem: `Limite de ${result.limit} requisições por ${config.windowSeconds || 60} segundos excedido`,
        retry_after: retryAfter
      },
      {
        status: 429,
        headers: {
          ...headers,
          'Retry-After': retryAfter.toString()
        }
      }
    )
  }

  // Sucesso - retorna null para continuar processamento
  // Headers podem ser adicionados na response final se necessário
  return null
}

/**
 * Helper para adicionar headers de rate limit a uma response existente
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.reset.toString())
  
  return response
}
