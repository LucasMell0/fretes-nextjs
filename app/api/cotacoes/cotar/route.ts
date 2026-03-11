import { NextRequest, NextResponse } from 'next/server'
import { cotacaoService } from '@/lib/services/cotacao.service'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/auth'

const produtoSchema = z.object({
  sku: z.string(),
  quantidade: z.number().int().positive(),
  valor: z.number().optional(),
})

const cotacaoSchema = z.object({
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  produtos: z.array(produtoSchema).min(1, 'Pelo menos um produto é necessário'),
  origem: z.string().optional().default('MANUAL'),
})

/**
 * API AUTENTICADA de cotação - Salva com usuarioId correto
 * Usada pela página /dashboard/cotacao
 */
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    
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

    const { cep, produtos, origem } = validation.data

    // 1. Realizar cotação COM filtro de usuário (apenas suas transportadoras/produtos)
    const resultados = await cotacaoService.cotar(cep, produtos, userId)

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

    const ipOrigem = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // 2. Salvar log COM usuarioId (IMPORTANTE!)
    await cotacaoService.salvarLogCotacao(
      cep,
      produtos,
      resultados,
      origem,
      undefined, // marketplace
      userId,    // ✅ PASSA userId aqui!
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
})
