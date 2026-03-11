import { NextRequest, NextResponse } from 'next/server'
import { cotacaoService } from '@/lib/services/cotacao.service'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const produtoSchema = z.object({
  sku: z.string(),
  quantidade: z.number().int().positive(),
  valor: z.number().optional(),
})

const cotacaoSchema = z.object({
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  produtos: z.array(produtoSchema).min(1, 'Pelo menos um produto é necessário'),
  origem: z.string().optional().default('API'),
  marketplace: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 20 requisições por minuto
    const rateLimitResponse = rateLimitMiddleware(request, {
      maxRequests: 20,
      windowSeconds: 60
    })
    
    if (rateLimitResponse) {
      logger.warn('Rate limit excedido em /api/v1/cotacao')
      return rateLimitResponse
    }

    const body = await request.json()
    
    const validation = cotacaoSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: 'Dados inválidos',
          erros: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { cep, produtos, origem, marketplace } = validation.data

    const resultados = await cotacaoService.cotar(cep, produtos)

    if (resultados.length === 0) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: 'Nenhuma transportadora encontrada para este CEP',
          cotacoes: [],
          total_transportadoras: 0,
        },
        { status: 404 }
      )
    }

    const ipOrigem = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    await cotacaoService.salvarLogCotacao(
      cep,
      produtos,
      resultados,
      origem,
      marketplace,
      undefined,
      ipOrigem,
      userAgent
    )

    return NextResponse.json(
      {
        sucesso: true,
        cotacoes: resultados,
        melhor_cotacao: resultados[0],
        total_transportadoras: resultados.length,
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('Erro ao processar cotação:', error)
    
    return NextResponse.json(
      {
        sucesso: false,
        mensagem: 'Erro ao processar cotação',
        erro: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      mensagem: 'API de Cotação de Fretes',
      versao: '1.0',
      metodo: 'POST',
      endpoint: '/api/v1/cotacao',
      documentacao: {
        body: {
          cep: 'string (formato: 00000-000)',
          produtos: [
            {
              sku: 'string',
              quantidade: 'number (inteiro positivo)',
              valor: 'number (opcional)',
            },
          ],
          origem: 'string (opcional, padrão: API)',
          marketplace: 'string (opcional)',
        },
      },
    },
    { status: 200 }
  )
}
