import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { BlingService, BlingWebhookEstoque, BlingWebhookEstoqueVirtual } from '@/lib/services/bling.service'

/**
 * API Webhook do Bling ERP - Atualização de Estoque
 * 
 * Endpoint: POST /api/v1/erp-bling/webhook/{token}
 * 
 * Recebe webhooks do Bling para:
 * - Atualização de estoque (created, updated, deleted)
 * - Atualização de estoque virtual
 * 
 * Payloads suportados:
 * 
 * 1. Estoque Created/Updated:
 * {
 *   "produto": { "id": 12345678 },
 *   "deposito": {
 *     "id": 12345678,
 *     "saldoFisico": 1250.75,
 *     "saldoVirtual": 1250.75
 *   },
 *   "operacao": "E",
 *   "quantidade": 25,
 *   "saldoFisicoTotal": 1500.75,
 *   "saldoVirtualTotal": 1500.75
 * }
 * 
 * 2. Estoque Deleted:
 * {
 *   "produto": { "id": 12345678 },
 *   "deposito": {
 *     "id": 12345678,
 *     "saldoFisico": 1250.75,
 *     "saldoVirtual": 1250.75
 *   },
 *   "saldoFisicoTotal": 1500.75,
 *   "saldoVirtualTotal": 1500.75
 * }
 * 
 * 3. Estoque Virtual Updated:
 * {
 *   "produto": { "id": 12345 },
 *   "saldoFisicoTotal": 150.75,
 *   "saldoVirtualTotal": 148.50,
 *   "vinculoComplexo": true,
 *   "depositos": [
 *     {
 *       "id": 1,
 *       "saldoFisico": 75.25,
 *       "saldoVirtual": 73.00
 *     }
 *   ]
 * }
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const inicio = Date.now()
  let integracao: any = null

  try {
    // Rate limiting por token: 100 requisições por minuto (webhooks podem ser frequentes)
    const rateLimitResponse = rateLimitMiddleware(request, {
      maxRequests: 100,
      windowSeconds: 60,
      identifier: params.token // Rate limit por token específico
    })
    
    if (rateLimitResponse) {
      logger.warn(`Rate limit excedido para webhook Bling token ${params.token}`)
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

    // Verificar se é canal Bling
    if (integracao.canal.slug !== 'erp-bling') {
      await salvarLog(integracao.id, request, 400, 'Invalid channel', Date.now() - inicio)
      return NextResponse.json(
        { error: 'This endpoint is only for Bling ERP' },
        { status: 400 }
      )
    }

    // 2. Parse e validar webhook payload
    const body = await request.json()
    
    if (!body.produto || !body.produto.id) {
      await salvarLog(integracao.id, request, 400, 'Invalid payload: missing produto.id', Date.now() - inicio)
      return NextResponse.json(
        { error: 'Invalid payload: missing produto.id' },
        { status: 400 }
      )
    }

    if (body.saldoVirtualTotal === undefined) {
      await salvarLog(integracao.id, request, 400, 'Invalid payload: missing saldoVirtualTotal', Date.now() - inicio)
      return NextResponse.json(
        { error: 'Invalid payload: missing saldoVirtualTotal' },
        { status: 400 }
      )
    }

    // 3. Verificar se integração está configurada com OAuth
    if (!integracao.accessToken || !integracao.refreshToken) {
      await salvarLog(integracao.id, request, 500, 'Bling integration not configured. Please connect your Bling account first.', Date.now() - inicio)
      return NextResponse.json(
        { error: 'Bling integration not configured. Please connect your Bling account in the integrations page.' },
        { status: 500 }
      )
    }

    // 4. Criar serviço Bling com OAuth tokens
    const blingService = new BlingService({ 
      apiKey: '', // Não usado com OAuth
      apiUrl: 'https://www.bling.com.br/Api/v3'
    })
    
    // Configurar tokens OAuth
    blingService.setTokens(
      integracao.accessToken,
      integracao.refreshToken,
      integracao.tokenExpiresAt || new Date(),
      integracao.id
    )

    // 5. Processar webhook
    const resultado = await blingService.processarWebhookEstoque(
      body as BlingWebhookEstoque | BlingWebhookEstoqueVirtual,
      integracao.usuarioId
    )

    // 6. Salvar log do webhook
    await salvarLog(integracao.id, request, 200, resultado, Date.now() - inicio)

    // 7. Atualizar estatísticas da integração
    await prisma.usuarioIntegracaoCanal.update({
      where: { id: integracao.id },
      data: {
        ultimaRequisicao: new Date(),
        totalRequisicoes: { increment: 1 },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      data: resultado
    })

  } catch (error) {
    logger.error('Erro no webhook Bling:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
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

    const body = await request.clone().json().catch(() => null)

    await prisma.integracaoLog.create({
      data: {
        usuarioCanalId: integracaoId,
        metodo: 'POST',
        endpoint: request.nextUrl.pathname,
        queryParams: Object.fromEntries(request.nextUrl.searchParams),
        body,
        headers: Object.fromEntries(request.headers),
        ipOrigem: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        statusCode,
        responseBody,
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
