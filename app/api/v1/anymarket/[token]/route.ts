import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CotacaoService, CotacaoError } from '@/lib/services/cotacao.service'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

/**
 * API de Cotação de Frete - Anymarket
 * 
 * Endpoint: POST /api/v1/anymarket/{token}
 * 
 * Request:
 * {
 *   "zipCode": "87100000",
 *   "marketplace": "Mercado Livre",
 *   "products": [
 *     {
 *       "sku": "A1512",
 *       "height": 10,
 *       "width": 20,
 *       "weight": 20,
 *       "length": 20,
 *       "amount": 1,
 *       "value": 149.90
 *     }
 *   ]
 * }
 * 
 * Response:
 * {
 *   "items": [
 *     {
 *       "serviceName": "Transporte Terrestre",
 *       "carrierName": "Transportadora X",
 *       "deliveryTime": 12,
 *       "price": 23.99,
 *       "freightType": "NORMAL"
 *     }
 *   ]
 * }
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const inicio = Date.now()
  let integracao: { id: number; ativo: boolean; usuarioId: number; usuario: Record<string, unknown>; canal: Record<string, unknown> } | null = null
  const cotacaoService = new CotacaoService()

  try {
    // Rate limiting por token: 60 requisições por minuto
    const rateLimitResponse = rateLimitMiddleware(request, {
      maxRequests: 60,
      windowSeconds: 60,
      identifier: params.token // Rate limit por token específico
    })

    if (rateLimitResponse) {
      logger.warn(`Rate limit excedido para token ${params.token}`)
      return rateLimitResponse
    }

    const { token } = params

    // 1. Validar token e obter integração
    integracao = await prisma.usuarioIntegracaoCanal.findUnique({
      where: { token },
      include: {
        usuario: true,
        canal: true,
      },
    })

    if (!integracao || !integracao.ativo) {
      await salvarLog(null, request, 401, 'Invalid or inactive token', Date.now() - inicio)
      return NextResponse.json(
        { error: 'Invalid or inactive token' },
        { status: 401 }
      )
    }

    // 2. Parse e validar input
    const body = await request.json()
    const validationError = validateInput(body)
    
    if (validationError) {
      await salvarLog(integracao.id, request, 400, validationError, Date.now() - inicio)
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      )
    }

    // 3. Extrair dados
    const cep = body.zipCode.replace(/\D/g, '')
    const marketplace = body.marketplace || 'Anymarket'

    // 4. Montar array de produtos para cotação usando SKU
    const produtosParaCotar = body.products.map((p: { sku: string; amount?: string; value?: number }) => ({
      sku: p.sku,
      quantidade: parseInt(p.amount || '1'),
      valor: p.value || 0,
    }))

    // 5. Realizar cotação (com isolamento multi-tenant)
    const { cotacoes, erros } = await cotacaoService.cotar(cep, produtosParaCotar, integracao.usuarioId)

    // 6. Formatar resposta no padrão Anymarket
    const response = formatarResposta(cotacoes)

    // 7. Medir tempo de resposta
    const tempoTotal = Date.now() - inicio

    // 8. Salvar logs em background (não bloqueia a resposta)
    Promise.all([
      cotacaoService.salvarLogCotacao(
        cep, produtosParaCotar, cotacoes, 'API', marketplace,
        integracao.usuarioId, undefined, undefined, tempoTotal, erros
      ),
      salvarLog(integracao.id, request, 200, response, tempoTotal),
      prisma.usuarioIntegracaoCanal.update({
        where: { id: integracao.id },
        data: {
          ultimaRequisicao: new Date(),
          totalRequisicoes: { increment: 1 },
        },
      }),
    ]).catch(err => logger.error('Erro ao salvar logs:', err))

    return NextResponse.json(response)

  } catch (error) {
    if (error instanceof CotacaoError && integracao) {
      const body = await request.clone().json().catch(() => ({}))
      const skus = (body.products || []).map((p: { sku: string }) => p.sku)

      await cotacaoService.registrarAuditoria({
        tipo: error.tipo,
        descricao: error.message,
        detalhes: error.detalhes,
        cep: body.zipCode?.replace(/\D/g, ''),
        skus,
        origem: 'API',
        marketplace: body.marketplace || 'Anymarket',
        integracaoId: integracao.id,
        usuarioId: integracao.usuarioId,
      })

      const tempoProcessamento = Date.now() - inicio
      await salvarLog(integracao.id, request, 400, { error: error.message, tipo: error.tipo }, tempoProcessamento)

      // Anymarket espera { items: [] } quando não há cotação
      return NextResponse.json({ items: [], error: error.message })
    }

    logger.error('Erro no endpoint Anymarket:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Validar entrada
function validateInput(data: Record<string, unknown>): string | null {
  if (!data.zipCode) {
    return 'zipCode is required'
  }

  if (!data.products || !Array.isArray(data.products)) {
    return 'products array is required'
  }

  for (let i = 0; i < data.products.length; i++) {
    const prod = data.products[i]
    if (!prod.sku) {
      return `Product at index ${i} is missing sku`
    }
  }

  return null
}

// Formatar resposta no padrão Anymarket
function formatarResposta(cotacoes: Array<{ transportadora_id: number; transportadora_nome: string; valor_frete: number; prazo_entrega: number; regiao_nome?: string }>) {
  if (!cotacoes || cotacoes.length === 0) {
    return { items: [] }
  }

  // Encontrar mais barato (NORMAL) e mais rápido (EXPRESSA)
  let maisBarato = cotacoes[0]
  let maisRapido = cotacoes[0]

  for (const cot of cotacoes) {
    if (cot.valor_frete < maisBarato.valor_frete) {
      maisBarato = cot
    }
    if (cot.prazo_entrega < maisRapido.prazo_entrega) {
      maisRapido = cot
    }
  }

  const items = []

  // Adicionar mais barato como NORMAL
  items.push({
    serviceName: maisBarato.regiao_nome || 'Transporte Terrestre',
    carrierName: maisBarato.transportadora_nome,
    deliveryTime: maisBarato.prazo_entrega,
    price: parseFloat(maisBarato.valor_frete.toFixed(2)),
    freightType: 'NORMAL',
  })

  // Adicionar mais rápido como EXPRESSA (apenas se diferente do mais barato)
  if (maisRapido.transportadora_id !== maisBarato.transportadora_id) {
    items.push({
      serviceName: maisRapido.regiao_nome || 'Transporte Expresso',
      carrierName: maisRapido.transportadora_nome,
      deliveryTime: maisRapido.prazo_entrega,
      price: parseFloat(maisRapido.valor_frete.toFixed(2)),
      freightType: 'EXPRESSA',
    })
  }

  return { items }
}

// Filtrar headers sensíveis antes de salvar no banco
const SAFE_HEADERS = ['content-type', 'content-length', 'user-agent', 'x-forwarded-for', 'x-real-ip', 'accept', 'origin', 'referer']

function filterSafeHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(
    [...headers.entries()].filter(([key]) => SAFE_HEADERS.includes(key.toLowerCase()))
  )
}

// Salvar log da requisição
async function salvarLog(
  integracaoId: number | null,
  request: NextRequest,
  statusCode: number,
  responseBody: unknown,
  tempoMs: number
) {
  try {
    if (!integracaoId) return

    await prisma.integracaoLog.create({
      data: {
        usuarioCanalId: integracaoId,
        metodo: 'POST',
        endpoint: request.nextUrl.pathname,
        queryParams: Object.fromEntries(request.nextUrl.searchParams),
        body: await request.clone().json().catch(() => null),
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

// CORS headers
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
