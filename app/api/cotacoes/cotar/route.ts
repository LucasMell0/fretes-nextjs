import { NextResponse } from 'next/server'
import { cotacaoService, CotacaoError } from '@/lib/services/cotacao.service'
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
  let dadosValidados: z.infer<typeof cotacaoSchema> | null = null

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

    dadosValidados = validation.data
    const { cep, produtos, origem } = dadosValidados

    // 1. Realizar cotação COM filtro de usuário (apenas suas transportadoras/produtos)
    const resultados = await cotacaoService.cotar(cep, produtos, userId)

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
    if (error instanceof CotacaoError) {
      // Registrar na auditoria
      await cotacaoService.registrarAuditoria({
        tipo: error.tipo,
        descricao: error.message,
        detalhes: error.detalhes,
        cep: dadosValidados?.cep?.replace(/\D/g, ''),
        skus: dadosValidados?.produtos?.map(p => p.sku) || [],
        origem: dadosValidados?.origem || 'MANUAL',
        usuarioId: userId,
      })

      const status = error.tipo === 'CEP_NAO_ATENDIDO' ? 404 : 400
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: error.message,
          tipo_erro: error.tipo,
          detalhes: error.detalhes,
        },
        { status }
      )
    }

    logger.error('Erro ao processar cotação:', error)

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: 'Erro ao processar cotação',
      },
      { status: 500 }
    )
  }
})
