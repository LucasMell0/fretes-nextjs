import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CotacaoService } from '@/lib/services/cotacao.service'

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
  const startTime = Date.now()
  
  try {
    const { token } = params

    // 1. Validar token e obter integração
    const integracao = await prisma.usuarioIntegracaoCanal.findUnique({
      where: { token },
      include: {
        usuario: true,
        canal: true,
      },
    })

    if (!integracao || !integracao.ativo) {
      await salvarLog(null, request, 401, 'Invalid or inactive token', Date.now() - startTime)
      return NextResponse.json(
        { error: 'Invalid or inactive token' },
        { status: 401 }
      )
    }

    // 2. Parse e validar input
    const body = await request.json()
    const validationError = validateInput(body)
    
    if (validationError) {
      await salvarLog(integracao.id, request, 400, validationError, Date.now() - startTime)
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      )
    }

    // 3. Extrair dados
    const cep = body.zipCode.replace(/\D/g, '')
    const marketplace = body.marketplace || 'Anymarket'

    // 4. Buscar produtos por SKU
    const skus = body.products.map((p: any) => p.sku)
    const produtos = await prisma.produto.findMany({
      where: {
        sku: { in: skus },
        ativo: true,
      },
    })

    // Mapear SKU -> ID
    const skuToId = new Map(produtos.map(p => [p.sku, p.id]))

    // Montar array de produtos para cotação
    const produtosParaCotar = body.products
      .filter((p: any) => skuToId.has(p.sku))
      .map((p: any) => ({
        produto_id: skuToId.get(p.sku)!,
        quantidade: parseInt(p.amount || '1'),
      }))

    // 5. Se não encontrou produtos, retornar vazio
    if (produtosParaCotar.length === 0) {
      const response = { items: [] }
      await salvarLog(integracao.id, request, 200, response, Date.now() - startTime)
      return NextResponse.json(response)
    }

    // 6. Realizar cotação
    const cotacaoService = new CotacaoService()
    const cotacoes = await cotacaoService.cotar(cep, produtosParaCotar)

    // 7. Formatar resposta no padrão Anymarket
    const response = formatarResposta(cotacoes)

    // 8. Salvar log da cotação
    await cotacaoService.salvarLogCotacao(
      cep,
      produtosParaCotar,
      cotacoes,
      'API',
      marketplace,
      integracao.usuario_id
    )

    // 9. Salvar log da requisição
    await salvarLog(integracao.id, request, 200, response, Date.now() - startTime)

    // 10. Atualizar estatísticas da integração
    await prisma.usuarioIntegracaoCanal.update({
      where: { id: integracao.id },
      data: {
        ultimaRequisicao: new Date(),
        totalRequisicoes: { increment: 1 },
      },
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('Erro no endpoint Anymarket:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Validar entrada
function validateInput(data: any): string | null {
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
function formatarResposta(cotacoes: any[]) {
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
    if (cot.prazo < maisRapido.prazo) {
      maisRapido = cot
    }
  }

  const items = []

  // Adicionar mais barato como NORMAL
  items.push({
    serviceName: maisBarato.regiao_nome || 'Transporte Terrestre',
    carrierName: maisBarato.transportadora_nome,
    deliveryTime: maisBarato.prazo,
    price: parseFloat(maisBarato.valor_frete.toFixed(2)),
    freightType: 'NORMAL',
  })

  // Adicionar mais rápido como EXPRESSA (apenas se diferente do mais barato)
  if (maisRapido.transportadora_id !== maisBarato.transportadora_id) {
    items.push({
      serviceName: maisRapido.regiao_nome || 'Transporte Expresso',
      carrierName: maisRapido.transportadora_nome,
      deliveryTime: maisRapido.prazo,
      price: parseFloat(maisRapido.valor_frete.toFixed(2)),
      freightType: 'EXPRESSA',
    })
  }

  return { items }
}

// Salvar log da requisição
async function salvarLog(
  integracaoId: number | null,
  request: NextRequest,
  statusCode: number,
  responseBody: any,
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
        headers: Object.fromEntries(request.headers),
        ipOrigem: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        statusCode,
        responseBody,
        tempoProcessamentoMs: tempoMs,
      },
    })
  } catch (error) {
    console.error('Erro ao salvar log:', error)
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
