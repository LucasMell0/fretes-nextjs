import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cotacaoService, CotacaoError } from '@/lib/services/cotacao.service'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { cache } from '@/lib/cache'

/**
 * API de Cotação de Frete - Casa Imperial Hub
 *
 * Endpoint: POST /api/v1/casa-imperial-hub/{token}
 *
 * Request:
 * {
 *   "cep": "01310100",
 *   "store_id": "str_xxx",
 *   "items": [
 *     {
 *       "sku": "A1512",
 *       "qty": 2,
 *       "price_cents": 49900,
 *       "weight_kg": 12.5,
 *       "length_cm": 80,
 *       "width_cm": 60,
 *       "height_cm": 40
 *     }
 *   ]
 * }
 *
 * Response (sucesso):
 * {
 *   "ok": true,
 *   "options": [
 *     { "id": "normal",   "name": "Transportadora X",  "price_cents": 4990, "eta_days": 7 },
 *     { "id": "expressa", "name": "Transportadora Y",  "price_cents": 8990, "eta_days": 3 }
 *   ]
 * }
 *
 * Response (erro):
 * { "ok": false, "error": "Fora da área de entrega" }
 */

const CANAL_NOME = 'Casa Imperial Hub'

interface CasaImperialItem {
  sku: string | number
  qty: number
  price_cents?: number
  weight_kg?: number
  length_cm?: number
  width_cm?: number
  height_cm?: number
}

interface CasaImperialRequest {
  cep: string
  store_id?: string
  items: CasaImperialItem[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const inicio = Date.now()
  let integracao: { id: number; ativo: boolean; usuarioId: number } | null = null
  let requestBody: CasaImperialRequest | null = null

  try {
    // Rate limiting por token: 60 requisições por minuto
    const rateLimitResponse = rateLimitMiddleware(request, {
      maxRequests: 60,
      windowSeconds: 60,
      identifier: params.token,
    })

    if (rateLimitResponse) {
      logger.warn(`Rate limit excedido para token ${params.token}`)
      return rateLimitResponse
    }

    const { token } = params

    // 1. Validar token (cache de 5min)
    const tokenCacheKey = `token:${token}`
    integracao = await cache.get(tokenCacheKey)
    if (!integracao) {
      integracao = await prisma.usuarioIntegracaoCanal.findUnique({
        where: { token },
        select: { id: true, ativo: true, usuarioId: true },
      })
      if (integracao) {
        cache.set(tokenCacheKey, integracao, 300).catch(() => {})
      }
    }

    if (!integracao || !integracao.ativo) {
      await salvarLog(null, request, 401, { ok: false, error: 'Token inválido ou inativo' }, Date.now() - inicio)
      return NextResponse.json(
        { ok: false, error: 'Token inválido ou inativo' },
        { status: 401 }
      )
    }

    // 2. Parse e validar input
    const body = await request.json() as CasaImperialRequest
    requestBody = body
    const validationError = validateInput(body)

    if (validationError) {
      await salvarLog(integracao.id, request, 400, { ok: false, error: validationError }, Date.now() - inicio, body)
      return NextResponse.json(
        { ok: false, error: validationError },
        { status: 400 }
      )
    }

    // 3. Extrair dados
    const cep = String(body.cep).replace(/\D/g, '')
    // marketplace fica como o nome do canal; store_id segue rastreável no body do request log
    const marketplace = CANAL_NOME

    // 4. Mapear items → produtos do serviço de cotação (price_cents → reais)
    const produtosParaCotar = body.items.map((i) => ({
      sku: String(i.sku),
      quantidade: Number(i.qty) || 1,
      valor: i.price_cents != null ? Number(i.price_cents) / 100 : 0,
    }))

    // 5. Realizar cotação (multi-tenant)
    const { cotacoes, erros, produtosDB } = await cotacaoService.cotar(cep, produtosParaCotar, integracao.usuarioId)

    // 6. Formatar resposta no contrato Casa Imperial
    const response = formatarResposta(cotacoes)
    const statusEnviado = response.ok ? 200 : 200 // contrato sempre 200, ok=false dentro do body

    const tempoTotal = Date.now() - inicio

    // 7. Logs em background
    Promise.all([
      cotacaoService.salvarLogCotacao(
        cep, produtosParaCotar, cotacoes, 'API', marketplace,
        integracao.usuarioId, undefined, undefined, tempoTotal, erros,
        { casaImperialResponse: response, statusEnviado, tempoMs: tempoTotal },
        produtosDB
      ),
      salvarLog(integracao.id, request, statusEnviado, response, tempoTotal, body),
      prisma.usuarioIntegracaoCanal.update({
        where: { id: integracao.id },
        data: {
          ultimaRequisicao: new Date(),
          totalRequisicoes: { increment: 1 },
        },
      }),
    ]).catch(err => logger.error('Erro ao salvar logs:', err))

    return NextResponse.json(response, {
      headers: { 'X-Response-Time': `${tempoTotal}ms` },
    })

  } catch (error) {
    if (error instanceof CotacaoError && integracao) {
      const skus = (requestBody?.items || []).map(i => String(i.sku))

      await cotacaoService.registrarAuditoria({
        tipo: error.tipo,
        descricao: error.message,
        detalhes: error.detalhes,
        cep: requestBody?.cep ? String(requestBody.cep).replace(/\D/g, '') : '',
        skus,
        origem: 'API',
        marketplace: CANAL_NOME,
        integracaoId: integracao.id,
        usuarioId: integracao.usuarioId,
      })

      const tempoProcessamento = Date.now() - inicio
      const errorBody = { ok: false, error: error.message }
      await salvarLog(integracao.id, request, 200, errorBody, tempoProcessamento, requestBody)
      return NextResponse.json(errorBody)
    }

    logger.error(`Erro no endpoint ${CANAL_NOME}:`, error)

    return NextResponse.json(
      { ok: false, error: 'Erro interno' },
      { status: 500 }
    )
  }
}

// ───────── Helpers ─────────

function validateInput(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'body inválido'
  const d = data as Record<string, unknown>

  if (!d.cep || (typeof d.cep !== 'string' && typeof d.cep !== 'number')) {
    return 'campo "cep" é obrigatório'
  }

  if (!Array.isArray(d.items) || d.items.length === 0) {
    return 'campo "items" é obrigatório (array não vazio)'
  }

  for (let i = 0; i < d.items.length; i++) {
    const it = d.items[i] as Record<string, unknown>
    if (it == null || (typeof it.sku !== 'string' && typeof it.sku !== 'number')) {
      return `items[${i}] sem "sku"`
    }
    if (typeof it.qty !== 'number' || it.qty <= 0) {
      return `items[${i}].qty deve ser número positivo`
    }
  }

  return null
}

type CotacaoResultado = {
  transportadora_id: number
  transportadora_nome: string
  valor_frete: number
  prazo_entrega: number
  regiao_nome?: string
}

type Option = {
  id: string
  name: string
  price_cents: number
  eta_days: number
}

type ResponseSuccess = { ok: true; options: Option[] }
type ResponseError = { ok: false; error: string }
type Response = ResponseSuccess | ResponseError

function formatarResposta(cotacoes: CotacaoResultado[]): Response {
  if (!cotacoes || cotacoes.length === 0) {
    return { ok: false, error: 'Sem cotação disponível para o CEP/produtos informados' }
  }

  // Mais barato e mais rápido (mesmo critério da integração Anymarket)
  let maisBarato = cotacoes[0]
  let maisRapido = cotacoes[0]
  for (const cot of cotacoes) {
    if (cot.valor_frete < maisBarato.valor_frete) maisBarato = cot
    if (cot.prazo_entrega < maisRapido.prazo_entrega) maisRapido = cot
  }

  const options: Option[] = [{
    id: 'normal',
    name: maisBarato.transportadora_nome,
    price_cents: Math.round(maisBarato.valor_frete * 100),
    eta_days: maisBarato.prazo_entrega,
  }]

  if (maisRapido.transportadora_id !== maisBarato.transportadora_id) {
    options.push({
      id: 'expressa',
      name: maisRapido.transportadora_nome,
      price_cents: Math.round(maisRapido.valor_frete * 100),
      eta_days: maisRapido.prazo_entrega,
    })
  }

  return { ok: true, options }
}

const SAFE_HEADERS = ['content-type', 'content-length', 'user-agent', 'x-forwarded-for', 'x-real-ip', 'accept', 'origin', 'referer']

function filterSafeHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(
    [...headers.entries()].filter(([key]) => SAFE_HEADERS.includes(key.toLowerCase()))
  )
}

async function salvarLog(
  integracaoId: number | null,
  request: NextRequest,
  statusCode: number,
  responseBody: unknown,
  tempoMs: number,
  parsedBody?: unknown
) {
  try {
    if (!integracaoId) return

    await prisma.integracaoLog.create({
      data: {
        usuarioCanalId: integracaoId,
        metodo: 'POST',
        endpoint: request.nextUrl.pathname,
        queryParams: Object.fromEntries(request.nextUrl.searchParams),
        body: parsedBody ? JSON.parse(JSON.stringify(parsedBody)) : null,
        headers: filterSafeHeaders(request.headers),
        ipOrigem: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        statusCode,
        responseBody: JSON.parse(JSON.stringify(responseBody)),
        tempoProcessamentoMs: tempoMs,
      },
    })
  } catch (error) {
    logger.error('Erro ao salvar log:', error)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
